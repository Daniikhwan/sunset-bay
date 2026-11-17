// The city's other inhabitants: traffic cars that cruise the road grid and
// pedestrians who stroll the sidewalks and cross at intersections. Traffic
// cars follow a road, turn at random at each crossing, and brake for the car
// ahead; pedestrians pick a sidewalk, walk it to the end, then pick another.
// Both are scenery with rules: hit one and the wanted level notices.

import * as THREE from 'three';
import { CAR, PED, ROADS, TRAFFIC, WORLD } from './config.js';
import { resolveCircle } from './city.js';

function makePedMesh(rng) {
  const group = new THREE.Group();
  const shirt = [0xd94f3d, 0x3d7bd9, 0xe8c33a, 0x8a5fd0, 0xe8e4da, 0x4fae62][Math.floor(rng() * 6)];
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.85, 0.35),
    new THREE.MeshLambertMaterial({ color: shirt }),
  );
  body.position.y = 0.85;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0xd9a077 }),
  );
  head.position.y = 1.5;
  group.add(head);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.45, 0.32),
    new THREE.MeshLambertMaterial({ color: 0x2c3440 }),
  );
  legs.position.y = 0.22;
  legs.name = 'legs';
  group.add(legs);
  return group;
}

export function createTraffic(scene, S) {
  function randomRoadPoint() {
    const road = ROADS[Math.floor(S.rng() * ROADS.length)];
    const t = -150 + S.rng() * 300;
    return S.rng() < 0.5 ? { x: road, z: t } : { x: t, z: road };
  }

  function spawnTrafficCar() {
    const at = randomRoadPoint();
    const alongZ = Math.abs(at.x - Math.round(at.x)) < 1 && ROADS.includes(Math.round(at.x));
    const heading = alongZ ? (S.rng() < 0.5 ? 0 : Math.PI) : (S.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const car = S.vehicles.spawnCar('civil', at.x, at.z, heading, { driver: 'npc' });
    car.speed = CAR.npcSpeed * (0.8 + S.rng() * 0.4);
    car.route = { road: Math.round(alongZ ? at.x : at.z), alongZ, dir: heading };
    return car;
  }

  function spawnPed() {
    const at = randomRoadPoint();
    const mesh = makePedMesh(S.rng);
    mesh.position.set(at.x + (S.rng() - 0.5) * 4, 0, at.z + (S.rng() - 0.5) * 4);
    scene.add(mesh);
    const ped = {
      mesh,
      pos: mesh.position,
      heading: S.rng() * Math.PI * 2,
      speed: PED.walkSpeed * (0.7 + S.rng() * 0.6),
      target: null,
      walkPhase: S.rng() * 6,
      scared: 0,
    };
    S.peds.push(ped);
    return ped;
  }

  function pickPedTarget(ped) {
    const at = randomRoadPoint();
    ped.target = { x: at.x + (S.rng() - 0.5) * 8, z: at.z + (S.rng() - 0.5) * 8 };
  }

  function stepTrafficCar(car, dt) {
    const route = car.route;
    // At an intersection, sometimes turn onto the crossing road.
    const nearCross = ROADS.some((r) => Math.abs((route.alongZ ? car.mesh.position.z : car.mesh.position.x) - r) < 2);
    if (nearCross && S.rng() < dt * 0.5) {
      const cross = ROADS[Math.floor(S.rng() * ROADS.length)];
      if (route.alongZ) {
        route.alongZ = false;
        route.road = cross;
        car.heading = S.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        route.alongZ = true;
        route.road = cross;
        car.heading = S.rng() < 0.5 ? 0 : Math.PI;
      }
    }
    // Ease back onto the lane centre: the correction flips with driving
    // direction, since turning toward the centre means a different heading
    // change when heading north versus south.
    const lane = route.alongZ ? car.mesh.position.x : car.mesh.position.z;
    const off = lane - route.road;
    const steer = route.alongZ
      ? Math.max(-0.4, Math.min(0.4, -off * 0.3 * Math.cos(car.heading)))
      : Math.max(-0.4, Math.min(0.4, off * 0.3 * Math.sin(car.heading)));
    // Brake for the car ahead.
    let throttle = 0.55;
    for (const other of S.cars) {
      if (other === car) continue;
      const dx = other.mesh.position.x - car.mesh.position.x;
      const dz = other.mesh.position.z - car.mesh.position.z;
      const ahead = route.alongZ ? dz * Math.cos(car.heading) : dx * Math.sin(car.heading);
      const side = Math.abs(route.alongZ ? dx : dz);
      if (ahead > 0 && ahead < TRAFFIC.minGap && side < 3) throttle = -0.8;
    }
    S.vehicles.drive(car, dt, throttle, steer);
    car.speed = Math.max(0, Math.min(CAR.npcSpeed * 1.2, car.speed));
  }

  function stepPed(ped, dt) {
    if (!ped.target) pickPedTarget(ped);
    const dx = ped.target.x - ped.pos.x;
    const dz = ped.target.z - ped.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.5) {
      pickPedTarget(ped);
      return;
    }
    const want = Math.atan2(dx, dz);
    let dh = want - ped.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    ped.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
    const speed = ped.scared > 0 ? PED.walkSpeed * 3.2 : ped.speed;
    ped.scared = Math.max(0, ped.scared - dt);
    ped.pos.x += Math.sin(ped.heading) * speed * dt;
    ped.pos.z += Math.cos(ped.heading) * speed * dt;
    ped.pos.x = Math.max(-168, Math.min(168, ped.pos.x));
    ped.pos.z = Math.max(-168, Math.min(164, ped.pos.z));
    resolveCircle(S.city.colliders, ped.pos, PED.radius);
    ped.walkPhase += dt * speed * 2.2;
    const legs = ped.mesh.getObjectByName('legs');
    if (legs) legs.position.y = 0.22 + Math.abs(Math.sin(ped.walkPhase)) * 0.1;
    ped.mesh.rotation.y = ped.heading;
    // Flee a speeding car or a gunshot nearby.
    const playerCar = S.player.car;
    const threat = playerCar ? playerCar.mesh.position : S.player.pos;
    const td = Math.hypot(threat.x - ped.pos.x, threat.z - ped.pos.z);
    if (td < 6 && (playerCar ? Math.abs(playerCar.speed) > 12 : S.player.pistol)) ped.scared = 2.5;
  }

  function update(dt) {
    for (const car of [...S.cars]) {
      if (car.kind === 'civil' && car.driver === 'npc' && !car.parked) stepTrafficCar(car, dt);
    }
    for (const ped of S.peds) stepPed(ped, dt);
    // A car the player is driving fast into a pedestrian is a crime.
    for (const ped of S.peds) {
      const p = S.player;
      const threatPos = p.car ? p.car.mesh.position : p.pos;
      const d = Math.hypot(threatPos.x - ped.pos.x, threatPos.z - ped.pos.z);
      if (d < 1.6) {
        ped.scared = 3;
        ped.pos.x += (ped.pos.x - threatPos.x) * 0.4;
        ped.pos.z += (ped.pos.z - threatPos.z) * 0.4;
        if (!ped.hitCooldown) {
          ped.hitCooldown = 2;
          S.police.addHeat(1);
          S.hud.showDialog('You hit a pedestrian! The cops are coming.', 3);
          S.audio.punch();
        }
      }
      if (ped.hitCooldown) ped.hitCooldown -= dt;
    }
  }

  function init() {
    for (let i = 0; i < TRAFFIC.count; i += 1) spawnTrafficCar();
    for (const spot of S.city.parkingSpots) {
      S.vehicles.spawnCar('civil', spot.x, spot.z, spot.heading, { parked: true });
    }
    for (let i = 0; i < PED.count; i += 1) spawnPed();
  }

  return { init, update, spawnTrafficCar, spawnPed };
}
