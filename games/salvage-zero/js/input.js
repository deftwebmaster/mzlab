// Unified input state polled once per frame by ship.js / game.js.
// Supports desktop keyboard and mobile touch (virtual joystick + buttons).

const GAME_KEYS = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd', 'shift'];

export class InputManager {
  constructor() {
    this.rotate = 0;       // -1..1 (keyboard)
    this.aimAngle = null;  // absolute heading from the touch stick, or null when it is centred
    this.thrust = false;
    this.brake = false;
    this.fire = false;
    this.tractor = false;
    this.pausePressed = false; // edge-triggered, consumed by game.js

    // game.js decides when the game owns the keyboard; menus keep native key behaviour.
    this.shouldCapture = () => true;

    this._keys = new Set();
    this._joystickActive = false;
    this._joystickId = null;
    this._joystickOrigin = { x: 0, y: 0 };
    this._joystickAngle = null;
    this._knobEl = null;

    this._bindKeyboard();
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (!e.key) return;
      const key = e.key.toLowerCase();
      if (!this.shouldCapture()) return;
      if (GAME_KEYS.includes(key)) e.preventDefault();
      if (e.repeat) return;
      this._keys.add(key);
      if (key === 'escape' || key === 'p') this.pausePressed = true;
    }, { passive: false });
    window.addEventListener('keyup', (e) => {
      if (!e.key) return;
      const key = e.key.toLowerCase();
      this._keys.delete(key);
      // Releasing Shift changes what the letter keys report, so drop both spellings.
      if (key === 'shift') this._keys.delete('shift');
    });
    window.addEventListener('blur', () => this.reset());
  }

  // Drop every held key, button and stick — used when focus is lost and at mission start.
  reset() {
    this._keys.clear();
    this._mobileThrust = this._mobileBrake = this._mobileFire = this._mobileTractor = false;
    this.pausePressed = false;
    this._releaseJoystick();
    document.querySelectorAll('.ctrl-btn.held').forEach((el) => el.classList.remove('held'));
  }

  _releaseJoystick() {
    this._joystickActive = false;
    this._joystickId = null;
    this._joystickAngle = null;
    if (this._knobEl) {
      this._knobEl.style.transition = 'transform 0.12s ease-out';
      this._knobEl.style.transform = 'translate(0px, 0px)';
    }
  }

  bindJoystick(zoneEl, knobEl) {
    this._knobEl = knobEl;
    const deadZone = 0.22;
    const maxRadius = () => Math.max(30, zoneEl.clientWidth * 0.4);

    const start = (e) => {
      if (this._joystickId !== null) return;
      const touch = e.changedTouches ? e.changedTouches[0] : e;
      this._joystickId = touch.identifier ?? 'mouse';
      // Steer relative to the pad centre, so a tap on the rim already means "that way".
      const rect = zoneEl.getBoundingClientRect();
      this._joystickOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      this._joystickActive = true;
      knobEl.style.transition = 'none';
      apply(touch);
      e.preventDefault();
    };
    const apply = (touch) => {
      const r = maxRadius();
      let dx = touch.clientX - this._joystickOrigin.x;
      let dy = touch.clientY - this._joystickOrigin.y;
      const mag = Math.hypot(dx, dy);
      if (mag > r) { dx = dx / mag * r; dy = dy / mag * r; }
      knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
      this._joystickAngle = mag / r > deadZone ? Math.atan2(dy, dx) : null;
    };
    const move = (e) => {
      if (!this._joystickActive) return;
      const touches = e.changedTouches ? Array.from(e.changedTouches) : [e];
      const touch = touches.find(t => (t.identifier ?? 'mouse') === this._joystickId);
      if (!touch) return;
      apply(touch);
      if (e.cancelable) e.preventDefault();
    };
    const end = (e) => {
      if (!this._joystickActive) return;
      const touches = e.changedTouches ? Array.from(e.changedTouches) : [e];
      const touch = touches.find(t => (t.identifier ?? 'mouse') === this._joystickId);
      if (!touch) return;
      this._releaseJoystick();
    };

    zoneEl.addEventListener('touchstart', start, { passive: false });
    // Track on the window so the thumb can drift off the pad without losing the stick.
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end, { passive: false });
    window.addEventListener('touchcancel', end, { passive: false });
    zoneEl.addEventListener('mousedown', start);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
  }

  bindButton(el, onDown, onUp) {
    const down = (e) => { if (e.cancelable) e.preventDefault(); el.classList.add('held'); onDown(); };
    const up = (e) => { if (e.cancelable) e.preventDefault(); el.classList.remove('held'); onUp(); };
    el.addEventListener('touchstart', down, { passive: false });
    el.addEventListener('touchend', up, { passive: false });
    el.addEventListener('touchcancel', up, { passive: false });
    el.addEventListener('mousedown', down);
    el.addEventListener('mouseup', up);
    el.addEventListener('mouseleave', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  update() {
    const k = this._keys;
    let rotate = 0;
    if (k.has('a') || k.has('arrowleft')) rotate -= 1;
    if (k.has('d') || k.has('arrowright')) rotate += 1;
    this.rotate = rotate;
    this.aimAngle = this._joystickActive && rotate === 0 ? this._joystickAngle : null;

    this.thrust = !!this._mobileThrust || k.has('w') || k.has('arrowup');
    this.brake = !!this._mobileBrake || k.has('s') || k.has('arrowdown');
    this.fire = !!this._mobileFire || k.has(' ');
    this.tractor = !!this._mobileTractor || k.has('shift');
  }

  consumePause() {
    const v = this.pausePressed;
    this.pausePressed = false;
    return v;
  }

  setMobileFlag(name, value) {
    this['_mobile' + name] = value;
  }
}
