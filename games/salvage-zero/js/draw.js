import { CONFIG } from './config.js';

export function drawFrame(renderer, camera, mission, ship, projectilePool, particlePool, bgTheme) {
  const ctx = renderer.ctx;
  const W = renderer.width, H = renderer.height;

  renderer.clear(bgTheme);
  renderer.drawNebula(camera);
  renderer.drawStars(camera);

  drawGate(ctx, camera, mission, W, H);

  for (const w of mission.wrecks) {
    if (!w.alive) continue;
    if (!camera.isVisible(w.x, w.y, w.radius, W, H)) continue;
    drawWreck(ctx, camera, w, W, H);
  }

  for (const s of mission.salvage) {
    if (s.collected) continue;
    if (!camera.isVisible(s.x, s.y, s.radius, W, H)) continue;
    drawSalvage(ctx, camera, s, W, H);
  }

  drawParticles(ctx, camera, particlePool, W, H);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.shadowColor = '#ffb84f';
  ctx.shadowBlur = 8;
  ctx.strokeStyle = '#ffe58a';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (const p of projectilePool.active) {
    if (p.__hit) continue;
    const pos = camera.toScreen(p.x, p.y, W, H);
    ctx.moveTo(pos.x - Math.cos(p.angle) * 11, pos.y - Math.sin(p.angle) * 11);
    ctx.lineTo(pos.x, pos.y);
  }
  ctx.stroke();
  ctx.restore();

  if (!ship.alive) return; // the craft is debris now
  if (ship.tractorActive) drawTractorBeam(ctx, camera, ship, W, H);
  drawShip(ctx, camera, ship, W, H);
}

function drawGate(ctx, camera, mission, W, H) {
  const gate = mission.gate;
  const pos = camera.toScreen(gate.x, gate.y, W, H);
  const visible = camera.isVisible(gate.x, gate.y, gate.radius, W, H);
  const color = gate.active ? '#4fd8e8' : 'rgba(139,152,165,0.35)';

  if (visible) {
    const pulse = gate.active ? 1 + Math.sin(performance.now() / 220) * 0.08 : 1;
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = gate.active ? 4 : 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = gate.active ? 22 : 0;
    ctx.beginPath();
    ctx.arc(0, 0, gate.radius * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, gate.radius * 0.7 * pulse, 0, Math.PI * 2);
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (gate.active) {
      // slow counter-rotating chevrons so the open gate reads as "fly in here"
      const spin = performance.now() / 900;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        const a = spin + i * Math.PI / 2;
        ctx.beginPath();
        ctx.arc(0, 0, gate.radius * 0.42, a, a + 0.7);
        ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.font = '600 11px "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(gate.active ? 'EXTRACTION GATE' : 'GATE OFFLINE', 0, gate.radius + 18);
    ctx.restore();
  } else if (gate.active) {
    // off-screen nav arrow toward the gate, pinned to the screen edge with its distance
    const dx = pos.x - W / 2, dy = pos.y - H / 2;
    const angle = Math.atan2(dy, dx);
    const margin = 54;
    const k = Math.min((W / 2 - margin) / Math.max(Math.abs(dx), 0.001), (H / 2 - margin) / Math.max(Math.abs(dy), 0.001));
    const ax = W / 2 + dx * k;
    const ay = H / 2 + dy * k;
    const bob = 1 + Math.sin(performance.now() / 180) * 0.12;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.fillStyle = '#4fd8e8';
    ctx.font = '700 11px "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(Math.hypot(dx, dy) / 10) + ' m', 0, 28);
    ctx.rotate(angle);
    ctx.scale(bob, bob);
    ctx.shadowColor = '#4fd8e8';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(14, 0); ctx.lineTo(-10, -9); ctx.lineTo(-10, 9); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawWreck(ctx, camera, w, W, H) {
  const pos = camera.toScreen(w.x, w.y, W, H);
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(w.angle);

  let color = w.color;
  if (w.reactorCountdown >= 0) {
    const flicker = Math.sin(performance.now() / (80 - w.reactorCountdown * 25 + 20)) > 0;
    color = flicker ? '#ff4d4d' : '#ffb066';
    ctx.shadowColor = '#ff4d4d';
    ctx.shadowBlur = 20;
  }

  ctx.strokeStyle = color;
  ctx.fillStyle = hexAlpha(color, 0.18);
  ctx.lineWidth = 2;

  const r = w.radius;
  ctx.beginPath();
  if (w.sharp) {
    const spikes = 6;
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * Math.PI * 2;
      const rr = r * (i % 2 === 0 ? 1 : 0.55);
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  } else if (w.def.rotates) {
    // satellite array: cross-shaped irregular silhouette
    ctx.rect(-r, -r * 0.22, r * 2, r * 0.44);
    ctx.rect(-r * 0.22, -r, r * 0.44, r * 2);
  } else {
    const sides = 7;
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const rr = r * (0.82 + 0.18 * Math.sin(i * 7.3 + w.id));
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Inner structure: reads as plating, and dims as the wreck takes damage.
  if (!w.sharp && !w.def.rotates) {
    const integrity = Math.max(0, Math.min(1, w.hp / w.maxHp));
    ctx.globalAlpha = 0.22 + 0.4 * integrity;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, -r * 0.15); ctx.lineTo(r * 0.5, -r * 0.3);
    ctx.moveTo(-r * 0.4, r * 0.35); ctx.lineTo(r * 0.45, r * 0.2);
    ctx.moveTo(-r * 0.1, -r * 0.6); ctx.lineTo(r * 0.05, r * 0.6);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (w.def.explosive || w.def.reactor) {
    // hazard core
    const pulse = 0.55 + 0.45 * Math.sin(performance.now() / (w.def.reactor ? 260 : 420) + w.id);
    ctx.fillStyle = hexAlpha(w.def.color, 0.35 + 0.4 * pulse);
    ctx.shadowColor = w.def.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  if (w.reactorCountdown >= 0) {
    // countdown ring + blast radius preview, drawn unrotated
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.strokeStyle = 'rgba(255,77,77,0.28)';
    ctx.setLineDash([6, 8]);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, w.radius * 5, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 15px "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(Math.max(0, w.reactorCountdown).toFixed(1), 0, 0);
    ctx.restore();
  }
}

function drawSalvage(ctx, camera, s, W, H) {
  const pos = camera.toScreen(s.x, s.y, W, H);
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(s.angle);
  ctx.fillStyle = s.color;
  ctx.shadowColor = s.color;
  ctx.shadowBlur = s.beamed ? 12 : 4;
  const r = s.radius;
  ctx.beginPath();
  ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawParticles(ctx, camera, pool, W, H) {
  for (const p of pool.active) {
    const pos = camera.toScreen(p.x, p.y, W, H);
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    if (p.type === 'shockwave') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, p.size * (1 - alpha), 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawTractorBeam(ctx, camera, ship, W, H) {
  const pos = camera.toScreen(ship.x, ship.y, W, H);
  const range = ship.tractorRange || CONFIG.TRACTOR.RANGE;
  const half = CONFIG.TRACTOR.HALF_ANGLE;
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(ship.angle);
  const grad = ctx.createLinearGradient(0, 0, range, 0);
  grad.addColorStop(0, 'rgba(79,216,232,0.35)');
  grad.addColorStop(1, 'rgba(79,216,232,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, range, -half, half);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawShip(ctx, camera, ship, W, H) {
  const pos = camera.toScreen(ship.x, ship.y, W, H);
  const warp = ship.warpProgress || 0;
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(ship.angle);
  if (warp > 0) {
    ctx.globalAlpha = 1 - warp;
    ctx.scale(1 - warp * 0.9, 1 - warp * 0.9);
  }

  const damaged = ship.hull / ship.maxHull < 0.25;
  const r = ship.radius;

  // thruster glow
  if (ship.thrusting) {
    ctx.fillStyle = 'rgba(79,216,232,0.55)';
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, -r * 0.5);
    ctx.lineTo(-r * 1.6 - Math.random() * 6, 0);
    ctx.lineTo(-r * 0.6, r * 0.5);
    ctx.closePath();
    ctx.fill();
  }

  // hull — angular industrial silhouette
  ctx.fillStyle = ship.hitFlash > 0 ? '#ffffff' : '#171d24';
  ctx.strokeStyle = '#eef4f8';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(-r * 0.7, -r * 0.75);
  ctx.lineTo(-r * 0.3, -r * 0.3);
  ctx.lineTo(-r * 0.9, -r * 0.4);
  ctx.lineTo(-r * 0.9, r * 0.4);
  ctx.lineTo(-r * 0.3, r * 0.3);
  ctx.lineTo(-r * 0.7, r * 0.75);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // cargo bay
  ctx.fillStyle = '#4fd8e8';
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.arc(-r * 0.15, 0, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // nav / warning lights
  ctx.fillStyle = damaged ? '#ff9540' : '#eef4f8';
  ctx.beginPath(); ctx.arc(-r * 0.75, -r * 0.5, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-r * 0.75, r * 0.5, 1.6, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

function hexAlpha(hex, alpha) {
  if (hex.startsWith('rgb')) return hex;
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
