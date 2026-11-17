// Sunset Bay — bootstrap and the main loop. Builds the city, spawns the
// player and the population, wires the keys, and runs the frame: input,
// player, driving, traffic, police, missions, combat, camera, HUD.
import * as THREE from 'three';
import { CFG, mulberry32 } from './config.js';
import { W, setDialog, setObjective, resetRun } from './world.js';
import { buildCity } from './city.js';
import { initRenderer, updateCamera, renderFrame } from './render.js';
import { initInput, keys, pressed, mouse, axis, lockPointer, endFrameInput } from './input.js';
import { GameAudio } from './audio.js';
import { loadGame, saveGame } from './save.js';
import { makePlayerMesh, updatePlayer } from './player.js';
import { spawnParkedCars, drivePlayerCar, tryEnterExitCar } from './vehicles.js';
import { spawnPopulation, updateTraffic } from './traffic.js';
import { updatePolice, bustPlayer, wastePlayer } from './police.js';
import { makeBeacon, updateMissions, tryStartMission } from './missions.js';
import { makePistolView, togglePistol, punch, shoot, reload, updateCombat } from './combat.js';
import { initHud, updateHud, showScreen, showEndScreen } from './hud.js';
import { stageShot } from './shots.js';

let canvasHost = null;

function startGame() {
  W.audio.ensure();
  resetRun();
  if (W.storyDone) setObjective('Story complete — free roam Sunset Bay!');
  else setObjective(`Mission ${W.missionIndex + 1} — press M to start`);
  setDialog("Marla: 'Welcome to Sunset Bay. Grab a car, press M when you are ready for work.'", 8);
  showScreen(null);
  lockPointer(canvasHost);
  saveGame();
}

function endToTitle() {
  W.mode = 'title';
  showScreen('title');
}

function togglePause() {
  if (W.mode === 'play') {
    W.mode = 'paused';
    showScreen('pause');
    if (W.audio) W.audio.setEngine(0, false);
  } else if (W.mode === 'paused') {
    W.mode = 'play';
    showScreen(null);
  }
}

function handleKeys() {
  if (pressed.Enter) {
    if (W.mode === 'title') startGame();
    else if (W.mode === 'busted' || W.mode === 'wasted') startGame();
  }
  if (pressed.KeyP || pressed.Escape) {
    if (W.mode === 'play' || W.mode === 'paused') togglePause();
  }
  if (W.mode !== 'play') return;
  if (pressed.KeyE) tryEnterExitCar();
  if (pressed.KeyM) tryStartMission();
  if (pressed.KeyQ) togglePistol();
  if (pressed.KeyF) punch();
  if (pressed.KeyR) reload();
  if (pressed.KeyH) {
    // Honk / flash: small flavor, no gameplay effect.
    if (W.audio) W.audio.blip(320, 0.25, 'square', 0.15);
  }
  if (mouse.click) {
    if (W.pistolOut && W.onFoot) shoot();
    else if (!mouse.locked) lockPointer(canvasHost);
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - (frame.last ?? now)) / 1000 || 0.016);
  frame.last = now;
  W.dt = dt;
  W.time += dt;

  handleKeys();

  if (W.mode === 'play' || W.mode === 'title') {
    // Autopilot (screenshot scenes) drives the car straight down the road.
    const input = W.autopilot && !W.onFoot
      ? { forward: 1, strafe: 0, run: false }
      : axis();
    if (W.mode === 'play') {
      if (W.onFoot) updatePlayer(dt, input);
      else drivePlayerCar(dt, input);
      updateMissions(dt);
      updatePolice(dt);
      updateCombat(dt);
    }
    updateTraffic(dt);
    updateCamera(dt);
    updateHud();
  } else if (W.mode === 'paused' || W.mode === 'busted' || W.mode === 'wasted') {
    updateCamera(dt);
  }

  renderFrame();
  endFrameInput();
}

function boot() {
  canvasHost = document.getElementById('game-canvas');
  const { scene, camera } = initRenderer();
  initInput(canvasHost);
  initHud();
  W.audio = new GameAudio();

  buildCity(scene);
  const player = makePlayerMesh();
  player.position.set(CFG.spawn.x, 0, CFG.spawn.z);
  scene.add(player);
  W.player = player;
  W.playerPos = { x: CFG.spawn.x, z: CFG.spawn.z };

  spawnParkedCars(scene, mulberry32(424242));
  spawnPopulation(scene);
  makeBeacon(scene);
  makePistolView(scene, camera);

  // Restore saved progress (money + missions) before the first frame.
  const saved = loadGame();
  if (saved && (saved.missionIndex > 0 || saved.money > 0)) {
    setObjective(
      saved.storyDone
        ? 'Story complete — free roam Sunset Bay!'
        : `Mission ${saved.missionIndex + 1} — press M to start (save restored: $${saved.money})`,
    );
  }

  // Clicking the title / pause / end screens starts or resumes.
  const titleBtn = document.getElementById('start-btn');
  if (titleBtn) titleBtn.addEventListener('click', () => startGame());
  const resumeBtn = document.getElementById('resume-btn');
  if (resumeBtn) resumeBtn.addEventListener('click', () => togglePause());
  const againBtn = document.getElementById('again-btn');
  if (againBtn) againBtn.addEventListener('click', () => startGame());
  document.getElementById('screen-title')?.addEventListener('click', (e) => {
    if (e.target.id === 'screen-title') startGame();
  });

  // Screenshot staging, if the URL asks for it.
  const shot = new URLSearchParams(location.search).get('shot');
  if (shot) {
    stageShot(shot, scene);
  } else {
    showScreen('title');
  }

  // Debug handle for playtests (read-only inspection from the console).
  window.__SB = { W, CFG };

  requestAnimationFrame(frame);
}

boot();
