// Sunset Bay — keyboard and mouse input. Tracks held keys, pointer-lock
// mouse look deltas, and one-shot "pressed this frame" edges for actions
// like entering a car or toggling the pistol.
export const keys = {};
export const pressed = {}; // edge-triggered: consumed by the game loop
export const mouse = {
  dx: 0,
  dy: 0,
  click: false, // left click edge
  locked: false,
};

const CODE_ALIASES = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run',
  Space: 'jump',
};

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys[e.code] = true;
    pressed[e.code] = true;
    const alias = CODE_ALIASES[e.code];
    if (alias) pressed[alias] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
  });
  document.addEventListener('pointerlockchange', () => {
    mouse.locked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (e) => {
    if (!mouse.locked) return;
    mouse.dx += e.movementX;
    mouse.dy += e.movementY;
  });
  document.addEventListener('mousedown', (e) => {
    if (e.button === 0) mouse.click = true;
  });
}

export function lockPointer(canvas) {
  if (document.pointerLockElement !== canvas) {
    canvas.requestPointerLock?.();
  }
}

// Called once per frame after the game has read the edges.
export function endFrameInput() {
  for (const k of Object.keys(pressed)) pressed[k] = false;
  mouse.dx = 0;
  mouse.dy = 0;
  mouse.click = false;
}

export function axis() {
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  return { forward: f, strafe: s, run: !!(keys.ShiftLeft || keys.ShiftRight) };
}
