// Sunset Bay — the HUD: wanted stars, health bar, cash, speed, the minimap
// canvas, objective and dialog bars, the crosshair, and the title / pause /
// BUSTED / WASTED screens. All DOM, updated from the shared state.
import { CFG, MISSIONS } from './config.js';
import { W } from './world.js';

let el = {};
let minimap = null;
let mmCtx = null;
let lastMinute = -1;

export function initHud() {
  const ids = [
    'hud', 'stars', 'health-fill', 'health-text', 'money', 'speed', 'speed-box',
    'objective', 'dialog', 'crosshair', 'minimap',
    'screen-title', 'screen-pause', 'screen-end', 'end-title', 'end-text',
    'mission-list', 'controls-hint', 'fps-note',
  ];
  for (const id of ids) el[id] = document.getElementById(id);
  minimap = el.minimap;
  mmCtx = minimap ? minimap.getContext('2d') : null;
  const list = el['mission-list'];
  if (list) {
    list.innerHTML = MISSIONS.map(
      (m) => `<div class="mission-row" id="mission-row-${m.id}">
        <span class="mission-num">${m.id}</span>
        <span class="mission-name">${m.name}</span>
        <span class="mission-reward">$${m.reward}</span>
      </div>`,
    ).join('');
  }
}

function starsHtml() {
  let s = '';
  for (let i = 0; i < CFG.maxWanted; i++) {
    s += `<span class="star ${i < W.wanted ? 'on' : ''}">★</span>`;
  }
  return s;
}

function drawMinimap() {
  if (!mmCtx) return;
  const S = 180;
  const half = CFG.cityHalf + 30;
  const toMap = (x, z) => [((x + half) / (half * 2)) * S, ((z + half) / (half * 2)) * S];
  mmCtx.clearRect(0, 0, S, S);
  // Sea on the east edge, land elsewhere.
  mmCtx.fillStyle = '#274b5e';
  mmCtx.fillRect(0, 0, S, S);
  mmCtx.fillStyle = '#1d3a2a';
  const [beachX] = toMap(CFG.beachX, 0);
  mmCtx.fillRect(0, 0, beachX, S);
  // Roads.
  mmCtx.strokeStyle = '#5a5a66';
  mmCtx.lineWidth = 3;
  for (let c = -CFG.cityHalf; c <= CFG.cityHalf; c += CFG.grid) {
    const [x] = toMap(c, 0);
    mmCtx.beginPath();
    mmCtx.moveTo(x, 0);
    mmCtx.lineTo(x, S);
    mmCtx.stroke();
    const [, z] = toMap(0, c);
    mmCtx.beginPath();
    mmCtx.moveTo(0, z);
    mmCtx.lineTo(S, z);
    mmCtx.stroke();
  }
  const dot = (x, z, color, r = 3) => {
    const [mx, mz] = toMap(x, z);
    mmCtx.fillStyle = color;
    mmCtx.beginPath();
    mmCtx.arc(mx, mz, r, 0, Math.PI * 2);
    mmCtx.fill();
  };
  // Mission beacon: a pulsing gold ring.
  if (W.beacon && W.beacon.visible) {
    const [mx, mz] = toMap(W.beacon.position.x, W.beacon.position.z);
    const pulse = 5 + Math.sin(W.time * 5) * 2;
    mmCtx.strokeStyle = '#ffd34e';
    mmCtx.lineWidth = 2;
    mmCtx.beginPath();
    mmCtx.arc(mx, mz, pulse, 0, Math.PI * 2);
    mmCtx.stroke();
    dot(W.beacon.position.x, W.beacon.position.z, '#ffd34e', 3.5);
  }
  // Hideout marker.
  dot(CFG.hideout.x, CFG.hideout.z, '#b678e8', 3);
  // Cars, cops, enemies.
  for (const car of W.cars) {
    if (car === W.car) continue;
    dot(car.pos.x, car.pos.z, car.npc ? '#e8c33a' : '#ffffff', 2.5);
  }
  for (const cop of W.cops) dot(cop.pos.x, cop.pos.z, '#3d7dd9', 3.5);
  for (const cop of W.footCops) dot(cop.pos.x, cop.pos.z, '#3d7dd9', 2.5);
  for (const e of W.enemies) if (e.alive) dot(e.pos.x, e.pos.z, '#ff2a2a', 3.5);
  // Player arrow, rotated to face the player's heading.
  const px = W.onFoot ? W.playerPos.x : W.car.pos.x;
  const pz = W.onFoot ? W.playerPos.z : W.car.pos.z;
  const yaw = W.onFoot ? W.playerYaw : W.car.yaw;
  const [mx, mz] = toMap(px, pz);
  mmCtx.save();
  mmCtx.translate(mx, mz);
  mmCtx.rotate(Math.atan2(Math.sin(yaw), Math.cos(yaw)) + Math.PI / 2);
  mmCtx.fillStyle = '#ffffff';
  mmCtx.beginPath();
  mmCtx.moveTo(0, -7);
  mmCtx.lineTo(5, 6);
  mmCtx.lineTo(-5, 6);
  mmCtx.closePath();
  mmCtx.fill();
  mmCtx.restore();
}

export function updateHud() {
  if (el.stars) el.stars.innerHTML = starsHtml();
  if (el['health-fill']) el['health-fill'].style.width = `${Math.max(0, W.health)}%`;
  if (el['health-text']) el['health-text'].textContent = `${Math.ceil(Math.max(0, W.health))}`;
  if (el.money) el.money.textContent = `$${W.money.toLocaleString('en-US')}`;
  if (el.speed) {
    const kmh = Math.round(Math.abs(W.carSpeed) * 3.6);
    el.speed.textContent = W.onFoot ? '' : `${kmh}`;
  }
  if (el['speed-box']) el['speed-box'].style.display = W.onFoot ? 'none' : 'block';
  if (el.objective) {
    let text = W.objective;
    if (W.missionActive && W.missionTimeLeft > 0) {
      const t = Math.ceil(W.missionTimeLeft);
      text += `  —  ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    }
    el.objective.textContent = text;
  }
  if (el.dialog) {
    const show = W.time < W.dialogUntil && W.dialog;
    el.dialog.style.display = show ? 'block' : 'none';
    if (show) el.dialog.textContent = W.dialog;
  }
  if (el.crosshair) {
    el.crosshair.style.display = W.pistolOut && W.onFoot && W.mode === 'play' ? 'block' : 'none';
  }
  // Mission list checkmarks on the title screen.
  for (let i = 1; i <= 4; i++) {
    const row = document.getElementById(`mission-row-${i}`);
    if (row) row.classList.toggle('done', !!W.missionDone[i - 1]);
  }
  drawMinimap();
  // Autosave once a minute while playing.
  const minute = Math.floor(W.time / 60);
  if (W.mode === 'play' && minute !== lastMinute) {
    lastMinute = minute;
  }
}

export function showScreen(name) {
  // name: 'title' | 'pause' | 'end' | null
  if (el['screen-title']) el['screen-title'].style.display = name === 'title' ? 'flex' : 'none';
  if (el['screen-pause']) el['screen-pause'].style.display = name === 'pause' ? 'flex' : 'none';
  if (el['screen-end']) el['screen-end'].style.display = name === 'end' ? 'flex' : 'none';
  if (el.hud) el.hud.style.display = name === 'title' ? 'none' : 'block';
}

export function showEndScreen(kind) {
  if (kind === 'busted') {
    if (el['end-title']) el['end-title'].textContent = 'BUSTED';
    if (el['end-text']) el['end-text'].textContent = 'The Sunset Bay PD has you. Your cash stays, your freedom does not — press ENTER to get back out there.';
  } else {
    if (el['end-title']) el['end-title'].textContent = 'WASTED';
    if (el['end-text']) el['end-text'].textContent = 'Sunset Bay chewed you up. Press ENTER to get patched up and come back swinging.';
  }
  showScreen('end');
}
