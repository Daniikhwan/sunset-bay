// The world: everything that moves, wired together. It owns the scene, the
// city, the player, the traffic, the police, the rivals, the missions, the
// sound and the HUD, and advances them all one fixed step at a time. It
// returns what happened as bit flags so the main loop can change screens.

import * as THREE from '../vendor/three.module.min.js';
import { CITY, MISSIONS, ON_FOOT, PALETTE, PISTOL, PLACES, STEP } from './config.js';
import { createRandom, pick } from './random.js';
import { buildCity } from './city.js';
import { driveCar, makeCar, parkCar } from './vehicles.js';
import { createPlayer, enterCar, exitCar, stepOnFoot } from './player.js';
import { createTraffic, stepTraffic } from './traffic.js';
import { addWanted, createPolice, stepPolice } from './police.js';
import { createRivals, punch, shoot, stepRivals } from './combat.js';
import { createMissions, currentDef, failMission, startMission, stepMissions } from './missions.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { loadSave, saveGame } from './save.js';

export const EVENT_NONE = 0;
export const EVENT_BUSTED = 1;
export const EVENT_WASTED = 2;
export const EVENT_JOB_DONE = 4;
export const EVENT_JOB_FAILED = 8;

const RIVAL_SPOTS = [
  { x: 19, z: 22 },
  { x: 43, z: 20 },
  { x: 20, z: 44 },
  { x: 45, z: 40 },
];

export function createWorld(seed) {
  const rng = createRandom(seed);
  const scene = new THREE.Scene();
  const city = buildCity(scene, rng);
  const player = createPlayer(scene, 31, 62);
  player.heading = Math.PI;
  const parked = [];
  for (const spot of city.parkedSpots) {
    const car = makeCar(scene, pick(rng, PALETTE.car), 'parked');
    parkCar(car, spot.x, spot.z, spot.heading);
    parked.push(car);
  }
  const traffic = createTraffic(scene, city, rng);
  const police = createPolice(scene, rng);
  const rivals = createRivals(scene, RIVAL_SPOTS);
  const missions = createMissions(scene);
  const audio = createAudio();
  const hud = createHud();
  const saved = loadSave();
  player.cash = saved.cash || 0;
  missions.index = Math.min(saved.jobs || 0, MISSIONS.length);
  for (let i = 0; i < missions.index; i += 1) missions.done[i] = true;

  const world = {
    scene,
    city,
    player,
    parked,
    traffic,
    police,
    rivals,
    missions,
    audio,
    hud,
    rng,
    cars: [],
    wanted: 0,
    time: 0,
    scared: false,
    scaredTimer: 0,
    best: saved.best || 0,
  };
  world.cars = [...parked, ...traffic.cars];
  world.save = () => {
    const jobs = missions.index;
    const best = Math.max(world.best, player.cash);
    world.best = best;
    saveGame({ cash: player.cash, jobs, best });
  };
  world.audio.unlock();
  return world;
}

/** Put the player back on their feet at the Hideout after a bust or a waste. */
export function respawn(world) {
  const player = world.player;
  if (player.car) {
    player.car.driver = false;
    player.car.speed = 0;
  }
  player.car = null;
  player.onFoot = true;
  player.pos.set(PLACES.hideout.x, 0, PLACES.hideout.z + 14);
  player.heading = 0;
  player.health = ON_FOOT.health;
  player.ammo = PISTOL.magazine;
  player.pistol = false;
  player.speed = 0;
  player.invuln = 2;
  world.wanted = 0;
  world.police.decayTimer = 0;
  if (world.audio) world.audio.siren(false);
  failMission(world.missions, world);
  for (const car of world.police.copCars) world.scene.remove(car.group);
  world.police.copCars.length = 0;
  for (const cop of world.police.footCops) world.scene.remove(cop.group);
  world.police.footCops.length = 0;
  player.cash = Math.max(0, player.cash - 200);
  world.save();
}

/**
 * One fixed step. `frame` is { move, sprint, pressed, look, clicked } from
 * the input. Returns event flags (BUSTED / WASTED / JOB_DONE / JOB_FAILED).
 */
export function stepWorld(world, dt, frame) {
  const player = world.player;
  let events = EVENT_NONE;
  world.time += dt;

  // Mouse look steers the aim heading.
  if (frame.look) player.heading -= frame.look.x * 0.0028;

  const pressed = frame.pressed || new Set();
  if (pressed.has('KeyE')) {
    if (player.onFoot) {
      let best = null;
      let bestDist = ON_FOOT.interactRange;
      for (const car of world.cars) {
        if (car.driver) continue;
        const d = Math.hypot(car.pos.x - player.pos.x, car.pos.z - player.pos.z);
        if (d < bestDist) {
          best = car;
          bestDist = d;
        }
      }
      if (best) {
        if (best.kind === 'traffic') {
          // Yank the driver out: they run off on foot.
          addWanted(world, 1);
          if (world.hud) world.hud.toast('You jacked a ride! The driver ran off.');
        }
        enterCar(player, best);
        if (world.audio) world.audio.pickup();
      }
    } else {
      exitCar(player);
    }
  }
  if (pressed.has('KeyM')) {
    const msg = startMission(world.missions, world);
    if (msg && world.hud) world.hud.toast(msg, 6);
    else if (!msg && world.hud && !world.missions.active) {
      const def = currentDef(world.missions);
      world.hud.toast(def ? 'Press M to start the next job.' : 'All jobs done. Free cruise!');
    }
  }
  if (pressed.has('KeyQ') && player.onFoot) {
    player.pistol = !player.pistol;
    if (world.audio) world.audio.click();
  }
  if (pressed.has('KeyF') && player.onFoot) {
    const hit = punch(world);
    if (world.audio) world.audio.punch();
    if (hit === 'rival' || hit === 'ped' || hit === 'cop') addWanted(world, 1);
  }
  if (pressed.has('KeyR') && player.onFoot && player.ammo < PISTOL.magazine && player.reloadTimer <= 0) {
    player.reloadTimer = PISTOL.reloadSeconds;
    player.ammo = PISTOL.magazine;
    if (world.audio) world.audio.click();
  }

  // Move: drive or walk.
  if (player.car) {
    const throttle = frame.move ? frame.move.forward : 0;
    const steer = frame.move ? frame.move.right : 0;
    driveCar(player.car, throttle, steer, dt, world.city.colliders);
    player.pos.copy(player.car.pos);
    player.heading = player.car.heading;
  } else {
    stepOnFoot(player, frame.move || { forward: 0, right: 0 }, frame.sprint || false, dt, world.city.colliders);
  }

  // Shoot with the mouse while the pistol is out.
  if (frame.clicked && player.onFoot && player.pistol && player.reloadTimer <= 0) {
    const origin = new THREE.Vector3(player.pos.x, 1.6, player.pos.z);
    const dir = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
    const hit = shoot(world, origin, dir);
    if (world.audio) world.audio.shot(false);
    if (hit !== 'empty') {
      world.scared = true;
      world.scaredTimer = 3;
    }
  }
  if (world.scaredTimer > 0) {
    world.scaredTimer -= dt;
    if (world.scaredTimer <= 0) world.scared = false;
  }

  // The rest of the city.
  stepTraffic(world.traffic, dt, world.city.colliders, world.cars, player.pos, world.scared, world.rng);
  world.cars = [...world.parked, ...world.traffic.cars, ...world.police.copCars];
  const bust = stepPolice(world.police, world, dt);
  if (bust === 'busted') {
    if (world.audio) world.audio.busted();
    return EVENT_BUSTED;
  }
  const rivalDamage = stepRivals(world, dt);
  if (rivalDamage > 0) {
    player.health -= rivalDamage;
    if (player.health <= 0) {
      player.health = 0;
      if (world.audio) world.audio.wasted();
      return EVENT_WASTED;
    }
  }
  if (player.health <= 0) {
    player.health = 0;
    if (world.audio) world.audio.wasted();
    return EVENT_WASTED;
  }

  const job = stepMissions(world.missions, world, dt);
  if (job === 'done') events |= EVENT_JOB_DONE;
  else if (job === 'failed') {
    events |= EVENT_JOB_FAILED;
    if (world.hud) world.hud.toast('Job failed. Press M to try again.');
  }

  // Sound and HUD.
  if (world.audio) {
    const speed01 = player.car ? Math.abs(player.car.speed) / 38 : 0;
    world.audio.engine(speed01, !!player.car);
  }
  if (world.hud) {
    world.hud.setWanted(world.wanted);
    world.hud.setHealth(player.health);
    world.hud.setCash(player.cash);
    world.hud.setSpeed(player.car ? Math.abs(player.car.speed) * 2.237 : 0, !!player.car);
    const def = currentDef(world.missions);
    if (world.missions.active && def) {
      world.hud.setMission(def.name, def.brief, world.missions.timer);
    } else if (def) {
      world.hud.setMission('Next job: ' + def.name, 'Press M to start', 0);
    } else {
      world.hud.setMission('', '', 0);
    }
    world.hud.tickToast(dt);
    world.hud.drawMinimap(world);
  }
  return events;
}

export { STEP };
