// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between screens: title,
// play, paused, busted, wasted. ?seed=N fixes the city; ?shot=start|play|
// chase|end stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.

import { STEP } from './config.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';
import { createWorld, EVENT_BUSTED, EVENT_JOB_DONE, EVENT_WASTED, respawn, stepWorld } from './world.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas, world.scene);
const input = createInput(canvas);

// Debug handle the playtest harness reads: screen, player, wanted.
window.__sunset = {
  screen: 'title',
  player: world.player,
  wanted: 0,
  world,
  renderer,
  camera: renderer.camera,
};

let screen = 'title';
let accumulator = 0;
let last = performance.now();

function announce(message) {
  status.textContent = message;
}

function showTitle() {
  screen = 'title';
  world.hud.showPanel('title');
  window.__sunset.screen = screen;
  announce('Sunset Bay. Press Enter or click to start.');
}

function startPlaying() {
  screen = 'play';
  world.hud.hidePanel();
  world.audio.unlock();
  window.__sunset.screen = screen;
  announce('Playing. Steal a car with E, press M for a job.');
}

function runShot(name) {
  const staged = stageShot(name, world);
  screen = staged.screen;
  window.__sunset.screen = screen;
  if (screen === 'title') world.hud.showPanel('title');
  else world.hud.hidePanel();
  // Put the camera where it belongs before the first paint, so the frame is
  // the shot, not a camera still travelling from the title orbit.
  renderer.snap(world, screen);
  // Paint several frames, then give the compositor a beat before declaring
  // the shot ready: a WebGL canvas needs a presented frame, not just a
  // rendered one, or the capture comes back dark.
  let painted = 0;
  function paint() {
    renderer.draw(world, screen, 1 / 60);
    painted += 1;
    if (painted < 5) requestAnimationFrame(paint);
    else setTimeout(() => { window.__shotReady = true; }, 450);
  }
  requestAnimationFrame(paint);
}

function runGame() {
  showTitle();

  function handlePressed(pressed) {
    if (pressed.has('Enter') || pressed.has('Space')) {
      if (screen === 'title') {
        world.audio.unlock();
        startPlaying();
      } else if (screen === 'busted' || screen === 'wasted') {
        respawn(world);
        startPlaying();
      }
      return;
    }
    if (pressed.has('KeyP') || pressed.has('Escape')) {
      if (screen === 'play') {
        screen = 'paused';
        world.hud.showPanel('paused', { cash: world.player.cash, jobs: world.missions.index });
        window.__sunset.screen = screen;
        announce('Paused.');
      } else if (screen === 'paused') {
        screen = 'play';
        world.hud.hidePanel();
        window.__sunset.screen = screen;
        announce('Playing.');
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dtReal = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const pressed = input.takePressed();
    const look = input.takeLook();
    const clicked = input.takeClick();
    const move = input.move();
    const sprint = input.sprint();
    handlePressed(pressed);
    if (screen === 'play') {
      accumulator += dtReal;
      let first = true;
      // One-shot presses, mouse look and clicks belong to the first step of
      // the frame only; later steps in the same frame get the held keys.
      while (accumulator >= STEP) {
        const events = stepWorld(world, STEP, {
          move,
          sprint,
          pressed: first ? pressed : new Set(),
          look: first ? look : { x: 0, y: 0 },
          clicked: first ? clicked : false,
        });
        first = false;
        accumulator -= STEP;
        if (events & EVENT_BUSTED) {
          screen = 'busted';
          world.hud.showPanel('busted');
          window.__sunset.screen = screen;
          announce('Busted.');
          break;
        }
        if (events & EVENT_WASTED) {
          screen = 'wasted';
          world.hud.showPanel('wasted');
          window.__sunset.screen = screen;
          announce('Wasted.');
          break;
        }
        if (events & EVENT_JOB_DONE) world.save();
      }
    } else {
      accumulator = 0;
    }
    window.__sunset.wanted = world.wanted;
    renderer.draw(world, screen, dtReal);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      world.hud.showPanel('paused', { cash: world.player.cash, jobs: world.missions.index });
      window.__sunset.screen = screen;
      announce('Paused.');
    }
  });
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
