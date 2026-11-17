// The player on foot: a small figure that walks and runs in the direction the
// camera faces, bumps into buildings, and climbs in and out of cars. When the
// player is driving, this module does nothing — vehicles.js owns the car —
// except keep the figure hidden inside it.

import * as THREE from 'three';
import { CAR, PLAYER } from './config.js';
import { resolveCircle } from './city.js';

export function createPlayer(scene, S) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 1.0, 0.42),
    new THREE.MeshLambertMaterial({ color: PALETTE_PLAYER }),
  );
  body.position.y = 0.95;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xe8b98a }),
  );
  head.position.y = 1.68;
  group.add(head);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.5, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x2c3440 }),
  );
  legs.position.y = 0.25;
  legs.name = 'legs';
  group.add(legs);
  scene.add(group);

  const p = S.player;
  p.mesh = group;
  group.position.copy(p.pos);
  group.rotation.y = p.heading;

  function enterCar(car) {
    if (car.driver === 'npc') {
      // Yank the driver out: stealing a driven car is a crime.
      car.driver = null;
      S.police.addHeat(1);
      S.hud.showDialog('You jacked the car! The driver ran off shouting.', 3);
    } else {
      S.hud.showDialog('You got in the car.', 1.5);
    }
    car.driver = 'player';
    car.parked = false;
    p.onFoot = false;
    p.car = car;
    group.visible = false;
    S.audio.ensure();
  }

  function exitCar() {
    const car = p.car;
    if (!car) return;
    car.driver = null;
    car.speed = 0;
    const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
    p.pos.set(car.mesh.position.x + side.x * 2.2, 0, car.mesh.position.z + side.z * 2.2);
    resolveCircle(S.city.colliders, p.pos, PLAYER.radius);
    p.onFoot = true;
    p.car = null;
    group.visible = true;
    group.position.copy(p.pos);
  }

  function update(dt) {
    if (!p.onFoot) {
      // Ride along: the figure stays hidden at the car's seat.
      group.position.copy(p.car.mesh.position);
      return;
    }
    const move = S.input.move();
    const look = S.input.takeLook();
    S.cameraYaw -= look.dx * 0.005;
    S.cameraPitch = Math.max(-0.15, Math.min(0.9, S.cameraPitch + look.dy * 0.003));
    const speed = move.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    // Movement is relative to where the camera looks: W walks away from the
    // camera, D strafes to the camera's right (which is -x when facing +z).
    const sin = Math.sin(S.cameraYaw);
    const cos = Math.cos(S.cameraYaw);
    let mx = sin * move.forward - cos * move.strafe;
    let mz = cos * move.forward + sin * move.strafe;
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      mx /= len;
      mz /= len;
      p.pos.x += mx * speed * dt;
      p.pos.z += mz * speed * dt;
      p.heading = Math.atan2(mx, mz);
      p.walkPhase += dt * speed * 1.6;
      legs.position.y = 0.25 + Math.abs(Math.sin(p.walkPhase)) * 0.12;
    }
    p.pos.x = Math.max(-168, Math.min(168, p.pos.x));
    p.pos.z = Math.max(-168, Math.min(164, p.pos.z));
    resolveCircle(S.city.colliders, p.pos, PLAYER.radius);
    group.position.copy(p.pos);
    group.rotation.y = p.heading;

    if (S.input.take('interact')) {
      const car = S.vehicles.nearestCar(p.pos, CAR.enterRange);
      if (car) enterCar(car);
      else S.missions.tryInteract();
    }
    if (S.input.take('weapon')) {
      p.pistol = !p.pistol;
      S.hud.showDialog(p.pistol ? 'Pistol out. Click to shoot.' : 'Fists out. Click or press F to punch.', 2);
      S.audio.click();
    }
    if (S.input.take('punch')) S.combat.punch();
    if (S.input.take('attack')) {
      if (p.pistol) S.combat.shoot();
      else S.combat.punch();
    }
  }

  return { update, enterCar, exitCar };
}

const PALETTE_PLAYER = 0x2f9e6e;
