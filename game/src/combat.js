// Combat: fists and a pistol. A punch hits the nearest enemy in front of the
// player; a pistol shot raycasts from the camera through the crosshair and
// hurts whatever it hits first — an enemy, a pedestrian, a cop, or a car.
// Enemies are the mission crews: they chase the player and swing back.

import * as THREE from 'three';
import { PLAYER } from './config.js';

function makeEnemyMesh() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 1.0, 0.44),
    new THREE.MeshLambertMaterial({ color: 0xc23b2e }),
  );
  body.position.y = 0.95;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xd9a077 }),
  );
  head.position.y = 1.68;
  group.add(head);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.5, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x1a1d24 }),
  );
  legs.position.y = 0.25;
  legs.name = 'legs';
  group.add(legs);
  return group;
}

export function createCombat(scene, S) {
  const raycaster = new THREE.Raycaster();
  const shootFrom = new THREE.Vector3();
  const shootDir = new THREE.Vector3();

  function spawnEnemy(x, z) {
    const mesh = makeEnemyMesh();
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const enemy = {
      mesh,
      pos: mesh.position,
      heading: 0,
      health: 100,
      swingTimer: 0,
      walkPhase: S.rng() * 6,
    };
    S.enemies.push(enemy);
    return enemy;
  }

  function killEnemy(enemy) {
    scene.remove(enemy.mesh);
    const i = S.enemies.indexOf(enemy);
    if (i !== -1) S.enemies.splice(i, 1);
    S.audio.punch();
  }

  function damageEnemy(enemy, amount) {
    enemy.health -= amount;
    if (enemy.health <= 0) {
      killEnemy(enemy);
      S.player.money += 20;
      S.hud.showDialog('Crew member down. +$20', 1.5);
      S.missions.onEnemyDown();
    }
  }

  function punch() {
    const p = S.player;
    if (!p.onFoot || p.punchTimer > 0) return;
    p.punchTimer = PLAYER.punchCooldown;
    S.audio.punch();
    // Nearest enemy or cop inside range and roughly in front.
    let best = null;
    let bestD = PLAYER.punchRange;
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    const consider = (pos, target) => {
      const dx = pos.x - p.pos.x;
      const dz = pos.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < bestD && (dx * fx + dz * fz) / Math.max(d, 0.01) > 0.2) {
        bestD = d;
        best = target;
      }
    };
    for (const e of S.enemies) consider(e.pos, { kind: 'enemy', ref: e });
    for (const c of S.cops) consider(c.pos, { kind: 'cop', ref: c });
    for (const ped of S.peds) consider(ped.pos, { kind: 'ped', ref: ped });
    if (!best) return;
    if (best.kind === 'enemy') damageEnemy(best.ref, PLAYER.punchDamage);
    else if (best.kind === 'cop') {
      S.police.addHeat(1);
      S.hud.showDialog('You hit a cop! That was a mistake.', 2.5);
    } else {
      best.ref.scared = 3;
      S.police.addHeat(1);
    }
  }

  function shoot() {
    const p = S.player;
    if (!p.onFoot || !p.pistol || p.shootTimer > 0) return;
    p.shootTimer = PLAYER.shootCooldown;
    S.audio.shot();
    S.audio.ensure();
    S.camera.getWorldPosition(shootFrom);
    S.camera.getWorldDirection(shootDir);
    raycaster.set(shootFrom, shootDir);
    raycaster.far = PLAYER.shootRange;
    const targets = [];
    for (const e of S.enemies) targets.push(e.mesh);
    for (const c of S.cops) targets.push(c.mesh);
    for (const ped of S.peds) targets.push(ped.mesh);
    for (const car of S.cars) targets.push(car.mesh);
    const hits = raycaster.intersectObjects(targets, true);
    if (hits.length === 0) return;
    let hit = hits[0].object;
    while (hit.parent && hit.parent !== scene) hit = hit.parent;
    const enemy = S.enemies.find((e) => e.mesh === hit);
    if (enemy) {
      damageEnemy(enemy, PLAYER.shootDamage);
      return;
    }
    const cop = S.cops.find((c) => c.mesh === hit);
    if (cop) {
      S.police.addHeat(1);
      S.hud.showDialog('You shot a cop! Every cruiser in the city is coming.', 3);
      return;
    }
    const ped = S.peds.find((pd) => pd.mesh === hit);
    if (ped) {
      ped.scared = 3;
      S.police.addHeat(1);
      return;
    }
    const car = S.cars.find((c) => c.mesh === hit);
    if (car) {
      car.health -= PLAYER.shootDamage;
      S.police.addHeat(0.5);
      if (car.health <= 0) {
        S.hud.showDialog('You blew up a car!', 2);
        S.vehicles.removeCar(car);
      }
    }
  }

  function update(dt) {
    const p = S.player;
    p.punchTimer = Math.max(0, (p.punchTimer || 0) - dt);
    p.shootTimer = Math.max(0, (p.shootTimer || 0) - dt);
    for (const enemy of [...S.enemies]) {
      const dx = p.pos.x - enemy.pos.x;
      const dz = p.pos.z - enemy.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 60) continue;
      const want = Math.atan2(dx, dz);
      let dh = want - enemy.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      enemy.heading += Math.max(-3 * dt, Math.min(3 * dt, dh));
      if (dist > 1.6) {
        const speed = p.car ? 7.5 : 5.2;
        enemy.pos.x += Math.sin(enemy.heading) * speed * dt;
        enemy.pos.z += Math.cos(enemy.heading) * speed * dt;
        enemy.walkPhase += dt * speed * 2;
        const legs = enemy.mesh.getObjectByName('legs');
        if (legs) legs.position.y = 0.25 + Math.abs(Math.sin(enemy.walkPhase)) * 0.1;
      } else {
        enemy.swingTimer -= dt;
        if (enemy.swingTimer <= 0) {
          enemy.swingTimer = 0.9;
          S.damagePlayer(9, 'beat up by the crew');
        }
      }
      enemy.mesh.rotation.y = enemy.heading;
    }
  }

  return { update, punch, shoot, spawnEnemy, damageEnemy };
}
