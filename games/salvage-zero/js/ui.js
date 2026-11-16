import { formatTime, clamp } from './utils.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

export class UI {
  constructor() {
    this.screens = {};
    $$('.screen').forEach(s => { this.screens[s.id] = s; });
    this.hullFill = $('#hullFill');
    this.heatFill = $('#heatFill');
    this.cargoCount = $('#cargoCount');
    this.cargoQuota = $('#cargoQuota');
    this.objectiveText = $('#objectiveText');
    this.timerReadout = $('#timerReadout');
    this.comboReadout = $('#comboReadout');
    this.extractionBanner = $('#extractionBanner');
    this.radarCanvas = $('#radarCanvas');
    this.radarCtx = this.radarCanvas.getContext('2d');
    this.pauseOverlay = $('#pauseOverlay');
    this.completeOverlay = $('#completeOverlay');
    this.failureOverlay = $('#failureOverlay');
    this.damageVignette = $('#damageVignette');
    this.controlHint = $('#controlHint');
    this._lastComboMult = 1;
    this._hud = {};
    this._sizeRadar();
    window.addEventListener('resize', () => this._sizeRadar());
  }

  // Keep the radar bitmap matched to its CSS box and the display density, so it stays sharp.
  _sizeRadar() {
    const c = this.radarCanvas;
    const css = c.clientWidth || 140;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this._radarSize = css;
    if (c.width !== Math.round(css * dpr)) {
      c.width = c.height = Math.round(css * dpr);
    }
    this.radarCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  showControlHint(visible) {
    if (this.controlHint) this.controlHint.classList.toggle('visible', !!visible);
  }

  // Only touch the DOM when a HUD value actually changes.
  _set(key, value, apply) {
    if (this._hud[key] === value) return;
    this._hud[key] = value;
    apply(value);
  }

  showScreen(id) {
    for (const key in this.screens) this.screens[key].classList.toggle('active', key === id);
  }

  setLoadingProgress(pct, label) {
    const fill = $('#loadingFill');
    if (fill) fill.style.width = clamp(pct, 0, 100) + '%';
    if (label) $('.loading-label').textContent = label;
  }

  renderMenu(save) {
    $('#installBtn').hidden = !window.__deferredInstallPrompt;
    const started = !!(save.completed && Object.keys(save.completed).length);
    const cont = $('.menu-btn[data-action="continue"]');
    const fresh = $('.menu-btn[data-action="new-game"]');
    cont.style.display = started ? '' : 'none';
    if (started) {
      const next = Math.min(save.unlockedMissions, 12);
      cont.textContent = `Continue — Contract ${String(next).padStart(2, '0')}`;
    }
    // A first-time pilot gets one obvious button; a returning one gets Continue instead.
    fresh.style.display = started ? 'none' : '';
    fresh.classList.toggle('primary', !started);
    fresh.textContent = 'Start First Contract';
    const done = save.completed ? Object.keys(save.completed).length : 0;
    $('#menuCredits').textContent = `${save.credits.toLocaleString()} CR · ${done}/12 contracts · Runs fully offline`;
  }

  renderUpgrades(save, upgradeDefs, maxLevel, onBuy) {
    $('#upgradesCredits').textContent = `${save.credits.toLocaleString()} CR`;
    const list = $('#upgradeList');
    list.innerHTML = '';
    for (const key in upgradeDefs) {
      const def = upgradeDefs[key];
      const level = save.upgrades[key] || 0;
      const maxed = level >= maxLevel;
      const cost = maxed ? null : def.costs[level];
      const canAfford = !maxed && save.credits >= cost;
      const card = document.createElement('div');
      card.className = 'upgrade-card';
      const dots = Array.from({ length: maxLevel }, (_, i) => `<span class="${i < level ? 'filled' : ''}"></span>`).join('');
      card.innerHTML = `
        <div class="row1"><span class="name">${def.name}</span><div class="upgrade-dots">${dots}</div></div>
        <div class="desc">${def.description}</div>
        <div class="effect">${def.describe(level)}</div>
        <button class="upgrade-buy ${maxed ? 'maxed' : ''}" ${maxed || !canAfford ? 'disabled' : ''}>
          ${maxed ? 'MAXED' : `Upgrade — ${cost.toLocaleString()} CR`}
        </button>
      `;
      if (!maxed) card.querySelector('.upgrade-buy').addEventListener('click', () => onBuy(key));
      list.appendChild(card);
    }
  }

  renderMissionGrid(missionDefs, save, onSelect) {
    const grid = $('#missionGrid');
    grid.innerHTML = '';
    missionDefs.forEach((def, i) => {
      const unlocked = def.id <= save.unlockedMissions;
      const card = document.createElement('button');
      const done = !!(save.completed && save.completed[def.id]);
      card.className = 'mission-card' + (unlocked ? '' : ' locked') + (done ? ' done' : '') + (!done && def.id === Math.min(save.unlockedMissions, 12) ? ' next' : '');
      card.disabled = !unlocked;
      const rank = save.bestRanks[def.id];
      const score = save.bestScores[def.id];
      const optDone = (save.optionalCompleted && save.optionalCompleted[def.id]) || {};
      const pips = def.optional.map(o => `<span class="${optDone[o.id] ? 'on' : ''}"></span>`).join('');
      card.innerHTML = `
        <div class="num">CONTRACT ${String(def.id).padStart(2, '0')}</div>
        <div class="name">${unlocked ? def.name : 'Locked'}</div>
        <div class="score">${unlocked && score ? 'Best: ' + score.toLocaleString() : (unlocked ? 'Not attempted' : 'Complete the previous contract')}</div>
        ${unlocked ? `<div class="pips" aria-hidden="true">${pips}</div>` : ''}
        ${rank ? `<div class="rank">${rank}</div>` : ''}
      `;
      if (unlocked) card.addEventListener('click', () => onSelect(def.id));
      grid.appendChild(card);
    });
  }

  renderStats(save) {
    const s = save.stats;
    const list = $('#statsList');
    const rows = [
      ['Total Salvage Value', s.totalSalvage.toLocaleString()],
      ['Contracts Completed', s.contractsCompleted + ' / 12'],
      ['Distance Flown', Math.round(s.distanceFlown).toLocaleString() + ' units'],
      ['Shots Fired', s.shotsFired.toLocaleString()],
      ['Accuracy', s.shotsFired ? Math.round((s.shotsHit / s.shotsFired) * 100) + '%' : '—'],
      ['Largest Combo', 'x' + s.largestCombo],
      ['Reactor Explosions', s.reactorExplosions],
      ['Play Time', formatTime(s.playTimeSec)],
    ];
    list.innerHTML = rows.map(([k, v]) => `<div class="stat-row"><span>${k}</span><span>${v}</span></div>`).join('');
  }

  bindSettings(save, onChange) {
    const sfx = $('#sfxVolume'), music = $('#musicVolume'), shake = $('#screenShake'),
      reduced = $('#reducedMotion'), contrast = $('#highContrast'), side = $('#controlSide');
    sfx.value = save.settings.sfxVolume;
    music.value = save.settings.musicVolume;
    shake.checked = save.settings.screenShake;
    reduced.checked = save.settings.reducedMotion;
    contrast.checked = save.settings.highContrast;
    side.value = save.settings.controlSide;
    const emit = () => onChange({
      sfxVolume: parseFloat(sfx.value), musicVolume: parseFloat(music.value),
      screenShake: shake.checked, reducedMotion: reduced.checked,
      highContrast: contrast.checked, controlSide: side.value,
    });
    [sfx, music, shake, reduced, contrast, side].forEach(el => {
      el.addEventListener('input', emit);
      el.addEventListener('change', emit);
    });
  }

  applyAccessibility(settings) {
    document.body.classList.toggle('reduced-motion', settings.reducedMotion);
    document.body.classList.toggle('high-contrast', settings.highContrast);
    document.body.classList.toggle('controls-swapped', settings.controlSide === 'right');
  }

  renderBrief(def, save) {
    $('#briefEyebrow').textContent = `CONTRACT ${String(def.id).padStart(2, '0')}`;
    $('#briefName').textContent = def.name;
    $('#briefText').textContent = def.brief;
    $('#briefQuota').textContent = def.quota + ' units';
    $('#briefTimer').textContent = def.timer ? formatTime(def.timer) : 'None';
    const best = save.bestScores[def.id];
    $('#briefBest').textContent = best ? best.toLocaleString() + (save.bestRanks[def.id] ? ' (' + save.bestRanks[def.id] + ')' : '') : '—';
    const optDone = (save.optionalCompleted && save.optionalCompleted[def.id]) || {};
    $('#briefOptional').innerHTML = def.optional
      .map(o => `<div class="${optDone[o.id] ? 'done' : ''}">${optDone[o.id] ? '&#9670;' : '&#9671;'} ${o.label}</div>`).join('');
  }

  updateHUD(mission, ship) {
    const hullPct = Math.round(clamp((ship.hull / ship.maxHull) * 100, 0, 100));
    this._set('hull', hullPct, (v) => {
      this.hullFill.style.width = v + '%';
      this.hullFill.className = 'bar-fill' + (v < 25 ? ' warn' : '');
    });

    const heat = Math.round(clamp(ship.heat, 0, 100));
    this._set('heat', heat + (ship.overheated ? 'x' : ''), () => {
      this.heatFill.style.width = (ship.overheated ? 100 : heat) + '%';
      this.heatFill.className = 'bar-fill' + (ship.overheated ? ' critical' : heat >= 70 ? ' hot' : '');
    });

    this._set('cargo', mission.cargoCollected, (v) => { this.cargoCount.textContent = v; });
    this._set('quota', mission.quota, (v) => { this.cargoQuota.textContent = v; });

    if (mission.timer) {
      const secs = Math.ceil(Math.max(0, mission.timeRemaining));
      this._set('timer', secs, (v) => {
        this.timerReadout.hidden = false;
        this.timerReadout.textContent = formatTime(v);
        this.timerReadout.classList.toggle('low', v <= 30);
      });
    } else {
      this._set('timer', 'none', () => { this.timerReadout.hidden = true; });
    }

    const objective = ship.overheated ? 'OVERHEATED — systems venting'
      : mission.gate.active ? 'Quota met — proceed to the extraction gate.'
      : `Recover salvage: ${mission.cargoCollected}/${mission.quota}`;
    this._set('objective', objective, (v) => { this.objectiveText.textContent = v; });
    this._set('gate', mission.gate.active, (v) => { this.extractionBanner.hidden = !v; });

    const comboOn = mission.combo.mult > 1 && mission.combo.timer > 0;
    this._set('combo', comboOn ? mission.combo.mult : 0, (v) => {
      this.comboReadout.hidden = !v;
      if (!v) return;
      this.comboReadout.textContent = `${v}x COMBO`;
      if (v > this._lastComboMult) {
        this.comboReadout.classList.remove('combo-pop');
        void this.comboReadout.offsetWidth; // restart animation
        this.comboReadout.classList.add('combo-pop');
      }
    });
    this._lastComboMult = mission.combo.mult;

    const vignette = ship.hitFlash > 0 ? (Math.min(1, ship.hitFlash / 0.35) * 0.85).toFixed(2) : '0';
    this._set('vignette', vignette, (v) => { this.damageVignette.style.opacity = v; });
  }

  drawRadar(mission, ship) {
    const ctx = this.radarCtx;
    const w = this._radarSize, h = this._radarSize;
    const cx = w / 2, cy = h / 2, R = w / 2 - 4;
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(139,152,165,0.22)';
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(139,152,165,0.4)'; ctx.stroke();

    const scale = R / (Math.max(mission.worldW, mission.worldH) * 0.55);
    const project = (wx, wy) => {
      let dx = wx - ship.x, dy = wy - ship.y;
      if (dx > mission.worldW / 2) dx -= mission.worldW; if (dx < -mission.worldW / 2) dx += mission.worldW;
      if (dy > mission.worldH / 2) dy -= mission.worldH; if (dy < -mission.worldH / 2) dy += mission.worldH;
      const px = cx + dx * scale, py = cy + dy * scale;
      return { px, py, visible: Math.hypot(px - cx, py - cy) <= R };
    };
    const plot = (wx, wy, color, size) => {
      const p = project(wx, wy);
      if (!p.visible) return;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(p.px, p.py, size, 0, Math.PI * 2); ctx.fill();
    };

    for (const w2 of mission.wrecks) {
      if (!w2.alive) continue;
      if (w2.level === 0) plot(w2.x, w2.y, w2.def.reactor ? '#ff4d4d' : w2.def.explosive ? '#ff9540' : 'rgba(139,152,165,0.8)', w2.def.reactor ? 2.6 : 2);
      else plot(w2.x, w2.y, 'rgba(139,152,165,0.45)', 1.2);
      if (w2.def.reactor && w2.reactorCountdown >= 0) {
        const p = project(w2.x, w2.y);
        if (p.visible) {
          const pulse = 4 + Math.sin(performance.now() / 120) * 2.5;
          ctx.strokeStyle = 'rgba(255,77,77,0.8)';
          ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.arc(p.px, p.py, 5 + pulse, 0, Math.PI * 2); ctx.stroke();
        }
      }
    }
    for (const s of mission.salvage) {
      if (s.collected) continue;
      if (s.kind === 'rare' || s.kind === 'blackbox') plot(s.x, s.y, '#c58bff', 2.2);
    }
    if (mission.gate.active) {
      // Clamp the gate blip to the rim so there is always a bearing to follow.
      const g = project(mission.gate.x, mission.gate.y);
      let gx = g.px, gy = g.py;
      const gd = Math.hypot(gx - cx, gy - cy);
      if (gd > R - 3) { gx = cx + (gx - cx) / gd * (R - 3); gy = cy + (gy - cy) / gd * (R - 3); }
      const blink = 0.6 + 0.4 * Math.sin(performance.now() / 160);
      ctx.fillStyle = `rgba(79,216,232,${blink})`;
      ctx.beginPath(); ctx.arc(gx, gy, 3.4, 0, Math.PI * 2); ctx.fill();
    } else {
      plot(mission.gate.x, mission.gate.y, 'rgba(79,216,232,0.35)', 2.4);
    }

    // the craft, with a heading tick
    ctx.strokeStyle = '#eef4f8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ship.angle) * 8, cy + Math.sin(ship.angle) * 8);
    ctx.stroke();
    ctx.fillStyle = '#eef4f8';
    ctx.beginPath(); ctx.arc(cx, cy, 2.6, 0, Math.PI * 2); ctx.fill();
  }

  showPause(visible) { this.pauseOverlay.hidden = !visible; }

  showComplete(result) {
    $('#rankBadge').textContent = result.rank;
    const rows = [
      ['Salvage Collected', result.cargoValue.toLocaleString()],
      ['Hull Remaining', Math.round(result.hullPct) + '%'],
      ['Mission Time', formatTime(result.time)],
      ['Largest Combo', 'x' + result.largestCombo],
    ];
    const totals = [
      ['Score', result.score.toLocaleString()],
      ['Credits Earned', '+' + result.creditsEarned.toLocaleString()],
    ];
    const optional = (result.optional || [])
      .map(o => `<div class="row opt ${o.done ? 'done' : ''}"><span>${o.done ? '&#9670;' : '&#9671;'} ${o.label}</span><span class="hi">${o.done ? '+300' : '—'}</span></div>`).join('');
    const line = ([k, v]) => `<div class="row"><span>${k}</span><span class="hi">${v}</span></div>`;
    $('#resultList').innerHTML = rows.map(line).join('') + optional
      + '<div class="rule"></div>' + totals.map(line).join('');
    const badge = $('#rankBadge');
    badge.classList.remove('rank-in'); void badge.offsetWidth; badge.classList.add('rank-in');
    $('#newBest').hidden = !result.newBest;
    const nextBtn = document.querySelector('[data-action="next-mission"]');
    nextBtn.style.display = result.hasNext ? '' : 'none';
    this.completeOverlay.hidden = false;
  }
  hideComplete() { this.completeOverlay.hidden = true; }

  showFailure(title, reason) {
    $('#failureTitle').textContent = title;
    $('#failureReason').textContent = reason;
    this.failureOverlay.hidden = false;
  }
  hideFailure() { this.failureOverlay.hidden = true; }
}

export function computeScore(mission, ship) {
  let score = mission.cargoValue * 4;
  score += Math.round(mission.wrecksDestroyedTotal * 25);
  score += Math.round(ship.hull * 8);
  score += mission.largestCombo * 60;
  if (mission.shotsFired > 0) {
    score += Math.round((mission.shotsHit / mission.shotsFired) * 400);
  }
  score = Math.max(0, Math.round(score));
  return score;
}

export function computeRank(score, thresholds) {
  if (score >= thresholds['S+']) return 'S+';
  if (score >= thresholds['S']) return 'S';
  if (score >= thresholds['A']) return 'A';
  if (score >= thresholds['B']) return 'B';
  return 'C';
}
