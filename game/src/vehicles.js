// Sunset Bay — cars. Builds the low-poly car meshes, spawns parked cars and
// traffic cars, and drives the player's car with simple arcade physics:
// throttle, brake/reverse, steering that bites harder at low speed.
import * as THREE from 'three';
import { CFG, mulberry32, pick, range } from './config.js';
import { W, addWanted, setDialog } from './world.js';
import { isBlocked, resolveBlocked } from './city.js';

const CAR_COLORS = [
  0xd94f3d, 0x3d7dd9, 0xf2c14e, 0x4ecb71, 0xe8e8e8, 0x2b2b33,
  0x9b59b6, 0xef8ac2, 0x59c2c9, 0xff8c42, 0x7fb069, 0xc9c9c9,
];

export function makeCarMesh(color, isCop = false) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: isCop ? 0x1a1a22 : color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd4e8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 4.4), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 2.1), glass);
  cabin.position.set(0, 1.12, -0.25);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheels = [];
  for (const [wx, wz] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.38, wz);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }
  // Headlights and taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  for (const hx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.1), headMat);
    h.position.set(hx, 0.6, 2.22);
    group.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const hx of [-0.7, 0.7]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.1), tailMat);
    t.position.set(hx, 0.6, -2.22);
    group.add(t);
  }
  if (isCop) {
    // Black-and-white cruiser livery + light bar.
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.4, 1.4), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    door.position.set(0, 0.55, 0.1);
    group.add(door);
    const barR = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    barR.position.set(-0.45, 1.55, -0.25);
    group.add(barR);
    const barB = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    barB.position.set(0.45, 1.55, -0.25);
    group.add(barB);
    group.userData.lightBar = [barR, barB];
  }
  group.userData.wheels = wheels;
  return group;
}

export function spawnParkedCars(scene, rng) {
  const spots = [];
  for (let i = 0; i < 14; i++) {
    const road = Math.floor(range(rng, -4, 5)) * CFG.grid;
    const along = range(rng, -180, 180);
    const horizontal = rng() > 0.5;
    const x = horizontal ? along : road + CFG.roadHalf - 1.6;
    const z = horizontal ? road + CFG.roadHalf - 1.6 : along;
    if (Math.hypot(x - CFG.spawn.x, z - CFG.spawn.z) < 14) continue;
    if (isBlocked(x, z, 3)) continue;
    spots.push({ x, z, yaw: horizontal ? Math.PI / 2 : 0 });
  }
  // One car right by the spawn point so the player can drive immediately.
  spots.push({ x: 6, z: 24, yaw: Math.PI / 2 });
  for (const s of spots) {
    const mesh = makeCarMesh(pick(rng, CAR_COLORS));
    mesh.position.set(s.x, 0, s.z);
    mesh.rotation.y = s.yaw;
    scene.add(mesh);
    W.cars.push({
      group: mesh, pos: { x: s.x, z: s.z }, yaw: s.yaw, speed: 0,
      npc: false, driver: null, parked: true, color: mesh.children[0].material.color.getHex(),
    });
  }
}

export function spawnTrafficCar(scene, rng) {
  const horizontal = rng() > 0.5;
  const road = Math.floor(range(rng, -4, 5)) * CFG.grid;
  const along = range(rng, -190, 190);
  const lane = (rng() > 0.5 ? 1 : -1) * 3;
  const x = horizontal ? along : road + lane;
  const z = horizontal ? road + lane : along;
  const yaw = horizontal ? (lane > 0 ? Math.PI / 2 : -Math.PI / 2) : (lane > 0 ? 0 : Math.PI);
  const mesh = makeCarMesh(pick(rng, CAR_COLORS));
  mesh.position.set(x, 0, z);
  mesh.rotation.y = yaw;
  scene.add(mesh);
  const car = {
    group: mesh, pos: { x, z }, yaw, speed: range(rng, 8, 13),
    npc: true, driver: { present: true }, parked: false, horizontal,
    color: mesh.children[0].material.color.getHex(),
  };
  W.cars.push(car);
  return car;
}

// The player's car physics: arcade, forgiving, fun at speed.
export function drivePlayerCar(dt, input) {
  const car = W.car;
  if (!car) return;
  const fwd = input.forward;
  const steer = input.strafe;
  if (fwd > 0) car.speed += CFG.carAccel * dt;
  else if (fwd < 0) car.speed -= car.speed > 0.5 ? CFG.carBrake * dt : CFG.carAccel * 0.6 * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  // Screenshot autopilot cruises at a staged speed instead of flat-out.
  const topSpeed = W.autopilot ? W.autopilotSpeed : CFG.carMaxSpeed;
  car.speed = Math.max(-CFG.carReverseMax, Math.min(topSpeed, car.speed));
  if (Math.abs(car.speed) > 0.2) {
    const grip = Math.min(1, Math.abs(car.speed) / 14);
    car.yaw += steer * CFG.carSteer * grip * dt * Math.sign(car.speed);
  }
  const nx = car.pos.x + Math.sin(car.yaw) * car.speed * dt;
  const nz = car.pos.z + Math.cos(car.yaw) * car.speed * dt;
  const fixed = resolveBlocked(nx, nz, 2.4);
  if (fixed.x !== nx || fixed.z !== nz) car.speed *= 0.55;
  car.pos.x = Math.max(-CFG.cityHalf - 10, Math.min(CFG.beachX + 6, fixed.x));
  car.pos.z = Math.max(-CFG.cityHalf - 10, Math.min(CFG.cityHalf + 10, fixed.z));
  car.group.position.set(car.pos.x, 0, car.pos.z);
  car.group.rotation.y = car.yaw;
  const spin = car.speed * dt * 2.6;
  for (const wheel of car.group.userData.wheels) wheel.rotation.x += spin;
  W.carSpeed = car.speed;
  if (W.audio) W.audio.setEngine(Math.abs(car.speed) / CFG.carMaxSpeed, true);
}

export function nearestCar(maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of W.cars) {
    const d = Math.hypot(car.pos.x - W.playerPos.x, car.pos.z - W.playerPos.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

// E: get in the nearest car (jack it if an NPC is driving), or get out.
export function tryEnterExitCar() {
  if (W.onFoot) {
    const car = nearestCar(4.2);
    if (!car) return false;
    if (car.npc && car.driver) {
      // Yank the driver out: they flee on foot as a pedestrian.
      car.driver = null;
      import('./traffic.js').then(({ spawnPed }) => {
        const ped = spawnPed(W.scene, Math.random, car.pos.x, car.pos.z);
        ped.panic = true;
        ped.speed = 5;
      });
      setDialog('You pulled the driver out of the car!', 3);
    }
    car.npc = false;
    car.parked = false;
    car.speed = 0;
    W.car = car;
    W.onFoot = false;
    W.carSpeed = 0;
    W.player.visible = false;
    if (!car.owned) {
      // First time taking this car: it is a steal, and the city notices.
      car.owned = true;
      addWanted(1, 'steal');
      setDialog('You jacked a ride. The city noticed.', 3);
    }
    if (W.audio) W.audio.pickup();
    return true;
  }
  // Get out: step beside the car.
  const car = W.car;
  car.speed = 0;
  const side = { x: car.pos.x + Math.cos(car.yaw) * 2.4, z: car.pos.z - Math.sin(car.yaw) * 2.4 };
  const fixed = resolveBlocked(side.x, side.z, 1);
  W.playerPos = fixed;
  W.playerYaw = car.yaw;
  W.player.position.set(W.playerPos.x, 0, W.playerPos.z);
  W.player.rotation.y = W.playerYaw;
  W.player.visible = true;
  W.car = null;
  W.onFoot = true;
  W.carSpeed = 0;
  if (W.audio) W.audio.setEngine(0, false);
  return true;
}

export function carDistanceToPlayer(car) {
  return Math.hypot(car.pos.x - W.playerPos.x, car.pos.z - W.playerPos.z);
}
