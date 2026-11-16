import { wrapDelta, wrapValue, randRange } from './utils.js';

const STAR_TILE = 1400;
const NEBULA_TILE = 2600;

// Background theme palettes — subtle parallax starfields, no external images.
export const BACKGROUNDS = {
  earth_orbit:      { name: 'Earth Orbit',       sky: '#050a12', tint: '#1a3a5c', starDensity: 1.0, accent: '#2b5c8a' },
  dead_station:     { name: 'Dead Station',      sky: '#07070a', tint: '#26262e', starDensity: 0.8, accent: '#3a3a45' },
  asteroid_graveyard:{ name: 'Asteroid Graveyard',sky: '#080604', tint: '#3a2a1a', starDensity: 0.9, accent: '#5c4326' },
  shipyard:         { name: 'Shipyard',          sky: '#050810', tint: '#20304a', starDensity: 0.7, accent: '#4fd8e8' },
  jovian_orbit:      { name: 'Jovian Orbit',      sky: '#0a0705', tint: '#5c3a1a', starDensity: 1.1, accent: '#c58650' },
  nebula_edge:      { name: 'Nebula Edge',       sky: '#08040c', tint: '#3a1a5c', starDensity: 1.3, accent: '#8b4fd8' },
};

export class Camera {
  constructor(worldW, worldH) {
    this.x = worldW / 2;
    this.y = worldH / 2;
    // Unwrapped travel, so parallax layers scroll smoothly across the world seam.
    this.ux = 0;
    this.uy = 0;
    this.worldW = worldW;
    this.worldH = worldH;
    this.shake = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
  }

  follow(target, dt) {
    this.ux += wrapDelta(target.x, this.x, this.worldW);
    this.uy += wrapDelta(target.y, this.y, this.worldH);
    this.x = target.x;
    this.y = target.y;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 26);
      const s = this.shake;
      this.shakeOffsetX = randRange(-s, s);
      this.shakeOffsetY = randRange(-s, s);
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
    }
  }

  addShake(amount) {
    this.shake = Math.min(18, this.shake + amount);
  }

  // World -> screen, using shortest toroidal delta so wrapping is seamless near seams.
  toScreen(wx, wy, screenW, screenH) {
    const dx = wrapDelta(wx, this.x, this.worldW);
    const dy = wrapDelta(wy, this.y, this.worldH);
    return {
      x: screenW / 2 + dx - this.shakeOffsetX,
      y: screenH / 2 + dy - this.shakeOffsetY,
      dx, dy,
    };
  }

  isVisible(wx, wy, radius, screenW, screenH) {
    const p = this.toScreen(wx, wy, screenW, screenH);
    return p.x > -radius - 40 && p.x < screenW + radius + 40 && p.y > -radius - 40 && p.y < screenH + radius + 40;
  }
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.stars = [];
    this.nebula = [];
    this.reducedMotion = false;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = w;
    this.height = h;
  }

  // Stars and nebula live on a repeating tile rather than in world space: each layer
  // scrolls at its own fraction of camera travel and wraps at the tile edge, so the sky
  // fills any screen size evenly and never pops when the craft crosses the world seam.
  generateStars(worldW, worldH, density = 1) {
    this.stars = [];
    const layers = [
      { count: 150 * density, speed: 0.12, size: [0.6, 1.2], alpha: 0.35 },
      { count: 95 * density, speed: 0.28, size: [0.9, 1.8], alpha: 0.55 },
      { count: 50 * density, speed: 0.5, size: [1.2, 2.4], alpha: 0.85 },
    ];
    for (const layer of layers) {
      for (let i = 0; i < layer.count; i++) {
        this.stars.push({
          x: Math.random() * STAR_TILE,
          y: Math.random() * STAR_TILE,
          size: randRange(layer.size[0], layer.size[1]),
          alpha: layer.alpha * randRange(0.6, 1),
          speed: layer.speed,
          twinkle: Math.random() * Math.PI * 2,
        });
      }
    }
  }

  generateNebula(worldW, worldH, theme) {
    this.nebula = [];
    const count = 6;
    for (let i = 0; i < count; i++) {
      this.nebula.push({
        x: Math.random() * NEBULA_TILE,
        y: Math.random() * NEBULA_TILE,
        radius: randRange(260, 520),
        alpha: randRange(0.06, 0.14),
        speed: 0.06,
        color: i % 3 === 2 ? theme.tint : theme.accent,
      });
    }
  }

  drawNebula(camera) {
    const ctx = this.ctx;
    for (const n of this.nebula) {
      const bx = wrapValue(n.x - camera.ux * n.speed, NEBULA_TILE) - n.radius;
      const by = wrapValue(n.y - camera.uy * n.speed, NEBULA_TILE) - n.radius;
      for (let px = bx - NEBULA_TILE; px - n.radius < this.width; px += NEBULA_TILE) {
        if (px + n.radius < 0) continue;
        for (let py = by - NEBULA_TILE; py - n.radius < this.height; py += NEBULA_TILE) {
          if (py + n.radius < 0) continue;
          const g = ctx.createRadialGradient(px, py, 0, px, py, n.radius);
          g.addColorStop(0, hexAlphaColor(n.color, n.alpha));
          g.addColorStop(1, hexAlphaColor(n.color, 0));
          ctx.fillStyle = g;
          ctx.fillRect(px - n.radius, py - n.radius, n.radius * 2, n.radius * 2);
        }
      }
    }
  }

  clear(bgTheme) {
    const ctx = this.ctx;
    const theme = bgTheme || BACKGROUNDS.earth_orbit;
    const g = ctx.createLinearGradient(0, 0, 0, this.height);
    g.addColorStop(0, theme.sky);
    g.addColorStop(1, mixHex(theme.sky, theme.tint, 0.35));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  drawStars(camera) {
    const ctx = this.ctx;
    const t = this.reducedMotion ? 0 : performance.now() / 1000;
    ctx.fillStyle = '#eef4f8';
    for (const s of this.stars) {
      const bx = wrapValue(s.x - camera.ux * s.speed, STAR_TILE);
      const by = wrapValue(s.y - camera.uy * s.speed, STAR_TILE);
      ctx.globalAlpha = s.alpha * (0.82 + 0.18 * Math.sin(t * 1.3 + s.twinkle));
      for (let px = bx; px < this.width; px += STAR_TILE) {
        for (let py = by; py < this.height; py += STAR_TILE) {
          ctx.fillRect(px, py, s.size, s.size);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  begin() {
    this.ctx.save();
  }
  end() {
    this.ctx.restore();
  }
}

export function mixHex(a, b, t) {
  const pa = hexToRgb(a), pb = hexToRgb(b);
  const r = Math.round(lerp(pa.r, pb.r, t));
  const g = Math.round(lerp(pa.g, pb.g, t));
  const bl = Math.round(lerp(pa.b, pb.b, t));
  return `rgb(${r},${g},${bl})`;
}
function lerp(a, b, t) { return a + (b - a) * t; }
function hexAlphaColor(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}
function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const num = parseInt(hex, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
