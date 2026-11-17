// The player on foot: a box-built person who walks, sprints, punches and
// shoots, and climbs in and out of cars. While driving the person is hidden
// inside the car. The heading is the aim direction (mouse look sets it);
// WASD moves relative to it, GTA style.

import * as THREE from '../vendor/three.module.min.js';
import { ON_FOOT, PALETTE } from './config.js';
import { resolveCollision } from './city.js';

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const headGeo = new THREE.SphereGeometry(0.26, 12, 10);

export function createPlayer(scene, x, z) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a077 });
  const shirt = new THREE.MeshLambertMaterial({ color: PALETTE.player });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });

  const torso = new THREE.Mesh(boxGeo, shirt);
  torso.scale.set(0.72, 0.85, 0.4);
  torso.position.y = 1.15;
  group.add(torso);
  const head = new THREE.Mesh(headGeo, skin);
  head.position.y = 1.78;
  group.add(head);
  const legL = new THREE.Mesh(boxGeo, pants);
  legL.scale.set(0.28, 0.75, 0.32);
  legL.position.set(-0.18, 0.38, 0);
  group.add(legL);
  const legR = new THREE.Mesh(boxGeo, pants);
  legR.scale.set(0.28, 0.75, 0.32);
  legR.position.set(0.18, 0.38, 0);
  group.add(legR);
  const armL = new THREE.Mesh(boxGeo, shirt);
  armL.scale.set(0.2, 0.7, 0.24);
  armL.position.set(-0.48, 1.18, 0);
  group.add(armL);
  const armR = new THREE.Mesh(boxGeo, shirt);
  armR.scale.set(0.2, 0.7, 0.24);
  armR.position.set(0.48, 1.18, 0);
  group.add(armR);
  const gun = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  gun.scale.set(0.1, 0.12, 0.5);
  gun.position.set(0.48, 1.15, -0.35);
  gun.visible = false;
  group.add(gun);
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  scene.add(group);
  const player = {
    pos: new THREE.Vector3(x, 0, z),
    heading: 0,
    speed: 0,
    health: ON_FOOT.health,
    cash: 0,
    pistol: false,
    ammo: 12,
    onFoot: true,
    car: null,
    punchTimer: 0,
    reloadTimer: 0,
    invuln: 0,
    walkPhase: 0,
    group,
    legL,
    legR,
    armL,
    armR,
    gun,
  };
  syncPlayer(player);
  return player;
}

/** Place the person's meshes where its data says it is. */
export function syncPlayer(player) {
  player.group.position.copy(player.pos);
  player.group.rotation.y = player.heading;
  player.group.visible = player.onFoot;
  player.gun.visible = player.onFoot && player.pistol;
  const swing = Math.sin(player.walkPhase) * 0.5 * Math.min(1, player.speed / 6);
  player.legL.rotation.x = swing;
  player.legR.rotation.x = -swing;
  player.armL.rotation.x = -swing * 0.7;
  player.armR.rotation.x = player.pistol ? -1.35 : swing * 0.7;
}

/**
 * One step on foot. `move` is {forward, right} in -1..1, `sprint` is a
 * boolean; the heading is already set by the mouse. Returns nothing.
 */
export function stepOnFoot(player, move, sprint, dt, colliders) {
  const target = sprint ? ON_FOOT.sprint : ON_FOOT.walk;
  const want = Math.hypot(move.forward, move.right) > 0 ? target : 0;
  player.speed += (want - player.speed) * Math.min(1, dt * 6);
  if (player.speed < 0.05) player.speed = 0;
  const fx = Math.sin(player.heading);
  const fz = Math.cos(player.heading);
  const rx = Math.cos(player.heading);
  const rz = -Math.sin(player.heading);
  const mx = fx * move.forward + rx * move.right;
  const mz = fz * move.forward + rz * move.right;
  const len = Math.hypot(mx, mz) || 1;
  const nx = player.pos.x + (mx / len) * player.speed * dt;
  const nz = player.pos.z + (mz / len) * player.speed * dt;
  const hit = resolveCollision(nx, nz, 0.55, colliders);
  player.pos.x = hit.x;
  player.pos.z = hit.z;
  player.pos.y = 0;
  player.walkPhase += player.speed * dt * 1.6;
  if (player.punchTimer > 0) player.punchTimer -= dt;
  if (player.reloadTimer > 0) player.reloadTimer -= dt;
  if (player.invuln > 0) player.invuln -= dt;
  syncPlayer(player);
}

/** Put the player beside a car (driver's side) and take the wheel. */
export function enterCar(player, car) {
  player.car = car;
  player.onFoot = false;
  car.driver = true;
  car.speed = 0;
  syncPlayer(player);
}

/** Step out of the car, on its left side. */
export function exitCar(player) {
  const car = player.car;
  if (!car) return;
  car.driver = false;
  car.speed = 0;
  const sx = Math.cos(car.heading);
  const sz = -Math.sin(car.heading);
  player.pos.set(car.pos.x + sx * 2.2, 0, car.pos.z + sz * 2.2);
  player.heading = car.heading;
  player.car = null;
  player.onFoot = true;
  player.speed = 0;
  syncPlayer(player);
}
