// The HUD: wanted stars, health, money and speed as DOM, the mission
// objective and dialog as text bars, and a live minimap drawn on a small
// canvas — roads, buildings, the sea, the player, cars, police and the
// mission beacon, all top-down. Screens (title, pause, game over) are DOM
// panels this module shows and hides.

import { LANDMARKS, WORLD } from './config.js';

function stars(count) {
  let out = '';
  for (let i = 0; i < 5; i += 1) out += i < count ? '★' : '☆';
  return out;
}

export function createHud(S) {
  const el = (id) => document.getElementById(id);
  const starsEl = el('wanted');
  const healthFill = el('health-fill');
  const healthText = el('health-text');
  const moneyEl = el('money');
  const speedEl = el('speed');
  const objectiveEl = el('objective');
  const dialogEl = el('dialog');
  const minimap = el('minimap');
  const mapCtx = minimap.getContext('2d');
  const crosshair = el('crosshair');
  const screens = {
    title: el('screen-title'),
    paused: el('screen-pause'),
    over: el('screen-over'),
  };
  const overTitle = el('over-title');
  const overStats = el('over-stats');
  const titleBest = el('title-best');
  let dialogUntil = 0;

  function showDialog(text, seconds) {
    dialogEl.textContent = text;
    dialogEl.style.opacity = '1';
    dialogUntil = S.time + (seconds || 4);
  }

  function setObjective(text) {
    objectiveEl.textContent = text;
  }

  function setScreen(name, data) {
    for (const key of Object.keys(screens)) {
      if (screens[key]) screens[key].style.display = key === name ? 'flex' : 'none';
    }
    if (name === 'over' && data) {
      overTitle.textContent = data.reason === 'busted' ? 'BUSTED' : 'WASTED';
      overTitle.style.color = data.reason === 'busted' ? '#5aa2ff' : '#ff5a4e';
      overStats.textContent = `You banked $${data.money}. Best haul: $${data.best}.`;
    }
    if (name === 'title' && titleBest) {
      titleBest.textContent = data && data.best > 0 ? `Best haul so far: $${data.best}` : 'New in town. Make your name.';
    }
    document.getElementById('hud').style.display = name === 'play' ? 'block' : 'none';
  }

  function drawMinimap() {
    const size = minimap.width;
    const scale = size / (WORLD.maxX - WORLD.minX + 40);
    const toMap = (x, z) => [(x - WORLD.minX + 20) * scale, (z - WORLD.minZ + 20) * scale];
    mapCtx.fillStyle = '#20242e';
    mapCtx.fillRect(0, 0, size, size);
    // Sea and sand along the south edge.
    const [sx0, sy0] = toMap(WORLD.minX, 132);
    const [sx1, sy1] = toMap(WORLD.maxX, WORLD.maxZ + 20);
    mapCtx.fillStyle = '#e8cf9a';
    mapCtx.fillRect(0, sy0, size, sy1 - sy0);
    mapCtx.fillStyle = '#2e7f9e';
    mapCtx.fillRect(0, sy0 + (sy1 - sy0) * 0.5, size, size);
    // Roads.
    mapCtx.strokeStyle = '#555a66';
    mapCtx.lineWidth = 7;
    for (const r of [-120, -60, 0, 60, 120]) {
      const [ax, ay] = toMap(r, WORLD.minZ);
      const [bx, by] = toMap(r, WORLD.maxZ);
      mapCtx.beginPath();
      mapCtx.moveTo(ax, ay);
      mapCtx.lineTo(bx, by);
      mapCtx.stroke();
      const [cx, cy] = toMap(WORLD.minX, r);
      const [dx, dy] = toMap(WORLD.maxX, r);
      mapCtx.beginPath();
      mapCtx.moveTo(cx, cy);
      mapCtx.lineTo(dx, dy);
      mapCtx.stroke();
    }
    // Buildings.
    mapCtx.fillStyle = '#8b93a3';
    for (const c of S.city.colliders) {
      const [x, y] = toMap(c.x0, c.z0);
      const [x2, y2] = toMap(c.x1, c.z1);
      mapCtx.fillRect(x, y, x2 - x, y2 - y);
    }
    // Mission beacon.
    const mark = S.missions.markerPoint();
    if (mark) {
      const [x, y] = toMap(mark.x, mark.z);
      mapCtx.fillStyle = '#ffd23e';
      mapCtx.beginPath();
      mapCtx.arc(x, y, 6, 0, Math.PI * 2);
      mapCtx.fill();
      mapCtx.strokeStyle = '#ffd23e';
      mapCtx.lineWidth = 2;
      mapCtx.beginPath();
      mapCtx.arc(x, y, 10 + Math.sin(S.time * 4) * 2, 0, Math.PI * 2);
      mapCtx.stroke();
    }
    // Enemies, police, cars, then the player on top.
    const dot = (x, z, colour, r) => {
      const [mx, my] = toMap(x, z);
      mapCtx.fillStyle = colour;
      mapCtx.beginPath();
      mapCtx.arc(mx, my, r, 0, Math.PI * 2);
      mapCtx.fill();
    };
    for (const e of S.enemies) dot(e.pos.x, e.pos.z, '#ff5a4e', 3.5);
    for (const c of S.cars) {
      if (c.kind === 'police') dot(c.mesh.position.x, c.mesh.position.z, Math.sin(S.time * 8) > 0 ? '#ff4040' : '#3f7bff', 4);
      else dot(c.mesh.position.x, c.mesh.position.z, '#e8e4da', 3);
    }
    const p = S.player;
    const [px, py] = toMap(p.pos.x, p.pos.z);
    mapCtx.fillStyle = '#2f9e6e';
    mapCtx.beginPath();
    mapCtx.moveTo(px, py - 7);
    mapCtx.lineTo(px + 5, py + 5);
    mapCtx.lineTo(px - 5, py + 5);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.strokeStyle = '#ffffff';
    mapCtx.lineWidth = 1.5;
    mapCtx.stroke();
  }

  function update() {
    const p = S.player;
    starsEl.textContent = stars(Math.floor(S.wanted));
    starsEl.style.color = S.wanted >= 3 ? '#ff5a4e' : '#ffd23e';
    const health = Math.max(0, Math.round(p.health));
    healthFill.style.width = `${health}%`;
    healthFill.style.background = health > 50 ? '#2f9e6e' : health > 25 ? '#e8a33a' : '#ff5a4e';
    healthText.textContent = `${health}`;
    moneyEl.textContent = `$${p.money}`;
    const speed = p.car ? Math.abs(Math.round(p.car.speed * 3.6)) : 0;
    speedEl.textContent = p.car ? `${speed} km/h` : '';
    crosshair.style.display = p.onFoot && p.pistol && S.screen === 'play' ? 'block' : 'none';
    if (dialogUntil && S.time > dialogUntil) {
      dialogEl.style.opacity = '0';
      dialogUntil = 0;
    }
    drawMinimap();
  }

  return { update, showDialog, setObjective, setScreen };
}
