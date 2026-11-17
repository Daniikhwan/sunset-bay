// Sunset Bay — missions and story. Marla the fixer hands out four jobs in
// order; each one plants a glowing beacon in the world and a marker on the
// minimap, and finishing one pays out and unlocks the next.
import * as THREE from 'three';
import { CFG, MISSIONS } from './config.js';
import { W, currentMission, setDialog, setObjective, addWanted } from './world.js';
import { saveGame } from './save.js';
import { makePedMesh } from './traffic.js';

let beaconGroup = null;
let beaconLight = null;

export function makeBeacon(scene) {
  const group = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 60, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd34e, transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
  );
  pillar.position.y = 30;
  group.add(pillar);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3, 0.25, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd34e }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.3;
  group.add(ring);
  const light = new THREE.PointLight(0xffd34e, 60, 40);
  light.position.y = 4;
  group.add(light);
  group.visible = false;
  scene.add(group);
  beaconGroup = group;
  beaconLight = light;
  W.beacon = group;
  return group;
}

export function moveBeaconTo(x, z) {
  if (!beaconGroup) return;
  beaconGroup.position.set(x, 0, z);
  beaconGroup.visible = true;
}

export function hideBeacon() {
  if (beaconGroup) beaconGroup.visible = false;
}

export function startMission(index) {
  const m = MISSIONS[index];
  if (!m) return;
  W.missionIndex = index;
  W.missionActive = true;
  W.missionStage = 0;
  W.missionTimeLeft = m.timeLimit;
  setDialog(m.brief, 9);
  setObjective(`Mission ${m.id}: ${m.name} — ${m.objective}`);
  if (m.id === 2) {
    addWanted(3, 'mission');
    moveBeaconTo(m.target.x, m.target.z);
  } else if (m.id === 3) {
    spawnRivals();
    moveBeaconTo(m.target.x, m.target.z);
  } else if (m.id === 4) {
    moveBeaconTo(CFG.bank.x, CFG.bank.z);
    spawnBankCash();
  } else {
    moveBeaconTo(m.target.x, m.target.z);
  }
  if (W.audio) W.audio.pickup();
}

export function completeMission() {
  const m = MISSIONS[W.missionIndex];
  if (!m) return;
  W.missionDone[W.missionIndex] = true;
  W.money += m.reward;
  W.missionActive = false;
  hideBeacon();
  setDialog(
    `Marla: 'Job done — $${m.reward} is yours. ${W.missionIndex < 3 ? 'Next job is on the board when you are ready.' : 'That is the whole story, kid. Sunset Bay is yours now.'}`,
    8,
  );
  if (W.audio) W.audio.missionJingle();
  saveGame();
  if (W.missionIndex === 3) {
    W.storyDone = true;
    W.missionIndex = 4;
    setObjective('Story complete — free roam Sunset Bay!');
  } else {
    W.missionIndex += 1;
    setObjective(`Mission ${MISSIONS[W.missionIndex].id}: ${MISSIONS[W.missionIndex].name} — press M to start`);
  }
}

function spawnRivals() {
  const spots = [
    { x: CFG.plaza.x - 8, z: CFG.plaza.z - 6 },
    { x: CFG.plaza.x + 9, z: CFG.plaza.z + 4 },
    { x: CFG.plaza.x + 2, z: CFG.plaza.z - 12 },
  ];
  for (const s of spots) {
    const mesh = makePedMesh(Math.random);
    mesh.children[1].material = new THREE.MeshLambertMaterial({ color: 0x8a1a1a });
    mesh.position.set(s.x, 0, s.z);
    W.scene.add(mesh);
    // A visible pistol in the rival's hand.
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.55),
      new THREE.MeshLambertMaterial({ color: 0x111111 }),
    );
    gun.position.set(0.4, 1.15, 0.3);
    mesh.add(gun);
    W.enemies.push({
      group: mesh, pos: { x: s.x, z: s.z }, yaw: 0,
      health: 100, alive: true, shootCooldown: 1.5 + Math.random(),
    });
  }
}

function spawnBankCash() {
  const pile = new THREE.Group();
  const green = new THREE.MeshLambertMaterial({ color: 0x2f9e5f });
  for (let i = 0; i < 5; i++) {
    const stack = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.5), green);
    stack.position.set((i % 3) * 1.1 - 1, 0.15 + Math.floor(i / 3) * 0.28, (i % 2) * 0.7);
    stack.rotation.y = i * 0.5;
    pile.add(stack);
  }
  pile.position.set(CFG.bank.x, 0, CFG.bank.z + 12);
  W.scene.add(pile);
  W.bankCash = pile;
}

function distTo(x, z) {
  const px = W.onFoot ? W.playerPos.x : W.car.pos.x;
  const pz = W.onFoot ? W.playerPos.z : W.car.pos.z;
  return Math.hypot(px - x, pz - z);
}

export function updateMissions(dt) {
  if (!W.missionActive || W.mode !== 'play') return;
  const m = currentMission();
  if (!m) return;
  if (m.timeLimit > 0) {
    W.missionTimeLeft -= dt;
    if (W.missionTimeLeft <= 0) {
      W.missionActive = false;
      hideBeacon();
      setDialog(`Marla: 'Too slow — the ${m.name} job fell through. Press M to try it again.'`, 7);
      setObjective(`Mission ${m.id}: ${m.name} — press M to retry`);
      return;
    }
  }
  if (m.id === 1 && distTo(m.target.x, m.target.z) < 5) completeMission();
  if (m.id === 2 && distTo(m.target.x, m.target.z) < 6) {
    W.wanted = 0;
    completeMission();
  }
  if (m.id === 3) {
    const alive = W.enemies.filter((e) => e.alive).length;
    if (alive === 0 && W.enemies.length > 0) completeMission();
  }
  if (m.id === 4) {
    if (W.missionStage === 0) {
      if (distTo(CFG.bank.x, CFG.bank.z + 12) < 4) {
        W.missionStage = 1;
        W.money += 0; // the cash is counted at the hideout
        if (W.bankCash) {
          W.scene.remove(W.bankCash);
          W.bankCash = null;
        }
        addWanted(4, 'bank');
        moveBeaconTo(CFG.hideout.x, CFG.hideout.z);
        setDialog("Marla: 'You have the cash! Now run — every cruiser in the city is coming. Get to the hideout!'", 8);
        setObjective('Mission 4: The Bank Job — escape to the hideout!');
        if (W.audio) W.audio.pickup();
      }
    } else if (distTo(CFG.hideout.x, CFG.hideout.z) < 6) {
      W.wanted = 0;
      completeMission();
    }
  }
  // Beacon pulse.
  if (beaconGroup && beaconGroup.visible) {
    const s = 1 + Math.sin(W.time * 4) * 0.12;
    beaconGroup.children[1].scale.set(s, s, 1);
    if (beaconLight) beaconLight.intensity = 50 + Math.sin(W.time * 4) * 25;
  }
}

// M key: start (or retry) the current mission.
export function tryStartMission() {
  if (W.mode !== 'play') return;
  if (W.missionActive) return;
  if (W.storyDone) {
    setDialog("Marla: 'No more jobs, kid — the city is yours. Go enjoy it.'", 5);
    return;
  }
  startMission(W.missionIndex);
}
