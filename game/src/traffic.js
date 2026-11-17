// Traffic: cars that cruise the avenue grid and pedestrians who walk the
// sidewalks. Traffic cars keep to their road, turn at intersections, and
// slow for the car ahead. Pedestrians stroll until something scares them,
// then they run; a shot one goes down and, after a while, the street finds a
// new walker.

import * as THREE from '../vendor/three.module.min.js';
import { CITY, PALETTE, ROADS, TRAFFIC } from './config.js';
import { chance, int, pick, range } from './random.js';
import { makeCar, parkCar, syncCar } from './vehicles.js';
import { resolveCollision } from './city.js';

const pedBox = new THREE.BoxGeometry(1, 1, 1);
const pedHead = new THREE.SphereGeometry(0.24, 10, 8);
const pedColors = [0xe74c3c, 0x3498db, 0xf1c40f, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xecf0f1, 0x95a5a6];

function makePed(scene, color) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a077 });
  const torso = new THREE.Mesh(pedBox, shirt);
  torso.scale.set(0.66, 0.8, 0.38);
  torso.position.y = 1.12;
  group.add(torso);
  const head = new THREE.Mesh(pedHead, skin);
  head.position.y = 1.72;
  group.add(head);
  const legL = new THREE.Mesh(pedBox, pants);
  legL.scale.set(0.26, 0.72, 0.3);
  legL.position.set(-0.16, 0.36, 0);
  group.add(legL);
  const legR = new THREE.Mesh(pedBox, pants);
  legR.scale.set(0.26, 0.72, 0.3);
  legR.position.set(0.16, 0.36, 0);
  group.add(legR);
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 14),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);
  scene.add(group);
  return { group, legL, legR };
}

export function createTraffic(scene, city, rng) {
  const cars = [];
  for (let i = 0; i < TRAFFIC.cars; i += 1) {
    const car = makeCar(scene, pick(rng, PALETTE.car), 'traffic');
    const horizontal = chance(rng, 0.5);
    const road = pick(rng, ROADS);
    const along = range(rng, -140, 140);
    const dir = chance(rng, 0.5) ? 1 : -1;
    const lane = 3.4;
    if (horizontal) {
      car.pos.set(along, 0, road + lane * dir);
      car.heading = dir > 0 ? 0 : Math.PI;
    } else {
      car.pos.set(road + lane * dir, 0, along);
      car.heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    car.speed = TRAFFIC.cruise + range(rng, -TRAFFIC.cruiseJitter, TRAFFIC.cruiseJitter);
    car.cruise = car.speed;
    car.axis = horizontal ? 'x' : 'z';
    car.road = road;
    car.dir = dir;
    syncCar(car);
    cars.push(car);
  }
  const peds = [];
  for (let i = 0; i < TRAFFIC.peds; i += 1) {
    const mesh = makePed(scene, pick(rng, pedColors));
    const road = pick(rng, ROADS);
    const along = range(rng, -140, 140);
    const side = chance(rng, 0.5) ? 1 : -1;
    const horizontal = chance(rng, 0.5);
    const ped = {
      ...mesh,
      pos: new THREE.Vector3(),
      heading: 0,
      speed: range(rng, 1.2, 2.2),
      state: 'walk',
      walkPhase: range(rng, 0, 6),
      downTimer: 0,
      axis: horizontal ? 'x' : 'z',
      road,
      side,
      along,
    };
    if (horizontal) {
      ped.pos.set(along, 0, road + side * (CITY.roadWidth / 2 + 1.6));
      ped.heading = side > 0 ? 0 : Math.PI;
    } else {
      ped.pos.set(road + side * (CITY.roadWidth / 2 + 1.6), 0, along);
      ped.heading = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    ped.group.position.copy(ped.pos);
    ped.group.rotation.y = ped.heading;
    peds.push(ped);
  }
  return { cars, peds };
}

function nearestAhead(car, others) {
  let best = Infinity;
  for (const o of others) {
    if (o === car || o.kind === 'parked') continue;
    const dx = o.pos.x - car.pos.x;
    const dz = o.pos.z - car.pos.z;
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    const ahead = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (ahead > 0 && ahead < best && side < 4) best = ahead;
  }
  return best;
}

function turnAtIntersection(car, rng) {
  // At an intersection, keep going, or turn onto the crossing avenue.
  const roll = rng();
  if (roll < 0.55) return; // straight on
  const horizontal = car.axis === 'x';
  const road = car.road;
  const at = horizontal ? car.pos.x : car.pos.z;
  const nearest = ROADS.reduce((best, r) => (Math.abs(r - at) < Math.abs(best - at) ? r : best), ROADS[0]);
  if (Math.abs(nearest - at) > 6) return;
  if (horizontal) {
    car.axis = 'z';
    car.road = nearest;
    car.dir = chance(rng, 0.5) ? 1 : -1;
    car.heading = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    car.pos.x = nearest + 3.4 * car.dir;
  } else {
    car.axis = 'x';
    car.road = nearest;
    car.dir = chance(rng, 0.5) ? 1 : -1;
    car.heading = car.dir > 0 ? 0 : Math.PI;
    car.pos.z = nearest + 3.4 * car.dir;
  }
  void road;
}

export function stepTraffic(traffic, dt, colliders, allCars, playerPos, scared, rng) {
  for (const car of traffic.cars) {
    if (car.driver) continue; // the player is driving this one
    const ahead = nearestAhead(car, allCars);
    const target = ahead < 12 ? Math.max(0, car.cruise * (ahead / 14)) : car.cruise;
    car.speed += (target - car.speed) * Math.min(1, dt * 2);
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    const nx = car.pos.x + fx * car.speed * dt;
    const nz = car.pos.z + fz * car.speed * dt;
    // Turn around at the city edge.
    const along = car.axis === 'x' ? nx : nz;
    if (along > CITY.halfExtent + 8 || along < -CITY.halfExtent - 8) {
      car.dir *= -1;
      car.heading += Math.PI;
      car.speed = car.cruise;
    }
    car.pos.x = nx;
    car.pos.z = nz;
    turnAtIntersection(car, rng);
    syncCar(car);
  }
  for (const ped of traffic.peds) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        // A new walker takes the street.
        ped.state = 'walk';
        ped.pos.set(range(rng, -120, 120), 0, pick(rng, ROADS) + 8.6);
        ped.group.rotation.x = 0;
        ped.group.position.copy(ped.pos);
      }
      continue;
    }
    const dx = playerPos.x - ped.pos.x;
    const dz = playerPos.z - ped.pos.z;
    const dist = Math.hypot(dx, dz);
    if (scared || dist < 6) ped.state = 'flee';
    else if (ped.state === 'flee' && dist > 30) ped.state = 'walk';
    const speed = ped.state === 'flee' ? 5.5 : ped.speed;
    ped.walkPhase += speed * dt * 2.2;
    const fx = Math.sin(ped.heading);
    const fz = Math.cos(ped.heading);
    let nx = ped.pos.x + fx * speed * dt;
    let nz = ped.pos.z + fz * speed * dt;
    if (ped.state === 'flee') {
      // Run away from the player.
      const away = Math.atan2(-dx, -dz);
      ped.heading = away;
      nx = ped.pos.x + Math.sin(away) * speed * dt;
      nz = ped.pos.z + Math.cos(away) * speed * dt;
    }
    const hit = resolveCollision(nx, nz, 0.5, colliders);
    ped.pos.x = hit.x;
    ped.pos.z = hit.z;
    // Turn around at the end of the sidewalk.
    const along = ped.axis === 'x' ? ped.pos.x : ped.pos.z;
    if (along > CITY.halfExtent + 6 || along < -CITY.halfExtent - 6) ped.heading += Math.PI;
    ped.group.position.copy(ped.pos);
    ped.group.rotation.y = ped.heading;
    const swing = Math.sin(ped.walkPhase) * 0.45;
    ped.legL.rotation.x = swing;
    ped.legR.rotation.x = -swing;
  }
}

/** Lay a pedestrian out flat after a shot. */
export function dropPed(ped) {
  ped.state = 'down';
  ped.downTimer = 9;
  ped.group.rotation.x = Math.PI / 2;
  ped.group.position.y = 0.3;
}
