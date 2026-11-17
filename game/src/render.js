// The Three.js renderer and the chase camera. One warm directional sun plus
// a hemisphere light give the sunset look; fog melts the city edge into the
// sky. The camera rides behind the player on foot and behind the car while
// driving, easing toward the car's heading unless the player just dragged
// the mouse to look around.

import * as THREE from 'three';
import { PALETTE } from './config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 180, 620);

  const hemi = new THREE.HemisphereLight(0xffe0b3, 0x5a4a3a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 1.6);
  sun.position.set(-80, 120, -60);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(0, 30, 60);

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  const target = new THREE.Vector3();
  const camPos = new THREE.Vector3();

  function lerpAngle(a, b, t) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }

  /** Place the camera for one frame from the shared state. */
  function follow(S, dt) {
    const p = S.player;
    const driving = !p.onFoot && p.car;
    if (driving) {
      const wantYaw = p.car.heading + Math.PI;
      const dragged = S.time - (S.lastDragTime || -10) < 1.5;
      if (!dragged) S.cameraYaw = lerpAngle(S.cameraYaw, wantYaw, 1 - Math.exp(-2.2 * dt));
      S.cameraDist = 13;
      S.cameraPitch = Math.max(S.cameraPitch, 0.22);
    } else {
      S.cameraDist = 9;
    }
    target.copy(p.pos);
    if (driving) target.copy(p.car.mesh.position);
    target.y = 1.6;
    const dist = S.cameraDist;
    const hDist = dist * Math.cos(S.cameraPitch);
    const height = 1.2 + dist * Math.sin(S.cameraPitch);
    const fx = Math.sin(S.cameraYaw);
    const fz = Math.cos(S.cameraYaw);
    camPos.set(target.x - fx * hDist, target.y + height, target.z - fz * hDist);
    camera.position.copy(camPos);
    camera.lookAt(target.x + fx * 2.5, target.y + 0.4, target.z + fz * 2.5);
  }

  /** A high establishing view of the city, used by the title screen. The
   * orbit stays 70 m up — above the tallest roof — so it never clips a
   * building on its way around. */
  function establishing(S, time) {
    const a = time * 0.03;
    camera.position.set(Math.sin(a) * 120, 70, Math.cos(a) * 120);
    camera.lookAt(0, 0, 0);
  }

  return {
    renderer,
    scene,
    camera,
    follow,
    establishing,
    render() {
      renderer.render(scene, camera);
    },
  };
}
