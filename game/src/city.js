// Sunset Bay itself: the ground, the road grid, the beach and the sea, the
// buildings with lit-window facades, street lamps, palm trees and parks. All
// geometry is built from boxes, cylinders and planes with flat colours and one
// canvas-made window texture, so the city costs no downloads. createCity also
// hands back the collision boxes and the parking spots the other systems use.

import * as THREE from 'three';
import { LANDMARKS, PALETTE, ROADS, ROAD_HALF, ROAD_WIDTH, WORLD } from './config.js';

function makeFacadeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const lit = ((row * 4 + col) * 37) % 5 === 0;
      g.fillStyle = lit ? '#ffd98a' : '#2c3440';
      g.fillRect(14 + col * 28, 14 + row * 30, 16, 18);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeRoadTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const g = canvas.getContext('2d');
  g.fillStyle = '#3a3d46';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#c9c9c9';
  g.fillRect(30, 6, 4, 20);
  g.fillRect(30, 38, 4, 20);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Push a circle (x, z, radius) out of every box it overlaps; returns true on a hit. */
export function resolveCircle(colliders, pos, radius) {
  let hit = false;
  for (let i = 0; i < colliders.length; i += 1) {
    const c = colliders[i];
    const cx = Math.max(c.x0, Math.min(pos.x, c.x1));
    const cz = Math.max(c.z0, Math.min(pos.z, c.z1));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    hit = true;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      pos.x = cx + (dx / d) * radius;
      pos.z = cz + (dz / d) * radius;
    } else {
      // Dead centre inside the box: shove out along the nearer face.
      const left = pos.x - c.x0;
      const right = c.x1 - pos.x;
      const near = pos.z - c.z0;
      const far = c.z1 - pos.z;
      const m = Math.min(left, right, near, far);
      if (m === left) pos.x = c.x0 - radius;
      else if (m === right) pos.x = c.x1 + radius;
      else if (m === near) pos.z = c.z0 - radius;
      else pos.z = c.z1 + radius;
    }
  }
  return hit;
}

export function createCity(scene, rng) {
  const colliders = [];
  const parkingSpots = [];
  const facadeTex = makeFacadeTexture();
  const roadTex = makeRoadTexture();
  const group = new THREE.Group();
  scene.add(group);

  const groundMat = new THREE.MeshLambertMaterial({ color: PALETTE.ground });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(560, 560), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 20);
  group.add(ground);

  // Sand strip, then the sea stretching south past the playable edge.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.maxX - WORLD.minX, WORLD.waterZ - WORLD.beachZ + 4),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.0, (WORLD.beachZ + WORLD.waterZ) / 2);
  group.add(sand);
  const waterMat = new THREE.MeshLambertMaterial({ color: PALETTE.sea });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(560, 260), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.02, WORLD.waterZ + 120);
  group.add(water);

  // Sidewalks (wide, pale) under the roads (narrower, dark, dashed).
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  const span = WORLD.maxX - WORLD.minX;
  for (const r of ROADS) {
    for (const horizontal of [false, true]) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(span, ROAD_WIDTH + 6), walkMat);
      walk.rotation.x = -Math.PI / 2;
      if (horizontal) walk.rotation.z = Math.PI / 2;
      walk.position.set(horizontal ? r : 0, 0.01, horizontal ? 0 : r);
      group.add(walk);
      const road = new THREE.Mesh(new THREE.PlaneGeometry(span, ROAD_WIDTH), roadMat);
      road.rotation.x = -Math.PI / 2;
      if (horizontal) road.rotation.z = Math.PI / 2;
      roadTex.repeat.set(span / 14, 1);
      road.position.set(horizontal ? r : 0, 0.03, horizontal ? 0 : r);
      group.add(road);
    }
  }

  // Buildings fill the blocks between roads; a few blocks stay parks.
  const edges = [-170, -127, -113, -67, -53, -7, 7, 53, 67, 113, 127, 170];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let bx = 0; bx < edges.length - 1; bx += 2) {
    for (let bz = 0; bz < edges.length - 1; bz += 2) {
      const x0 = edges[bx];
      const x1 = edges[bx + 1];
      const z0 = edges[bz];
      const z1 = edges[bz + 1];
      if (z0 >= WORLD.beachZ) continue;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      const w = x1 - x0;
      const d = z1 - z0;
      if (rng() < 0.18) {
        // A pocket park: grass, a bench box and two palms.
        const park = new THREE.Mesh(
          new THREE.PlaneGeometry(w, d),
          new THREE.MeshLambertMaterial({ color: 0x7fae62 }),
        );
        park.rotation.x = -Math.PI / 2;
        park.position.set(cx, 0.04, cz);
        group.add(park);
        plantPalm(group, rng, cx - w / 4, cz - d / 4);
        plantPalm(group, rng, cx + w / 4, cz + d / 4);
        continue;
      }
      const height = 8 + rng() * rng() * 34 + (Math.abs(cx) < 70 && Math.abs(cz) < 70 ? 8 : 0);
      const bw = w * (0.55 + rng() * 0.25);
      const bd = d * (0.55 + rng() * 0.25);
      const colour = PALETTE.building[Math.floor(rng() * PALETTE.building.length)];
      const tex = facadeTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(Math.max(1, Math.round(bw / 14)), Math.max(1, Math.round(height / 14)));
      const mat = new THREE.MeshLambertMaterial({ map: tex, color: colour });
      const building = new THREE.Mesh(boxGeo, mat);
      building.scale.set(bw, height, bd);
      building.position.set(cx, height / 2, cz);
      group.add(building);
      const roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: 0x5a5148 }));
      roof.scale.set(bw * 0.92, 0.8, bd * 0.92);
      roof.position.set(cx, height + 0.4, cz);
      group.add(roof);
      colliders.push({ x0: cx - bw / 2, x1: cx + bw / 2, z0: cz - bd / 2, z1: cz + bd / 2 });
    }
  }

  // Street lamps along every road, alternating sides.
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.4, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2e3138 });
  const lampGeo = new THREE.SphereGeometry(0.32, 8, 6);
  const lampMat = new THREE.MeshLambertMaterial({ color: PALETTE.lamp, emissive: 0xffc860 });
  for (const r of ROADS) {
    for (let t = -150; t <= 150; t += 30) {
      for (const side of [-1, 1]) {
        if (((t / 30 + (side + 1)) | 0) % 2 !== 0) continue;
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(r + side * (ROAD_HALF + 2.4), 2.7, t);
        group.add(pole);
        const lamp = new THREE.Mesh(lampGeo, lampMat);
        lamp.position.set(r + side * (ROAD_HALF + 2.4), 5.5, t);
        group.add(lamp);
        const pole2 = new THREE.Mesh(poleGeo, poleMat);
        pole2.position.set(t, 2.7, r + side * (ROAD_HALF + 2.4));
        group.add(pole2);
        const lamp2 = new THREE.Mesh(lampGeo, lampMat);
        lamp2.position.set(t, 5.5, r + side * (ROAD_HALF + 2.4));
        group.add(lamp2);
      }
    }
  }

  // A row of palms along the beach, and a pier jutting into the sea.
  for (let x = -150; x <= 150; x += 18) plantPalm(group, rng, x, WORLD.beachZ + 6);
  const pier = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.6, 40),
    new THREE.MeshLambertMaterial({ color: 0x8a6b4a }),
  );
  pier.position.set(LANDMARKS.marina.x, 0.6, WORLD.waterZ + 12);
  group.add(pier);
  colliders.push({ x0: LANDMARKS.marina.x - 5, x1: LANDMARKS.marina.x + 5, z0: WORLD.waterZ - 6, z1: WORLD.waterZ + 30 });

  // Parking spots: a few cars rest beside the roads.
  for (const [x, z, heading] of [
    [7.5, -40, 0], [7.5, 30, 0], [-7.5, 90, Math.PI], [67.5, -100, 0],
    [127.5, 40, Math.PI], [-127.5, -20, 0], [7.5, -100, 0], [-67.5, 130, Math.PI],
  ]) parkingSpots.push({ x, z, heading });

  return {
    colliders,
    parkingSpots,
    update(dt, time) {
      water.position.y = 0.02 + Math.sin(time * 0.6) * 0.05;
    },
  };
}

function plantPalm(group, rng, x, z) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.28, 4.6, 6),
    new THREE.MeshLambertMaterial({ color: 0x8a6b4a }),
  );
  trunk.position.set(x, 2.3, z);
  trunk.rotation.z = (rng() - 0.5) * 0.16;
  group.add(trunk);
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(1.7, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0x3f8f4f }),
  );
  canopy.scale.y = 0.55;
  canopy.position.set(x, 4.9, z);
  group.add(canopy);
}
