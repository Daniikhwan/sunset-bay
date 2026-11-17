// The wanted level: stars that rise with every crime and fall when the heat
// dies down. Police cruisers spawn at the edge of the map and chase the
// player; foot cops run the player down on foot. Get caught on foot and it is
// BUSTED; get your car smashed up or your health to zero and it is WASTED.

import * as THREE from 'three';
import { CAR, ROADS, WANTED } from './config.js';
import { resolveCircle } from './city.js';

function makeCopMesh() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.9, 0.38),
    new THREE.MeshLambertMaterial({ color: 0x1c4fd7 }),
  );
  body.position.y = 0.9;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0xd9a077 }),
  );
  head.position.y = 1.55;
  group.add(head);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.26, 0.1, 8),
    new THREE.MeshLambertMaterial({ color: 0x10131a }),
  );
  cap.position.y = 1.74;
  group.add(cap);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.45, 0.34),
    new THREE.MeshLambertMaterial({ color: 0x10131a }),
  );
  legs.position.y = 0.22;
  legs.name = 'legs';
  group.add(legs);
  return group;
}

export function createPolice(scene, S) {
  let quietTimer = 0;

  function addHeat(amount) {
    if (S.screen !== 'play') return;
    S.wanted = Math.min(WANTED.max, S.wanted + amount);
    quietTimer = 0;
    if (S.wanted >= 1) S.audio.siren(true);
  }

  function spawnEdgePoint() {
    const p = S.player;
    const angle = S.rng() * Math.PI * 2;
    return {
      x: Math.max(-160, Math.min(160, p.pos.x + Math.cos(angle) * 90)),
      z: Math.max(-160, Math.min(160, p.pos.z + Math.sin(angle) * 90)),
    };
  }

  function spawnPoliceCar() {
    const at = spawnEdgePoint();
    const car = S.vehicles.spawnCar('police', at.x, at.z, 0, { driver: 'npc' });
    car.speed = 10;
    return car;
  }

  function spawnFootCop() {
    const at = spawnEdgePoint();
    const mesh = makeCopMesh();
    mesh.position.set(at.x, 0, at.z);
    scene.add(mesh);
    const cop = { mesh, pos: mesh.position, heading: 0, grabTimer: 0, walkPhase: S.rng() * 6 };
    S.cops.push(cop);
    return cop;
  }

  function removeCop(cop) {
    scene.remove(cop.mesh);
    const i = S.cops.indexOf(cop);
    if (i !== -1) S.cops.splice(i, 1);
  }

  function stepPoliceCar(car, dt) {
    const p = S.player;
    const target = p.car ? p.car.mesh.position : p.pos;
    const dx = target.x - car.mesh.position.x;
    const dz = target.z - car.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, dh * 1.4));
    const throttle = dist > 6 ? 1 : 0.4;
    S.vehicles.drive(car, dt, throttle, steer);
    // Ramming the player's car damages it; ramming the player on foot busts them.
    if (dist < 3.4) {
      if (p.car) {
        p.car.health -= 18 * dt;
        if (p.car.health <= 0) {
          const wreck = p.car;
          S.hud.showDialog('Your car is wrecked!', 2);
          S.playerCtl.exitCar();
          S.vehicles.removeCar(wreck);
        }
      } else if (p.onFoot) {
        copGrab(dt, 0.9);
      }
    }
  }

  function copGrab(dt, rate) {
    // Shared bust progress: any cop close by counts it up.
    S.bustTimer = (S.bustTimer || 0) + dt * rate;
    if (S.bustTimer > 1.4) {
      S.bustTimer = 0;
      S.endGame('busted');
    }
  }

  function stepFootCop(cop, dt) {
    const p = S.player;
    const dx = p.pos.x - cop.pos.x;
    const dz = p.pos.z - cop.pos.z;
    const dist = Math.hypot(dx, dz);
    if (p.car) {
      // The player drove off: the cop gives up and despawns far away.
      if (dist > 70) removeCop(cop);
      return;
    }
    const want = Math.atan2(dx, dz);
    let dh = want - cop.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    cop.heading += Math.max(-3 * dt, Math.min(3 * dt, dh));
    const speed = 6.4;
    cop.pos.x += Math.sin(cop.heading) * speed * dt;
    cop.pos.z += Math.cos(cop.heading) * speed * dt;
    resolveCircle(S.city.colliders, cop.pos, 0.5);
    cop.walkPhase += dt * speed * 2;
    const legs = cop.mesh.getObjectByName('legs');
    if (legs) legs.position.y = 0.22 + Math.abs(Math.sin(cop.walkPhase)) * 0.1;
    cop.mesh.rotation.y = cop.heading;
    if (dist < 1.8) copGrab(dt, 1);
    else S.bustTimer = Math.max(0, (S.bustTimer || 0) - dt);
  }

  function update(dt) {
    const wanted = Math.floor(S.wanted);
    const policeCars = S.cars.filter((c) => c.kind === 'police');
    const wantCars = wanted * WANTED.carsPerStar;
    while (policeCars.length < wantCars && S.cars.length < 30) {
      policeCars.push(spawnPoliceCar());
    }
    // Surplus cruisers cruise off and despawn.
    for (const car of [...policeCars]) {
      if (wanted === 0) {
        S.vehicles.removeCar(car);
        continue;
      }
      stepPoliceCar(car, dt);
    }
    const wantCops = S.player.car ? 0 : wanted * WANTED.footCopsPerStar;
    while (S.cops.length < wantCops) spawnFootCop();
    while (S.cops.length > wantCops) removeCop(S.cops[S.cops.length - 1]);
    for (const cop of [...S.cops]) stepFootCop(cop, dt);

    // Wanted decay: quiet for a while, far from any cop, and a star fades.
    const nearestCop = Math.min(
      ...S.cars.filter((c) => c.kind === 'police').map((c) => Math.hypot(c.mesh.position.x - S.player.pos.x, c.mesh.position.z - S.player.pos.z)),
      ...S.cops.map((c) => Math.hypot(c.pos.x - S.player.pos.x, c.pos.z - S.player.pos.z)),
      Infinity,
    );
    if (wanted > 0 && nearestCop > 55) {
      quietTimer += dt;
      if (quietTimer > WANTED.decayDelay + WANTED.decayStep) {
        S.wanted = Math.max(0, S.wanted - 1);
        quietTimer = 0;
        S.hud.showDialog('You lost them. Wanted level dropped.', 2.5);
      }
    } else {
      quietTimer = 0;
    }
    S.audio.siren(wanted >= 1);
  }

  return { addHeat, update };
}
