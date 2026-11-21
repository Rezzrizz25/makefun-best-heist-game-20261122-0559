// Keyboard and mouse input, read every frame: WASD or arrows to move, Shift
// to sneak, E to interact (hold to crack the vault), 1/2/3 for tools, Space
// or click to confirm on menus, P or Escape to pause. A click on the floor
// sets a walk target the thief heads for; a click on a HUD tool button uses
// that tool. The game never reads the pointer position for aiming — the
// mouse is for movement and tools, the keyboard for everything else.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_SMOKE = 4;
export const ACTION_EMP = 8;
export const ACTION_LOCKPICK = 16;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  /** The last click in canvas CSS pixels, or null; main.js maps it to world. */
  let click = null;
  let clickHandled = true;

  function keyDown(event) {
    if (event.repeat) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
      return;
    }
    keys.add(event.key.toLowerCase());
    if (event.key === ' ' || event.key === 'Enter') {
      actions |= ACTION_CONFIRM;
      event.preventDefault();
    }
    if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') actions |= ACTION_PAUSE;
    if (event.key === '1') actions |= ACTION_SMOKE;
    if (event.key === '2') actions |= ACTION_EMP;
    if (event.key === '3') actions |= ACTION_LOCKPICK;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
  }

  function keyUp(event) {
    keys.delete(event.key.toLowerCase());
  }

  function pointerDown(event) {
    const rect = canvas.getBoundingClientRect();
    click = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    clickHandled = false;
    actions |= ACTION_CONFIRM;
  }

  function blur() {
    keys.clear();
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', blur);
  canvas.addEventListener('pointerdown', pointerDown);

  /** The held movement direction this frame, and whether Shift is held. */
  function direction() {
    let dx = 0;
    let dy = 0;
    if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
    if (keys.has('d') || keys.has('arrowright')) dx += 1;
    if (keys.has('w') || keys.has('arrowup')) dy -= 1;
    if (keys.has('s') || keys.has('arrowdown')) dy += 1;
    return { dx, dy, sneak: keys.has('shift'), interact: keys.has('e') };
  }

  /** Actions pressed since the last call; each is reported once. */
  function takeActions() {
    const taken = actions;
    actions = 0;
    return taken;
  }

  /** The newest click, once; null when there is none waiting. */
  function takeClick() {
    if (!click || clickHandled) return null;
    clickHandled = true;
    return click;
  }

  /** True while E is held down. */
  function interactHeld() {
    return keys.has('e');
  }

  return { direction, takeActions, takeClick, interactHeld };
}
