// The world's shared state: everything the systems read and write — the
// scene and camera, the clock and the screen, the player, every car,
// pedestrian, cop and enemy, and the wanted level. main.js builds this first
// and hands the same object to every system, so there is one source of truth
// for where everything is.

import * as THREE from 'three';
import { LANDMARKS } from './config.js';

/** A fresh state object for one session, from a loaded save (or a new game). */
export function createWorldState(view, rng, saved) {
  return {
    scene: view.scene,
    camera: view.camera,
    renderer: view.renderer,
    rng,
    time: 0,
    screen: 'title',
    overReason: null,
    wanted: 0,
    bustTimer: 0,
    missionIndex: saved.missionIndex,
    storyDone: saved.storyDone,
    best: saved.best,
    cameraYaw: Math.PI * 0.15,
    cameraPitch: 0.35,
    cameraDist: 40,
    lastDragTime: -10,
    player: {
      pos: new THREE.Vector3(LANDMARKS.spawn.x, 0, LANDMARKS.spawn.z),
      heading: 0,
      health: 100,
      money: saved.money,
      onFoot: true,
      car: null,
      pistol: false,
      walkPhase: 0,
      punchTimer: 0,
      shootTimer: 0,
      mesh: null,
    },
    cars: [],
    peds: [],
    cops: [],
    enemies: [],
    city: null,
    input: null,
    audio: null,
    hud: null,
    vehicles: null,
    traffic: null,
    police: null,
    combat: null,
    missions: null,
    playerCtl: null,
  };
}
