/**
 * Casio A158W Engine & Component - Photorealistic Edition
 * Using original Casio A158W watch geometry and transparent LCD bezel.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CasioA158 = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  // --- AUDIO SYNTHESIS (Casio Module 593 Piezo Buzzer) ---
  class CasioAudio {
    constructor() {
      this.ctx = null;
      this.muted = false;
      try {
        const savedMute = localStorage.getItem('casio_a158_muted');
        if (savedMute !== null) this.muted = JSON.parse(savedMute);
      } catch (e) {}
    }

    init() {
      if (!this.ctx && typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }

    toggleMute() {
      this.muted = !this.muted;
      try {
        localStorage.setItem('casio_a158_muted', JSON.stringify(this.muted));
      } catch (e) {}
      if (!this.muted) this.beep(3500, 0.03);
      return this.muted;
    }

    beep(freq = 2048, duration = 0.035, count = 1) {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      for (let i = 0; i < count; i++) {
        const start = now + (i * 0.07);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.12, start + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(start);
        osc.stop(start + duration + 0.01);
      }
    }
  }

  const audio = new CasioAudio();

  // --- 7-SEGMENT DISPLAY UTILITIES ---
  const SEG_PATHS = {
    a: "M 10 8 L 18 16 L 42 16 L 50 8 L 44 3 L 16 3 Z",
    b: "M 52 10 L 44 18 L 44 45 L 52 51 L 57 46 L 57 15 Z",
    c: "M 52 53 L 44 59 L 44 86 L 52 94 L 57 89 L 57 58 Z",
    d: "M 10 96 L 18 88 L 42 88 L 50 96 L 44 101 L 16 101 Z",
    e: "M 8 53 L 16 59 L 16 86 L 8 94 L 3 89 L 3 58 Z",
    f: "M 8 10 L 16 18 L 16 45 L 8 51 L 3 46 L 3 15 Z",
    g: "M 10 52 L 16 47 L 44 47 L 50 52 L 44 57 L 16 57 Z"
  };

  const CHAR_MAP = {
    '0': ['a', 'b', 'c', 'd', 'e', 'f'],
    '1': ['b', 'c'],
    '2': ['a', 'b', 'g', 'e', 'd'],
    '3': ['a', 'b', 'g', 'c', 'd'],
    '4': ['f', 'g', 'b', 'c'],
    '5': ['a', 'f', 'g', 'c', 'd'],
    '6': ['a', 'f', 'g', 'e', 'c', 'd'],
    '7': ['a', 'b', 'c'],
    '8': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    '9': ['a', 'b', 'c', 'd', 'f', 'g'],
    '-': ['g'],
    ' ': []
  };

  function createDigitSVG(char = ' ', width = 24, height = 40, slant = -4) {
    const activeSegs = new Set(CHAR_MAP[char] || []);
    const keys = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

    return `
      <svg class="casio-digit" viewBox="0 0 60 104" width="${width}" height="${height}" style="transform: skewX(${slant}deg);">
        ${keys.map(k => {
          const isActive = activeSegs.has(k);
          return `<path data-seg="${k}" d="${SEG_PATHS[k]}" class="seg ${isActive ? 'seg-on' : 'seg-off'}" />`;
        }).join('')}
      </svg>
    `;
  }

  function updateDigitSVG(svgEl, char = ' ') {
    if (!svgEl) return;
    const activeSegs = new Set(CHAR_MAP[char] || []);
    const paths = svgEl.querySelectorAll('path[data-seg]');
    paths.forEach(p => {
      const seg = p.getAttribute('data-seg');
      if (activeSegs.has(seg)) {
        p.classList.remove('seg-off');
        p.classList.add('seg-on');
      } else {
        p.classList.remove('seg-on');
        p.classList.add('seg-off');
      }
    });
  }

  // --- STYLESHEET ---
  const STYLES = `
    .casio-watch-root {
      position: relative;
      width: 270px;
      height: 484px;
      user-select: none;
      -webkit-user-select: none;
      filter: drop-shadow(0 16px 28px rgba(0, 0, 0, 0.65));
      cursor: grab;
      pointer-events: auto;
    }
    .casio-watch-root:active {
      cursor: grabbing;
    }

    /* Original Photo Watch Frame Overlay */
    .casio-frame-img {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 10;
      object-fit: contain;
    }

    /* Live LCD Panel situated behind cutout window */
    .casio-lcd-panel {
      position: absolute;
      left: 23.75%;
      top: 42.47%;
      width: 48.47%;
      height: 13.46%;
      background: #a4a79b; /* Sampled Casio LCD substrate */
      border-radius: 4px;
      box-shadow: inset 1px 2px 3px rgba(0, 0, 0, 0.35);
      overflow: hidden;
      z-index: 5;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 4px 6px 4px 6px;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    /* Micro-LED Green Backlight */
    .casio-lcd-backlight {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: radial-gradient(ellipse 130% 140% at 0% 50%, 
        rgba(68, 255, 133, 0.92) 0%, 
        rgba(48, 238, 114, 0.78) 28%, 
        rgba(75, 220, 125, 0.45) 58%, 
        rgba(120, 190, 140, 0.18) 85%, 
        transparent 100%
      );
      box-shadow: 
        inset 6px 0 16px rgba(68, 255, 133, 0.95),
        inset 0 0 12px rgba(48, 238, 114, 0.6);
      opacity: 0;
      pointer-events: none;
      z-index: 8;
      transition: opacity 1.4s cubic-bezier(0.1, 0.9, 0.2, 1);
    }
    .casio-lcd-backlight.active {
      opacity: 1;
      transition: opacity 0.04s ease-out;
    }

    /* Subtle LCD crystal specular reflection */
    .casio-lcd-panel::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: linear-gradient(135deg, 
        rgba(255,255,255,0.2) 0%, 
        rgba(255,255,255,0.05) 45%, 
        transparent 55%
      );
      pointer-events: none;
      z-index: 9;
    }

    /* LCD Top Row: Indicators, Day of Week, Date */
    .lcd-top-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      height: 18px;
      z-index: 6;
    }

    .lcd-indicators-left {
      display: flex;
      align-items: center;
      gap: 3px;
      min-width: 34px;
      font-size: 8px;
      font-weight: 800;
      color: #151913;
    }

    .lcd-icon {
      opacity: 0.12;
      transition: opacity 0.15s;
    }
    .lcd-icon.active { opacity: 0.95; }

    .lcd-pm-indicator {
      font-size: 7px;
      font-weight: 900;
      letter-spacing: 0.3px;
      opacity: 0.08;
      font-family: "Helvetica Neue", Arial, sans-serif;
    }
    .lcd-pm-indicator.active { opacity: 0.95; }

    .lcd-24h-indicator {
      font-size: 6.5px;
      font-weight: 900;
      opacity: 0.08;
    }
    .lcd-24h-indicator.active { opacity: 0.95; }

    .lcd-day-center {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .casio-day-display {
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 1.2px;
      color: #151913;
      font-family: -apple-system, BlinkMacSystemFont, "Courier New", monospace;
    }

    .lcd-date-right {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      min-width: 34px;
    }

    .spl-indicator {
      font-size: 7.5px;
      font-weight: 900;
      color: #151913;
      margin-right: 2px;
      letter-spacing: 0.5px;
    }

    /* Main LCD Digits */
    .lcd-main-row {
      display: flex;
      align-items: flex-end;
      justify-content: center;
      width: 100%;
      height: 44px;
      padding-bottom: 2px;
      z-index: 6;
    }

    .digits-group-time {
      display: flex;
      align-items: flex-end;
      gap: 1.5px;
    }

    /* Colon Separator */
    .lcd-colon {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 7px;
      width: 7px;
      height: 34px;
      align-items: center;
      padding-bottom: 3px;
    }
    .colon-dot {
      width: 3.5px;
      height: 3.5px;
      background: #151913;
      border-radius: 0.5px;
      opacity: 0.95;
      transition: opacity 0.04s ease;
    }
    .colon-dot.off { opacity: 0.08; }

    .seconds-container {
      display: flex;
      align-items: flex-end;
      margin-left: 3px;
      margin-bottom: 2px;
      gap: 1px;
    }

    /* 7-Segment SVG styling */
    .casio-digit {
      display: inline-block;
      overflow: visible;
    }
    .seg {
      transition: fill 0.03s linear;
    }
    .seg-on {
      fill: #151913;
      opacity: 0.96;
    }
    .seg-off {
      fill: rgba(20, 26, 18, 0.055);
    }

    /* Interactive Hotspots matching genuine buttons */
    .casio-hotspot {
      position: absolute;
      background: transparent;
      border: none;
      outline: none;
      cursor: pointer;
      z-index: 20;
    }
    .casio-hotspot:hover {
      background: rgba(255, 255, 255, 0.08);
      border-radius: 3px;
    }

    /* Physical Pusher Hotspots */
    .pusher-tl-hotspot {
      left: 0;
      top: 39.15%;
      width: 8%;
      height: 6.4%;
      border-radius: 4px 0 0 4px;
    }
    .pusher-bl-hotspot {
      left: 0;
      top: 51.65%;
      width: 8%;
      height: 6.2%;
      border-radius: 4px 0 0 4px;
    }
    .pusher-br-hotspot {
      right: 0;
      top: 52.88%;
      width: 8%;
      height: 5.5%;
      border-radius: 0 4px 4px 0;
    }

    /* Dial Text Click Hotspots */
    .dial-light-hotspot {
      left: 18%;
      top: 36.8%;
      width: 27%;
      height: 2.2%;
    }
    .dial-mode-hotspot {
      left: 18%;
      top: 38.9%;
      width: 15%;
      height: 2.2%;
    }
    .dial-start-hotspot {
      left: 45%;
      top: 38.9%;
      width: 35%;
      height: 2.2%;
    }
  `;

  function ensureStyles() {
    if (typeof document !== 'undefined' && !document.getElementById('casio-a158-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'casio-a158-styles';
      styleEl.textContent = STYLES;
      document.head.appendChild(styleEl);
    }
  }

  // --- CONTROLLER ---
  class CasioController {
    constructor(mountElement, options = {}) {
      this.el = mountElement;
      this.options = options;

      this.is24Hour = false;
      try {
        const saved24 = localStorage.getItem('casio_a158_24h');
        if (saved24 !== null) this.is24Hour = JSON.parse(saved24);
      } catch (e) {}

      this.scale = 1.0;
      try {
        const savedScale = localStorage.getItem('casio_a158_scale');
        if (savedScale !== null) this.scale = JSON.parse(savedScale);
      } catch (e) {}

      this.mode = 'TIME';
      this.isBacklightActive = false;
      this.backlightTimeout = null;

      this.stopwatch = {
        status: 'stopped',
        startTime: 0,
        accumulatedMs: 0,
        splitMs: null
      };

      this.rafId = null;
      this.lastTick = 0;
      this.domBuilt = false;
      this.boundKeyHandler = this.handleKeyDown.bind(this);

      ensureStyles();
      this.buildDOM();
      this.bindEvents();
      this.startLoop();
    }

    getElapsedStopwatchMs() {
      if (this.stopwatch.status === 'running') {
        return this.stopwatch.accumulatedMs + (performance.now() - this.stopwatch.startTime);
      }
      return this.stopwatch.accumulatedMs;
    }

    triggerBacklight() {
      audio.init();
      this.isBacklightActive = true;
      this.updateBacklightDOM();

      if (this.backlightTimeout) clearTimeout(this.backlightTimeout);
      this.backlightTimeout = setTimeout(() => {
        this.isBacklightActive = false;
        this.updateBacklightDOM();
      }, 1800);
    }

    updateBacklightDOM() {
      const bl = this.el.querySelector('#lcd-backlight');
      if (bl) {
        if (this.isBacklightActive) bl.classList.add('active');
        else bl.classList.remove('active');
      }
    }

    switchMode() {
      audio.beep(2048, 0.04);
      this.mode = this.mode === 'TIME' ? 'STOPWATCH' : 'TIME';
      this.updateDisplay();
    }

    handleRightButton() {
      audio.init();
      if (this.mode === 'TIME') {
        audio.beep(2048, 0.035);
        this.is24Hour = !this.is24Hour;
        try {
          localStorage.setItem('casio_a158_24h', JSON.stringify(this.is24Hour));
        } catch (e) {}
      } else {
        audio.beep(2048, 0.04);
        if (this.stopwatch.status === 'running') {
          this.stopwatch.accumulatedMs += (performance.now() - this.stopwatch.startTime);
          this.stopwatch.status = 'stopped';
        } else {
          this.stopwatch.startTime = performance.now();
          this.stopwatch.status = 'running';
        }
      }
      this.updateDisplay();
    }

    handleTopLeftButton() {
      audio.init();
      this.triggerBacklight();
      if (this.mode === 'STOPWATCH') {
        if (this.stopwatch.status === 'running') {
          audio.beep(2048, 0.03, 2);
          if (this.stopwatch.splitMs === null) {
            this.stopwatch.splitMs = this.getElapsedStopwatchMs();
          } else {
            this.stopwatch.splitMs = null;
          }
        } else {
          audio.beep(2048, 0.035);
          this.stopwatch.accumulatedMs = 0;
          this.stopwatch.startTime = 0;
          this.stopwatch.splitMs = null;
        }
      }
      this.updateDisplay();
    }

    handleKeyDown(e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const key = e.key.toLowerCase();
      if (key === 'l') this.handleTopLeftButton();
      else if (key === 'm') this.switchMode();
      else if (key === 's') this.handleRightButton();
      else if (key === 'r') { if (this.mode === 'STOPWATCH') this.handleTopLeftButton(); }
      else if (key === 'b') {
        audio.toggleMute();
        this.updateAudioIndicator();
      } else if (key === '+' || key === '=') {
        this.setScale(this.scale + 0.1);
      } else if (key === '-' || key === '_') {
        this.setScale(this.scale - 0.1);
      } else if (key === '0') {
        this.setScale(1.0);
      }
    }

    setScale(val) {
      this.scale = Math.min(2.5, Math.max(0.4, Math.round(val * 10) / 10));
      try { localStorage.setItem('casio_a158_scale', JSON.stringify(this.scale)); } catch (e) {}
      const root = this.el.querySelector('.casio-watch-root');
      if (root) {
        root.style.transform = `scale(${this.scale})`;
        root.style.transformOrigin = 'top center';
      }
    }

    updateAudioIndicator() {
      const bell = this.el.querySelector('#lcd-icon-bell');
      if (bell) bell.classList.toggle('active', !audio.muted);
    }

    bindEvents() {
      if (typeof window !== 'undefined') {
        window.addEventListener('keydown', this.boundKeyHandler);
      }
    }

    destroy() {
      if (this.rafId) cancelAnimationFrame(this.rafId);
      if (this.backlightTimeout) clearTimeout(this.backlightTimeout);
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', this.boundKeyHandler);
      }
    }

    startLoop() {
      const tick = () => {
        const now = performance.now();
        const interval = (this.mode === 'STOPWATCH' && this.stopwatch.status === 'running') ? 25 : 100;
        if (now - this.lastTick >= interval) {
          this.lastTick = now;
          this.updateDisplay();
        }
        this.rafId = requestAnimationFrame(tick);
      };
      this.rafId = requestAnimationFrame(tick);
    }

    buildDOM() {
      this.el.innerHTML = `
        <div class="casio-watch-root">
          <!-- Live LCD Screen behind cutout window -->
          <div class="casio-lcd-panel">
            <!-- Micro-LED Green Backlight Overlay -->
            <div class="casio-lcd-backlight" id="lcd-backlight"></div>

            <!-- Top Row: Indicators, Day of Week, Date -->
            <div class="lcd-top-row">
              <div class="lcd-indicators-left">
                <svg class="lcd-icon active" viewBox="0 0 24 24" width="8" height="8">
                  <path d="M4 14 A6 6 0 0 1 4 6 M8 16 A9 9 0 0 1 8 4 M12 18 A12 12 0 0 1 12 2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
                </svg>
                <svg class="lcd-icon ${!audio.muted ? 'active' : ''}" id="lcd-icon-bell" viewBox="0 0 24 24" width="8" height="8" style="cursor:pointer;" title="Sound (B)">
                  <path d="M12 3 A4 4 0 0 0 8 7 V12 L6 15 H18 L16 12 V7 A4 4 0 0 0 12 3 Z M10 17 A2 2 0 0 0 14 17 Z" fill="currentColor"/>
                </svg>
                <span class="lcd-pm-indicator" id="lcd-pm">PM</span>
                <span class="lcd-24h-indicator" id="lcd-24h">24H</span>
              </div>

              <div class="lcd-day-center">
                <div class="casio-day-display">
                  <span id="lcd-day-text">SU</span>
                </div>
              </div>

              <div class="lcd-date-right">
                <span class="spl-indicator" id="lcd-spl-text" style="display:none;">SPL</span>
                <div id="lcd-date-digits" style="display:flex;">
                  <span id="lcd-date-1">${createDigitSVG(' ', 12, 19, -4)}</span>
                  <span id="lcd-date-2">${createDigitSVG(' ', 12, 19, -4)}</span>
                </div>
              </div>
            </div>

            <!-- Main Digits: Hours, Colon, Minutes, Seconds -->
            <div class="lcd-main-row">
              <div class="digits-group-time">
                <span id="lcd-h1">${createDigitSVG(' ', 21, 35, -4)}</span>
                <span id="lcd-h2">${createDigitSVG(' ', 21, 35, -4)}</span>

                <div class="lcd-colon">
                  <span class="colon-dot" id="lcd-colon-1"></span>
                  <span class="colon-dot" id="lcd-colon-2"></span>
                </div>

                <span id="lcd-m1">${createDigitSVG(' ', 21, 35, -4)}</span>
                <span id="lcd-m2">${createDigitSVG(' ', 21, 35, -4)}</span>

                <div class="seconds-container">
                  <span id="lcd-s1">${createDigitSVG(' ', 16, 26, -4)}</span>
                  <span id="lcd-s2">${createDigitSVG(' ', 16, 26, -4)}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Original Casio A158W Watch Photo Overlay with cut-out LCD -->
          <img 
            src="watch_frame.png" 
            alt="Casio A158W" 
            class="casio-frame-img"
            onerror="if(!this.tried){this.tried=true;this.src='casio-a158.widget/watch_frame.png';}"
          />

          <!-- Interactive Clickable Hotspots -->
          <button class="casio-hotspot pusher-tl-hotspot" id="hotspot-tl" title="LIGHT / LAP • RESET (L)"></button>
          <button class="casio-hotspot pusher-bl-hotspot" id="hotspot-bl" title="MODE (M)"></button>
          <button class="casio-hotspot pusher-br-hotspot" id="hotspot-br" title="START • STOP / 12 • 24H (S)"></button>

          <button class="casio-hotspot dial-light-hotspot" id="hotspot-dial-light" title="LIGHT / LAP • RESET"></button>
          <button class="casio-hotspot dial-mode-hotspot" id="hotspot-dial-mode" title="MODE"></button>
          <button class="casio-hotspot dial-start-hotspot" id="hotspot-dial-start" title="START • STOP / 12 • 24H"></button>
        </div>
      `;

      this.dom = {
        pm: this.el.querySelector('#lcd-pm'),
        h24: this.el.querySelector('#lcd-24h'),
        dayText: this.el.querySelector('#lcd-day-text'),
        splText: this.el.querySelector('#lcd-spl-text'),
        dateContainer: this.el.querySelector('#lcd-date-digits'),
        date1Svg: this.el.querySelector('#lcd-date-1 svg'),
        date2Svg: this.el.querySelector('#lcd-date-2 svg'),
        h1Svg: this.el.querySelector('#lcd-h1 svg'),
        h2Svg: this.el.querySelector('#lcd-h2 svg'),
        m1Svg: this.el.querySelector('#lcd-m1 svg'),
        m2Svg: this.el.querySelector('#lcd-m2 svg'),
        s1Svg: this.el.querySelector('#lcd-s1 svg'),
        s2Svg: this.el.querySelector('#lcd-s2 svg'),
        colon1: this.el.querySelector('#lcd-colon-1'),
        colon2: this.el.querySelector('#lcd-colon-2')
      };

      // Connect clicks
      const tl = this.el.querySelector('#hotspot-tl');
      const bl = this.el.querySelector('#hotspot-bl');
      const br = this.el.querySelector('#hotspot-br');
      const dialLight = this.el.querySelector('#hotspot-dial-light');
      const dialMode = this.el.querySelector('#hotspot-dial-mode');
      const dialStart = this.el.querySelector('#hotspot-dial-start');
      const bell = this.el.querySelector('#lcd-icon-bell');

      if (tl) tl.onclick = (e) => { e.stopPropagation(); this.handleTopLeftButton(); };
      if (dialLight) dialLight.onclick = (e) => { e.stopPropagation(); this.handleTopLeftButton(); };

      if (bl) bl.onclick = (e) => { e.stopPropagation(); this.switchMode(); };
      if (dialMode) dialMode.onclick = (e) => { e.stopPropagation(); this.switchMode(); };

      if (br) br.onclick = (e) => { e.stopPropagation(); this.handleRightButton(); };
      if (dialStart) dialStart.onclick = (e) => { e.stopPropagation(); this.handleRightButton(); };

      if (bell) bell.onclick = (e) => {
        e.stopPropagation();
        audio.toggleMute();
        this.updateAudioIndicator();
      };

      const root = this.el.querySelector('.casio-watch-root');
      if (root) {
        if (this.scale !== 1.0) {
          root.style.transform = `scale(${this.scale})`;
          root.style.transformOrigin = 'top center';
        }
        root.addEventListener('wheel', (e) => {
          if (e.altKey || e.metaKey || e.ctrlKey) {
            e.preventDefault();
            this.setScale(this.scale + (e.deltaY < 0 ? 0.05 : -0.05));
          }
        }, { passive: false });
      }

      this.domBuilt = true;
      this.updateDisplay();
    }

    updateDisplay() {
      if (!this.domBuilt) return;

      const now = new Date();
      let dayStr = '';
      let dateStr = '';
      let hoursStr = '';
      let minutesStr = '';
      let secondsStr = '';
      let isPM = false;
      let colonVisible = true;
      let splVisible = false;

      if (this.mode === 'TIME') {
        const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
        dayStr = days[now.getDay()];
        dateStr = String(now.getDate());

        let h = now.getHours();
        if (this.is24Hour) {
          hoursStr = String(h).padStart(2, '0');
        } else {
          isPM = h >= 12;
          h = h % 12;
          if (h === 0) h = 12;
          hoursStr = h < 10 ? ' ' + h : String(h);
        }

        minutesStr = String(now.getMinutes()).padStart(2, '0');
        secondsStr = String(now.getSeconds()).padStart(2, '0');
        colonVisible = now.getMilliseconds() < 600;
      } else {
        dayStr = 'ST';
        const displayMs = this.stopwatch.splitMs !== null 
          ? this.stopwatch.splitMs 
          : this.getElapsedStopwatchMs();

        const totalSeconds = Math.floor(displayMs / 1000);
        const mins = Math.floor(totalSeconds / 60) % 60;
        const secs = totalSeconds % 60;
        const centis = Math.floor((displayMs % 1000) / 10);

        hoursStr = String(mins).padStart(2, '0');
        minutesStr = String(secs).padStart(2, '0');
        secondsStr = String(centis).padStart(2, '0');
        dateStr = '';
        splVisible = this.stopwatch.splitMs !== null;
        colonVisible = true;
      }

      const dateChar1 = dateStr.length === 2 ? dateStr[0] : ' ';
      const dateChar2 = dateStr.length >= 1 ? dateStr[dateStr.length - 1] : ' ';

      if (this.dom.dayText) this.dom.dayText.textContent = dayStr;
      if (this.dom.splText) this.dom.splText.style.display = splVisible ? 'inline' : 'none';
      if (this.dom.dateContainer) this.dom.dateContainer.style.display = this.mode === 'TIME' ? 'flex' : 'none';

      if (this.dom.pm) this.dom.pm.classList.toggle('active', isPM);
      if (this.dom.h24) this.dom.h24.classList.toggle('active', this.is24Hour && this.mode === 'TIME');

      if (this.dom.colon1) this.dom.colon1.classList.toggle('off', !colonVisible);
      if (this.dom.colon2) this.dom.colon2.classList.toggle('off', !colonVisible);

      updateDigitSVG(this.dom.h1Svg, hoursStr[0]);
      updateDigitSVG(this.dom.h2Svg, hoursStr[1]);
      updateDigitSVG(this.dom.m1Svg, minutesStr[0]);
      updateDigitSVG(this.dom.m2Svg, minutesStr[1]);
      updateDigitSVG(this.dom.s1Svg, secondsStr[0]);
      updateDigitSVG(this.dom.s2Svg, secondsStr[1]);

      if (this.mode === 'TIME') {
        updateDigitSVG(this.dom.date1Svg, dateChar1);
        updateDigitSVG(this.dom.date2Svg, dateChar2);
      }
    }
  }

  return {
    Controller: CasioController,
    Audio: audio,
    createDigitSVG: createDigitSVG,
    updateDigitSVG: updateDigitSVG,
    STYLES: STYLES
  };
});
