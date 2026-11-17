// Cars: building them from boxes, driving them, and getting in and out.
// Every car on the street is one of these — the player's ride, a parked car
// waiting to be stolen, a traffic car, or a police cruiser. Driving is arcade:
// accelerate, brake and reverse on one axis, steering that bites harder the
// slower the car goes, and a soft collision push against buildings and cars.

import * as THREE from 'three';
import { CAR, PALETTE } from './config.js';
import { resolveCircle } from './city.js';

const BODY_COLOURS = [0xd94f3d, 0x3d7bd9, 0xe8c33a, 0x7a7f8a, 0x4fae62, 0xe8e4da, 0x8a5fd0, 0x2b2f36];
let nextId = 1;

function buildCarMesh(kind, colour) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: kind === 'police' ? 0x1c1e24 : colour });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4), bodyMat);
  body.position.y = 0.62;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.65, 2.2),
    new THREE.MeshLambertMaterial({ color: kind === 'police' ? 0x2c2f38 : 0x1e2430 }),
  );
  cabin.position.set(0, 1.28, -0.2);
  group.add(cabin);
  if (kind === 'police') {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.2, 4.42), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    stripe.position.y = 0.72;
    group.add(stripe);
    const lightBar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5), new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x2244ff }));
    lightBar.position.set(0, 1.72, -0.2);
    lightBar.name = 'lightbar';
    group.add(lightBar);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const wheels = [];
  for (const [x, z] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.38, z);
    group.add(wheel);
    wheels.push(wheel);
  }
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xccaa44 });
  for (const x of [-0.7, 0.7]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lampMat);
    lamp.position.set(x, 0.66, 2.21);
    group.add(lamp);
  }
  return { group, wheels };
}

export function createVehicles(scene, S) {
  function spawnCar(kind, x, z, heading, options = {}) {
    const colour = options.colour ?? BODY_COLOURS[Math.floor(S.rng() * BODY_COLOURS.length)];
    const { group, wheels } = buildCarMesh(kind, colour);
    group.position.set(x, 0, z);
    group.rotation.y = heading;
    scene.add(group);
    const car = {
      id: nextId,
      kind,
      mesh: group,
      wheels,
      heading,
      speed: 0,
      steer: 0,
      health: CAR.health,
      driver: options.driver ?? null,
      parked: options.parked ?? false,
      route: options.route ?? null,
      routeIndex: 0,
      colour,
      sirenPhase: 0,
    };
    nextId += 1;
    S.cars.push(car);
    return car;
  }

  function removeCar(car) {
    scene.remove(car.mesh);
    const i = S.cars.indexOf(car);
    if (i !== -1) S.cars.splice(i, 1);
  }

  /** Drive one car one step from driver input: throttle -1..1, steer -1..1. */
  function drive(car, dt, throttle, steer) {
    if (throttle > 0) car.speed += CAR.accel * throttle * dt;
    else if (throttle < 0) {
      car.speed += (car.speed > 0.5 ? -CAR.brake : CAR.reverseAccel) * dt;
    } else {
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
    }
    const cap = car.kind === 'police' ? CAR.policeSpeed : CAR.maxSpeed;
    car.speed = Math.max(-CAR.maxReverse, Math.min(cap, car.speed));
    const turn = steer * CAR.turnRate * dt * Math.min(1, Math.abs(car.speed) / 8 + 0.25) * Math.sign(car.speed || 1);
    car.heading += turn;
    car.steer = steer;
    const forward = { x: Math.sin(car.heading), z: Math.cos(car.heading) };
    car.mesh.position.x += forward.x * car.speed * dt;
    car.mesh.position.z += forward.z * car.speed * dt;
    car.mesh.position.x = Math.max(-168, Math.min(168, car.mesh.position.x));
    car.mesh.position.z = Math.max(-168, Math.min(164, car.mesh.position.z));
    resolveCircle(S.city.colliders, car.mesh.position, CAR.radius);
    car.mesh.rotation.y = car.heading;
    for (const wheel of car.wheels) wheel.rotation.x += (car.speed * dt) / 0.38;
    // Flash the light bar on police cars.
    if (car.kind === 'police') {
      car.sirenPhase += dt * 6;
      const bar = car.mesh.getObjectByName('lightbar');
      if (bar) bar.material.emissive.setHex(Math.sin(car.sirenPhase) > 0 ? 0xff2222 : 0x2244ff);
    }
  }

  function carsCollide(dt) {
    for (let i = 0; i < S.cars.length; i += 1) {
      for (let j = i + 1; j < S.cars.length; j += 1) {
        const a = S.cars[i];
        const b = S.cars[j];
        const dx = b.mesh.position.x - a.mesh.position.x;
        const dz = b.mesh.position.z - a.mesh.position.z;
        const d = Math.hypot(dx, dz);
        const min = CAR.radius * 2;
        if (d < min && d > 0.001) {
          const push = (min - d) / 2;
          const nx = dx / d;
          const nz = dz / d;
          a.mesh.position.x -= nx * push;
          a.mesh.position.z -= nz * push;
          b.mesh.position.x += nx * push;
          b.mesh.position.z += nz * push;
          const exchange = a.speed;
          a.speed = b.speed * 0.5;
          b.speed = exchange * 0.5;
          if (a.driver === 'player' || b.driver === 'player') S.police.addHeat(0.25);
        }
      }
    }
  }

  function nearestCar(pos, range) {
    let best = null;
    let bestD = range;
    for (const car of S.cars) {
      const d = Math.hypot(car.mesh.position.x - pos.x, car.mesh.position.z - pos.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function update(dt) {
    carsCollide(dt);
    for (const car of S.cars) {
      if (car.driver === 'player') continue;
      if (car.kind === 'police') continue; // police.js drives its own cars
      if (car.parked) continue;
      // Traffic cars are driven by traffic.js through drive().
    }
  }

  return { spawnCar, removeCar, drive, nearestCar, update };
}
