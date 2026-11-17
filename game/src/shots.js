// The screenshot scenes behind ?shot=start|play|chase|end. Each one stages the
// real game — the same world, traffic, police and missions the player gets —
// and plays it forward from a fixed seed with a simple autopilot, so the
// frame is what a short session really looks like and the same seed always
// gives the same frame. The caller renders the staged state twice and sets
// window.__shotReady.

import { LANDMARKS, STEP } from './config.js';

const IDLE_SECONDS = 4;
const PLAY_SECONDS = 9;
const CHASE_SECONDS = 5;

function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Steer a car through road waypoints toward a point, flooring it. */
function driveRoute(S, car, waypoints, dt) {
  const target = waypoints[0];
  const dx = target.x - car.mesh.position.x;
  const dz = target.z - car.mesh.position.z;
  if (Math.hypot(dx, dz) < 6 && waypoints.length > 1) waypoints.shift();
  const want = Math.atan2(dx, dz);
  const dh = normAngle(want - car.heading);
  const steer = Math.max(-1, Math.min(1, dh * 1.6));
  S.vehicles.drive(car, dt, 1, steer);
}

/** Steer a car toward a point and floor it. */
function driveToward(S, car, tx, tz, dt) {
  driveRoute(S, car, [{ x: tx, z: tz }], dt);
}

function stepWorld(S, dt) {
  S.time += dt;
  S.city.update(dt, S.time);
  S.traffic.update(dt);
  S.police.update(dt);
  S.combat.update(dt);
  S.missions.update(dt, S.time);
  S.vehicles.update(dt);
}

function syncPlayerToCar(S) {
  if (S.player.car) S.player.pos.copy(S.player.car.mesh.position);
}

export function stageShot(name, S) {
  S.screen = 'play';
  if (name === 'start') {
    S.screen = 'title';
    for (let i = 0; i < IDLE_SECONDS / STEP; i += 1) {
      S.time += STEP;
      S.city.update(STEP, S.time);
      S.traffic.update(STEP);
    }
    // The cover frame: the title over a living city, with the HUD, a couple
    // of wanted stars, the mission objective and a cruiser in view, so one
    // image shows the whole game at once.
    S.wanted = 2;
    S.vehicles.spawnCar('police', 12, 44, Math.PI, { driver: 'npc' });
    S.hud.setScreen('title', { best: S.best });
    document.getElementById('hud').style.display = 'block';
    return { screen: 'title', establishing: true };
  }

  if (name === 'chase') {
    // Clear the chase road so the pursuit reads as a pursuit, not a pile-up.
    for (const car of [...S.cars]) {
      if (car.kind === 'civil' && car.driver === 'npc' && Math.abs(car.mesh.position.x) < 12 && car.mesh.position.z > -130 && car.mesh.position.z < 40) {
        S.vehicles.removeCar(car);
      }
    }
    const car = S.vehicles.spawnCar('civil', 0, 30, Math.PI, { driver: 'player' });
    S.playerCtl.enterCar(car);
    car.speed = 24;
    S.wanted = 3;
    S.player.money = 400;
    const cop1 = S.vehicles.spawnCar('police', -4, 52, Math.PI, { driver: 'npc' });
    cop1.speed = 26;
    const cop2 = S.vehicles.spawnCar('police', 5, 58, Math.PI, { driver: 'npc' });
    cop2.speed = 24;
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) {
      const t = i * STEP;
      // Weave gently down Bay Street while the cruisers close in.
      const target = { x: Math.sin(t * 0.7) * 3, z: -120 };
      driveToward(S, car, target.x, target.z, STEP);
      stepWorld(S, STEP);
      syncPlayerToCar(S);
    }
    S.hud.setScreen('play');
    S.hud.setObjective('M4 Sunset Score — escape to the hideout!');
    S.hud.showDialog('Marla: "Lose them at the hideout — do NOT get busted!"', 10);
    return { screen: 'play' };
  }

  if (name === 'end') {
    S.screen = 'over';
    S.overReason = 'wasted';
    S.player.health = 0;
    S.player.money = 650;
    const cop = S.vehicles.spawnCar('police', 6, 30, Math.PI, { driver: 'npc' });
    cop.speed = 0;
    for (let i = 0; i < 2 / STEP; i += 1) {
      S.time += STEP;
      S.city.update(STEP, S.time);
      S.traffic.update(STEP);
    }
    S.hud.setScreen('over', { reason: 'wasted', money: S.player.money, best: Math.max(S.best, S.player.money) });
    return { screen: 'over' };
  }

  // 'play' (and anything else): driving to the first pickup, mission live.
  // The route stays on the roads: north up Bay Street, then west to the marina.
  const car = S.vehicles.spawnCar('civil', 0, 80, Math.PI, { driver: 'player' });
  S.playerCtl.enterCar(car);
  S.player.money = 150;
  const route = [{ x: 0, z: -60 }, { x: LANDMARKS.parcelPickup.x, z: LANDMARKS.parcelPickup.z }];
  for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
    driveRoute(S, car, route, STEP);
    stepWorld(S, STEP);
    syncPlayerToCar(S);
  }
  S.hud.setScreen('play');
  S.hud.setObjective('M1 Parcel Run — pick up the parcel at Bay Street');
  S.hud.showDialog('Marla: "Pick up the parcel at the marina end of Bay Street."', 10);
  return { screen: 'play' };
}
