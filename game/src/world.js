// The Midnight Vault — the rules and state, with no drawing and no browser
// in it: the thief, patrolling guards with vision cones, sweeping cameras,
// the vault, loot, tools and the alarm meter. step() advances one fixed step
// and returns what happened as bit flags, so the caller can react (sounds,
// announcements) without the world knowing about screens. Everything random
// comes from the seeded generator passed in, so one seed replays the same.

import {
  ALARM, CAMERA, FIELD, GUARD, LEVELS, LOOT, SMOKE, EMP, THIEF, TILE, TOOLS, VAULT,
} from './config.js';

export const EVENT_PICKUP = 1;
export const EVENT_VAULT = 2;
export const EVENT_SPOTTED = 4;
export const EVENT_BUSTED = 8;
export const EVENT_WON = 16;
export const EVENT_LOCKDOWN = 32;
export const EVENT_HINT = 64;
export const EVENT_TOOL = 128;

/** Tiles that block movement. */
const SOLID = new Set(['#', 'X', 'D']);
/** Tiles that block sight. The vault is a floor tile that blocks sight too. */
const SIGHT_BLOCK = new Set(['#', 'X', 'D']);

function tileAt(level, tx, ty) {
  if (tx < 0 || ty < 0 || ty >= level.map.length || tx >= level.map[0].length) return '#';
  return level.map[ty][tx];
}

function tileCenter(tx, ty) {
  return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
}

/** True when the circle at (x, y) with radius r overlaps a solid tile. */
function hitsSolid(level, x, y, r) {
  const x0 = Math.floor((x - r) / TILE);
  const x1 = Math.floor((x + r) / TILE);
  const y0 = Math.floor((y - r) / TILE);
  const y1 = Math.floor((y + r) / TILE);
  for (let ty = y0; ty <= y1; ty += 1) {
    for (let tx = x0; tx <= x1; tx += 1) {
      if (!SOLID.has(tileAt(level, tx, ty))) continue;
      const cx = Math.max(tx * TILE, Math.min(x, (tx + 1) * TILE));
      const cy = Math.max(ty * TILE, Math.min(y, (ty + 1) * TILE));
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy < r * r) return true;
    }
  }
  return false;
}

/** Move a circle axis by axis so it slides along walls instead of sticking. */
function moveCircle(level, body, dx, dy) {
  const nx = body.x + dx;
  if (!hitsSolid(level, nx, body.y, body.radius)) body.x = nx;
  const ny = body.y + dy;
  if (!hitsSolid(level, body.x, ny, body.radius)) body.y = ny;
}

/** Line of sight: sample the segment; a sight-blocking tile ends it. */
function hasLineOfSight(level, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 8));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const tx = Math.floor((ax + dx * t) / TILE);
    const ty = Math.floor((ay + dy * t) / TILE);
    if (SIGHT_BLOCK.has(tileAt(level, tx, ty))) return false;
  }
  return true;
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Find every tile holding `ch` in the map and return their centres. */
function findTiles(level, ch) {
  const found = [];
  level.map.forEach((row, ty) => {
    for (let tx = 0; tx < row.length; tx += 1) {
      if (row[tx] === ch) found.push(tileCenter(tx, ty));
    }
  });
  return found;
}

export function createWorld(levelIndex, random) {
  const level = LEVELS[levelIndex];
  const start = findTiles(level, 'T')[0];
  const exit = findTiles(level, 'E')[0];
  const vaultTile = findTiles(level, 'V')[0];

  const state = {
    levelIndex,
    level,
    status: 'playing', // playing | busted | won
    elapsed: 0,
    loot: 0,
    vaultLoot: false,
    maxAlarm: 0,
    alarm: 0,
    lockdown: 0, // seconds left once the alarm hits 100; 0 when not locked down
    empTimer: 0,
    hint: '',
    hintTimer: 0,
    crackProgress: 0,
    cracking: false,
    tools: { ...TOOLS },
    thief: {
      x: start.x, y: start.y, radius: THIEF.radius,
      dirX: 0, dirY: 1, moving: false, sneaking: false,
    },
    exit,
    vault: { x: vaultTile.x, y: vaultTile.y, open: false },
    loots: findTiles(level, 'L').map((p) => ({ ...p, taken: false, kind: 'side' })),
    pickups: findTiles(level, 'S').map((p) => ({ ...p, taken: false, kind: 'smoke' })),
    smokes: [], // {x, y, ttl}
    guards: level.guards.map((g) => {
      const wps = g.waypoints.map(([tx, ty]) => tileCenter(tx, ty));
      return {
        waypoints: wps,
        waypoint: 1 % wps.length,
        x: wps[0].x, y: wps[0].y, radius: GUARD.radius,
        facing: 0, suspicion: 0, alerted: false, loseTimer: 0,
        pauseTimer: 0, moving: false,
      };
    }),
    cameras: level.cameras.map((c) => {
      const p = tileCenter(c.tx, c.ty);
      return { ...p, baseAngle: c.angle, arc: c.arc, angle: c.angle, seesThief: false };
    }),
  };

  function reset() {
    const fresh = createWorld(levelIndex, random);
    Object.keys(state).forEach((k) => { state[k] = fresh.state[k]; });
  }

  /** Can this watcher see the thief right now? */
  function canSee(watcher, range, halfAngle) {
    const thief = state.thief;
    const dx = thief.x - watcher.x;
    const dy = thief.y - watcher.y;
    const dist = Math.hypot(dx, dy);
    if (dist > range) return false;
    if (Math.abs(angleDiff(angleTo(watcher.x, watcher.y, thief.x, thief.y), watcher.facing ?? watcher.angle)) > halfAngle) return false;
    if (!hasLineOfSight(level, watcher.x, watcher.y, thief.x, thief.y)) return false;
    for (const smoke of state.smokes) {
      const sdx = thief.x - smoke.x;
      const sdy = thief.y - smoke.y;
      if (sdx * sdx + sdy * sdy < SMOKE.radius * SMOKE.radius) return false;
      // A smoke cloud between watcher and thief blocks the view too.
      const segLen = dist;
      const t = Math.max(0, Math.min(1, ((smoke.x - watcher.x) * dx + (smoke.y - watcher.y) * dy) / (segLen * segLen)));
      const px = watcher.x + dx * t;
      const py = watcher.y + dy * t;
      const pdx = smoke.x - px;
      const pdy = smoke.y - py;
      if (pdx * pdx + pdy * pdy < SMOKE.radius * SMOKE.radius) return false;
    }
    return true;
  }

  function stepGuard(guard, dt) {
    const thief = state.thief;
    const seen = canSee(guard, GUARD.viewRange, GUARD.viewHalfAngle);
    if (seen) {
      const dist = Math.hypot(thief.x - guard.x, thief.y - guard.y);
      const closeness = 1 - (dist / GUARD.viewRange) * 0.6;
      guard.suspicion = Math.min(1, guard.suspicion + GUARD.suspicionRate * closeness * (thief.sneaking ? 0.45 : 1) * dt);
      guard.loseTimer = 0;
    } else {
      guard.suspicion = Math.max(0, guard.suspicion - GUARD.suspicionDecay * dt);
      if (guard.alerted) guard.loseTimer += dt;
    }
    if (guard.suspicion >= 1 && !guard.alerted) {
      guard.alerted = true;
      guard.loseTimer = 0;
      state.events |= EVENT_SPOTTED;
    }
    if (guard.alerted && guard.loseTimer > 3) {
      guard.alerted = false;
      guard.suspicion = 0.5;
      guard.loseTimer = 0;
    }

    if (guard.alerted) {
      // Chase the thief.
      const dx = thief.x - guard.x;
      const dy = thief.y - guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 1) {
        guard.facing = Math.atan2(dy, dx);
        moveCircle(level, guard, (dx / dist) * GUARD.chaseSpeed * dt, (dy / dist) * GUARD.chaseSpeed * dt);
        guard.moving = true;
      }
    } else {
      // Patrol: walk to the next waypoint, pausing there.
      guard.moving = false;
      if (guard.pauseTimer > 0) {
        guard.pauseTimer -= dt;
        const next = guard.waypoints[guard.waypoint];
        guard.facing = Math.atan2(next.y - guard.y, next.x - guard.x);
      } else {
        const target = guard.waypoints[guard.waypoint];
        const dx = target.x - guard.x;
        const dy = target.y - guard.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 4) {
          guard.waypoint = (guard.waypoint + 1) % guard.waypoints.length;
          guard.pauseTimer = GUARD.pauseAtWaypoint + random() * 0.8;
        } else {
          guard.facing = Math.atan2(dy, dx);
          moveCircle(level, guard, (dx / dist) * GUARD.patrolSpeed * dt, (dy / dist) * GUARD.patrolSpeed * dt);
          guard.moving = true;
        }
      }
    }
    // Caught: a guard that reaches the thief ends the run.
    const cdx = thief.x - guard.x;
    const cdy = thief.y - guard.y;
    if (cdx * cdx + cdy * cdy < (guard.radius + thief.radius - 2) * (guard.radius + thief.radius - 2)) {
      state.status = 'busted';
      state.events |= EVENT_BUSTED;
    }
  }

  function stepCamera(camera, dt) {
    camera.angle = camera.baseAngle + Math.sin(state.elapsed * CAMERA.sweepSpeed) * camera.arc;
    camera.seesThief = state.empTimer <= 0 && canSee(camera, CAMERA.range, CAMERA.halfAngle);
  }

  function useTool(kind) {
    if (kind === 'smoke' && state.tools.smoke > 0) {
      state.tools.smoke -= 1;
      state.smokes.push({ x: state.thief.x, y: state.thief.y, ttl: SMOKE.seconds });
      state.events |= EVENT_TOOL;
      return true;
    }
    if (kind === 'emp' && state.tools.emp > 0) {
      state.tools.emp -= 1;
      state.empTimer = EMP.seconds;
      state.events |= EVENT_TOOL;
      return true;
    }
    if (kind === 'lockpick' && state.tools.lockpick > 0 && !state.vault.open) {
      const dx = state.thief.x - state.vault.x;
      const dy = state.thief.y - state.vault.y;
      if (Math.hypot(dx, dy) < TILE * 1.6) {
        state.tools.lockpick -= 1;
        state.vault.open = true;
        state.loot += LOOT.vault;
        state.vaultLoot = true;
        state.events |= EVENT_VAULT;
        return true;
      }
    }
    return false;
  }

  /**
   * Advance one fixed step. `input` is {dx, dy, sneak, interact, smoke, emp,
   * lockpick}: dx/dy a unit-ish direction, the rest booleans for this step.
   * Returns the events of this step as bit flags.
   */
  function step(dt, input) {
    state.events = 0;
    if (state.status !== 'playing') return state.events;
    state.elapsed += dt;
    if (state.hintTimer > 0) {
      state.hintTimer -= dt;
      if (state.hintTimer <= 0) state.hint = '';
    }
    if (state.empTimer > 0) state.empTimer -= dt;
    for (const smoke of state.smokes) smoke.ttl -= dt;
    state.smokes = state.smokes.filter((s) => s.ttl > 0);

    // Tools, on this step's press.
    if (input.smoke) useTool('smoke');
    if (input.emp) useTool('emp');
    if (input.lockpick) useTool('lockpick');

    // The thief moves; moving cancels a vault crack in progress.
    const thief = state.thief;
    const speed = input.sneak ? THIEF.sneakSpeed : THIEF.walkSpeed;
    const moving = input.dx !== 0 || input.dy !== 0;
    thief.moving = moving;
    thief.sneaking = input.sneak;
    if (moving) {
      const len = Math.hypot(input.dx, input.dy) || 1;
      thief.dirX = input.dx / len;
      thief.dirY = input.dy / len;
      moveCircle(level, thief, (input.dx / len) * speed * dt, (input.dy / len) * speed * dt);
      state.cracking = false;
      state.crackProgress = Math.max(0, state.crackProgress - dt * 0.5);
    }

    // Side loot and smoke pickups: walk over them to take them.
    for (const loot of state.loots) {
      if (loot.taken) continue;
      const dx = thief.x - loot.x;
      const dy = thief.y - loot.y;
      if (dx * dx + dy * dy < (THIEF.grabRadius + 8) * (THIEF.grabRadius + 8)) {
        loot.taken = true;
        state.loot += LOOT.side;
        state.events |= EVENT_PICKUP;
      }
    }
    for (const pickup of state.pickups) {
      if (pickup.taken) continue;
      const dx = thief.x - pickup.x;
      const dy = thief.y - pickup.y;
      if (dx * dx + dy * dy < (THIEF.grabRadius + 8) * (THIEF.grabRadius + 8)) {
        pickup.taken = true;
        state.tools.smoke += 1;
        state.events |= EVENT_PICKUP;
      }
    }

    // The vault: hold E beside it to crack it; a lockpick opens it at once.
    const vdx = thief.x - state.vault.x;
    const vdy = thief.y - state.vault.y;
    const nearVault = Math.hypot(vdx, vdy) < TILE * 1.6;
    if (!state.vault.open && nearVault && input.interact && !moving) {
      state.cracking = true;
      state.crackProgress += dt / VAULT.crackSeconds;
      if (state.crackProgress >= 1) {
        state.vault.open = true;
        state.loot += LOOT.vault;
        state.vaultLoot = true;
        state.events |= EVENT_VAULT;
      }
    } else {
      state.cracking = false;
    }

    // The getaway: the vault loot must be in hand first.
    const edx = thief.x - state.exit.x;
    const edy = thief.y - state.exit.y;
    if (edx * edx + edy * edy < (THIEF.grabRadius + 6) * (THIEF.grabRadius + 6)) {
      if (state.vaultLoot) {
        state.status = 'won';
        state.events |= EVENT_WON;
        return state.events;
      }
      if (state.hintTimer <= 0) {
        state.hint = 'The vault loot is still inside — crack the vault first.';
        state.hintTimer = 2.5;
        state.events |= EVENT_HINT;
      }
    }

    // Watchers: guards patrol and chase, cameras sweep.
    for (const guard of state.guards) stepGuard(guard, dt);
    for (const camera of state.cameras) stepCamera(camera, dt);
    if (state.status !== 'playing') return state.events;

    // The alarm: rises while anyone sees the thief, falls while hidden.
    let rise = 0;
    if (state.guards.some((g) => g.alerted)) rise = Math.max(rise, ALARM.alertRate);
    else if (state.guards.some((g) => g.suspicion > 0.5)) rise = Math.max(rise, ALARM.guardRate);
    if (state.cameras.some((c) => c.seesThief)) rise = Math.max(rise, CAMERA.alarmRate);
    if (rise > 0) state.alarm = Math.min(100, state.alarm + rise * dt);
    else state.alarm = Math.max(0, state.alarm - ALARM.decay * dt);
    state.maxAlarm = Math.max(state.maxAlarm, state.alarm);

    if (state.alarm >= 100 && state.lockdown <= 0) {
      state.lockdown = ALARM.lockdownSeconds;
      for (const guard of state.guards) {
        guard.alerted = true;
        guard.suspicion = 1;
        guard.loseTimer = 0;
      }
      state.events |= EVENT_LOCKDOWN;
    }
    if (state.lockdown > 0) {
      state.lockdown -= dt;
      if (state.lockdown <= 0) {
        state.lockdown = 0;
        state.status = 'busted';
        state.events |= EVENT_BUSTED;
      }
    }
    return state.events;
  }

  /** The level's take so far: loot, a ghost bonus, and a time bonus on a win. */
  function take(won) {
    let total = state.loot;
    const ghost = state.maxAlarm <= 25;
    if (ghost) total += LOOT.ghostBonus;
    const timeBonus = won ? Math.max(0, Math.min(120, Math.round(state.level.par - state.elapsed))) * LOOT.timeBonusPerSecond : 0;
    return { total: total + timeBonus, ghost, timeBonus };
  }

  return { state, step, reset, take };
}
