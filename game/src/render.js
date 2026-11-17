// Drawing only: the renderer, the sunset sky, the lights and the camera.
// The world owns the scene graph; this module owns the eye that looks at it.
// The camera trails the player on foot and the car behind the wheel, and
// slowly orbits the city on the title screen.

import * as THREE from '../vendor/three.module.min.js';
import { PALETTE } from './config.js';

const skyVertex = `
varying vec3 vPos;
void main() {
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const skyFragment = `
varying vec3 vPos;
uniform vec3 topColor;
uniform vec3 midColor;
uniform vec3 lowColor;
void main() {
  float h = normalize(vPos).y;
  vec3 col = h > 0.25 ? mix(midColor, topColor, smoothstep(0.25, 0.85, h))
    : mix(lowColor, midColor, smoothstep(-0.05, 0.25, h));
  gl_FragColor = vec4(col, 1.0);
}`;

export function createRenderer(canvas, scene) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  scene.fog = new THREE.Fog(PALETTE.fog, 180, 620);

  // Sunset dome: a huge sphere, gradient from purple overhead to orange at
  // the horizon, drawn back-to-front so the city sits inside it.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: skyVertex,
      fragmentShader: skyFragment,
      uniforms: {
        topColor: { value: new THREE.Color(PALETTE.skyTop) },
        midColor: { value: new THREE.Color(PALETTE.skyMid) },
        lowColor: { value: new THREE.Color(PALETTE.skyLow) },
      },
    }),
  );
  scene.add(sky);

  // The sun itself: a bright disc low over the sea to the south-west.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(46, 32),
    new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false }),
  );
  sun.position.set(-260, 66, 700);
  sun.lookAt(0, 40, 0);
  scene.add(sun);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(110, 32),
    new THREE.MeshBasicMaterial({ color: 0xff8a4d, transparent: true, opacity: 0.28, fog: false }),
  );
  glow.position.set(-260, 66, 699);
  glow.lookAt(0, 40, 0);
  scene.add(glow);

  // Warm low sun plus a soft purple fill from the sky.
  const sunLight = new THREE.DirectionalLight(0xffb36b, 2.4);
  sunLight.position.set(-180, 90, 320);
  scene.add(sunLight);
  scene.add(new THREE.HemisphereLight(0x8a6bb8, 0x4a3428, 1.1));
  const fill = new THREE.DirectionalLight(0x6a7fd8, 0.5);
  fill.position.set(120, 160, -120);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
  const camPos = new THREE.Vector3(0, 30, 90);
  const camLook = new THREE.Vector3(0, 0, 0);
  let orbit = 0;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  /**
   * Where the camera wants to be for this screen: a slow orbit over the city
   * on the title, a chase view behind the car, a close third-person view on
   * foot. Returns the position and the look target.
   */
  function cameraTarget(view, screen, dt) {
    const player = view.player;
    if (screen === 'title') {
      orbit += dt * 0.045;
      const r = 190;
      return {
        pos: new THREE.Vector3(Math.sin(orbit) * r, 62 + Math.sin(orbit * 0.6) * 14, Math.cos(orbit) * r),
        look: new THREE.Vector3(0, 8, 40),
      };
    }
    if (player.car) {
      const car = player.car;
      const back = 11.5;
      return {
        pos: new THREE.Vector3(
          car.pos.x - Math.sin(car.heading) * back,
          4.6,
          car.pos.z - Math.cos(car.heading) * back,
        ),
        look: new THREE.Vector3(car.pos.x + Math.sin(car.heading) * 6, 1.6, car.pos.z + Math.cos(car.heading) * 6),
      };
    }
    const yaw = player.heading;
    const back = 7.5;
    return {
      pos: new THREE.Vector3(
        player.pos.x - Math.sin(yaw) * back,
        3.4,
        player.pos.z - Math.cos(yaw) * back,
      ),
      look: new THREE.Vector3(player.pos.x + Math.sin(yaw) * 4, 1.8, player.pos.z + Math.cos(yaw) * 4),
    };
  }

  /**
   * One frame. `view` is the world state; `screen` is title/play/paused/
   * busted/wasted/over; `dt` is real frame time for the sea shimmer. The
   * camera eases toward its target so turns feel smooth.
   */
  function draw(view, screen, dt) {
    const target = cameraTarget(view, screen, dt);
    const ease = screen === 'title' ? 1 : Math.min(1, dt * (view.player.car ? 4.5 : 7));
    camPos.x += (target.pos.x - camPos.x) * ease;
    camPos.y += (target.pos.y - camPos.y) * ease;
    camPos.z += (target.pos.z - camPos.z) * ease;
    camLook.copy(target.look);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    // The sea breathes a little.
    if (view.city && view.city.sea) {
      view.city.sea.position.y = -0.05 + Math.sin(performance.now() / 1400) * 0.12;
    }
    renderer.render(scene, camera);
  }

  /** Jump the camera straight to its target (screenshot scenes). */
  function snap(view, screen) {
    const target = cameraTarget(view, screen, 0);
    camPos.copy(target.pos);
    camLook.copy(target.look);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  }

  return { draw, snap, camera, resize };
}
