// The screenshot scenes behind ?shot=start|play|alarm|win. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered
// by a small autopilot that walks waypoints and waits out a vision cone
// before crossing it — so the frame is what a short game really looks like
// and the same seed always gives the same frame. The alarm scene steers
// straight through a patrol instead, so a guard catches the thief out.
// Waypoints route through the rooms' doors: the left room leaves only at
// (3,7) and (3,11), the vault room only at (23,7) and (23,11).

import { STEP, TILE } from './config.js';
import { SCREEN_BUSTED, SCREEN_PLAY, SCREEN_WIN } from './render.js';

/** Waypoints in tile coordinates, walked in order. */
function tileWaypoints(list) {
  return list.map(([tx, ty]) => ({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE }));
}

/** True when the point is inside a guard's vision cone (angle + range). */
function inAnyCone(state, x, y) {
  for (const guard of state.guards) {
    const dx = x - guard.x;
    const dy = y - guard.y;
    if (Math.hypot(dx, dy) > 235) continue;
    let diff = Math.atan2(dy, dx) - guard.facing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) < 0.56) return true;
  }
  return false;
}

/** The nearest guard within `radius` of the thief, or null. */
function nearGuard(state, radius) {
  let best = null;
  let bestDist = radius;
  for (const guard of state.guards) {
    const d = Math.hypot(state.thief.x - guard.x, state.thief.y - guard.y);
    if (d < bestDist) {
      bestDist = d;
      best = guard;
    }
  }
  return best;
}

/**
 * One autopilot step: head for the current waypoint.
 * - cautious: sidestep out of a guard's cone instead of walking into it.
 * - reckless: walk straight on, but shove away from a guard that is close
 *   enough to grab the thief — spotted, chased, but not caught at once.
 */
function autopilotStep(state, waypoints, index, mode) {
  const thief = state.thief;
  const target = waypoints[Math.min(index, waypoints.length - 1)];
  const dx = target.x - thief.x;
  const dy = target.y - thief.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 18) return { dx: 0, dy: 0, sneak: false, interact: false, smoke: false, emp: false, lockpick: false, arrived: true };
  if (mode === 'cautious') {
    for (const guard of state.guards) {
      if (guard.alerted) continue; // A chasing guard is outrun, not sidestepped.
      const gdx = thief.x - guard.x;
      const gdy = thief.y - guard.y;
      const gdist = Math.hypot(gdx, gdy);
      if (gdist > 235) continue;
      let diff = Math.atan2(gdy, gdx) - guard.facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      // Sidestep when the thief is inside the cone, or close enough to the
      // guard's body to be grabbed — walking into a patrol from behind is
      // how a careful thief gets caught.
      if (Math.abs(diff) >= 0.56 && gdist >= 70) continue;
      // Sidestep perpendicular to the guard's facing, to the side the thief
      // is already on; back away too when the guard is close.
      const px = -Math.sin(guard.facing);
      const py = Math.cos(guard.facing);
      const side = (gdx * px + gdy * py) >= 0 ? 1 : -1;
      const back = gdist < 70 ? -0.7 : 0;
      const mx = px * side + Math.cos(guard.facing) * back;
      const my = py * side + Math.sin(guard.facing) * back;
      const ml = Math.hypot(mx, my) || 1;
      return { dx: mx / ml, dy: my / ml, sneak: true, interact: false, smoke: false, emp: false, lockpick: false, arrived: false };
    }
  } else if (mode === 'flee') {
    // Run from the nearest guard, whatever way that is; the thief is faster
    // than a chasing guard, so open ground keeps him alive.
    const guard = nearGuard(state, 300);
    if (guard) {
      const ax = thief.x - guard.x;
      const ay = thief.y - guard.y;
      const al = Math.hypot(ax, ay) || 1;
      return { dx: ax / al, dy: ay / al, sneak: false, interact: false, smoke: false, emp: false, lockpick: false, arrived: false };
    }
    return { dx: 0, dy: 0, sneak: false, interact: false, smoke: false, emp: false, lockpick: false, arrived: true };
  } else {
    const guard = nearGuard(state, 55);
    if (guard) {
      const ax = thief.x - guard.x;
      const ay = thief.y - guard.y;
      const al = Math.hypot(ax, ay) || 1;
      return { dx: ax / al, dy: ay / al, sneak: false, interact: false, smoke: false, emp: false, lockpick: false, arrived: false };
    }
  }
  return { dx: dx / dist, dy: dy / dist, sneak: false, interact: false, smoke: false, emp: false, lockpick: false, arrived: false };
}

/** Walk the waypoint list; returns the index reached. Stops on bust/win. */
function walkWaypoints(world, waypoints, maxSeconds, mode) {
  let index = 0;
  const limit = Math.floor(maxSeconds / STEP);
  for (let i = 0; i < limit; i += 1) {
    const input = autopilotStep(world.state, waypoints, index, mode);
    if (input.arrived) {
      index += 1;
      if (index >= waypoints.length) break;
      continue;
    }
    world.step(STEP, input);
    if (world.state.status !== 'playing') break;
  }
  return index;
}

/** The door out of the thief's starting room, into the corridor: north along
 * column 2 first (a crate sits at (3,13)), then east through the door. */
const OUT_OF_START = [[2, 13], [2, 12], [3, 12], [3, 11], [4, 10]];
/** The door into the vault room, from the corridor. */
const INTO_VAULT_ROOM = [[23, 10], [23, 11], [23, 12]];

/**
 * Set `world` to the named scene and return what to draw over it.
 * start: the thief crossing the middle corridor, cones sweeping.
 * play: at the vault room door, spotted once, alarm climbing.
 * alarm: caught out in the corridor — a guard chasing, alarm high.
 * win: the vault cracked, the loot in hand, out the green door.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    const waypoints = tileWaypoints([...OUT_OF_START, [10, 9], [16, 9], [20, 9], ...INTO_VAULT_ROOM, [25, 15]]);
    walkWaypoints(world, waypoints, 75, 'cautious');
    // Linger by the vault until the camera over it has swept the thief and
    // the alarm meter is visibly climbing; the guards cannot see this spot.
    const idle = { dx: 0, dy: 0, sneak: false, interact: false, smoke: false, emp: false, lockpick: false };
    for (let i = 0; i < 6 / STEP && world.state.status === 'playing' && world.state.alarm < 20; i += 1) {
      world.step(STEP, idle);
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'alarm') {
    // Trip the vault camera and stand in its sweep until the alarm is high:
    // the frame shows the thief caught in the blue cone by the vault, the
    // meter red, the guards patrolling behind. No guard can see this spot,
    // so the run never ends here.
    const waypoints = tileWaypoints([...OUT_OF_START, [10, 9], [16, 9], [20, 9], ...INTO_VAULT_ROOM, [26, 15]]);
    walkWaypoints(world, waypoints, 75, 'cautious');
    const idle = { dx: 0, dy: 0, sneak: false, interact: false, smoke: false, emp: false, lockpick: false };
    for (let i = 0; i < 25 / STEP && world.state.status === 'playing' && world.state.alarm < 55; i += 1) {
      world.step(STEP, idle);
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'win') {
    const toVault = tileWaypoints([...OUT_OF_START, [10, 9], [16, 9], [20, 9], ...INTO_VAULT_ROOM, [25, 13], [27, 15]]);
    walkWaypoints(world, toVault, 100, 'cautious');
    // Burn the EMP as the vault comes into view: the camera over it goes dark.
    if (world.state.status === 'playing' && !world.state.vault.open) {
      world.step(STEP, { dx: 0, dy: 0, sneak: false, interact: false, smoke: false, emp: true, lockpick: false });
    }
    // Crack the vault: stand still, hold E.
    if (world.state.status === 'playing' && !world.state.vault.open) {
      for (let i = 0; i < 5 / STEP && world.state.status === 'playing'; i += 1) {
        world.step(STEP, { dx: 0, dy: 0, sneak: false, interact: true, smoke: false, emp: false, lockpick: false });
        if (world.state.vault.open) break;
      }
    }
    // Walk out the green door: back through the vault-room door, west along
    // the corridor, out the top door of the starting room, up to the exit.
    if (world.state.status === 'playing' && world.state.vault.open) {
      const toExit = tileWaypoints([[23, 12], [23, 11], [23, 10], [20, 9], [12, 9], [5, 8], [3, 8], [3, 7], [3, 6], [2, 5], [2, 2], [1, 1]]);
      walkWaypoints(world, toExit, 100, 'cautious');
    }
    if (world.state.status === 'won') {
      return { screen: SCREEN_WIN, best: 0, take: world.take(true), finalWin: false };
    }
    if (world.state.status === 'busted') return { screen: SCREEN_BUSTED, best: 0, bustedReason: 'Spotted on the way out — so close to the door.' };
    return { screen: SCREEN_PLAY, best: 0 };
  }
  // start (default): a few seconds in, crossing the corridor.
  const waypoints = tileWaypoints([...OUT_OF_START, [8, 9], [16, 9]]);
  walkWaypoints(world, waypoints, 30, 'cautious');
  return { screen: SCREEN_PLAY, best: 0 };
}
