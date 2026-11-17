// Combat: the pistol and the fist, and the armed rivals who shoot back.
// Shooting is a ray against spheres (no scene raycast needed): the nearest
// thing the bullet's line passes close to, inside its range, is hit. Rivals
// are the plaza crew for mission three; they stand their ground and return
// fire with a hit chance that falls off with distance.

import * as THREE from '../vendor/three.module.min.js';
import { PISTOL } from './config.js';
import { addWanted } from './police.js';
import { dropPed } from './traffic.js';

const rivalBox = new THREE.BoxGeometry(1, 1, 1);
const rivalHead = new THREE.SphereGeometry(0.25, 10, 8);

function makeRival(scene, color) {
  const group = new THREE.Group();
  const coat = new THREE.MeshLambertMaterial({ color });
  const pants = new THREE.MeshLambertMaterial({ color: 0x1c1e24 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc89068 });
  const torso = new THREE.Mesh(rivalBox, coat);
  torso.scale.set(0.74, 0.88, 0.42);
  torso.position.y = 1.15;
  group.add(torso);
  const head = new THREE.Mesh(rivalHead, skin);
  head.position.y = 1.78;
  group.add(head);
  const legL = new THREE.Mesh(rivalBox, pants);
  legL.scale.set(0.28, 0.75, 0.32);
  legL.position.set(-0.18, 0.38, 0);
  group.add(legL);
  const legR = new THREE.Mesh(rivalBox, pants);
  legR.scale.set(0.28, 0.75, 0.32);
  legR.position.set(0.18, 0.38, 0);
  group.add(legR);
  const gun = new THREE.Mesh(rivalBox, new THREE.MeshLambertMaterial({ color: 0x141414 }));
  gun.scale.set(0.1, 0.12, 0.55);
  gun.position.set(0.46, 1.2, -0.35);
  group.add(gun);
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 14),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);
  scene.add(group);
  return { group, legL, legR };
}

export function createRivals(scene, positions) {
  return positions.map((p, i) => {
    const mesh = makeRival(scene, 0x8e44ad);
    const rival = {
      ...mesh,
      pos: new THREE.Vector3(p.x, 0, p.z),
      heading: 0,
      health: 100,
      alive: true,
      shootTimer: 1 + i * 0.4,
      walkPhase: 0,
    };
    rival.group.position.copy(rival.pos);
    rival.group.visible = false;
    return rival;
  });
}

function raySphere(origin, dir, centre, radius) {
  const ox = centre.x - origin.x;
  const oy = centre.y - origin.y;
  const oz = centre.z - origin.z;
  const along = ox * dir.x + oy * dir.y + oz * dir.z;
  if (along < 0) return Infinity;
  const cx = origin.x + dir.x * along;
  const cy = origin.y + dir.y * along;
  const cz = origin.z + dir.z * along;
  const d2 = (centre.x - cx) ** 2 + (centre.y - cy) ** 2 + (centre.z - cz) ** 2;
  return d2 <= radius * radius ? along : Infinity;
}

/**
 * Fire the pistol from `origin` along `dir`. Returns the thing hit ('rival',
 * 'ped', 'cop', 'car', 'none') so the caller can react.
 */
export function shoot(world, origin, dir) {
  const player = world.player;
  if (player.ammo <= 0 || player.reloadTimer > 0) return 'empty';
  player.ammo -= 1;
  const jitter = PISTOL.spread;
  const d = new THREE.Vector3(
    dir.x + (Math.random() - 0.5) * jitter,
    dir.y + (Math.random() - 0.5) * jitter,
    dir.z + (Math.random() - 0.5) * jitter,
  ).normalize();
  let best = PISTOL.range;
  let hitKind = 'none';
  let hitTarget = null;
  function consider(centre, radius, kind, target) {
    const t = raySphere(origin, d, centre, radius);
    if (t < best) {
      best = t;
      hitKind = kind;
      hitTarget = target;
    }
  }
  for (const r of world.rivals) {
    if (r.alive) consider(new THREE.Vector3(r.pos.x, 1.2, r.pos.z), 1.1, 'rival', r);
  }
  for (const p of world.traffic.peds) {
    if (p.state !== 'down') consider(new THREE.Vector3(p.pos.x, 1.1, p.pos.z), 0.9, 'ped', p);
  }
  for (const c of world.police.footCops) {
    consider(new THREE.Vector3(c.pos.x, 1.2, c.pos.z), 1.0, 'cop', c);
  }
  for (const car of world.cars) {
    if (car === player.car) continue;
    consider(new THREE.Vector3(car.pos.x, 1.0, car.pos.z), 2.4, 'car', car);
  }
  if (hitKind === 'rival') {
    hitTarget.health -= PISTOL.damage;
    if (hitTarget.health <= 0) {
      hitTarget.alive = false;
      hitTarget.group.visible = false;
      addWanted(world, 1);
    }
  } else if (hitKind === 'ped') {
    dropPed(hitTarget);
    addWanted(world, 1);
  } else if (hitKind === 'cop') {
    const idx = world.police.footCops.indexOf(hitTarget);
    if (idx >= 0) {
      world.police.scene.remove(hitTarget.group);
      world.police.footCops.splice(idx, 1);
    }
    addWanted(world, 1);
  } else if (hitKind === 'car') {
    // A shot at a car scares its driver out on foot (traffic) or just dents it.
    if (hitTarget.kind === 'traffic') {
      hitTarget.speed = 0;
    }
  }
  // Firing a gun in public is itself a crime.
  addWanted(world, 1);
  if (player.ammo === 0) player.reloadTimer = PISTOL.reloadSeconds;
  return hitKind;
}

/** Swing a fist at whatever is right in front of the player. */
export function punch(world) {
  const player = world.player;
  if (player.punchTimer > 0) return 'wait';
  player.punchTimer = 0.45;
  const fx = Math.sin(player.heading);
  const fz = Math.cos(player.heading);
  function inFront(pos, range) {
    const dx = pos.x - player.pos.x;
    const dz = pos.z - player.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > range) return false;
    return (dx * fx + dz * fz) / Math.max(dist, 0.001) > 0.4;
  }
  for (const r of world.rivals) {
    if (r.alive && inFront(r.pos, 2.6)) {
      r.health -= 25;
      if (r.health <= 0) {
        r.alive = false;
        r.group.visible = false;
      }
      return 'rival';
    }
  }
  for (const p of world.traffic.peds) {
    if (p.state !== 'down' && inFront(p.pos, 2.6)) {
      dropPed(p);
      return 'ped';
    }
  }
  for (const c of world.police.footCops) {
    if (inFront(c.pos, 2.6)) {
      const idx = world.police.footCops.indexOf(c);
      world.police.scene.remove(c.group);
      world.police.footCops.splice(idx, 1);
      addWanted(world, 1);
      return 'cop';
    }
  }
  return 'miss';
}

/** Rivals return fire while mission three is live. Returns damage dealt. */
export function stepRivals(world, dt) {
  const player = world.player;
  let damage = 0;
  for (const r of world.rivals) {
    if (!r.alive || !r.group.visible) continue;
    const dx = player.pos.x - r.pos.x;
    const dz = player.pos.z - r.pos.z;
    const dist = Math.hypot(dx, dz);
    r.heading = Math.atan2(dx, dz);
    r.group.rotation.y = r.heading;
    r.shootTimer -= dt;
    if (dist < 46 && r.shootTimer <= 0) {
      r.shootTimer = 1.1 + Math.random() * 0.7;
      const chanceHit = Math.max(0.07, Math.min(0.5, 0.55 - dist / 110));
      if (Math.random() < chanceHit && player.invuln <= 0) {
        damage += 9;
        player.invuln = 0.5;
      }
      if (world.audio) world.audio.shot(true);
    }
  }
  return damage;
}
