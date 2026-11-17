// Sunset Bay — the shared game state. Every module reads and writes this
// one object, so the player, the cars, the police and the missions always
// agree about what is happening in the city.
import { CFG, MISSIONS } from './config.js';

export const W = {
  // Clock (seconds since the game booted) and per-frame delta.
  time: 0,
  dt: 0,
  // 'title' | 'play' | 'paused' | 'busted' | 'wasted'
  mode: 'title',
  started: false,
  paused: false,

  // Player resources.
  money: 0,
  health: 100,
  ammo: 36,
  pistolOut: false,
  wanted: 0,
  // Seconds since the last crime; the wanted level decays when this is long.
  sinceCrime: 99,
  // Seconds a foot cop has held the player at close range (busted timer).
  heldByCop: 0,

  // Mission progress.
  missionIndex: 0, // 0..3 while playing, 4 when the story is finished
  missionActive: false,
  missionTimeLeft: 0,
  missionStage: 0, // mission 4 uses two stages: 0 = reach bank, 1 = flee
  missionDone: [false, false, false, false],
  storyDone: false,

  // HUD text.
  objective: 'Press ENTER to start',
  dialog: '',
  dialogUntil: 0,
  toast: '',

  // Player body (a THREE.Group) and movement state.
  player: null,
  playerPos: { x: CFG.spawn.x, z: CFG.spawn.z },
  playerYaw: Math.PI, // facing down the avenue
  playerSpeed: 0,
  onFoot: true,
  car: null, // the car the player is driving, or null
  carSpeed: 0,
  punching: 0, // punch animation timer
  shootFlash: 0,

  // Camera.
  camYaw: Math.PI,
  camPitch: -0.32,

  // World entities.
  cars: [], // { group, pos, yaw, speed, color, npc, driver, parked, stolen }
  peds: [], // { group, pos, yaw, speed, panic, route }
  cops: [], // cop cars { group, pos, yaw, speed, siren }
  footCops: [], // { group, pos, yaw, speed }
  enemies: [], // { group, pos, yaw, health, alive, shootCooldown }
  beacon: null, // THREE.Group for the mission beacon
  bankCash: null, // the cash pile mesh for mission 4

  // Three.js handles, filled in by render.js.
  scene: null,
  camera: null,
  renderer: null,

  // Screenshot staging (shots.js fills this in when ?shot= is present).
  shot: null,
  autopilot: false,
  autopilotSpeed: 40,
  shotFrames: 0,

  // Audio handle, filled in by audio.js.
  audio: null,
};

export function currentMission() {
  return MISSIONS[W.missionIndex] ?? null;
}

export function setDialog(text, seconds = 7) {
  W.dialog = text;
  W.dialogUntil = W.time + seconds;
}

export function setObjective(text) {
  W.objective = text;
}

export function addWanted(n, reason) {
  const before = W.wanted;
  W.wanted = Math.min(5, W.wanted + n);
  W.sinceCrime = 0;
  if (W.wanted > before && W.audio) W.audio.sirenBurst();
  return W.wanted;
}

export function resetRun() {
  // A new run keeps earned money and finished missions (progression), and
  // resets the run state: health, heat, position and the current mission.
  W.health = 100;
  W.ammo = 36;
  W.pistolOut = false;
  W.wanted = 0;
  W.sinceCrime = 99;
  W.heldByCop = 0;
  W.missionActive = false;
  W.missionTimeLeft = 0;
  W.missionStage = 0;
  W.playerPos = { x: CFG.spawn.x, z: CFG.spawn.z };
  W.playerYaw = Math.PI;
  W.onFoot = true;
  W.car = null;
  W.carSpeed = 0;
  W.mode = 'play';
  W.started = true;
}
