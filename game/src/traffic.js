// Sunset Bay — the living street: NPC traffic cars cruising the road grid and
// pedestrians strolling the sidewalks (and fleeing when a car screams past).
// Peds hit by the player's car at speed count as a crime.
import * as THREE from 'three';
import { CFG, mulberry32, pick, range } from './config.js';
import { W, addWanted } from './world.js';
import { spawnTrafficCar } from './vehicles.js';
import { resolveBlocked } from './city.js';

const PED_SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0xfd79a8, 0x00cec9, 0xe17055];
const PED_SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];

export function makePedMesh(rng) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, PED_SHIRTS) });
  const skin = new THREE.MeshLambertMaterial({ color: pick(rng, PED_SKINS) });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.8, 0.26), new THREE.MeshLambertMaterial({ color: 0x2c3e50 }));
  legs.position.y = 0.4;
  legs.castShadow = true;
  group.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.32), shirt);
  torso.position.y = 1.12;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.68;
  head.castShadow = true;
  group.add(head);
  const armMat = shirt;
  for (const ax of [-0.34, 0.34]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.6, 0.13), armMat);
    arm.position.set(ax, 1.1, 0);
    group.add(arm);
  }
  return group;
}

function randomSidewalkPoint(rng) {
  // A point on a sidewalk: just off a road, inside the city.
  const road = Math.floor(range(rng, -4, 5)) * CFG.grid;
  const along = range(rng, -190, 190);
  const side = (rng() > 0.5 ? 1 : -1) * (CFG.roadHalf + 2.2);
  return rng() > 0.5 ? { x: along, z: road + side } : { x: road + side, z: along };
}

export function spawnPed(scene, rng, x = null, z = null) {
  const p = x === null ? randomSidewalkPoint(rng) : { x, z };
  const mesh = makePedMesh(rng);
  mesh.position.set(p.x, 0, p.z);
  scene.add(mesh);
  const ped = {
    group: mesh, pos: { x: p.x, z: p.z }, yaw: range(rng, 0, Math.PI * 2),
    speed: range(rng, 1.1, 1.9), panic: false, down: false, downTimer: 0,
    target: randomSidewalkPoint(rng),
  };
  W.peds.push(ped);
  return ped;
}

export function spawnPopulation(scene) {
  const rng = mulberry32(777001);
  for (let i = 0; i < 10; i++) spawnTrafficCar(scene, rng);
  for (let i = 0; i < 22; i++) spawnPed(scene, rng);
}

function pedStep(ped, dt) {
  if (ped.down) {
    ped.downTimer -= dt;
    if (ped.downTimer <= 0) {
      ped.group.visible = false;
      ped.removeMe = true;
    }
    return;
  }
  const dx = ped.target.x - ped.pos.x;
  const dz = ped.target.z - ped.pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 1.5) {
    ped.target = randomSidewalkPoint(mulberry32((Math.random() * 1e9) | 0));
    return;
  }
  const speed = ped.panic ? ped.speed * 2.6 : ped.speed;
  ped.pos.x += (dx / dist) * speed * dt;
  ped.pos.z += (dz / dist) * speed * dt;
  ped.yaw = Math.atan2(dx, dz);
  ped.group.position.set(ped.pos.x, 0, ped.pos.z);
  ped.group.rotation.y = ped.yaw;
  // Walk bob.
  ped.group.position.y = Math.abs(Math.sin(W.time * 8 + ped.pos.x)) * 0.06;
  if (ped.panic) ped.panic = Math.hypot(ped.pos.x - W.playerPos.x, ped.pos.z - W.playerPos.z) > 40;
}

function carStep(car, dt) {
  if (!car.npc) return;
  const ahead = { x: car.pos.x + Math.sin(car.yaw) * 9, z: car.pos.z + Math.cos(car.yaw) * 9 };
  let blocked = false;
  for (const other of W.cars) {
    if (other === car || !other.npc) continue;
    if (Math.hypot(other.pos.x - ahead.x, other.pos.z - ahead.z) < 5) { blocked = true; break; }
  }
  if (!blocked && W.car && Math.hypot(W.car.pos.x - ahead.x, W.car.pos.z - ahead.z) < 6) blocked = true;
  const targetSpeed = blocked ? 0 : car.cruise ?? 10;
  car.speed += Math.sign(targetSpeed - car.speed) * Math.min(Math.abs(targetSpeed - car.speed), 6 * dt);
  car.pos.x += Math.sin(car.yaw) * car.speed * dt;
  car.pos.z += Math.cos(car.yaw) * car.speed * dt;
  // At an intersection, sometimes turn onto the cross street.
  const nearX = Math.abs(car.pos.x % CFG.grid) < 1.2 || Math.abs(car.pos.x % CFG.grid) > CFG.grid - 1.2;
  const nearZ = Math.abs(car.pos.z % CFG.grid) < 1.2 || Math.abs(car.pos.z % CFG.grid) > CFG.grid - 1.2;
  if (nearX && nearZ && Math.random() < 0.02) {
    car.yaw += (Math.random() > 0.5 ? 1 : -1) * Math.PI / 2;
  }
  // Wrap around the city edge so traffic never runs out.
  if (car.pos.x > CFG.cityHalf + 20) car.pos.x = -CFG.cityHalf - 20;
  if (car.pos.x < -CFG.cityHalf - 20) car.pos.x = CFG.cityHalf + 20;
  if (car.pos.z > CFG.cityHalf + 20) car.pos.z = -CFG.cityHalf - 20;
  if (car.pos.z < -CFG.cityHalf - 20) car.pos.z = CFG.cityHalf + 20;
  car.group.position.set(car.pos.x, 0, car.pos.z);
  car.group.rotation.y = car.yaw;
  const spin = car.speed * dt * 2.6;
  for (const wheel of car.group.userData.wheels) wheel.rotation.x += spin;
}

// The player's car hitting a pedestrian is a crime — and it shows.
function checkPedHits() {
  if (!W.car || Math.abs(W.carSpeed) < 4) return;
  for (const ped of W.peds) {
    if (ped.down) continue;
    const d = Math.hypot(ped.pos.x - W.car.pos.x, ped.pos.z - W.car.pos.z);
    if (d < 2.1) {
      ped.down = true;
      ped.downTimer = 4;
      ped.group.rotation.x = -Math.PI / 2;
      ped.group.position.y = 0.4;
      addWanted(1, 'hit-ped');
      if (W.audio) W.audio.punch();
    }
  }
  // Bumping another car hard also draws attention.
  for (const car of W.cars) {
    if (car === W.car || !car.npc) continue;
    const d = Math.hypot(car.pos.x - W.car.pos.x, car.pos.z - W.car.pos.z);
    if (d < 3.4 && Math.abs(W.carSpeed) > 8) {
      car.speed = 2;
      addWanted(1, 'crash');
    }
  }
}

export function updateTraffic(dt) {
  for (const car of W.cars) carStep(car, dt);
  for (const ped of W.peds) pedStep(ped, dt);
  W.peds = W.peds.filter((p) => {
    if (p.removeMe) {
      W.scene.remove(p.group);
      return false;
    }
    return true;
  });
  // Keep the streets populated.
  if (W.peds.length < 16 && Math.random() < 0.01) {
    spawnPed(W.scene, mulberry32((Math.random() * 1e9) | 0));
  }
  if (W.cars.filter((c) => c.npc).length < 8 && Math.random() < 0.005) {
    spawnTrafficCar(W.scene, mulberry32((Math.random() * 1e9) | 0));
  }
  checkPedHits();
}
