// The story: four jobs for Marla the fixer, in order. A mission starts when
// the player presses M; each one has a target place (a gold beacon the HUD
// and the minimap point at), an optional clock, and a payout. Finish one and
// the next unlocks; fail one (clock, bust or wasted) and Marla lets you try
// again. The plaza job spawns its four armed rivals; the bank job is two
// stages, the grab and the getaway.

import * as THREE from '../vendor/three.module.min.js';
import { MISSIONS, PLACES } from './config.js';
import { addWanted } from './police.js';

export function createMissions(scene) {
  // The beacon: a tall gold pillar of light over the current target.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 90, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xf2c94c, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  beacon.visible = false;
  scene.add(beacon);
  const marker = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 2.6, 0.25, 20),
    new THREE.MeshBasicMaterial({ color: 0xf2c94c, transparent: true, opacity: 0.6 }),
  );
  marker.visible = false;
  scene.add(marker);
  return {
    index: 0,
    active: false,
    stage: 0,
    timer: 0,
    done: [false, false, false, false],
    beacon,
    marker,
  };
}

export function currentDef(missions) {
  return missions.index < MISSIONS.length ? MISSIONS[missions.index] : null;
}

function placeBeacon(missions, x, z) {
  missions.beacon.position.set(x, 45, z);
  missions.beacon.visible = true;
  missions.marker.position.set(x, 0.3, z);
  missions.marker.visible = true;
}

function hideBeacon(missions) {
  missions.beacon.visible = false;
  missions.marker.visible = false;
}

/** Start the next job. Returns a message for the HUD, or null. */
export function startMission(missions, world) {
  const def = currentDef(missions);
  if (!def || missions.active) return null;
  missions.active = true;
  missions.stage = 0;
  missions.timer = def.timer || 0;
  const target = def.target;
  placeBeacon(missions, target.x, target.z);
  if (def.wanted) addWanted(world, def.wanted);
  if (def.rivals) {
    for (const r of world.rivals) {
      r.group.visible = true;
      r.alive = true;
      r.health = 100;
    }
  }
  if (world.audio) world.audio.jingle();
  return `${def.name}: ${def.brief}`;
}

/**
 * One step of the story. Returns 'done' | 'failed' | null, and pays out
 * through the world when a job lands.
 */
export function stepMissions(missions, world, dt) {
  if (!missions.active) return null;
  const def = currentDef(missions);
  if (!def) return null;
  const player = world.player;
  if (missions.timer > 0) {
    missions.timer -= dt;
    if (missions.timer <= 0) {
      missions.active = false;
      hideBeacon(missions);
      return 'failed';
    }
  }
  const near = (place, radius) => {
    const dx = player.pos.x - place.x;
    const dz = player.pos.z - place.z;
    return dx * dx + dz * dz <= radius * radius;
  };

  if (def.id === 'package') {
    if (near(def.target, def.radius)) return finishJob(missions, world, def);
  } else if (def.id === 'pursuit') {
    if (near(def.target, def.radius) && world.wanted <= 1) return finishJob(missions, world, def);
  } else if (def.id === 'plaza') {
    const left = world.rivals.filter((r) => r.alive).length;
    if (left === 0) return finishJob(missions, world, def);
  } else if (def.id === 'bank') {
    if (missions.stage === 0) {
      if (near(def.target, def.radius)) {
        missions.stage = 1;
        player.cash += 500;
        addWanted(world, def.wanted || 4);
        placeBeacon(missions, PLACES.hideout.x, PLACES.hideout.z);
        if (world.hud) world.hud.toast('The vault is open. Now lose them and get to the Hideout!');
      }
    } else if (near(PLACES.hideout, def.radius)) {
      return finishJob(missions, world, def);
    }
  }
  return null;
}

function finishJob(missions, world, def) {
  missions.active = false;
  missions.done[missions.index] = true;
  missions.index += 1;
  world.player.cash += def.payout;
  hideBeacon(missions);
  if (world.audio) world.audio.jingle();
  if (world.hud) {
    world.hud.toast(`Job done: ${def.name} — +$${def.payout}`);
  }
  if (world.save) world.save();
  return 'done';
}

/** Called when the player is busted or wasted: the active job is lost. */
export function failMission(missions, world) {
  if (!missions.active) return;
  missions.active = false;
  hideBeacon(missions);
  if (world.rivals) {
    for (const r of world.rivals) r.group.visible = false;
  }
}
