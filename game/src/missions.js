// Missions and the story of Sunset Bay: four jobs in order, each with a
// glowing beacon on the street, an objective line on the HUD and short dialog
// from the fixer, Marla. Finish one and the next opens; finish all four and
// the city is yours to roam with the money banked.

import * as THREE from 'three';
import { LANDMARKS, MISSIONS } from './config.js';

const DIALOG = {
  intro: 'Marla: "Kid, Sunset Bay eats nobodies. Do my jobs, get paid, stay out of the cells."',
  m1Pickup: 'Marla: "Pick up the parcel at the marina end of Bay Street. Don\'t open it."',
  m1Deliver: 'Parcel in hand. Drop it at the south plaza — the buyer waits by the palms.',
  m1Done: 'Marla: "Clean run. $150. You might be worth keeping around."',
  m2Start: 'Marla: "I need wheels. Steal any car — parked or rolling — and bring it to the hideout."',
  m2Done: 'Marla: "Nice ride. $250. The cops noticed, but that\'s your problem."',
  m3Start: 'Marla: "The Red Jackets took our turf on Coral Row. Go clear them out. All three."',
  m3Done: 'Marla: "Turf\'s ours again. $400. The Jackets won\'t forget this — neither will I."',
  m4Start: 'Marla: "The big one. Hit the bank on Palm Avenue, grab the cash, lose the heat at the hideout."',
  m4Grab: 'Cash grabbed! The alarm is screaming — get to the hideout, now!',
  m4Done: 'Marla: "Eight hundred. You\'re not a nobody anymore, kid. Sunset Bay is yours."',
  free: 'Story complete. Free roam — earn cash, dodge the law, own the bay.',
};

export function createMissions(scene, S) {
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.85 });
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.28 });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.25, 20), beaconMat);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 60, 12, 1, true), beamMat);
  beam.position.y = 30;
  const marker = new THREE.Group();
  marker.add(beacon);
  marker.add(beam);
  marker.visible = false;
  scene.add(marker);

  const state = {
    index: S.missionIndex,
    stage: 0,
    objective: '',
    enemiesLeft: 0,
    hasParcel: false,
    hasCash: false,
    storyDone: S.storyDone,
  };

  function markerAt(point) {
    marker.position.set(point.x, 0.15, point.z);
    marker.visible = true;
  }

  function setObjective(text) {
    state.objective = text;
    S.hud.setObjective(text);
  }

  function startMission(index) {
    state.index = index;
    state.stage = 0;
    state.hasParcel = false;
    state.hasCash = false;
    state.enemiesLeft = 0;
    if (index === 0) {
      markerAt(LANDMARKS.parcelPickup);
      setObjective('M1 Parcel Run — pick up the parcel at Bay Street');
      S.hud.showDialog(DIALOG.m1Pickup, 5);
    } else if (index === 1) {
      markerAt(LANDMARKS.hideout);
      setObjective('M2 Hot Wheels — steal a car, bring it to the hideout');
      S.hud.showDialog(DIALOG.m2Start, 5);
    } else if (index === 2) {
      markerAt(LANDMARKS.turf);
      setObjective('M3 Turf War — take back Coral Row');
      S.hud.showDialog(DIALOG.m3Start, 5);
    } else if (index === 3) {
      markerAt(LANDMARKS.bank);
      setObjective('M4 Sunset Score — hit the bank on Palm Avenue');
      S.hud.showDialog(DIALOG.m4Start, 5);
    }
  }

  function completeMission() {
    const reward = MISSIONS[state.index].reward;
    S.player.money += reward;
    S.best = Math.max(S.best, S.player.money);
    S.audio.jingle();
    S.save();
    const doneLines = [DIALOG.m1Done, DIALOG.m2Done, DIALOG.m3Done, DIALOG.m4Done];
    S.hud.showDialog(`${doneLines[state.index]} (+$${reward})`, 5);
    state.index += 1;
    S.missionIndex = state.index;
    if (state.index >= MISSIONS.length) {
      state.storyDone = true;
      S.storyDone = true;
      S.save();
      marker.visible = false;
      setObjective(DIALOG.free);
      return;
    }
    startMission(state.index);
  }

  function near(point, range) {
    const p = S.player;
    const pos = p.car ? p.car.mesh.position : p.pos;
    return Math.hypot(pos.x - point.x, pos.z - point.z) < range;
  }

  /** E pressed near a mission point: pick up, grab, or start a fight. */
  function tryInteract() {
    if (state.storyDone) return;
    const p = S.player;
    if (state.index === 0 && state.stage === 0 && near(LANDMARKS.parcelPickup, 4) && p.onFoot) {
      state.hasParcel = true;
      state.stage = 1;
      markerAt(LANDMARKS.parcelDrop);
      setObjective('M1 Parcel Run — deliver the parcel to the south plaza');
      S.hud.showDialog(DIALOG.m1Deliver, 4);
      S.audio.pickup();
    } else if (state.index === 3 && state.stage === 0 && near(LANDMARKS.bank, 5) && p.onFoot) {
      state.hasCash = true;
      state.stage = 1;
      S.police.addHeat(3);
      markerAt(LANDMARKS.hideout);
      setObjective('M4 Sunset Score — escape to the hideout!');
      S.hud.showDialog(DIALOG.m4Grab, 4);
      S.audio.pickup();
    }
  }

  function onEnemyDown() {
    if (state.index !== 2 || state.storyDone) return;
    state.enemiesLeft = Math.max(0, state.enemiesLeft - 1);
    setObjective(`M3 Turf War — clear the crew (${state.enemiesLeft} left)`);
    if (state.enemiesLeft === 0) completeMission();
  }

  function onCarStolen() {
    if (state.index === 1 && state.stage === 0) {
      state.stage = 1;
      setObjective('M2 Hot Wheels — drive the stolen car to the hideout');
    }
  }

  function update(dt, time) {
    marker.rotation.y = time * 0.8;
    beaconMat.opacity = 0.65 + Math.sin(time * 3) * 0.2;
    if (state.storyDone || S.screen !== 'play') return;
    if (state.index === 0 && state.stage === 1 && near(LANDMARKS.parcelDrop, 5)) {
      completeMission();
    } else if (state.index === 1 && state.stage === 1 && S.player.car && near(LANDMARKS.hideout, 6)) {
      completeMission();
    } else if (state.index === 2 && state.stage === 0 && near(LANDMARKS.turf, 8)) {
      state.stage = 1;
      const base = LANDMARKS.turf;
      for (let i = 0; i < 3; i += 1) {
        S.combat.spawnEnemy(base.x + (i - 1) * 4, base.z + (i % 2 === 0 ? 4 : -4));
      }
      state.enemiesLeft = 3;
      setObjective('M3 Turf War — clear the crew (3 left)');
      S.hud.showDialog('Red Jackets: "This is our corner now!"', 3);
    } else if (state.index === 3 && state.stage === 1 && near(LANDMARKS.hideout, 6)) {
      completeMission();
    }
  }

  function init() {
    if (state.storyDone) {
      marker.visible = false;
      setObjective(DIALOG.free);
    } else {
      startMission(state.index);
      S.hud.showDialog(DIALOG.intro, 5);
    }
  }

  return {
    state,
    init,
    update,
    tryInteract,
    onEnemyDown,
    onCarStolen,
    markerPoint() {
      return marker.visible ? { x: marker.position.x, z: marker.position.z } : null;
    },
  };
}
