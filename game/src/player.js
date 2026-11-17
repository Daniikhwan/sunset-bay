// Sunset Bay — the player on foot: the character mesh, WASD movement
// relative to the camera, sprinting, and the third-person camera rig that
// follows from behind with mouse-look (pointer lock).
import * as THREE from 'three';
import { CFG } from './config.js';
import { W } from './world.js';
import { resolveBlocked } from './city.js';
import { mouse } from './input.js';

export function makePlayerMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0xff5a3c });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2c4a6e });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe0ac69 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.82, 0.28), jeans);
  legs.position.y = 0.41;
  legs.castShadow = true;
  group.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.66, 0.34), jacket);
  torso.position.y = 1.15;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), skin);
  head.position.y = 1.72;
  head.castShadow = true;
  group.add(head);
  // Sunset cap.
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.29, 0.1, 12),
    new THREE.MeshLambertMaterial({ color: 0xf2c14e }),
  );
  cap.position.y = 1.92;
  group.add(cap);
  for (const ax of [-0.36, 0.36]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, 0.14), jacket);
    arm.position.set(ax, 1.12, 0);
    arm.castShadow = true;
    group.add(arm);
  }
  group.userData.armL = group.children[4];
  group.userData.armR = group.children[5];
  return group;
}

export function updatePlayer(dt, input) {
  if (!W.onFoot || W.mode !== 'play') return;
  // Mouse look: yaw follows the mouse, pitch clamps.
  W.camYaw -= mouse.dx * 0.0028;
  W.camPitch = Math.max(-1.1, Math.min(0.35, W.camPitch - mouse.dy * 0.0022));
  const speed = input.run ? CFG.runSpeed : CFG.walkSpeed;
  const fwdX = Math.sin(W.camYaw);
  const fwdZ = Math.cos(W.camYaw);
  const rightX = Math.cos(W.camYaw);
  const rightZ = -Math.sin(W.camYaw);
  let mx = fwdX * input.forward + rightX * input.strafe;
  let mz = fwdZ * input.forward + rightZ * input.strafe;
  const len = Math.hypot(mx, mz);
  if (len > 0.01) {
    mx /= len;
    mz /= len;
    const nx = W.playerPos.x + mx * speed * dt;
    const nz = W.playerPos.z + mz * speed * dt;
    const fixed = resolveBlocked(nx, nz, CFG.playerRadius);
    W.playerPos.x = Math.max(-CFG.cityHalf - 10, Math.min(CFG.beachX + 24, fixed.x));
    W.playerPos.z = Math.max(-CFG.cityHalf - 10, Math.min(CFG.cityHalf + 10, fixed.z));
    W.playerYaw = Math.atan2(mx, mz);
    W.playerSpeed = speed;
    // Walk-cycle bob and arm swing.
    const t = W.time * (input.run ? 13 : 9);
    W.player.position.y = Math.abs(Math.sin(t)) * 0.07;
    W.player.userData.armL.rotation.x = Math.sin(t) * 0.7;
    W.player.userData.armR.rotation.x = -Math.sin(t) * 0.7;
  } else {
    W.playerSpeed = 0;
    W.player.position.y = 0;
    W.player.userData.armL.rotation.x *= 0.8;
    W.player.userData.armR.rotation.x *= 0.8;
  }
  if (W.punching > 0) {
    W.player.userData.armR.rotation.x = -1.6 * Math.sin((W.punching / 0.35) * Math.PI);
  }
  W.player.position.set(W.playerPos.x, W.player.position.y, W.playerPos.z);
  W.player.rotation.y = W.playerYaw;
}
