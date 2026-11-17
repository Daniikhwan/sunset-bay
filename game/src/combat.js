// Sunset Bay — combat. Punch the nearest hostile in front of you, or draw
// the pistol (Q), aim with the mouse and fire (click) with a raycast. Armed
// rivals shoot back with shaky aim, and getting shot hurts.
import * as THREE from 'three';
import { CFG } from './config.js';
import { W, addWanted, setDialog } from './world.js';
import { wastePlayer } from './police.js';

let raycaster = null;
let pistolMesh = null;
let tracer = null;
let tracerUntil = 0;

export function makePistolView(scene, camera) {
  raycaster = new THREE.Raycaster();
  // A chunky first-person pistol, parented to the camera.
  pistolMesh = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.14, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x1c1c22 }),
  );
  pistolMesh.add(body);
  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.22, 0.12),
    new THREE.MeshLambertMaterial({ color: 0x3a2a1a }),
  );
  grip.position.set(0, -0.14, 0.16);
  grip.rotation.x = 0.3;
  pistolMesh.add(grip);
  pistolMesh.position.set(0.32, -0.28, -0.6);
  pistolMesh.visible = false;
  camera.add(pistolMesh);
  // Tracer line for shots.
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1),
  ]);
  tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8 }));
  tracer.visible = false;
  tracer.frustumCulled = false;
  scene.add(tracer);
  return pistolMesh;
}

export function togglePistol() {
  if (!W.onFoot || W.mode !== 'play') return;
  W.pistolOut = !W.pistolOut;
  if (pistolMesh) pistolMesh.visible = W.pistolOut;
  setDialog(W.pistolOut ? 'Pistol out. Click to fire.' : 'Pistol holstered.', 2);
}

function nearestHostile(maxDist, inFrontOnly) {
  let best = null;
  let bestD = maxDist;
  const fx = Math.sin(W.playerYaw);
  const fz = Math.cos(W.playerYaw);
  for (const e of W.enemies) {
    if (!e.alive) continue;
    const dx = e.pos.x - W.playerPos.x;
    const dz = e.pos.z - W.playerPos.z;
    const d = Math.hypot(dx, dz);
    if (d >= bestD) continue;
    if (inFrontOnly && (dx * fx + dz * fz) / Math.max(d, 0.01) < 0.35) continue;
    bestD = d;
    best = e;
  }
  return best;
}

export function punch() {
  if (!W.onFoot || W.mode !== 'play' || W.punching > 0) return;
  W.punching = 0.35;
  if (W.audio) W.audio.punch();
  const e = nearestHostile(CFG.punchRange, true);
  if (e) {
    damageEnemy(e, CFG.punchDamage);
    e.pos.x += Math.sin(W.playerYaw) * 1.2;
    e.pos.z += Math.cos(W.playerYaw) * 1.2;
  } else {
    // A punch can also shove a nearby pedestrian (and the law notices).
    for (const ped of W.peds) {
      if (ped.down) continue;
      const d = Math.hypot(ped.pos.x - W.playerPos.x, ped.pos.z - W.playerPos.z);
      if (d < CFG.punchRange) {
        ped.panic = true;
        addWanted(1, 'assault');
        break;
      }
    }
  }
}

export function damageEnemy(e, dmg) {
  e.health -= dmg;
  if (e.health <= 0 && e.alive) {
    e.alive = false;
    e.group.rotation.x = -Math.PI / 2;
    e.group.position.y = 0.35;
    W.money += 50;
    setDialog('Rival down. +$50', 2);
    if (W.audio) W.audio.pickup();
  }
}

export function shoot() {
  if (!W.onFoot || !W.pistolOut || W.mode !== 'play') return;
  if (W.ammo <= 0) {
    setDialog('Out of ammo! Find the ammo crates… (press R to reload from your stash)', 3);
    return;
  }
  W.ammo -= 1;
  W.shootFlash = 0.08;
  if (W.audio) W.audio.gunshot();
  if (W.pistolOut) addWanted(0, 'shot'); // firing is loud; wanted rises near cops
  const cam = W.camera;
  raycaster.setFromCamera(new THREE.Vector2(0, 0), cam);
  const targets = W.enemies.filter((e) => e.alive).map((e) => e.group);
  const hits = raycaster.intersectObjects(targets, true);
  let end = new THREE.Vector3();
  raycaster.ray.at(CFG.pistolRange, end);
  if (hits.length > 0) {
    const hit = hits[0];
    end = hit.point.clone();
    let enemy = W.enemies.find((e) => e.alive && e.group === hit.object);
    if (!enemy) {
      // The ray hit a child mesh; walk up to the enemy group.
      let obj = hit.object;
      while (obj && !W.enemies.some((e) => e.group === obj)) obj = obj.parent;
      enemy = W.enemies.find((e) => e.group === obj);
    }
    if (enemy) damageEnemy(enemy, CFG.pistolDamage);
  }
  // Tracer from the muzzle to the hit point.
  const start = new THREE.Vector3();
  pistolMesh.getWorldPosition(start);
  tracer.geometry.setFromPoints([start, end]);
  tracer.visible = true;
  tracerUntil = W.time + 0.07;
  // A muzzle-flash kick on the pistol view model.
  pistolMesh.position.z = -0.52;
}

export function reload() {
  if (!W.onFoot || W.mode !== 'play') return;
  if (W.ammo >= CFG.startAmmo) return;
  W.ammo = CFG.startAmmo;
  setDialog('Reloaded.', 2);
  if (W.audio) W.audio.pickup();
}

function enemyShoot(e, dt) {
  e.shootCooldown -= dt;
  const d = Math.hypot(e.pos.x - W.playerPos.x, e.pos.z - W.playerPos.z);
  if (d > 45 || !W.onFoot) return;
  // Face the player.
  e.yaw = Math.atan2(W.playerPos.x - e.pos.x, W.playerPos.z - e.pos.z);
  e.group.rotation.y = e.yaw;
  if (e.shootCooldown <= 0) {
    e.shootCooldown = 1.1 + Math.random() * 0.9;
    if (W.audio) W.audio.gunshot();
    // Shaky aim: hits about half the time up close, less far away.
    const hitChance = Math.max(0.15, 0.55 - d * 0.008);
    if (Math.random() < hitChance) {
      W.health -= 9 + Math.random() * 6;
      setDialog('You are taking fire!', 2);
      if (W.health <= 0) {
        W.health = 0;
        wastePlayer();
      }
    }
    // Show the enemy's shot as a quick tracer.
    const from = new THREE.Vector3(e.pos.x, 1.2, e.pos.z);
    const to = new THREE.Vector3(W.playerPos.x, 1.2, W.playerPos.z);
    tracer.geometry.setFromPoints([from, to]);
    tracer.visible = true;
    tracerUntil = W.time + 0.07;
  }
}

export function updateCombat(dt) {
  for (const e of W.enemies) {
    if (!e.alive) continue;
    enemyShoot(e, dt);
  }
  if (tracer && tracer.visible && W.time > tracerUntil) tracer.visible = false;
  if (pistolMesh && W.pistolOut) {
    // Settle the muzzle kick back.
    pistolMesh.position.z += (-0.6 - pistolMesh.position.z) * Math.min(1, dt * 12);
  }
  if (W.punching > 0) W.punching -= dt;
  if (W.shootFlash > 0) W.shootFlash -= dt;
}
