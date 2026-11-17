// Sunset Bay — rendering: the WebGL renderer, the camera rig, and the
// per-frame camera follow. The camera chases the player from behind (or
// behind the car), smoothed so driving at speed still feels steady.
import * as THREE from 'three';
import { CFG } from './config.js';
import { W } from './world.js';

let camPos = new THREE.Vector3(0, 8, -14);
let camLook = new THREE.Vector3(0, 1.5, 0);

export function initRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  document.getElementById('game-canvas').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(0, 8, -14);
  scene.add(camera);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  W.scene = scene;
  W.camera = camera;
  W.renderer = renderer;
  return { renderer, scene, camera };
}

export function updateCamera(dt) {
  const cam = W.camera;
  if (!cam) return;
  let targetPos;
  let lookAt;
  let dist;
  let height;
  if (W.onFoot) {
    targetPos = new THREE.Vector3(W.playerPos.x, 0, W.playerPos.z);
    lookAt = new THREE.Vector3(W.playerPos.x, 1.6, W.playerPos.z);
    dist = 7.5;
    height = 3.2;
  } else {
    const car = W.car;
    targetPos = new THREE.Vector3(car.pos.x, 0, car.pos.z);
    lookAt = new THREE.Vector3(car.pos.x, 1.4, car.pos.z);
    dist = 10.5 + Math.abs(W.carSpeed) * 0.12;
    height = 4.2;
  }
  // Follow behind the facing direction: on foot the camera yaw, in a car the
  // car's yaw, eased toward each other so turns sweep smoothly.
  const followYaw = W.onFoot ? W.camYaw : W.car.yaw;
  const pitch = W.onFoot ? W.camPitch : -0.22;
  const cx = targetPos.x - Math.sin(followYaw) * Math.cos(pitch) * dist;
  const cz = targetPos.z - Math.cos(followYaw) * Math.cos(pitch) * dist;
  const cy = targetPos.y + height - Math.sin(pitch) * dist * 0.6;
  const desired = new THREE.Vector3(cx, cy, cz);
  const k = 1 - Math.exp(-dt * (W.onFoot ? 9 : 6));
  camPos.lerp(desired, k);
  camLook.lerp(lookAt, 1 - Math.exp(-dt * 12));
  cam.position.copy(camPos);
  cam.lookAt(camLook);
}

export function renderFrame() {
  if (W.renderer && W.scene && W.camera) W.renderer.render(W.scene, W.camera);
}
