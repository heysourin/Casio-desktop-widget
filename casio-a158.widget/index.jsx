/**
 * Casio A158W Desktop Widget for Übersicht - Photorealistic Edition
 * 
 * Exact 1:1 photorealistic digital recreation of the iconic Casio A158W-1
 * stainless steel digital watch. Matches genuine Casio proportions,
 * dial typography, LCD segment geometry, and pushers.
 * 
 * Runs directly on macOS desktop via Übersicht.
 */

import { React } from 'uebersicht';

const { useState, useEffect, useRef, useCallback } = React;

// Disable Übersicht automatic polling; widget manages its own smooth monotonic loop
export const refreshFrequency = false;

// --- CONFIGURATION ---
// Default watch scale multiplier (1.0 = standard, 0.8 = compact, 1.25 = large)
export const DEFAULT_SCALE = 1.0;

// Root wrapper positioning on macOS desktop
export const className = `
  position: absolute;
  top: 40px;
  right: 40px;
  user-select: none;
  -webkit-user-select: none;
  pointer-events: none; /* Allows desktop clicks to pass through around the watch */
  z-index: 1;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
`;

// --- AUDIO SYNTHESIZER (Casio Module 593 Piezo Buzzer) ---
class CasioBuzzer {
  constructor() {
    this.ctx = null;
    this.muted = false;
    try {
      const saved = localStorage.getItem('casio_a158_muted');
      if (saved !== null) this.muted = JSON.parse(saved);
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

  toggle() {
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

const buzzer = new CasioBuzzer();

// --- 7-SEGMENT SVG PATHS ---
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

const Digit = ({ char = ' ', width = 21, height = 35, slant = -4 }) => {
  const activeSegs = new Set(CHAR_MAP[char] || []);
  const keys = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

  return (
    <svg 
      className="casio-digit" 
      viewBox="0 0 60 104" 
      width={width} 
      height={height} 
      style={{ transform: `skewX(${slant}deg)` }}
    >
      {keys.map(k => (
        <path 
          key={k} 
          d={SEG_PATHS[k]} 
          className={`seg ${activeSegs.has(k) ? 'seg-on' : 'seg-off'}`} 
        />
      ))}
    </svg>
  );
};

// --- MAIN CASIO A158 COMPONENT ---
const CasioA158Widget = () => {
  // Mode & Display state
  const [mode, setMode] = useState('TIME'); // 'TIME' | 'STOPWATCH'
  const [is24H, setIs24H] = useState(() => {
    try {
      const saved = localStorage.getItem('casio_a158_24h');
      return saved !== null ? JSON.parse(saved) : false;
    } catch (e) {
      return false;
    }
  });

  const [isBacklightActive, setIsBacklightActive] = useState(false);
  const [isMuted, setIsMuted] = useState(buzzer.muted);

  // Time & Stopwatch state
  const [now, setNow] = useState(() => new Date());
  const stopwatchRef = useRef({
    status: 'stopped', // 'stopped' | 'running'
    startTime: 0,      // performance.now()
    accumulatedMs: 0,
    splitMs: null
  });
  const [stopwatchDisplayMs, setStopwatchDisplayMs] = useState(0);

  // Position & Scale state (Draggable desktop placement & Resizing)
  const [scale, setScale] = useState(() => {
    try {
      const saved = localStorage.getItem('casio_a158_scale');
      return saved !== null ? JSON.parse(saved) : DEFAULT_SCALE;
    } catch (e) {
      return DEFAULT_SCALE;
    }
  });

  const [position, setPosition] = useState(() => {
    try {
      const saved = localStorage.getItem('casio_a158_pos');
      return saved !== null ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, startPos: { x: 0, y: 0 } });

  // Backlight timer reference
  const backlightTimerRef = useRef(null);

  // --- ACTIONS ---
  const triggerBacklight = useCallback(() => {
    buzzer.init();
    setIsBacklightActive(true);

    if (backlightTimerRef.current) clearTimeout(backlightTimerRef.current);
    backlightTimerRef.current = setTimeout(() => {
      setIsBacklightActive(false);
    }, 1800);
  }, []);

  const switchMode = useCallback(() => {
    buzzer.beep(2048, 0.04);
    setMode(m => (m === 'TIME' ? 'STOPWATCH' : 'TIME'));
  }, []);

  const handleRightButton = useCallback(() => {
    buzzer.init();

    if (mode === 'TIME') {
      buzzer.beep(2048, 0.035);
      setIs24H(prev => {
        const next = !prev;
        try { localStorage.setItem('casio_a158_24h', JSON.stringify(next)); } catch (e) {}
        return next;
      });
    } else {
      buzzer.beep(2048, 0.04);
      const sw = stopwatchRef.current;
      if (sw.status === 'running') {
        // Stop
        sw.accumulatedMs += (performance.now() - sw.startTime);
        sw.status = 'stopped';
      } else {
        // Start monotonic timing
        sw.startTime = performance.now();
        sw.status = 'running';
      }
    }
  }, [mode]);

  const handleTopLeftButton = useCallback(() => {
    buzzer.init();
    triggerBacklight();

    if (mode === 'STOPWATCH') {
      const sw = stopwatchRef.current;
      if (sw.status === 'running') {
        // Split / Lap
        buzzer.beep(2048, 0.03, 2);
        if (sw.splitMs === null) {
          sw.splitMs = sw.accumulatedMs + (performance.now() - sw.startTime);
        } else {
          sw.splitMs = null;
        }
      } else {
        // Reset
        buzzer.beep(2048, 0.035);
        sw.accumulatedMs = 0;
        sw.startTime = 0;
        sw.splitMs = null;
        setStopwatchDisplayMs(0);
      }
    }
  }, [mode, triggerBacklight]);

  const toggleSound = useCallback((e) => {
    if (e) e.stopPropagation();
    const muted = buzzer.toggle();
    setIsMuted(muted);
  }, []);

  // --- MONOTONIC CLOCK & STOPWATCH LOOP ---
  useEffect(() => {
    let animId;
    let lastClockUpdate = 0;

    const tick = () => {
      const nowTs = performance.now();

      // Update regular clock every ~100ms
      if (nowTs - lastClockUpdate >= 100) {
        lastClockUpdate = nowTs;
        setNow(new Date());
      }

      // Update stopwatch at 30-60fps while running
      const sw = stopwatchRef.current;
      if (sw.status === 'running') {
        const elapsed = sw.splitMs !== null 
          ? sw.splitMs 
          : sw.accumulatedMs + (performance.now() - sw.startTime);
        setStopwatchDisplayMs(elapsed);
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (backlightTimerRef.current) clearTimeout(backlightTimerRef.current);
    };
  }, []);

  // --- KEYBOARD SHORTCUTS ---
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const k = e.key.toLowerCase();
      if (k === 'l') handleTopLeftButton();
      else if (k === 'm') switchMode();
      else if (k === 's') handleRightButton();
      else if (k === 'r') { if (mode === 'STOPWATCH') handleTopLeftButton(); }
      else if (k === 'b') toggleSound();
      else if (k === '+' || k === '=') {
        setScale(s => {
          const next = Math.min(2.5, Math.round((s + 0.1) * 10) / 10);
          try { localStorage.setItem('casio_a158_scale', JSON.stringify(next)); } catch (err) {}
          return next;
        });
      } else if (k === '-' || k === '_') {
        setScale(s => {
          const next = Math.max(0.4, Math.round((s - 0.1) * 10) / 10);
          try { localStorage.setItem('casio_a158_scale', JSON.stringify(next)); } catch (err) {}
          return next;
        });
      } else if (k === '0') {
        setScale(DEFAULT_SCALE);
        try { localStorage.setItem('casio_a158_scale', JSON.stringify(DEFAULT_SCALE)); } catch (err) {}
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleTopLeftButton, switchMode, handleRightButton, toggleSound, mode]);

  // --- ZOOM VIA MOUSE WHEEL (Option / Cmd + Scroll) ---
  const handleWheel = (e) => {
    if (e.altKey || e.metaKey || e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      setScale(s => {
        const next = Math.min(2.5, Math.max(0.4, Math.round((s + delta) * 100) / 100));
        try { localStorage.setItem('casio_a158_scale', JSON.stringify(next)); } catch (err) {}
        return next;
      });
    }
  };

  // --- DRAGGING LOGIC ---
  const handleMouseDown = (e) => {
    // Only drag from non-button watch case areas
    if (e.target.closest('.casio-hotspot') || e.target.closest('#casio-mute-btn') || e.target.closest('.lcd-alarm-bell')) return;
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startPos: position || { x: 0, y: 0 }
    };
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      const newPos = {
        x: dragStartRef.current.startPos.x + dx,
        y: dragStartRef.current.startPos.y + dy
      };
      setPosition(newPos);
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        try {
          if (position) localStorage.setItem('casio_a158_pos', JSON.stringify(position));
        } catch (e) {}
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [position]);

  // --- DISPLAY STRING CALCULATIONS ---
  let dayStr = '';
  let dateStr = '';
  let hoursStr = '';
  let minutesStr = '';
  let secondsStr = '';
  let isPM = false;
  let colonVisible = true;
  let splVisible = false;

  if (mode === 'TIME') {
    const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    dayStr = days[now.getDay()];
    dateStr = String(now.getDate());

    let h = now.getHours();
    if (is24H) {
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
    // Stopwatch
    dayStr = 'ST';
    const displayMs = stopwatchRef.current.splitMs !== null 
      ? stopwatchRef.current.splitMs 
      : stopwatchDisplayMs;

    const totalSeconds = Math.floor(displayMs / 1000);
    const mins = Math.floor(totalSeconds / 60) % 60;
    const secs = totalSeconds % 60;
    const centis = Math.floor((displayMs % 1000) / 10);

    hoursStr = String(mins).padStart(2, '0');
    minutesStr = String(secs).padStart(2, '0');
    secondsStr = String(centis).padStart(2, '0');
    dateStr = '';
    splVisible = stopwatchRef.current.splitMs !== null;
    colonVisible = true;
  }

  const dateChar1 = dateStr.length === 2 ? dateStr[0] : ' ';
  const dateChar2 = dateStr.length >= 1 ? dateStr[dateStr.length - 1] : ' ';

  const wrapperStyle = {
    transform: `${position ? `translate3d(${position.x}px, ${position.y}px, 0) ` : ''}scale(${scale})`,
    transformOrigin: 'top center'
  };

  return (
    <div 
      className="casio-watch-root" 
      style={wrapperStyle}
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
    >
      <style>{`
        .casio-watch-root {
          position: relative;
          width: 270px;
          height: 484px;
          user-select: none;
          -webkit-user-select: none;
          filter: drop-shadow(0 16px 28px rgba(0, 0, 0, 0.65));
          cursor: grab;
          pointer-events: auto;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
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

        .lcd-alarm-bell {
          display: flex;
          align-items: center;
          gap: 2px;
          color: #151913;
          cursor: pointer;
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
      `}</style>

      {/* Live LCD Screen situated behind cutout window */}
      <div className="casio-lcd-panel">
        {/* Micro-LED Green Backlight Overlay */}
        <div className={`casio-lcd-backlight ${isBacklightActive ? 'active' : ''}`} />

        {/* Top Row: Indicators, Day of Week, Date */}
        <div className="lcd-top-row">
          <div className="lcd-indicators-left">
            <svg className="lcd-icon active" viewBox="0 0 24 24" width="8" height="8">
              <path d="M4 14 A6 6 0 0 1 4 6 M8 16 A9 9 0 0 1 8 4 M12 18 A12 12 0 0 1 12 2" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
            <div 
              className="lcd-alarm-bell" 
              id="casio-mute-btn"
              onClick={toggleSound}
              title={`Piezo Buzzer: ${isMuted ? 'Muted' : 'On'} (Press B)`}
            >
              <svg className={`lcd-icon ${!isMuted ? 'active' : ''}`} viewBox="0 0 24 24" width="8" height="8">
                <path d="M12 3 A4 4 0 0 0 8 7 V12 L6 15 H18 L16 12 V7 A4 4 0 0 0 12 3 Z M10 17 A2 2 0 0 0 14 17 Z" fill="currentColor" />
              </svg>
            </div>
            <span className={`lcd-pm-indicator ${isPM ? 'active' : ''}`}>PM</span>
            <span className={`lcd-24h-indicator ${is24H && mode === 'TIME' ? 'active' : ''}`}>24H</span>
          </div>

          <div className="lcd-day-center">
            <div className="casio-day-display">
              <span>{dayStr}</span>
            </div>
          </div>

          <div className="lcd-date-right">
            {splVisible && <span className="spl-indicator">SPL</span>}
            {mode === 'TIME' && (
              <div style={{ display: 'flex' }}>
                <Digit char={dateChar1} width={12} height={19} slant={-4} />
                <Digit char={dateChar2} width={12} height={19} slant={-4} />
              </div>
            )}
          </div>
        </div>

        {/* Main LCD Digits: Hours, Colon, Minutes, Seconds */}
        <div className="lcd-main-row">
          <div className="digits-group-time">
            <Digit char={hoursStr[0]} width={21} height={35} slant={-4} />
            <Digit char={hoursStr[1]} width={21} height={35} slant={-4} />

            <div className="lcd-colon">
              <span className={`colon-dot ${colonVisible ? '' : 'off'}`} />
              <span className={`colon-dot ${colonVisible ? '' : 'off'}`} />
            </div>

            <Digit char={minutesStr[0]} width={21} height={35} slant={-4} />
            <Digit char={minutesStr[1]} width={21} height={35} slant={-4} />

            <div className="seconds-container">
              <Digit char={secondsStr[0]} width={16} height={26} slant={-4} />
              <Digit char={secondsStr[1]} width={16} height={26} slant={-4} />
            </div>
          </div>
        </div>
      </div>

      {/* Original Casio A158W Watch Photo Overlay with transparent LCD window */}
      <img 
        src="casio-a158.widget/watch_frame.png" 
        alt="Casio A158W" 
        className="casio-frame-img"
        onError={(e) => {
          if (!e.currentTarget.dataset.fallback) {
            e.currentTarget.dataset.fallback = "true";
            e.currentTarget.src = "watch_frame.png";
          }
        }}
      />

      {/* Physical Pusher Hotspots */}
      <button 
        className="casio-hotspot pusher-tl-hotspot" 
        onClick={handleTopLeftButton}
        title="LIGHT / LAP • RESET (L)" 
      />
      <button 
        className="casio-hotspot pusher-bl-hotspot" 
        onClick={switchMode}
        title="MODE (M)" 
      />
      <button 
        className="casio-hotspot pusher-br-hotspot" 
        onClick={handleRightButton}
        title="START • STOP / 12 • 24H (S)" 
      />

      {/* Dial Text Click Hotspots */}
      <button 
        className="casio-hotspot dial-light-hotspot" 
        onClick={handleTopLeftButton}
        title="LIGHT / LAP • RESET" 
      />
      <button 
        className="casio-hotspot dial-mode-hotspot" 
        onClick={switchMode}
        title="MODE" 
      />
      <button 
        className="casio-hotspot dial-start-hotspot" 
        onClick={handleRightButton}
        title="START • STOP / 12 • 24H" 
      />
    </div>
  );
};

export const render = () => {
  return <CasioA158Widget />;
};

export default CasioA158Widget;
