// Keyboard and mouse for Sunset Bay. Held keys are read every frame; one-shot
// presses (interact, attack, weapon swap, pause, confirm) are queued as flags
// and cleared by endFrame(), so a press between two frames is never lost and
// never counted twice. The camera is steered by dragging with the mouse.

export const KEY_FORWARD = 'KeyW';
export const KEY_BACK = 'KeyS';
export const KEY_LEFT = 'KeyA';
export const KEY_RIGHT = 'KeyD';
export const KEY_RUN = 'ShiftLeft';
export const KEY_INTERACT = 'KeyE';
export const KEY_WEAPON = 'KeyQ';
export const KEY_PUNCH = 'KeyF';
export const KEY_PAUSE = 'KeyP';
export const KEY_CONFIRM = 'Space';

export function createInput(canvas) {
  const held = new Set();
  let lookDX = 0;
  let lookDY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const pressed = {
    interact: false,
    punch: false,
    attack: false,
    weapon: false,
    pause: false,
    confirm: false,
  };

  window.addEventListener('keydown', (event) => {
    if (event.code === KEY_INTERACT && !event.repeat) pressed.interact = true;
    if (event.code === KEY_PUNCH && !event.repeat) pressed.punch = true;
    if (event.code === KEY_WEAPON && !event.repeat) pressed.weapon = true;
    if ((event.code === KEY_PAUSE || event.code === 'Escape') && !event.repeat) pressed.pause = true;
    if ((event.code === KEY_CONFIRM || event.code === 'Enter') && !event.repeat) pressed.confirm = true;
    held.add(event.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
    dragging = false;
  });

  canvas.addEventListener('mousedown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    if (event.button === 0) pressed.attack = true;
  });
  window.addEventListener('mousemove', (event) => {
    if (!dragging) return;
    lookDX += event.clientX - lastX;
    lookDY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
  });

  return {
    held(code) {
      return held.has(code);
    },
    /** Forward/back/strafe as -1, 0 or 1, from WASD or the arrow keys. */
    move() {
      const f = (held.has(KEY_FORWARD) || held.has('ArrowUp') ? 1 : 0) - (held.has(KEY_BACK) || held.has('ArrowDown') ? 1 : 0);
      const s = (held.has(KEY_RIGHT) || held.has('ArrowRight') ? 1 : 0) - (held.has(KEY_LEFT) || held.has('ArrowLeft') ? 1 : 0);
      return { forward: f, strafe: s, run: held.has(KEY_RUN) || held.has('ShiftRight') };
    },
    /** Mouse drag since the last call, in pixels; calling it consumes it. */
    takeLook() {
      const out = { dx: lookDX, dy: lookDY };
      lookDX = 0;
      lookDY = 0;
      return out;
    },
    take(name) {
      const value = pressed[name] === true;
      pressed[name] = false;
      return value;
    },
    /** Clear every one-shot flag at the end of a frame. */
    endFrame() {
      for (const key of Object.keys(pressed)) pressed[key] = false;
      lookDX = 0;
      lookDY = 0;
    },
  };
}
