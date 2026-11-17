// Cars: a box-built body with a cabin, four wheels and lights, plus the
// arcade driving model. A car is plain data (position, heading, speed) with
// a group of meshes that mirrors it; the world owns the list, this module
// owns how one looks and how one moves.

import * as THREE from '../vendor/three.module.min.js';
import { CAR } from './config.js';
import { resolveCollision } from './city.js';

const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12);
const lightGeo = new THREE.BoxGeometry(1, 1, 1);
let nextId = 1;

/**
 * Build a car. `kind` is 'player' | 'traffic' | 'cop' | 'parked'; cops get a
 * black-and-white body and a light bar. Returns the car object; call
 * sync(car) after moving it to place the meshes.
 */
export function makeCar(scene, color, kind = 'traffic') {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1c1e24 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fc8d8 });
  const isCop = kind === 'cop';

  const body = new THREE.Mesh(bodyGeo, isCop ? new THREE.MeshLambertMaterial({ color: 0x11131a }) : paint);
  body.scale.set(CAR.width, 0.85, CAR.length);
  body.position.y = 0.62;
  group.add(body);
  const hood = new THREE.Mesh(bodyGeo, isCop ? new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }) : paint);
  hood.scale.set(CAR.width * 0.94, 0.5, CAR.length * 0.42);
  hood.position.set(0, 1.18, -0.4);
  group.add(hood);
  const cabin = new THREE.Mesh(bodyGeo, glass);
  cabin.scale.set(CAR.width * 0.8, 0.62, CAR.length * 0.42);
  cabin.position.set(0, 1.45, 0.35);
  group.add(cabin);
  // Headlights and taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a22 });
  for (const sx of [-0.7, 0.7]) {
    const head = new THREE.Mesh(lightGeo, headMat);
    head.scale.set(0.42, 0.22, 0.1);
    head.position.set(sx, 0.62, -CAR.length / 2 - 0.02);
    group.add(head);
    const tail = new THREE.Mesh(lightGeo, tailMat);
    tail.scale.set(0.42, 0.22, 0.1);
    tail.position.set(sx, 0.62, CAR.length / 2 + 0.02);
    group.add(tail);
  }
  // Cop light bar.
  let barA = null;
  let barB = null;
  if (isCop) {
    barA = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    barA.scale.set(0.5, 0.18, 0.5);
    barA.position.set(-0.45, 1.85, 0.35);
    group.add(barA);
    barB = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    barB.scale.set(0.5, 0.18, 0.5);
    barB.position.set(0.45, 1.85, 0.35);
    group.add(barB);
  }
  // Blob shadow: a dark disc under the car, cheaper than a shadow map.
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(CAR.width * 0.85, CAR.length * 0.62, 1);
  shadow.position.y = 0.03;
  group.add(shadow);

  const wheels = [];
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  for (const [wx, wz] of [[-0.95, -1.45], [0.95, -1.45], [-0.95, 1.45], [0.95, 1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
    wheels.push({ mesh: wheel, front: wz < 0 });
  }

  scene.add(group);
  const car = {
    id: nextId,
    kind,
    group,
    wheels,
    barA,
    barB,
    pos: new THREE.Vector3(),
    heading: 0,
    speed: 0,
    steer: 0,
    color,
    driver: false,
    cruise: 0,
  };
  nextId += 1;
  return car;
}

/** Place the car's meshes where its data says it is. */
export function syncCar(car) {
  car.group.position.copy(car.pos);
  car.group.rotation.y = car.heading;
  for (const w of car.wheels) {
    w.mesh.rotation.x += car.speed * 0.016 / 0.42;
    if (w.front) w.mesh.rotation.y = car.steer * 0.4;
  }
  if (car.barA && car.barB) {
    const on = Math.floor(performance.now() / 260) % 2 === 0;
    car.barA.visible = on;
    car.barB.visible = !on;
  }
}

/**
 * Arcade drive step for a car the player (or a cop) steers: throttle -1..1,
 * steer -1..1. Slides along building walls instead of stopping dead.
 */
export function driveCar(car, throttle, steerInput, dt, colliders) {
  const forward = throttle > 0 ? CAR.accel * throttle : throttle < 0 ? CAR.reverseAccel * throttle : 0;
  car.speed += forward * dt;
  if (throttle === 0) {
    const drag = Math.sign(car.speed) * CAR.drag * 12 * dt;
    car.speed = Math.abs(car.speed) <= Math.abs(drag) ? 0 : car.speed - drag;
  }
  car.speed -= car.speed * CAR.drag * dt;
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
  const steerAuthority = 1 / (1 + Math.abs(car.speed) * 0.055);
  car.steer = steerInput * CAR.steerRate * steerAuthority;
  car.heading += car.steer * (car.speed / CAR.length) * dt * 0.9;
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  const nx = car.pos.x + fx * car.speed * dt;
  const nz = car.pos.z + fz * car.speed * dt;
  const hit = resolveCollision(nx, nz, CAR.width * 0.62, colliders);
  if (hit.x !== nx || hit.z !== nz) {
    // Bumped a wall: keep the slide, lose some speed.
    car.speed *= 0.55;
  }
  car.pos.x = hit.x;
  car.pos.z = hit.z;
  car.pos.y = 0;
  syncCar(car);
}

/** Park a car at a spot and leave it there. */
export function parkCar(car, x, z, heading) {
  car.pos.set(x, 0, z);
  car.heading = heading;
  car.speed = 0;
  syncCar(car);
}
