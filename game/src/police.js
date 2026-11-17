// The Sunset Bay PD: wanted stars, cop cars that chase and ram, foot cops
// who close in to make the bust. Cops spawn on the avenues near the player
// while the heat is on and melt away when it cools. A bust needs a foot cop
// close to a slow, on-foot player for a moment; a chase that never ends is
// no fun, so stars decay when the player keeps their nose clean.

import * as THREE from '../vendor/three.module.min.js';
import { CITY, ROADS, WANTED } from './config.js';
import { chance, pick, range } from './random.js';
import { driveCar, makeCar, syncCar } from './vehicles.js';
import { resolveCollision } from './city.js';

const copBox = new THREE.BoxGeometry(1, 1, 1);
const copHead = new THREE.SphereGeometry(0.25, 10, 8);

function makeFootCop(scene) {
  const group = new THREE.Group();
  const navy = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a077 });
  const torso = new THREE.Mesh(copBox, navy);
  torso.scale.set(0.72, 0.85, 0.4);
  torso.position.y = 1.15;
  group.add(torso);
  const head = new THREE.Mesh(copHead, skin);
  head.position.y = 1.78;
  group.add(head);
  const hat = new THREE.Mesh(copBox, new THREE.MeshLambertMaterial({ color: 0x0f1a2e }));
  hat.scale.set(0.56, 0.14, 0.56);
  hat.position.y = 1.98;
  group.add(hat);
  const legL = new THREE.Mesh(copBox, navy);
  legL.scale.set(0.28, 0.75, 0.32);
  legL.position.set(-0.18, 0.38, 0);
  group.add(legL);
  const legR = new THREE.Mesh(copBox, navy);
  legR.scale.set(0.28, 0.75, 0.32);
  legR.position.set(0.18, 0.38, 0);
  group.add(legR);
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 14),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);
  scene.add(group);
  return { group, legL, legR };
}

export function createPolice(scene, rng) {
  return {
    scene,
    rng,
    copCars: [],
    footCops: [],
    bustTimer: 0,
    decayTimer: 0,
    spawnTimer: 0,
  };
}

function spawnCopCar(police, playerPos) {
  const road = pick(police.rng, ROADS);
  const horizontal = chance(police.rng, 0.5);
  const along = range(police.rng, -120, 120);
  const car = makeCar(police.scene, 0x11131a, 'cop');
  if (horizontal) {
    car.pos.set(along, 0, road + (chance(police.rng, 0.5) ? 3.4 : -3.4));
  } else {
    car.pos.set(road + (chance(police.rng, 0.5) ? 3.4 : -3.4), 0, along);
  }
  // Face the player, roughly.
  car.heading = Math.atan2(playerPos.x - car.pos.x, playerPos.z - car.pos.z);
  car.speed = 10;
  syncCar(car);
  police.copCars.push(car);
  return car;
}

function spawnFootCop(police, playerPos) {
  const mesh = makeFootCop(police.scene);
  const angle = range(police.rng, 0, Math.PI * 2);
  const dist = range(police.rng, 26, 40);
  const cop = {
    ...mesh,
    pos: new THREE.Vector3(playerPos.x + Math.sin(angle) * dist, 0, playerPos.z + Math.cos(angle) * dist),
    heading: 0,
    walkPhase: 0,
  };
  cop.group.position.copy(cop.pos);
  police.footCops.push(cop);
  return cop;
}

/** Raise the heat, up to five stars, and reset the quiet timer. */
export function addWanted(world, amount) {
  const before = world.wanted;
  world.wanted = Math.min(WANTED.max, world.wanted + amount);
  world.police.decayTimer = 0;
  if (world.wanted > before && world.audio) world.audio.siren(world.wanted > 0);
  return world.wanted;
}

/**
 * One step of the law. Returns 'busted' when a foot cop has the player, or
 * null. `world` carries player, wanted, cars, colliders and audio.
 */
export function stepPolice(police, world, dt) {
  const player = world.player;
  // Quiet time sheds a star.
  if (world.wanted > 0) {
    police.decayTimer += dt;
    if (police.decayTimer >= WANTED.decaySeconds) {
      police.decayTimer = 0;
      world.wanted = Math.max(0, world.wanted - 1);
      if (world.wanted === 0 && world.audio) world.audio.siren(false);
    }
  }
  // How many units the heat calls for.
  const wantCars = Math.min(4, world.wanted * WANTED.copCarsPerStar);
  const wantFeet = world.wanted >= 2 ? Math.min(3, world.wanted - 1) : 0;
  police.spawnTimer -= dt;
  if (police.spawnTimer <= 0) {
    police.spawnTimer = 1.2;
    if (police.copCars.length < wantCars && world.wanted > 0) spawnCopCar(police, player.pos);
    if (police.footCops.length < wantFeet && world.wanted > 0) spawnFootCop(police, player.pos);
  }
  // Thin the herd when the heat drops.
  while (police.copCars.length > wantCars) {
    const gone = police.copCars.pop();
    police.scene.remove(gone.group);
  }
  while (police.footCops.length > wantFeet) {
    const gone = police.footCops.pop();
    police.scene.remove(gone.group);
  }

  // Cop cars chase: steer at the player, ram when close.
  for (const car of police.copCars) {
    const dx = player.pos.x - car.pos.x;
    const dz = player.pos.z - car.pos.z;
    const dist = Math.hypot(dx, dz);
    const wantHeading = Math.atan2(dx, dz);
    let diff = wantHeading - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 1.6));
    const throttle = dist > 6 ? 1 : 0.4;
    driveCar(car, throttle, steer, dt, world.city.colliders);
    // Ramming the player's car hurts and slows it.
    if (player.car && dist < 5.5) {
      const push = 26 * dt;
      player.car.pos.x += Math.sin(car.heading) * push;
      player.car.pos.z += Math.cos(car.heading) * push;
      player.car.speed *= 1 - 0.9 * dt;
      if (player.invuln <= 0 && Math.abs(car.speed) > 8) {
        player.health -= 6;
        player.invuln = 0.7;
      }
    }
  }
  // Foot cops walk at the player; close enough, long enough, and it's a bust.
  let busting = false;
  for (const cop of police.footCops) {
    const dx = player.pos.x - cop.pos.x;
    const dz = player.pos.z - cop.pos.z;
    const dist = Math.hypot(dx, dz);
    cop.heading = Math.atan2(dx, dz);
    const speed = dist > 2 ? 4.6 : 0;
    cop.walkPhase += speed * dt * 2;
    const nx = cop.pos.x + Math.sin(cop.heading) * speed * dt;
    const nz = cop.pos.z + Math.cos(cop.heading) * speed * dt;
    const hit = resolveCollision(nx, nz, 0.5, world.city.colliders);
    cop.pos.x = hit.x;
    cop.pos.z = hit.z;
    cop.group.position.copy(cop.pos);
    cop.group.rotation.y = cop.heading;
    const swing = Math.sin(cop.walkPhase) * 0.4;
    cop.legL.rotation.x = swing;
    cop.legR.rotation.x = -swing;
    if (player.onFoot && dist < WANTED.bustDistance && player.speed < 3) busting = true;
  }
  if (busting) {
    police.bustTimer += dt;
    if (police.bustTimer >= WANTED.bustSeconds) {
      police.bustTimer = 0;
      return 'busted';
    }
  } else {
    police.bustTimer = 0;
  }
  return null;
}
