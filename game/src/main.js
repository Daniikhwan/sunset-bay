// Sunset Bay — boot and the one loop. The game moves between four screens
// (title, play, paused, game over); in play the world advances in fixed 1/60 s
// steps and the renderer paints what is there. On the title screen the city
// idles behind the menu and the camera slowly orbits it.
//
// ?seed=N fixes the random city. ?shot=start|play|chase|end (with &seed=N)
// stages that scene instead of running the loop, paints it a few times and
// sets window.__shotReady for a screenshot once the frame has reached the
// screen.

import { CAR, LANDMARKS, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorldState } from './world.js';
import { createCity } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createRenderer } from './render.js';
import { createVehicles } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createPlayer } from './player.js';
import { loadSave, saveGame } from './save.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const view = createRenderer(canvas);
const rng = createRandom(seed);
const saved = loadSave() || { money: 0, missionIndex: 0, best: 0, storyDone: false };

// The shared state every system reads and writes, built by world.js.
const S = createWorldState(view, rng, saved);
S.damagePlayer = function damagePlayer(amount) {
  if (S.screen !== 'play') return;
  S.player.health -= amount;
  if (S.player.health <= 0) {
    S.player.health = 0;
    endGame('wasted');
  }
};
S.save = function save() {
  saveGame({ money: S.player.money, missionIndex: S.missionIndex, best: S.best, storyDone: S.storyDone });
};

S.city = createCity(S.scene, rng);
S.input = createInput(canvas);
S.audio = createAudio();
S.vehicles = createVehicles(S.scene, S);
S.traffic = createTraffic(S.scene, S);
S.police = createPolice(S.scene, S);
S.combat = createCombat(S.scene, S);
S.hud = createHud(S);
S.missions = createMissions(S.scene, S);
S.playerCtl = createPlayer(S.scene, S);
S.traffic.init();
S.missions.init();

// A read-only handle for debugging and play-testing in the console.
window.__sunset = S;

function endGame(reason) {
  S.screen = 'over';
  S.overReason = reason;
  S.audio.busted();
  S.audio.siren(false);
  S.audio.engine(0);
  S.save();
  S.hud.setScreen('over', { reason, money: S.player.money, best: S.best });
  status.textContent = reason === 'busted' ? 'Busted. The cops took you in.' : 'Wasted. Sunset Bay got you.';
}

function startGame() {
  // Clear the last run's heat: enemies, cops and cruisers all stand down.
  for (const e of [...S.enemies]) {
    S.scene.remove(e.mesh);
    S.enemies.splice(S.enemies.indexOf(e), 1);
  }
  for (const c of [...S.cops]) {
    S.scene.remove(c.mesh);
    S.cops.splice(S.cops.indexOf(c), 1);
  }
  for (const car of [...S.cars]) {
    if (car.kind === 'police') S.vehicles.removeCar(car);
  }
  if (S.player.car) {
    S.player.car.driver = null;
    S.player.car = null;
  }
  const p = S.player;
  p.health = 100;
  p.pos.set(LANDMARKS.spawn.x, 0, LANDMARKS.spawn.z);
  p.heading = 0;
  p.onFoot = true;
  p.pistol = false;
  p.mesh.visible = true;
  p.mesh.position.copy(p.pos);
  S.wanted = 0;
  S.bustTimer = 0;
  S.cameraYaw = Math.PI * 0.15;
  S.cameraPitch = 0.35;
  S.missions.init();
  S.screen = 'play';
  S.hud.setScreen('play');
  S.audio.ensure();
  S.audio.click();
  status.textContent = 'Playing. Sunset Bay is yours.';
}

function stepPlay(dt) {
  S.time += dt;
  const p = S.player;

  if (S.input.take('pause')) {
    S.screen = 'paused';
    S.hud.setScreen('paused');
    S.audio.engine(0);
    status.textContent = 'Paused.';
    return;
  }

  if (p.car) {
    const move = S.input.move();
    const look = S.input.takeLook();
    if (look.dx !== 0 || look.dy !== 0) S.lastDragTime = S.time;
    S.cameraYaw -= look.dx * 0.005;
    S.cameraPitch = Math.max(0.05, Math.min(0.9, S.cameraPitch + look.dy * 0.003));
    const throttle = move.forward;
    // D steers right: heading must fall, so the steer sign is flipped.
    const steer = -move.strafe;
    S.vehicles.drive(p.car, dt, throttle, steer);
    // The player's map position rides with the car while driving.
    p.pos.copy(p.car.mesh.position);
    if (S.input.take('interact')) S.playerCtl.exitCar();
  } else {
    S.playerCtl.update(dt);
  }

  S.city.update(dt, S.time);
  S.traffic.update(dt);
  S.police.update(dt);
  S.combat.update(dt);
  S.missions.update(dt, S.time);
  S.vehicles.update(dt);
  S.audio.engine(p.car ? Math.abs(p.car.speed) / CAR.maxSpeed : 0);
  S.hud.update();
  S.input.endFrame();
}

function stepTitle(dt) {
  S.time += dt;
  S.city.update(dt, S.time);
  S.traffic.update(dt);
  S.input.endFrame();
}

function runShot(name) {
  const staged = stageShot(name, S);
  const started = performance.now();
  function paint() {
    if (staged.establishing) view.establishing(S, S.time);
    else view.follow(S, STEP);
    S.hud.update();
    view.render();
    // Keep painting for two seconds: the compositor needs a few presented
    // frames before a WebGL canvas actually shows up in a screenshot, and a
    // capture taken on the very first ready frame can still catch the clear
    // colour instead of the city.
    if (performance.now() - started < 2000) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();
  S.hud.setScreen('title', { best: S.best });
  status.textContent = 'Sunset Bay. Press Space or click to start.';

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (S.screen === 'title') {
      if (S.input.take('confirm')) startGame();
      while (accumulator >= STEP && S.screen === 'title') {
        stepTitle(STEP);
        accumulator -= STEP;
      }
      view.establishing(S, S.time);
    } else if (S.screen === 'play') {
      while (accumulator >= STEP) {
        stepPlay(STEP);
        accumulator -= STEP;
        if (S.screen !== 'play') break;
      }
      if (S.screen === 'play') view.follow(S, STEP);
    } else if (S.screen === 'paused') {
      if (S.input.take('pause') || S.input.take('confirm')) {
        S.screen = 'play';
        S.hud.setScreen('play');
        status.textContent = 'Playing.';
      }
      S.input.endFrame();
      view.follow(S, STEP);
    } else if (S.screen === 'over') {
      if (S.input.take('confirm')) startGame();
      S.input.endFrame();
      view.follow(S, STEP);
    }
    if (S.screen !== 'title') view.render();
    else view.render();
  }

  // Leaving the tab pauses a running game rather than letting the city run on.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && S.screen === 'play') {
      S.screen = 'paused';
      S.hud.setScreen('paused');
      S.audio.engine(0);
      status.textContent = 'Paused.';
    }
  });

  canvas.addEventListener('pointerdown', () => {
    if (S.screen === 'title' || S.screen === 'over') startGame();
  });
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
