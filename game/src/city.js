// Sunset Bay — the city itself: ground, road grid, buildings, beach, sea,
// palm trees, street lamps, and the warm sunset lighting. Built once from a
// fixed seed so the city is identical every run.
import * as THREE from 'three';
import { CFG, mulberry32, pick, range } from './config.js';

// Building footprints, kept for simple collision checks (walk/drive around).
const colliders = [];

export function isBlocked(x, z, radius = 1) {
  for (const c of colliders) {
    if (x > c.x0 - radius && x < c.x1 + radius && z > c.z0 - radius && z < c.z1 + radius) return true;
  }
  return false;
}

// Push a position out of any building footprint it landed inside.
export function resolveBlocked(x, z, radius = 1) {
  for (const c of colliders) {
    if (x > c.x0 - radius && x < c.x1 + radius && z > c.z0 - radius && z < c.z1 + radius) {
      const dxl = x - (c.x0 - radius);
      const dxr = c.x1 + radius - x;
      const dzl = z - (c.z0 - radius);
      const dzr = c.z1 + radius - z;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) x = c.x0 - radius;
      else if (m === dxr) x = c.x1 + radius;
      else if (m === dzl) z = c.z0 - radius;
      else z = c.z1 + radius;
    }
  }
  return { x, z };
}

const BUILDING_COLORS = [
  0xf2e3c6, 0xe8b48a, 0xd98a7a, 0xc9d6df, 0xf6d365, 0x9fc5c9,
  0xe59a6d, 0xb8a88a, 0xf0a868, 0x8fb8a8, 0xead9a7, 0xd97b6c,
];
const PALM_TRUNK = 0x8a6b4f;
const PALM_LEAF = 0x3f8f4f;

function box(w, h, d, color, x, y, z, scene, opts = {}) {
  const mat = new THREE.MeshLambertMaterial({ color, emissive: opts.emissive ?? 0x000000 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = opts.shadow !== false;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function makePalm(scene, x, z, rng) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.3, 5.2, 6),
    new THREE.MeshLambertMaterial({ color: PALM_TRUNK }),
  );
  trunk.position.y = 2.6;
  trunk.castShadow = true;
  group.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: PALM_LEAF });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.6, 4), leafMat);
    const a = (i / 6) * Math.PI * 2 + rng() * 0.4;
    leaf.position.set(Math.cos(a) * 1.1, 5.4, Math.sin(a) * 1.1);
    leaf.rotation.z = Math.cos(a) * 1.1;
    leaf.rotation.x = -Math.sin(a) * 1.1;
    leaf.castShadow = true;
    group.add(leaf);
  }
  const nut = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0x6b4a2f }),
  );
  nut.position.y = 5.1;
  group.add(nut);
  group.position.set(x, 0, z);
  scene.add(group);
  return group;
}

export function buildCity(scene) {
  const rng = mulberry32(20261117);

  // Sunset sky, warm hemisphere light, low golden sun, thin haze.
  scene.background = new THREE.Color(0xffb36b);
  scene.fog = new THREE.Fog(0xffc98f, 130, 460);
  const hemi = new THREE.HemisphereLight(0xffe0b3, 0x5a4a6a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.1);
  sun.position.set(-120, 90, -60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220;
  sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220;
  sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 500;
  scene.add(sun);
  // A visible sun disc low over the sea.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(16, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false }),
  );
  sunDisc.position.set(330, 42, -40);
  sunDisc.lookAt(0, 20, 0);
  scene.add(sunDisc);

  // Ground: one big slab, grass-green inland, sand near the beach.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 700),
    new THREE.MeshLambertMaterial({ color: 0x7fae6a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Sand strip along the east edge.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 460),
    new THREE.MeshLambertMaterial({ color: 0xf2d8a0 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(CFG.beachX + 18, 0.05, 0);
  sand.receiveShadow = true;
  scene.add(sand);

  // The sea: a wide, gently animated plane (animated in render.js via userData).
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 480, 24, 24),
    new THREE.MeshLambertMaterial({ color: 0x2f7fa8, transparent: true, opacity: 0.92 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(CFG.seaX + 130, 0.12, 0);
  sea.userData.isSea = true;
  scene.add(sea);

  // Road grid: dark asphalt ribbons with pale center dashes.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3a42 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5e9c8 });
  const half = CFG.cityHalf;
  const step = CFG.grid;
  for (let c = -half; c <= half; c += step) {
    const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(CFG.roadHalf * 2, half * 2 + 40), roadMat);
    roadNS.rotation.x = -Math.PI / 2;
    roadNS.position.set(c, 0.08, 0);
    roadNS.receiveShadow = true;
    scene.add(roadNS);
    const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 40, CFG.roadHalf * 2), roadMat);
    roadEW.rotation.x = -Math.PI / 2;
    roadEW.position.set(0, 0.08, c);
    roadEW.receiveShadow = true;
    scene.add(roadEW);
    for (let d = -half; d <= half; d += 10) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 3), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(c, 0.12, d);
      scene.add(dash);
    }
  }

  // Buildings fill every block between the roads, with varied heights and
  // sunset colors. Windows are a darker inset box on the front face.
  const winMat = new THREE.MeshLambertMaterial({ color: 0x2c3e50, emissive: 0x332200 });
  for (let bx = -half; bx < half; bx += step) {
    for (let bz = -half; bz < half; bz += step) {
      if (bx + step > CFG.beachX - 20) continue; // keep the beach clear
      const cx = bx + step / 2;
      const cz = bz + step / 2;
      const w = range(rng, 12, 20);
      const d = range(rng, 12, 20);
      const h = pick(rng, [8, 10, 12, 16, 20, 26, 34, 48]);
      const color = pick(rng, BUILDING_COLORS);
      const ox = range(rng, -4, 4);
      const oz = range(rng, -4, 4);
      const b = box(w, h, d, color, cx + ox, h / 2, cz + oz, scene);
      b.userData.isBuilding = true;
      colliders.push({
        x0: cx + ox - w / 2, x1: cx + ox + w / 2,
        z0: cz + oz - d / 2, z1: cz + oz + d / 2,
      });
      // Roof trim.
      box(w + 0.6, 0.7, d + 0.6, 0x8a6f5a, cx + ox, h + 0.35, cz + oz, scene, { shadow: false });
      // Lit windows on the street-facing side.
      const floors = Math.max(1, Math.floor(h / 4));
      for (let f = 0; f < floors; f++) {
        for (let k = -1; k <= 1; k++) {
          const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.8), winMat);
          win.position.set(cx + ox + k * (w / 3.4), 2.5 + f * 3.6, cz + oz + d / 2 + 0.06);
          scene.add(win);
        }
      }
    }
  }

  // Landmark: the Bay Bank (mission 4) — a taller pale building with a
  // green awning on its block, and the hideout garage on the west edge.
  const bank = box(22, 18, 16, 0xe8e0c8, CFG.bank.x, 9, CFG.bank.z, scene);
  bank.userData.isBank = true;
  box(24, 1, 18, 0x2f7f5f, CFG.bank.x, 18.5, CFG.bank.z, scene, { shadow: false });
  colliders.push({ x0: CFG.bank.x - 11, x1: CFG.bank.x + 11, z0: CFG.bank.z - 8, z1: CFG.bank.z + 8 });
  const hideout = box(18, 7, 14, 0x7a5a8a, CFG.hideout.x, 3.5, CFG.hideout.z, scene);
  hideout.userData.isHideout = true;
  colliders.push({ x0: CFG.hideout.x - 9, x1: CFG.hideout.x + 9, z0: CFG.hideout.z - 7, z1: CFG.hideout.z + 7 });

  // Palm trees along the beachfront avenue and scattered on sidewalks.
  for (let z = -190; z <= 190; z += 20) {
    makePalm(scene, CFG.beachX - 8, z + range(rng, -4, 4), rng);
  }
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(range(rng, -180, 180) / CFG.grid) * CFG.grid + CFG.grid / 2 + range(rng, -8, 8);
    const z = Math.floor(range(rng, -180, 180) / CFG.grid) * CFG.grid + CFG.grid / 2 + range(rng, -8, 8);
    if (Math.abs(x) < 8 || Math.abs(z) < 8) continue;
    makePalm(scene, x, z, rng);
  }

  // Street lamps at every intersection corner.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2f2f38 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let c = -half; c <= half; c += step) {
    for (let d = -half; d <= half; d += step) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5.5, 6), lampMat);
      pole.position.set(c + CFG.roadHalf + 1.2, 2.75, d + CFG.roadHalf + 1.2);
      pole.castShadow = true;
      scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), bulbMat);
      bulb.position.set(c + CFG.roadHalf + 1.2, 5.6, d + CFG.roadHalf + 1.2);
      scene.add(bulb);
    }
  }

  return { sea, sun };
}
