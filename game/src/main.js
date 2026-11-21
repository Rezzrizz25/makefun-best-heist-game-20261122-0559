// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens: title,
// play, paused, busted and won. Winning a floor starts the next one, tools
// and loot carried over; winning the third ends the job.
// Clicking the floor sets a walk target the thief heads for; clicking a HUD
// tool button uses that tool. R restarts a busted floor.
//
// ?seed=N fixes the random pattern. ?shot=start|play|alarm|win (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.

import { BEST_KEY, FIELD, LEVELS, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createWorld, EVENT_BUSTED, EVENT_LOCKDOWN, EVENT_PICKUP, EVENT_SPOTTED, EVENT_TOOL, EVENT_VAULT, EVENT_WON } from './world.js';
import { ACTION_CONFIRM, ACTION_EMP, ACTION_LOCKPICK, ACTION_PAUSE, ACTION_SMOKE, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN, TOOL_BUTTONS } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const levelParam = Number.parseInt(params.get('level') ?? '', 10);
const startLevel = Number.isInteger(levelParam) && levelParam >= 0 && levelParam < LEVELS.length ? levelParam : 0;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
let world = createWorld(startLevel, createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts this visit only.
  }
}

/** In shot mode, stage the scene, paint it twice and signal readiness. */
function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, {
      best: scene.best ?? 0,
      take: scene.take,
      finalWin: scene.finalWin,
      bustedReason: scene.bustedReason,
    });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let totalTake = 0;
  let levelIndex = startLevel;
  let accumulator = 0;
  let last = performance.now();
  /** The floor point the thief is walking toward after a click, or null. */
  let walkTarget = null;
  /** Last frame's events, for sounds. */
  let lastEvents = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startLevel(index) {
    const tools = { ...world.state.tools };
    const loot = world.state.loot;
    world = createWorld(index, createRandom(seed + index * 7919));
    world.state.tools = tools;
    world.state.loot = loot;
    walkTarget = null;
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${world.state.level.name}. Crack the vault, then reach the green door.`);
  }

  function startGame() {
    levelIndex = startLevel;
    totalTake = 0;
    world = createWorld(levelIndex, createRandom(seed));
    walkTarget = null;
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${world.state.level.name}. Crack the vault, then reach the green door.`);
  }

  function endLevel() {
    const take = world.take(true);
    totalTake += take.total;
    const finalWin = levelIndex >= LEVELS.length - 1;
    if (take.total > best) {
      best = take.total;
      saveBest(best);
    }
    screen = SCREEN_WIN;
    announce(finalWin ? `Job done. Whole take $${totalTake}.` : `Floor clear. Take $${take.total}. Next floor.`);
    audio.win();
    return { take, finalWin };
  }

  function endBusted() {
    screen = SCREEN_BUSTED;
    announce('Busted. The run ends here.');
    audio.busted();
  }

  /** Sounds for this step's events. */
  function playEvents(events) {
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_VAULT) audio.vaultOpen();
    if (events & EVENT_SPOTTED) audio.spotted();
    if (events & EVENT_TOOL) audio.smoke();
    if (events & EVENT_LOCKDOWN) audio.spotted();
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The title screen idles the world behind it: guards patrol, cones sweep.
      world.step(STEP, { dx: 0, dy: 0, sneak: false, interact: false, smoke: false, emp: false, lockpick: false });
      return;
    }
    const dir = input.direction();
    let dx = dir.dx;
    let dy = dir.dy;
    // Click-to-walk: steer toward the target until a key is pressed or it is reached.
    if (walkTarget && dx === 0 && dy === 0) {
      const tx = walkTarget.x - world.state.thief.x;
      const ty = walkTarget.y - world.state.thief.y;
      const dist = Math.hypot(tx, ty);
      if (dist < 12) {
        walkTarget = null;
      } else {
        dx = tx / dist;
        dy = ty / dist;
      }
    } else if (dx !== 0 || dy !== 0) {
      walkTarget = null;
    }
    const stepInput = {
      dx, dy,
      sneak: dir.sneak,
      interact: input.interactHeld(),
      smoke: false, emp: false, lockpick: false,
    };
    const actions = input.takeActions();
    if (actions & ACTION_SMOKE) stepInput.smoke = true;
    if (actions & ACTION_EMP) stepInput.emp = true;
    if (actions & ACTION_LOCKPICK) stepInput.lockpick = true;
    lastEvents = world.step(STEP, stepInput);
    playEvents(lastEvents);
    audio.setAlarmLevel(world.state.alarm / 100);
    if (lastEvents & EVENT_WON) {
      endLevel();
    } else if (lastEvents & EVENT_BUSTED) {
      endBusted();
    }
  }

  function handleClicks() {
    const click = input.takeClick();
    if (!click) return;
    audio.unlock();
    if (screen === SCREEN_TITLE || screen === SCREEN_BUSTED || screen === SCREEN_WIN) return;
    // Map the click from CSS pixels to logical coordinates.
    const rect = canvas.getBoundingClientRect();
    const scaleX = FIELD.width / rect.width;
    const scaleY = FIELD.height / rect.height;
    const lx = click.x * scaleX;
    const ly = click.y * scaleY;
    for (const btn of TOOL_BUTTONS) {
      if (lx >= btn.x && lx <= btn.x + btn.w && ly >= btn.y && ly <= btn.y + btn.h) {
        const stepInput = { dx: 0, dy: 0, sneak: false, interact: false, smoke: false, emp: false, lockpick: false };
        if (btn.kind === 'smoke') stepInput.smoke = true;
        if (btn.kind === 'emp') stepInput.emp = true;
        if (btn.kind === 'lockpick') stepInput.lockpick = true;
        lastEvents = world.step(0, stepInput);
        playEvents(lastEvents);
        return;
      }
    }
    // Otherwise walk there (below the HUD bar only).
    if (ly < 660) walkTarget = { x: lx, y: ly };
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (screen === SCREEN_TITLE && (actions & ACTION_CONFIRM)) {
      startGame();
      return;
    }
    if (screen === SCREEN_BUSTED && (actions & ACTION_CONFIRM)) {
      startLevel(levelIndex);
      return;
    }
    if (screen === SCREEN_WIN && (actions & ACTION_CONFIRM)) {
      const finalWin = levelIndex >= LEVELS.length - 1;
      if (finalWin) startGame();
      else {
        levelIndex += 1;
        startLevel(levelIndex);
      }
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleClicks();
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const view = {
      best,
      take: screen === SCREEN_WIN ? world.take(true) : undefined,
      totalTake,
      finalWin: screen === SCREEN_WIN && levelIndex >= LEVELS.length - 1,
      bustedReason: screen === SCREEN_BUSTED
        ? (world.state.lockdown > 0 || world.state.alarm >= 100 ? 'Lockdown — the police arrived before the getaway.' : 'A guard caught the thief red-handed.')
        : undefined,
    };
    renderer.draw(world.state, screen, view);
  }

  // R restarts a busted floor at once.
  window.addEventListener('keydown', (event) => {
    if ((event.key === 'r' || event.key === 'R') && screen === SCREEN_BUSTED) startLevel(levelIndex);
  });

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('The Midnight Vault. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
