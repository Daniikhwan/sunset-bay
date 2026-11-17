// Sunset Bay — the Sunset Bay PD. Cop cars spawn at the city edge when the
// wanted level rises and chase the player; foot cops sprint after a player
// on foot, and holding the player at close range ends the run (BUSTED).
import * as THREE from 'three';
import { CFG, mulberry32, range } from './config.js';
import { W, setDialog } from './world.js';
import { makeCarMesh } from './vehicles.js';
import { makePedMesh } from './traffic.js';
import { resolveBlocked } from './city.js';

function playerTarget() {
  return W.onFoot ? W.playerPos : W.car.pos;
}

export function spawnCopCar(scene, rng) {
  const edge = [
    { x: -CFG.cityHalf, z: range(rng, -180, 180) },
    { x: CFG.cityHalf, z: range(rng, -180, 180) },
    { x: range(rng, -180, 180), z: -CFG.cityHalf },
    { x: range(rng, -180, 180), z: CFG.cityHalf },
  ][Math.floor(rng() * 4)];
  const mesh = makeCarMesh(0x1a1a22, true);
  mesh.position.set(edge.x, 0, edge.z);
  scene.add(mesh);
  const cop = {
    group: mesh, pos: { x: edge.x, z: edge.z }, yaw: 0, speed: 0,
    sirenPhase: rng() * Math.PI,
  };
  W.cops.push(cop);
  return cop;
}

export function spawnFootCop(scene, rng) {
  const t = playerTarget();
  const a = range(rng, 0, Math.PI * 2);
  const x = t.x + Math.cos(a) * 26;
  const z = t.z + Math.sin(a) * 26;
  const mesh = makePedMesh(mulberry32((rng() * 1e9) | 0));
  // Navy uniform: recolor the torso.
  mesh.children[1].material = new THREE.MeshLambertMaterial({ color: 0x1a2f5a });
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  const cop = { group: mesh, pos: { x, z }, yaw: 0, speed: 6.4 };
  W.footCops.push(cop);
  return cop;
}

function copCarStep(cop, dt) {
  if (cop.staged) {
    // Staged for a screenshot: hold lane and speed in formation instead of
    // converging on the player, so cruisers read as a motorcade, not a pile.
    cop.pos.x += Math.sin(cop.yaw) * cop.speed * dt;
    cop.pos.z += Math.cos(cop.yaw) * cop.speed * dt;
    cop.group.position.set(cop.pos.x, 0, cop.pos.z);
    cop.group.rotation.y = cop.yaw;
    cop.sirenPhase += dt * 7;
    const bars = cop.group.userData.lightBar;
    if (bars) {
      const on = Math.sin(cop.sirenPhase) > 0;
      bars[0].material.color.setHex(on ? 0xff2020 : 0x550000);
      bars[1].material.color.setHex(on ? 0x2040ff : 0x000055);
    }
    const spin = cop.speed * dt * 2.6;
    for (const wheel of cop.group.userData.wheels) wheel.rotation.x += spin;
    return;
  }
  const t = playerTarget();
  const dx = t.x - cop.pos.x;
  const dz = t.z - cop.pos.z;
  const dist = Math.hypot(dx, dz);
  const wantYaw = Math.atan2(dx, dz);
  let dy = wantYaw - cop.yaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  cop.yaw += Math.max(-2.4 * dt, Math.min(2.4 * dt, dy));
  const targetSpeed = dist > 6 ? CFG.copChaseSpeed : 6;
  cop.speed += Math.sign(targetSpeed - cop.speed) * Math.min(Math.abs(targetSpeed - cop.speed), 18 * dt);
  cop.pos.x += Math.sin(cop.yaw) * cop.speed * dt;
  cop.pos.z += Math.cos(cop.yaw) * cop.speed * dt;
  cop.group.position.set(cop.pos.x, 0, cop.pos.z);
  cop.group.rotation.y = cop.yaw;
  // Flashing light bar.
  cop.sirenPhase += dt * 7;
  const bars = cop.group.userData.lightBar;
  if (bars) {
    const on = Math.sin(cop.sirenPhase) > 0;
    bars[0].material.color.setHex(on ? 0xff2020 : 0x550000);
    bars[1].material.color.setHex(on ? 0x2040ff : 0x000055);
  }
  const spin = cop.speed * dt * 2.6;
  for (const wheel of cop.group.userData.wheels) wheel.rotation.x += spin;
  // Ramming the player's car hurts and slows it.
  if (W.car && dist < 3.6) {
    W.car.speed *= 0.86;
    if (W.audio) W.audio.punch();
  }
}

function footCopStep(cop, dt) {
  const t = playerTarget();
  const dx = t.x - cop.pos.x;
  const dz = t.z - cop.pos.z;
  const dist = Math.hypot(dx, dz);
  cop.yaw = Math.atan2(dx, dz);
  const speed = cop.speed * (dist > 30 ? 1.15 : 1);
  cop.pos.x += (dx / Math.max(dist, 0.01)) * speed * dt;
  cop.pos.z += (dz / Math.max(dist, 0.01)) * speed * dt;
  cop.group.position.set(cop.pos.x, 0, cop.pos.z);
  cop.group.rotation.y = cop.yaw;
  cop.group.position.y = Math.abs(Math.sin(W.time * 10)) * 0.08;
  // Close and on foot: the busted clock ticks.
  if (W.onFoot && dist < 2.6) {
    W.heldByCop += dt;
    if (W.heldByCop > 2.2) bustPlayer();
  }
}

export function bustPlayer() {
  if (W.mode !== 'play') return;
  W.mode = 'busted';
  W.heldByCop = 0;
  W.wanted = 0;
  setDialog('The Sunset Bay PD has you. The run ends here — for now.', 999);
  if (W.audio) {
    W.audio.bustedSting();
    W.audio.setSiren(false);
    W.audio.setEngine(0, false);
  }
}

export function wastePlayer() {
  if (W.mode !== 'play') return;
  W.mode = 'wasted';
  W.wanted = 0;
  setDialog('Sunset Bay chewed you up. Get patched up and come back swinging.', 999);
  if (W.audio) {
    W.audio.bustedSting();
    W.audio.setSiren(false);
    W.audio.setEngine(0, false);
  }
}

export function updatePolice(dt) {
  // Wanted level decays when the player keeps their nose clean and unseen.
  if (W.wanted > 0 && W.mode === 'play') {
    W.sinceCrime += dt;
    const nearestCop = Math.min(
      ...W.cops.map((c) => Math.hypot(c.pos.x - W.playerPos.x, c.pos.z - W.playerPos.z)),
      ...W.footCops.map((c) => Math.hypot(c.pos.x - W.playerPos.x, c.pos.z - W.playerPos.z)),
      999,
    );
    if (W.sinceCrime > CFG.wantedDecaySeconds && nearestCop > 35) {
      W.wanted -= 1;
      W.sinceCrime = 0;
      setDialog('The heat is cooling off…', 3);
    }
  }
  // Spawn pressure scales with the wanted level.
  const wantCars = W.wanted === 0 ? 0 : Math.min(1 + W.wanted, 5);
  const rng = mulberry32((Math.random() * 1e9) | 0);
  if (W.mode === 'play' && W.cops.length < wantCars && Math.random() < 0.03) {
    spawnCopCar(W.scene, rng);
  }
  if (W.mode === 'play' && W.wanted >= 2 && W.onFoot && W.footCops.length < Math.min(W.wanted, 3) && Math.random() < 0.02) {
    spawnFootCop(W.scene, rng);
  }
  for (const cop of W.cops) copCarStep(cop, dt);
  for (const cop of W.footCops) footCopStep(cop, dt);
  // Despawn the pursuit when the heat is gone.
  if (W.wanted === 0) {
    for (const cop of W.cops) W.scene.remove(cop.group);
    for (const cop of W.footCops) W.scene.remove(cop.group);
    W.cops = [];
    W.footCops = [];
  }
  if (W.audio) W.audio.setSiren(W.wanted > 0 && W.mode === 'play');
}
