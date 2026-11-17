// The city itself: a grid of avenues, blocks of buildings, palms along the
// beach, the docks, the plaza and the bank. Everything static lives in one
// group; the moving things (cars, people) are added by the world. The
// builder also hands back the data the game logic needs: building colliders
// (axis-aligned boxes), the road network for traffic, and the spawn points.

import * as THREE from '../vendor/three.module.min.js';
import { CITY, PALETTE, PLACES, ROADS } from './config.js';
import { chance, int, pick, range } from './random.js';

/** A canvas texture of lit and dark windows, repeated over a building face. */
function windowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3a3f4a';
  ctx.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const lit = Math.random() < 0.45;
      ctx.fillStyle = lit ? '#ffd27a' : '#20242e';
      ctx.fillRect(10 + col * 30, 12 + row * 30, 18, 20);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** A canvas texture with a short label, for the bank, docks and hideout signs. */
function signTexture(label, bg, fg) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = fg;
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 256, 52);
  return new THREE.CanvasTexture(canvas);
}

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
const unitCone = new THREE.ConeGeometry(1, 1, 8);

function box(material, w, h, d) {
  const mesh = new THREE.Mesh(unitBox, material);
  mesh.scale.set(w, h, d);
  return mesh;
}

export function buildCity(scene, rng) {
  const group = new THREE.Group();
  scene.add(group);
  const colliders = [];
  const winTex = windowTexture();
  const wallMats = PALETTE.building.map(
    (c) => new THREE.MeshLambertMaterial({ color: c, map: winTex }),
  );
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4038 });
  const groundMat = new THREE.MeshLambertMaterial({ color: PALETTE.ground });
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const sandMat = new THREE.MeshLambertMaterial({ color: PALETTE.sand });
  const seaMat = new THREE.MeshLambertMaterial({ color: PALETTE.sea });
  const lineMat = new THREE.MeshLambertMaterial({ color: 0xd8c25a });
  const palmTrunkMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmTrunk });
  const palmLeafMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmLeaf });

  function add(mesh, x, y, z, ry = 0) {
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    group.add(mesh);
    return mesh;
  }

  // Ground, roads, sidewalks, beach and sea.
  const ground = add(box(groundMat, CITY.halfExtent * 2 + 60, 0.2, CITY.halfExtent * 2 + 60), 0, -0.11, 0);
  ground.receiveShadow = false;
  for (const at of ROADS) {
    add(box(roadMat, CITY.halfExtent * 2 + 60, 0.1, CITY.roadWidth), 0, 0, at);
    add(box(roadMat, CITY.roadWidth, 0.1, CITY.halfExtent * 2 + 60), at, 0, 0);
    // Sidewalk strips along both sides of each road.
    add(box(walkMat, CITY.halfExtent * 2 + 60, 0.12, 2.4), 0, 0.01, at - CITY.roadWidth / 2 - 1.2);
    add(box(walkMat, CITY.halfExtent * 2 + 60, 0.12, 2.4), 0, 0.01, at + CITY.roadWidth / 2 + 1.2);
    add(box(walkMat, 2.4, 0.12, CITY.halfExtent * 2 + 60), at - CITY.roadWidth / 2 - 1.2, 0.01, 0);
    add(box(walkMat, 2.4, 0.12, CITY.halfExtent * 2 + 60), at + CITY.roadWidth / 2 + 1.2, 0.01, 0);
    // Dashed centre lines.
    for (let t = -CITY.halfExtent; t < CITY.halfExtent; t += 12) {
      add(box(lineMat, 5, 0.14, 0.5), t, 0.02, at);
      add(box(lineMat, 0.5, 0.14, 5), at, 0.02, t);
    }
  }
  add(box(sandMat, CITY.halfExtent * 2 + 60, 0.15, CITY.beachStart - CITY.seaStart + 42), 0, -0.02, (CITY.beachStart + CITY.seaStart) / 2 + 10);
  const sea = add(box(seaMat, CITY.halfExtent * 2 + 400, 0.1, CITY.seaEnd - CITY.seaStart), 0, -0.05, (CITY.seaStart + CITY.seaEnd) / 2);
  // Sunset reflection: a warm streak on the water toward the sun.
  const streak = add(
    box(new THREE.MeshBasicMaterial({ color: 0xffb36b, transparent: true, opacity: 0.55 }), 26, 0.12, 220),
    -30, 0.02, (CITY.seaStart + CITY.seaEnd) / 2,
  );

  // Buildings: one or two per block, skipping the plaza block at the centre.
  const blocks = [];
  for (let bx = 0; bx < ROADS.length - 1; bx += 1) {
    for (let bz = 0; bz < ROADS.length - 1; bz += 1) {
      blocks.push({ cx: (ROADS[bx] + ROADS[bx + 1]) / 2, cz: (ROADS[bz] + ROADS[bz + 1]) / 2 });
    }
  }
  function building(x, z, w, d, h, colorIdx) {
    const mat = wallMats[colorIdx % wallMats.length];
    const body = add(box(mat, w, h, d), x, h / 2, z);
    const roof = add(box(roofMat, w + 0.6, 0.7, d + 0.6), x, h + 0.35, z);
    void body;
    void roof;
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return { x, z, w, d, h };
  }
  for (const b of blocks) {
    if (Math.abs(b.cx - PLACES.plaza.x) < 1 && Math.abs(b.cz - PLACES.plaza.z) < 1) continue; // the plaza stays open
    if (Math.abs(b.cx - PLACES.bank.x) < 1 && Math.abs(b.cz - PLACES.bank.z) < 1) continue; // bank below
    if (Math.abs(b.cx - PLACES.hideout.x) < 1 && Math.abs(b.cz - PLACES.hideout.z) < 1) continue; // hideout below
    if (Math.abs(b.cx - PLACES.docks.x) < 30 && Math.abs(b.cz - PLACES.docks.z) < 30) continue; // docks below
    const tall = chance(rng, 0.3);
    const h = tall ? range(rng, 26, 44) : range(rng, 10, 22);
    const w = range(rng, 18, 30);
    const d = range(rng, 18, 30);
    building(b.cx + range(rng, -6, 6), b.cz + range(rng, -6, 6), w, d, h, int(rng, 0, PALETTE.building.length - 1));
    if (chance(rng, 0.5)) {
      building(b.cx + range(rng, -8, 8), b.cz + range(rng, -8, 8), range(rng, 10, 16), range(rng, 10, 16), range(rng, 8, 16), int(rng, 0, PALETTE.building.length - 1));
    }
  }

  // The plaza: open pavement, a fountain and benches.
  const plazaMat = new THREE.MeshLambertMaterial({ color: 0x8a7f72 });
  add(box(plazaMat, 44, 0.2, 44), PLACES.plaza.x, 0.02, PLACES.plaza.z);
  const basin = add(new THREE.Mesh(unitCylinder, new THREE.MeshLambertMaterial({ color: 0xb8b0a4 })), PLACES.plaza.x, 0.6, PLACES.plaza.z);
  basin.scale.set(5, 1.2, 5);
  const water = add(new THREE.Mesh(unitCylinder, new THREE.MeshLambertMaterial({ color: 0x4fa8c8 })), PLACES.plaza.x, 1.1, PLACES.plaza.z);
  water.scale.set(4.4, 0.3, 4.4);
  colliders.push({ minX: PLACES.plaza.x - 5, maxX: PLACES.plaza.x + 5, minZ: PLACES.plaza.z - 5, maxZ: PLACES.plaza.z + 5 });
  for (const [bx, bz] of [[-14, -14], [14, -14], [-14, 14], [14, 14]]) {
    add(box(new THREE.MeshLambertMaterial({ color: 0x6a5a48 }), 4, 1, 1.4), PLACES.plaza.x + bx, 0.5, PLACES.plaza.z + bz);
  }

  // Bay Bank: tall, pale, with columns and a sign.
  const bankMat = new THREE.MeshLambertMaterial({ color: 0xf0e6d0, map: winTex });
  add(box(bankMat, 30, 34, 24), PLACES.bank.x, 17, PLACES.bank.z);
  colliders.push({ minX: PLACES.bank.x - 15, maxX: PLACES.bank.x + 15, minZ: PLACES.bank.z - 12, maxZ: PLACES.bank.z + 12 });
  for (let i = -2; i <= 2; i += 1) {
    const col = add(new THREE.Mesh(unitCylinder, new THREE.MeshLambertMaterial({ color: 0xe8dcc8 })), PLACES.bank.x + i * 5, 6, PLACES.bank.z + 13.5);
    col.scale.set(1.1, 12, 1.1);
  }
  const bankSign = add(
    new THREE.Mesh(new THREE.PlaneGeometry(22, 4.1), new THREE.MeshBasicMaterial({ map: signTexture('BAY BANK', '#1a2a4a', '#ffd27a') })),
    PLACES.bank.x, 30, PLACES.bank.z + 12.2,
  );
  void bankSign;

  // Hideout: a low garage with a sign, tucked in its block.
  add(box(new THREE.MeshLambertMaterial({ color: 0x7a6a58, map: winTex }), 22, 9, 18), PLACES.hideout.x, 4.5, PLACES.hideout.z);
  colliders.push({ minX: PLACES.hideout.x - 11, maxX: PLACES.hideout.x + 11, minZ: PLACES.hideout.z - 9, maxZ: PLACES.hideout.z + 9 });
  add(
    new THREE.Mesh(new THREE.PlaneGeometry(14, 2.6), new THREE.MeshBasicMaterial({ map: signTexture('HIDEOUT', '#2a1a1a', '#f2c94c') })),
    PLACES.hideout.x, 7.5, PLACES.hideout.z + 9.2,
  );

  // The docks: warehouses, stacked containers and a pier.
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x5a6a7a });
  add(box(dockMat, 34, 12, 20), PLACES.docks.x - 8, 6, PLACES.docks.z - 14);
  colliders.push({ minX: PLACES.docks.x - 25, maxX: PLACES.docks.x + 9, minZ: PLACES.docks.z - 24, maxZ: PLACES.docks.z - 4 });
  const containerColors = [0xc0392b, 0x2980b9, 0xf39c12, 0x27ae60];
  for (let i = 0; i < 8; i += 1) {
    const cx = PLACES.docks.x - 20 + (i % 4) * 8;
    const cz = PLACES.docks.z + 8 + Math.floor(i / 4) * 7;
    const cy = i >= 4 ? 5.4 : 2.7;
    add(box(new THREE.MeshLambertMaterial({ color: containerColors[i % containerColors.length] }), 7, 5, 6), cx, cy, cz);
    if (i < 4) colliders.push({ minX: cx - 3.5, maxX: cx + 3.5, minZ: cz - 3, maxZ: cz + 3 });
  }
  add(
    new THREE.Mesh(new THREE.PlaneGeometry(18, 3.4), new THREE.MeshBasicMaterial({ map: signTexture('DOCKS', '#12303a', '#7fd4c8') })),
    PLACES.docks.x - 8, 10.5, PLACES.docks.z - 3.8,
  );
  // Pier reaching toward the sea.
  add(box(new THREE.MeshLambertMaterial({ color: 0x8a6a48 }), 8, 0.6, 40), 138, 0.4, 168);
  add(box(new THREE.MeshLambertMaterial({ color: 0x8a6a48 }), 8, 0.6, 40), 120, 0.4, 168);

  // Palms along the beach and the avenues.
  function palm(x, z) {
    const trunk = add(new THREE.Mesh(unitCylinder, palmTrunkMat), x, 3.2, z);
    trunk.scale.set(0.35, 6.4, 0.35);
    trunk.rotation.z = range(rng, -0.08, 0.08);
    const canopy = add(new THREE.Mesh(unitCone, palmLeafMat), x, 7.4, z);
    canopy.scale.set(3.4, 2.6, 3.4);
    colliders.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5 });
  }
  for (let x = -140; x <= 140; x += 28) palm(x + range(rng, -4, 4), 162);
  for (let x = -120; x <= 120; x += 60) {
    palm(x, -140);
    palm(x + 30, 140);
  }
  for (let z = -120; z <= 120; z += 60) {
    palm(-140, z);
    palm(140, z + 30);
  }

  // Beach umbrellas.
  for (const [ux, uz] of [[-60, 166], [-20, 164], [30, 167], [80, 165]]) {
    const pole = add(new THREE.Mesh(unitCylinder, new THREE.MeshLambertMaterial({ color: 0xd8d0c0 })), ux, 1.4, uz);
    pole.scale.set(0.12, 2.8, 0.12);
    const top = add(new THREE.Mesh(unitCone, new THREE.MeshLambertMaterial({ color: pick(rng, [0xe5534b, 0xf2c94c, 0x4fa8c8]) })), ux, 3.1, uz);
    top.scale.set(2.6, 1.2, 2.6);
  }

  // Streetlights at the intersections.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2d34 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const rx of ROADS) {
    for (const rz of ROADS) {
      const pole = add(new THREE.Mesh(unitCylinder, poleMat), rx + 8.5, 3, rz + 8.5);
      pole.scale.set(0.14, 6, 0.14);
      const lamp = add(new THREE.Mesh(unitBox, lampMat), rx + 8.5, 6.1, rz + 8.5);
      lamp.scale.set(0.9, 0.3, 0.9);
    }
  }

  // Parked cars: spots along the road edges.
  const parkedSpots = [];
  for (let i = 0; i < 12; i += 1) {
    const road = pick(rng, ROADS);
    const along = range(rng, -130, 130);
    const side = chance(rng, 0.5) ? 1 : -1;
    const horizontal = chance(rng, 0.5);
    if (horizontal) parkedSpots.push({ x: along, z: road + side * 5.2, heading: side > 0 ? 0 : Math.PI });
    else parkedSpots.push({ x: road + side * 5.2, z: along, heading: side > 0 ? Math.PI / 2 : -Math.PI / 2 });
  }

  return {
    group,
    colliders,
    sea,
    streak,
    parkedSpots,
    roads: ROADS,
  };
}

/** Push a circle (x, z, radius) out of every building box it overlaps. */
export function resolveCollision(x, z, radius, colliders) {
  let px = x;
  let pz = z;
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(px, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pz, c.maxZ));
    const dx = px - cx;
    const dz = pz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    if (d2 > 1e-6) {
      const d = Math.sqrt(d2);
      px = cx + (dx / d) * radius;
      pz = cz + (dz / d) * radius;
    } else {
      // Centre inside the box: shove out along the smallest penetration.
      const left = px - c.minX;
      const right = c.maxX - px;
      const top = pz - c.minZ;
      const bottom = c.maxZ - pz;
      const m = Math.min(left, right, top, bottom);
      if (m === left) px = c.minX - radius;
      else if (m === right) px = c.maxX + radius;
      else if (m === top) pz = c.minZ - radius;
      else pz = c.maxZ + radius;
    }
  }
  return { x: px, z: pz };
}

/** True when the point is on a road (within the road half-width of a road line). */
export function onRoad(x, z) {
  const half = CITY.roadWidth / 2;
  for (const r of ROADS) {
    if (Math.abs(x - r) <= half || Math.abs(z - r) <= half) return true;
  }
  return false;
}
