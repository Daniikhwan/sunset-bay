// Sunset Bay — deterministic screenshot scenes. ?shot=start|play|chase|end
// stages a fixed situation from a fixed seed, runs the real simulation for a
// couple of seconds, then sets window.__shotReady so the screenshot driver
// knows the frame is ready. Nothing here is faked: the city, the traffic,
// the police and the HUD are the same code the player gets.
import * as THREE from 'three';
import { CFG, MISSIONS, mulberry32 } from './config.js';
import { W, setDialog, setObjective, currentMission } from './world.js';
import { spawnTrafficCar } from './vehicles.js';
import { spawnPed } from './traffic.js';
import { spawnCopCar, spawnFootCop } from './police.js';
import { startMission, moveBeaconTo } from './missions.js';
import { showScreen } from './hud.js';

function clearDynamic(scene) {
  for (const car of W.cars) scene.remove(car.group);
  for (const ped of W.peds) scene.remove(ped.group);
  for (const cop of W.cops) scene.remove(cop.group);
  for (const cop of W.footCops) scene.remove(cop.group);
  for (const e of W.enemies) scene.remove(e.group);
  W.cars = [];
  W.peds = [];
  W.cops = [];
  W.footCops = [];
  W.enemies = [];
}

// Park a few extra cars and pedestrians around a point for a busy street.
function dressStreet(scene, rng, cx, cz) {
  for (let i = 0; i < 4; i++) {
    const car = spawnTrafficCar(scene, rng);
    car.pos.x = cx + (rng() - 0.5) * 60;
    car.pos.z = cz + (rng() - 0.5) * 60;
    car.group.position.set(car.pos.x, 0, car.pos.z);
  }
  for (let i = 0; i < 8; i++) {
    spawnPed(scene, rng, cx + (rng() - 0.5) * 50, cz + (rng() - 0.5) * 50);
  }
}

function putPlayerInCar(carIndex = 0) {
  const car = W.cars[carIndex];
  if (!car) return;
  car.npc = false;
  car.parked = false;
  car.speed = 18;
  W.car = car;
  W.onFoot = false;
  W.carSpeed = 18;
  W.player.visible = false;
  return car;
}

export function stageShot(name, scene) {
  const rng = mulberry32(90210);
  clearDynamic(scene);
  W.shot = name;
  W.started = true;
  W.mode = 'play';
  W.health = 100;
  W.ammo = 36;

  if (name === 'start') {
    // Cover: title screen over a living city, HUD + minimap + wanted stars
    // + mission objective + Marla's dialog all visible at once.
    W.mode = 'title';
    W.money = 1250;
    W.wanted = 2;
    W.sinceCrime = 0;
    W.missionIndex = 0;
    W.missionActive = true;
    W.missionTimeLeft = 98;
    setObjective('Mission 1: The Package — Deliver the package to the docks beacon');
    setDialog(MISSIONS[0].brief, 999);
    W.playerPos = { x: 2, z: 30 };
    W.playerYaw = Math.PI * 0.9;
    W.camYaw = Math.PI * 0.9;
    W.player.position.set(2, 0, 30);
    W.player.visible = true;
    dressStreet(scene, rng, 0, 20);
    moveBeaconTo(CFG.delivery.x, CFG.delivery.z);
    spawnCopCar(scene, rng);
    W.cops[0].pos = { x: -18, z: 44 };
    W.cops[0].group.position.set(-18, 0, 44);
    showScreen('title');
    // The cover shows the title AND the HUD at once.
    document.getElementById('hud').style.display = 'block';
  } else if (name === 'play') {
    // Driving through the avenue on mission 1, package in the trunk.
    W.money = 1250;
    W.wanted = 0;
    W.missionIndex = 0;
    W.missionActive = true;
    W.missionTimeLeft = 87;
    setObjective('Mission 1: The Package — Deliver the package to the docks beacon');
    setDialog("Marla: 'Take the avenue east, then cut south. The docks beacon is lit — you cannot miss it.'", 999);
    dressStreet(scene, rng, 0, 0);
    const car = putPlayerInCar(0);
    car.pos = { x: -30, z: 0 };
    car.yaw = Math.PI / 2;
    car.group.position.set(-30, 0, 0);
    car.group.rotation.y = car.yaw;
    moveBeaconTo(CFG.delivery.x, CFG.delivery.z);
    W.autopilot = true;
    showScreen(null);
  } else if (name === 'chase') {
    // Wanted 4, two cruisers on the tail, mission 2 escape in progress.
    W.money = 2050;
    W.wanted = 4;
    W.sinceCrime = 0;
    W.missionIndex = 1;
    W.missionActive = true;
    W.missionTimeLeft = 112;
    setObjective('Mission 2: Hot Wheels — Escape the police — reach the hideout');
    setDialog("Marla: 'They are all over you! Lose them and get to the hideout — do not stop!'", 999);
    dressStreet(scene, rng, 40, 40);
    const car = putPlayerInCar(0);
    car.pos = { x: 40, z: 40 };
    car.yaw = -Math.PI / 2;
    car.group.position.set(40, 0, 40);
    car.group.rotation.y = car.yaw;
    car.speed = 26;
    W.carSpeed = 26;
    // Two cruisers ahead in the lanes, closing in as the player bears down
    // on them: they stay inside the chase camera's view at the capture.
    W.autopilotSpeed = 26;
    const cop1 = spawnCopCar(scene, rng);
    cop1.staged = true;
    cop1.pos = { x: -20, z: 46 };
    cop1.yaw = -Math.PI / 2;
    cop1.speed = 26;
    cop1.group.position.set(-20, 0, 46);
    cop1.group.rotation.y = cop1.yaw;
    const cop2 = spawnCopCar(scene, rng);
    cop2.staged = true;
    cop2.pos = { x: -30, z: 33 };
    cop2.yaw = -Math.PI / 2;
    cop2.speed = 26;
    cop2.group.position.set(-30, 0, 33);
    cop2.group.rotation.y = cop2.yaw;
    moveBeaconTo(CFG.hideout.x, CFG.hideout.z);
    W.autopilot = true;
    showScreen(null);
  } else if (name === 'end') {
    // Story complete: the bank job paid off, player at the hideout at dusk.
    W.money = 5000;
    W.wanted = 0;
    W.storyDone = true;
    W.missionIndex = 4;
    W.missionActive = false;
    W.missionDone = [true, true, true, true];
    setObjective('Story complete — free roam Sunset Bay!');
    setDialog("Marla: 'That is the whole story, kid. The bank job paid off — Sunset Bay is yours now.'", 999);
    // Stand on the avenue by the hideout, looking west down the road so
    // the street, the hideout and the city open up behind the player.
    W.playerPos = { x: -120, z: 160 };
    W.playerYaw = -Math.PI / 2;
    W.camYaw = -Math.PI / 2;
    W.player.position.set(W.playerPos.x, 0, W.playerPos.z);
    W.player.visible = true;
    dressStreet(scene, rng, CFG.hideout.x, CFG.hideout.z);
    showScreen(null);
  }

  // Let the simulation settle for a couple of seconds, then declare ready.
  W.shotFrames = 0;
  const tick = () => {
    W.shotFrames += 1;
    if (W.shotFrames >= 110) window.__shotReady = true;
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
