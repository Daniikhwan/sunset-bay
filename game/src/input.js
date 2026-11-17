// Keyboard, mouse and pointer input. Held keys are a live set the game reads
// every step; one-shot presses (enter a car, start a mission, punch, reload,
// pause) are collected into a set the loop takes once per frame, so a press
// between two frames is never lost and never counted twice. Mouse movement
// steers the camera while the pointer is locked; a click shoots.

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  let lookX = 0;
  let lookY = 0;
  let clicked = false;
  let locked = false;

  function onKeyDown(event) {
    if (event.repeat) return;
    held.add(event.code);
    pressed.add(event.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
  }
  function onKeyUp(event) {
    held.delete(event.code);
  }
  function onBlur() {
    held.clear();
  }
  function onMouseMove(event) {
    if (!locked) return;
    lookX += event.movementX || 0;
    lookY += event.movementY || 0;
  }
  function onMouseDown(event) {
    if (event.button !== 0) return;
    if (!locked) {
      try {
        canvas.requestPointerLock();
      } catch {
        // Pointer lock can be refused (headless, denied): the game still plays.
      }
      return;
    }
    clicked = true;
  }
  function onLockChange() {
    locked = document.pointerLockElement === canvas;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  document.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  document.addEventListener('pointerlockchange', onLockChange);

  return {
    /** True while the key is held down. */
    down(code) {
      return held.has(code);
    },
    /** WASD / arrows as a -1..1 pair, forward and right. */
    move() {
      const forward = (this.down('KeyW') || this.down('ArrowUp') ? 1 : 0) - (this.down('KeyS') || this.down('ArrowDown') ? 1 : 0);
      const right = (this.down('KeyD') || this.down('ArrowRight') ? 1 : 0) - (this.down('KeyA') || this.down('ArrowLeft') ? 1 : 0);
      return { forward, right };
    },
    sprint() {
      return this.down('ShiftLeft') || this.down('ShiftRight');
    },
    /** The one-shot presses since the last take, as a set of codes, then cleared. */
    takePressed() {
      const taken = new Set(pressed);
      pressed.clear();
      return taken;
    },
    /** Mouse movement since the last take, in pixels, then cleared. */
    takeLook() {
      const out = { x: lookX, y: lookY };
      lookX = 0;
      lookY = 0;
      return out;
    },
    /** True if the (locked) mouse was clicked since the last take. */
    takeClick() {
      const out = clicked;
      clicked = false;
      return out;
    },
    isLocked() {
      return locked;
    },
  };
}
