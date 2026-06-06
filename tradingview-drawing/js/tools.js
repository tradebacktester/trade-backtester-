// ── Tool state machine + each tool class ─────────────────────────────────────
import { xToTime, yToPrice, timeToX, priceToY, getCandleData } from './chart.js';
import {
  getFabricCanvas, setDrawMode, syncAllDrawings,
  makeTrendLine, makeHLine, makeVLine, makeRect, makeText, makeFib, makePitchfork,
  makePreviewLine, makePreviewRect, updatePreviewLine, updatePreviewRect,
  removeObject, serializeDrawings,
} from './drawingLayer.js';
import { eventToCanvas, findNearestCandle, setFabricLineCoords, throttle } from './utils.js';
import { saveDrawings, pushUndoState } from './storage.js';

// ── Magnet state ──────────────────────────────────────────────────────────────
let magnetEnabled = false;
export function setMagnet(v) { magnetEnabled = v; }
export function getMagnet()  { return magnetEnabled; }

const MAGNET_RADIUS = 12;

/** Try to snap (x,y) to a candle OHLC point within MAGNET_RADIUS pixels */
function trySnap(x, y) {
  if (!magnetEnabled) return { x, y };
  const candles = getCandleData();
  const t = xToTime(x);
  if (!t) return { x, y };
  const c = findNearestCandle(t, candles);
  if (!c) return { x, y };
  const cx = timeToX(c.time);
  if (cx == null || Math.abs(cx - x) > MAGNET_RADIUS * 2) return { x, y };
  // check each OHLC price
  const prices = [c.high, c.low, c.open, c.close];
  let best = null, bestD = MAGNET_RADIUS;
  for (const p of prices) {
    const py2 = priceToY(p);
    if (py2 == null) continue;
    const d = Math.hypot(cx - x, py2 - y);
    if (d < bestD) { bestD = d; best = { x: cx, y: py2 }; }
  }
  return best || { x, y };
}

function toLogical(x, y) {
  const snapped = trySnap(x, y);
  return { time: xToTime(snapped.x), price: yToPrice(snapped.y), sx: snapped.x, sy: snapped.y };
}

// ── ToolManager ───────────────────────────────────────────────────────────────
export class ToolManager {
  constructor(wrapper) {
    this.wrapper     = wrapper;
    this.activeTool  = 'cursor';
    this.isDrawing   = false;
    this._tool       = null;
    this._bound      = {};
    this._onDown     = this._onDown.bind(this);
    this._onMove     = throttle(this._onMove.bind(this), 16);
    this._onUp       = this._onUp.bind(this);
    this._onKey      = this._onKey.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove  = throttle(this._onTouchMove.bind(this), 16);
    this._onTouchEnd   = this._onTouchEnd.bind(this);

    wrapper.addEventListener('mousedown', this._onDown);
    wrapper.addEventListener('mousemove', this._onMove);
    wrapper.addEventListener('mouseup',   this._onUp);
    document.addEventListener('keydown',  this._onKey);

    wrapper.addEventListener('touchstart', this._onTouchStart, { passive: false });
    wrapper.addEventListener('touchmove',  this._onTouchMove,  { passive: false });
    wrapper.addEventListener('touchend',   this._onTouchEnd,   { passive: false });

    // Cursor-mode: fabric handles selection
    getFabricCanvas().on('selection:cleared', () => {});
  }

  setTool(name) {
    this._cancelDrawing();
    this.activeTool = name;

    // highlight active button
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`[data-tool="${name}"]`);
    if (btn) btn.classList.add('active');

    if (name === 'cursor') {
      setDrawMode('cursor');
    } else {
      setDrawMode('draw');
    }

    this._tool = this._buildTool(name);
  }

  _buildTool(name) {
    switch (name) {
      case 'trendline': return new TrendLineTool();
      case 'ray':       return new RayTool();
      case 'hline':     return new HorizontalLineTool();
      case 'vline':     return new VerticalLineTool();
      case 'rect':      return new RectangleTool();
      case 'text':      return new TextTool(this.wrapper);
      case 'fib':       return new FibTool();
      case 'pitchfork': return new PitchforkTool();
      default:          return null;
    }
  }

  _onDown(e) {
    if (this.activeTool === 'cursor') return;
    if (!this._tool) return;
    const pos = eventToCanvas(e, this.wrapper);
    this.isDrawing = true;
    this._tool.onMouseDown(pos.x, pos.y);
  }

  _onMove(e) {
    if (this.activeTool === 'cursor') return;
    if (!this.isDrawing || !this._tool) return;
    const pos = eventToCanvas(e, this.wrapper);
    this._tool.onMouseMove(pos.x, pos.y);
  }

  _onUp(e) {
    if (this.activeTool === 'cursor') return;
    if (!this.isDrawing || !this._tool) return;
    const pos = eventToCanvas(e, this.wrapper);
    const finished = this._tool.onMouseUp(pos.x, pos.y);
    if (finished) {
      this.isDrawing = false;
      pushUndoState(serializeDrawings());
      saveDrawings(serializeDrawings());
      // Pitchfork uses 3 clicks — don't reset isDrawing prematurely
      if (this._tool.needsMoreClicks && this._tool.needsMoreClicks()) {
        this.isDrawing = true;
      }
    }
  }

  _onTouchStart(e) {
    if (this.activeTool === 'cursor') return;
    if (!this._tool) return;
    e.preventDefault();
    const pos = eventToCanvas(e, this.wrapper);
    this.isDrawing = true;
    this._tool.onMouseDown(pos.x, pos.y);
  }

  _onTouchMove(e) {
    if (this.activeTool === 'cursor') return;
    if (!this.isDrawing || !this._tool) return;
    e.preventDefault();
    const pos = eventToCanvas(e, this.wrapper);
    this._tool.onMouseMove(pos.x, pos.y);
  }

  _onTouchEnd(e) {
    if (this.activeTool === 'cursor') return;
    if (!this.isDrawing || !this._tool) return;
    e.preventDefault();
    const pos = eventToCanvas(e, this.wrapper);
    const finished = this._tool.onMouseUp(pos.x, pos.y);
    if (finished) {
      this.isDrawing = false;
      pushUndoState(serializeDrawings());
      saveDrawings(serializeDrawings());
      if (this._tool.needsMoreClicks && this._tool.needsMoreClicks()) {
        this.isDrawing = true;
      }
    }
  }

  _onKey(e) {
    if (e.key === 'Escape') this._cancelDrawing();
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.activeTool === 'cursor') {
      this._deleteSelected();
    }
  }

  _cancelDrawing() {
    if (this._tool) this._tool.cancel?.();
    this.isDrawing = false;
  }

  _deleteSelected() {
    const fab = getFabricCanvas();
    fab.getActiveObjects().forEach(o => removeObject(o));
    fab.discardActiveObject();
    pushUndoState(serializeDrawings());
    saveDrawings(serializeDrawings());
  }
}

// ── Base tool ─────────────────────────────────────────────────────────────────
class BaseTool {
  constructor() { this._preview = null; }
  onMouseDown() {}
  onMouseMove() {}
  onMouseUp()  { return true; }
  cancel() {
    if (this._preview) {
      getFabricCanvas().remove(this._preview);
      this._preview = null;
      getFabricCanvas().requestRenderAll();
    }
  }
}

// ── Trend Line ────────────────────────────────────────────────────────────────
class TrendLineTool extends BaseTool {
  onMouseDown(x, y) {
    const { sx, sy } = toLogical(x, y);
    this._startX = sx; this._startY = sy;
    this._preview = makePreviewLine(sx, sy, sx, sy);
  }
  onMouseMove(x, y) {
    if (!this._preview) return;
    const { sx, sy } = toLogical(x, y);
    updatePreviewLine(this._preview, this._startX, this._startY, sx, sy);
  }
  onMouseUp(x, y) {
    const lg1 = toLogical(this._startX, this._startY);
    const lg2 = toLogical(x, y);
    if (Math.hypot(x - this._startX, y - this._startY) < 4) { this.cancel(); return true; }
    getFabricCanvas().remove(this._preview); this._preview = null;
    makeTrendLine(this._startX, this._startY, lg2.sx, lg2.sy, {
      start: { time: lg1.time, price: lg1.price },
      end:   { time: lg2.time, price: lg2.price },
    });
    return true;
  }
}

// ── Ray ────────────────────────────────────────────────────────────────────────
class RayTool extends BaseTool {
  onMouseDown(x, y) {
    const { sx, sy } = toLogical(x, y);
    this._startX = sx; this._startY = sy;
    this._preview = makePreviewLine(sx, sy, sx, sy);
  }
  onMouseMove(x, y) {
    if (!this._preview) return;
    const { sx, sy } = toLogical(x, y);
    updatePreviewLine(this._preview, this._startX, this._startY, sx, sy);
  }
  onMouseUp(x, y) {
    const lg1 = toLogical(this._startX, this._startY);
    const lg2 = toLogical(x, y);
    if (Math.hypot(x - this._startX, y - this._startY) < 4) { this.cancel(); return true; }
    getFabricCanvas().remove(this._preview); this._preview = null;
    makeTrendLine(this._startX, this._startY, lg2.sx, lg2.sy, {
      start: { time: lg1.time, price: lg1.price },
      end:   { time: lg2.time, price: lg2.price },
    }, { type: 'ray' });
    return true;
  }
}

// ── Horizontal Line ────────────────────────────────────────────────────────────
class HorizontalLineTool extends BaseTool {
  onMouseDown(x, y) {
    const { sy } = toLogical(x, y);
    const price = yToPrice(sy);
    if (price == null) return;
    makeHLine(price, { price });
  }
  onMouseUp() { return true; }
}

// ── Vertical Line ──────────────────────────────────────────────────────────────
class VerticalLineTool extends BaseTool {
  onMouseDown(x, y) {
    const { sx } = toLogical(x, y);
    const time = xToTime(sx);
    if (time == null) return;
    makeVLine(time, { time });
  }
  onMouseUp() { return true; }
}

// ── Rectangle ─────────────────────────────────────────────────────────────────
class RectangleTool extends BaseTool {
  onMouseDown(x, y) {
    this._startX = x; this._startY = y;
    this._preview = makePreviewRect(x, y, x, y);
  }
  onMouseMove(x, y) {
    if (!this._preview) return;
    updatePreviewRect(this._preview, this._startX, this._startY, x, y);
  }
  onMouseUp(x, y) {
    if (Math.hypot(x - this._startX, y - this._startY) < 4) { this.cancel(); return true; }
    const lg1 = toLogical(this._startX, this._startY);
    const lg2 = toLogical(x, y);
    getFabricCanvas().remove(this._preview); this._preview = null;
    makeRect(this._startX, this._startY, x, y, {
      start: { time: lg1.time, price: lg1.price },
      end:   { time: lg2.time, price: lg2.price },
    });
    return true;
  }
}

// ── Text ───────────────────────────────────────────────────────────────────────
class TextTool extends BaseTool {
  constructor(wrapper) { super(); this._wrapper = wrapper; }
  onMouseDown(x, y) {
    const lg = toLogical(x, y);

    let overlay = document.getElementById('text-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'text-overlay';

      const inp = document.createElement('input');
      inp.type = 'text'; inp.id = 'text-input';
      inp.placeholder = 'Type label…';
      inp.setAttribute('autocomplete', 'off');

      const btn = document.createElement('button');
      btn.id = 'text-confirm-btn';
      btn.textContent = '✓';
      btn.type = 'button';

      overlay.appendChild(inp);
      overlay.appendChild(btn);
      this._wrapper.appendChild(overlay);
    }

    // Clamp overlay so it doesn't go off-screen
    const ww = this._wrapper.clientWidth;
    const overlayW = 160;
    const clampedX = Math.min(x, ww - overlayW - 8);
    overlay.style.left    = `${Math.max(4, clampedX)}px`;
    overlay.style.top     = `${y - 18}px`;
    overlay.style.display = 'flex';

    const inp = document.getElementById('text-input');
    const btn = document.getElementById('text-confirm-btn');
    inp.value = '';
    inp.focus();

    const commit = () => {
      const txt = inp.value.trim();
      overlay.style.display = 'none';
      inp.onkeydown = null;
      btn.onclick = null;
      inp.onblur = null;
      if (txt) {
        makeText(x, y, txt, { time: lg.time, price: lg.price, text: txt });
        saveDrawings(serializeDrawings());
      }
    };

    inp.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); commit(); }
    };

    // blur fires when mobile keyboard "Done" is tapped
    inp.onblur = () => setTimeout(commit, 80);

    btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); inp.onblur = null; commit(); };
  }
  onMouseUp() { return true; }
}

// ── Fibonacci ──────────────────────────────────────────────────────────────────
class FibTool extends BaseTool {
  onMouseDown(x, y) {
    const { sx, sy } = toLogical(x, y);
    this._startX = sx; this._startY = sy;
    this._preview = makePreviewLine(sx, sy, sx, sy);
  }
  onMouseMove(x, y) {
    if (!this._preview) return;
    const { sx, sy } = toLogical(x, y);
    updatePreviewLine(this._preview, this._startX, this._startY, sx, sy);
  }
  onMouseUp(x, y) {
    const lg1 = toLogical(this._startX, this._startY);
    const lg2 = toLogical(x, y);
    if (Math.hypot(x - this._startX, y - this._startY) < 4) { this.cancel(); return true; }
    getFabricCanvas().remove(this._preview); this._preview = null;
    makeFib(this._startX, this._startY, lg2.sx, lg2.sy, {
      start: { time: lg1.time, price: lg1.price },
      end:   { time: lg2.time, price: lg2.price },
    });
    return true;
  }
}

// ── Pitchfork (3-click) ────────────────────────────────────────────────────────
class PitchforkTool extends BaseTool {
  constructor() {
    super();
    this._clicks = [];
    this._previews = [];
  }
  needsMoreClicks() { return this._clicks.length > 0 && this._clicks.length < 3; }
  onMouseDown(x, y) {
    const lg = toLogical(x, y);
    this._clicks.push({ x: lg.sx, y: lg.sy, time: lg.time, price: lg.price });
    // Preview dot line
    if (this._clicks.length >= 2) {
      const prev = this._clicks[this._clicks.length - 2];
      const curr = this._clicks[this._clicks.length - 1];
      const line = makePreviewLine(prev.x, prev.y, curr.x, curr.y);
      this._previews.push(line);
    }
    if (this._clicks.length === 3) {
      const [a, b, c] = this._clicks;
      this._previews.forEach(l => getFabricCanvas().remove(l));
      this._previews = [];
      makePitchfork(a.x, a.y, b.x, b.y, c.x, c.y, {
        a: { time: a.time, price: a.price },
        b: { time: b.time, price: b.price },
        c: { time: c.time, price: c.price },
      });
      this._clicks = [];
      return; // will trigger onMouseUp returning true
    }
  }
  onMouseMove(x, y) {
    if (this._clicks.length === 0) return;
    const last = this._clicks[this._clicks.length - 1];
    if (this._previews.length > 0) {
      const line = this._previews[this._previews.length - 1];
      updatePreviewLine(line, last.x, last.y, x, y);
    } else {
      if (!this._preview) this._preview = makePreviewLine(last.x, last.y, x, y);
      else updatePreviewLine(this._preview, last.x, last.y, x, y);
    }
  }
  onMouseUp(x, y) {
    return this._clicks.length === 0; // true only after 3 clicks reset
  }
  cancel() {
    this._previews.forEach(l => getFabricCanvas().remove(l));
    this._previews = [];
    if (this._preview) { getFabricCanvas().remove(this._preview); this._preview = null; }
    this._clicks = [];
    getFabricCanvas().requestRenderAll();
  }
}
