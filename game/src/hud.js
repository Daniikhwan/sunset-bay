// The HUD: a DOM overlay for stars, health, cash, speed and the mission,
// plus a live minimap drawn on a small canvas. The title, pause, busted and
// wasted screens are panels in the same overlay. All of it is plain DOM, so
// it costs the WebGL renderer nothing.

import { CITY, PLACES } from './config.js';

function el(tag, cls, parent) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (parent) parent.appendChild(node);
  return node;
}

export function createHud() {
  const root = document.getElementById('hud');
  const stars = el('div', 'hud-stars', root);
  const cash = el('div', 'hud-cash', root);
  const mission = el('div', 'hud-mission', root);
  const missionName = el('div', 'hud-mission-name', mission);
  const missionBrief = el('div', 'hud-mission-brief', mission);
  const missionTimer = el('div', 'hud-mission-timer', mission);
  const healthWrap = el('div', 'hud-health', root);
  const healthBar = el('div', 'hud-health-bar', healthWrap);
  const speed = el('div', 'hud-speed', root);
  const toastBox = el('div', 'hud-toast', root);
  const map = el('canvas', 'hud-map', root);
  map.width = 190;
  map.height = 190;
  const mapCtx = map.getContext('2d');
  const panel = el('div', 'hud-panel', root);
  const panelTitle = el('div', 'hud-panel-title', panel);
  const panelLines = el('div', 'hud-panel-lines', panel);
  const panelPrompt = el('div', 'hud-panel-prompt', panel);

  let toastTimer = 0;
  let wanted = 0;
  let health = 100;
  let cashValue = 0;

  function drawStars() {
    let out = '';
    for (let i = 0; i < 5; i += 1) out += i < wanted ? '★' : '☆';
    stars.textContent = out;
    stars.style.color = wanted > 0 ? '#ffd24d' : 'rgba(245,239,230,0.55)';
  }

  function drawHealth() {
    healthBar.style.width = `${Math.max(0, Math.min(100, health))}%`;
    healthBar.style.background = health > 50 ? '#2ecc71' : health > 25 ? '#f2c94c' : '#e5534b';
  }

  function drawCash() {
    cash.textContent = `$${cashValue.toLocaleString('en-US')}`;
  }

  function drawMinimap(world) {
    const ctx = mapCtx;
    const S = 190;
    const scale = S / (CITY.halfExtent * 2 + 40);
    const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(20, 18, 30, 0.72)';
    ctx.fillRect(0, 0, S, S);
    // Sea.
    ctx.fillStyle = '#2a6f97';
    const [, seaY] = toMap(0, CITY.seaStart);
    ctx.fillRect(0, seaY, S, S - seaY);
    // Roads.
    ctx.strokeStyle = '#8a8f9c';
    ctx.lineWidth = 3;
    for (const r of [-124, -62, 0, 62, 124]) {
      const [x1] = toMap(r, 0);
      ctx.beginPath();
      ctx.moveTo(x1, 0);
      ctx.lineTo(x1, S);
      ctx.stroke();
      const [, z1] = toMap(0, r);
      ctx.beginPath();
      ctx.moveTo(0, z1);
      ctx.lineTo(S, z1);
      ctx.stroke();
    }
    // Mission beacon.
    if (world.missions && world.missions.active) {
      const def = world.missions;
      const bx = def.beacon.position.x;
      const bz = def.beacon.position.z;
      const [mx, my] = toMap(bx, bz);
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath();
      ctx.arc(mx, my, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f2c94c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx, my, 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Cop cars.
    ctx.fillStyle = '#5a8cff';
    for (const car of world.police.copCars) {
      const [mx, my] = toMap(car.pos.x, car.pos.z);
      ctx.fillRect(mx - 2, my - 2, 4, 4);
    }
    // Traffic.
    ctx.fillStyle = 'rgba(220,220,220,0.7)';
    for (const car of world.traffic.cars) {
      const [mx, my] = toMap(car.pos.x, car.pos.z);
      ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
    }
    // The player: a green arrow.
    const [px, py] = toMap(world.player.pos.x, world.player.pos.z);
    ctx.fillStyle = '#2ecc71';
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-world.player.heading);
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  return {
    setWanted(n) {
      wanted = n;
      drawStars();
    },
    setHealth(v) {
      health = v;
      drawHealth();
    },
    setCash(v) {
      cashValue = v;
      drawCash();
    },
    setSpeed(mph, inCar) {
      speed.textContent = inCar ? `${Math.round(mph)} mph` : '';
    },
    setMission(name, brief, timer) {
      missionName.textContent = name || '';
      missionBrief.textContent = brief || '';
      missionTimer.textContent = timer > 0 ? `${Math.ceil(timer)}s` : '';
      mission.style.display = name ? 'block' : 'none';
    },
    toast(message, seconds = 4) {
      toastBox.textContent = message;
      toastBox.style.opacity = '1';
      toastTimer = seconds;
    },
    tickToast(dt) {
      if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0) toastBox.style.opacity = '0';
      }
    },
    drawMinimap(world) {
      drawMinimap(world);
    },
    /** Show one of the big panels, or hide it with null. */
    showPanel(kind, data = {}) {
      if (!kind) {
        panel.style.display = 'none';
        return;
      }
      panel.style.display = 'block';
      if (kind === 'title') {
        panelTitle.textContent = 'SUNSET BAY';
        panelLines.innerHTML =
          'An open-world crime game on a sun-soaked coast.<br>' +
          'Steal any car. Outrun the PD. Work four jobs for Marla.<br><br>' +
          'WASD move &amp; drive &nbsp;·&nbsp; Mouse look &nbsp;·&nbsp; E enter car<br>' +
          'M mission &nbsp;·&nbsp; Q pistol &nbsp;·&nbsp; Click shoot &nbsp;·&nbsp; F punch<br>' +
          'R reload &nbsp;·&nbsp; Shift sprint &nbsp;·&nbsp; P pause';
        panelPrompt.textContent = 'Press ENTER or click START ENGINE';
      } else if (kind === 'paused') {
        panelTitle.textContent = 'PAUSED';
        panelLines.innerHTML = `Cash $${data.cash || 0} &nbsp;·&nbsp; Jobs done ${data.jobs || 0} of 4`;
        panelPrompt.textContent = 'Press P to keep playing';
      } else if (kind === 'busted') {
        panelTitle.textContent = 'BUSTED';
        panelLines.innerHTML = 'The Sunset Bay PD caught up with you.<br>Marla posts your bail. The job is lost.';
        panelPrompt.textContent = 'Press ENTER to get back out there';
      } else if (kind === 'wasted') {
        panelTitle.textContent = 'WASTED';
        panelLines.innerHTML = 'Sunset Bay chews people up.<br>Marla patches you up. The job is lost.';
        panelPrompt.textContent = 'Press ENTER to get back out there';
      } else if (kind === 'done') {
        panelTitle.textContent = 'ALL JOBS DONE';
        panelLines.innerHTML =
          `You ran every job Marla had and walked away with $${data.cash || 0}.<br>` +
          'Sunset Bay is yours now. Keep driving, or start over.';
        panelPrompt.textContent = 'Press ENTER to keep cruising';
      }
    },
    hidePanel() {
      panel.style.display = 'none';
    },
  };
}
