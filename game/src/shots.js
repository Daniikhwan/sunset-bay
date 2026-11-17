// The screenshot scenes behind ?shot=start|play|chase|end. Each one drives
// the real game forward from a fresh world for a fixed number of steps with
// a scripted driver, so the frame is what a short game really looks like and
// the same seed always gives the same frame. The four shots are the cover,
// a drive through the avenues, a police chase, and the sunset at the beach.

import * as THREE from '../vendor/three.module.min.js';
import { STEP } from './config.js';
import { enterCar } from './player.js';
import { stepWorld } from './world.js';
import { addWanted } from './police.js';

function frame(move, pressed = new Set()) {
  return { move, sprint: false, pressed, look: { x: 0, y: 0 }, clicked: false };
}

function driveFor(world, seconds, throttle, steer = 0) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    stepWorld(world, STEP, frame({ forward: throttle, right: steer }));
  }
}

function idleFor(world, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    stepWorld(world, STEP, frame({ forward: 0, right: 0 }));
  }
}

/** Pick the parked car nearest a road, put the player in it, face down the road. */
function carOnRoad(world, x, z, heading) {
  let best = null;
  let bestDist = Infinity;
  for (const car of world.parked) {
    const d = Math.hypot(car.pos.x - x, car.pos.z - z);
    if (d < bestDist) {
      best = car;
      bestDist = d;
    }
  }
  best.pos.set(x, 0, z);
  best.heading = heading;
  best.speed = 0;
  enterCar(world.player, best);
  world.player.heading = heading;
  return best;
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Any unknown name stages the title scene.
 */
export function stageShot(name, world) {
  const player = world.player;
  if (name === 'play') {
    // A drive down the central avenue, past the plaza.
    carOnRoad(world, -100, 0, Math.PI / 2);
    driveFor(world, 4.5, 0.7);
    return { screen: 'play', best: 0 };
  }
  if (name === 'chase') {
    // The same drive, but the heat is on and two units are closing in.
    carOnRoad(world, -100, 0, Math.PI / 2);
    addWanted(world, 3);
    driveFor(world, 5.5, 0.85);
    return { screen: 'play', best: 0 };
  }
  if (name === 'end') {
    // The day's last light: on foot at the beach, a car parked behind, the
    // sun going down over the water.
    player.pos.set(-40, 0, 166);
    player.heading = 0;
    player.cash = 4300;
    const car = world.parked[0];
    car.pos.set(-30, 0, 158);
    car.heading = Math.PI / 2;
    idleFor(world, 2);
    return { screen: 'play', best: 4300 };
  }
  // 'start' and anything else: the title over a living city.
  player.pos.set(31, 0, 62);
  player.heading = Math.PI;
  idleFor(world, 5);
  return { screen: 'title', best: 0 };
}

export { THREE };
