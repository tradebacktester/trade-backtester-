// ── Fabric.js canvas overlay — THE sync engine ───────────────────────────────
import { timeToX, xToTime, priceToY, yToPrice, subscribeSync, resizeChart } from './chart.js';
import { setFabricLineCoords, throttle } from './utils.js';

let _fab   = null;   // fabric.Canvas instance
let _wrap  = null;   // wrapper DOM element
const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const FIB_COLORS = ['#ef5350','#26a69a','#2962ff','#ff9800','#9c27b0','#26a69a','#ef5350'];

// ── Init ─────────────────────────────────────────────────────────────────────
export function initDrawingLayer(wrapper) {
  _wrap = wrapper;

  // Create <canvas> element inside wrapper
  const el = document.createElement('canvas');
  el.id = 'drawing-canvas';
  wrapper.appendChild(el);

  // Init Fabric
  _fab = new fabric.Canvas('drawing-canvas', {
    selection:          false,
    renderOnAddRemove:  false,
    skipTargetFind:     true,
    preserveObjectStacking: true,
  });
  _fab.setWidth(wrapper.clientWidth);
  _fab.setHeight(wrapper.clientHeight);

  // Chart sync on every viewport change
  subscribeSync(syncAllDrawings);

  // Resize observer — resize BOTH chart and fabric together
  const ro = new ResizeObserver(throttle(() => {
    const w = wrapper.clientWidth, h = wrapper.clientHeight;
    resizeChart(w, h);
    _fab.setDimensions({ width: w, height: h });
    syncAllDrawings();
  }, 32));
  ro.observe(wrapper);

  return _fab;
}

export function getFabricCanvas() { return _fab; }

// ── Mode switching ────────────────────────────────────────────────────────────
export function setDrawMode(mode) {
  // mode: 'draw' | 'cursor' | 'none'
  const el = _fab.getElement().parentElement; // upper-canvas
  const upper = _fab.upperCanvasEl;
  switch (mode) {
    case 'draw':
      upper.style.pointerEvents = 'all';
      upper.style.cursor = 'crosshair';
      _fab.selection = false;
      _fab.skipTargetFind = true;
      break;
    case 'cursor':
      upper.style.pointerEvents = 'all';
      upper.style.cursor = 'default';
      _fab.selection = true;
      _fab.skipTargetFind = false;
      break;
    case 'none':
    default:
      upper.style.pointerEvents = 'none';
      _fab.selection = false;
      _fab.skipTargetFind = true;
      break;
  }
}

// ── THE SYNC FUNCTION — called on every chart viewport change ─────────────────
export function syncAllDrawings() {
  if (!_fab) return;
  const w = _fab.getWidth();
  const h = _fab.getHeight();

  _fab.getObjects().forEach(obj => {
    if (!obj.logicalData || obj._isPreview) return;
    _syncObject(obj, w, h);
  });

  _fab.requestRenderAll();
}

function _syncObject(obj, w, h) {
  const d = obj.logicalData;
  switch (obj.drawingType) {

    case 'trendline': {
      const x1 = timeToX(d.start.time), y1 = priceToY(d.start.price);
      const x2 = timeToX(d.end.time),   y2 = priceToY(d.end.price);
      if (x1 != null && y1 != null && x2 != null && y2 != null)
        setFabricLineCoords(obj, x1, y1, x2, y2);
      break;
    }

    case 'ray': {
      const x1 = timeToX(d.start.time), y1 = priceToY(d.start.price);
      const x2 = timeToX(d.end.time),   y2 = priceToY(d.end.price);
      if (x1 != null && y1 != null && x2 != null && y2 != null) {
        // extend to canvas edge in one direction
        const dx = x2 - x1, dy = y2 - y1;
        if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) break;
        const ts = [];
        if (Math.abs(dx) > 0.001) { ts.push((0 - x1) / dx); ts.push((w - x1) / dx); }
        if (Math.abs(dy) > 0.001) { ts.push((0 - y1) / dy); ts.push((h - y1) / dy); }
        const maxT = Math.max(...ts.filter(t => t > 0));
        setFabricLineCoords(obj, x1, y1, x1 + dx * maxT, y1 + dy * maxT);
      }
      break;
    }

    case 'hline': {
      const y = priceToY(d.price);
      if (y != null) setFabricLineCoords(obj, 0, y, w, y);
      break;
    }

    case 'vline': {
      const x = timeToX(d.time);
      if (x != null) setFabricLineCoords(obj, x, 0, x, h);
      break;
    }

    case 'rect': {
      const x1 = timeToX(d.start.time), y1 = priceToY(d.start.price);
      const x2 = timeToX(d.end.time),   y2 = priceToY(d.end.price);
      if (x1 != null && y1 != null && x2 != null && y2 != null) {
        obj.set({
          left:   Math.min(x1, x2),
          top:    Math.min(y1, y2),
          width:  Math.max(Math.abs(x2 - x1), 0.001),
          height: Math.max(Math.abs(y2 - y1), 0.001),
        });
        obj.setCoords();
      }
      break;
    }

    case 'text': {
      const x = timeToX(d.time), y = priceToY(d.price);
      if (x != null && y != null) { obj.set({ left: x, top: y }); obj.setCoords(); }
      break;
    }

    case 'fib': {
      // fib is a group-id — we iterate all child lines below via tag
      _syncFibGroup(obj, d, w, h);
      break;
    }

    case 'fib-line': {
      // handled by parent fib group sync — skip individual
      break;
    }

    case 'pitchfork': {
      _syncPitchfork(obj, d, w, h);
      break;
    }
  }
}

// ── Fibonacci ─────────────────────────────────────────────────────────────────
function _syncFibGroup(groupLine, d, w, h) {
  // groupLine is the diagonal "anchor" line
  const x1 = timeToX(d.start.time), y1 = priceToY(d.start.price);
  const x2 = timeToX(d.end.time),   y2 = priceToY(d.end.price);
  if (x1 == null || y1 == null || x2 == null || y2 == null) return;
  setFabricLineCoords(groupLine, x1, y1, x2, y2);

  const left = Math.min(x1, x2);
  const right = w;

  // Update child fib level lines
  const groupId = d.groupId;
  _fab.getObjects().forEach(obj => {
    if (obj.drawingType !== 'fib-line' || obj.logicalData.groupId !== groupId) return;
    const level = obj.logicalData.level;
    const price = d.start.price + (d.end.price - d.start.price) * level;
    const ly = priceToY(price);
    if (ly != null) setFabricLineCoords(obj, left, ly, right, ly);
  });
}

// ── Pitchfork ─────────────────────────────────────────────────────────────────
function _syncPitchfork(handle, d, w, h) {
  const ax = timeToX(d.a.time), ay = priceToY(d.a.price);
  const bx = timeToX(d.b.time), by = priceToY(d.b.price);
  const cx = timeToX(d.c.time), cy = priceToY(d.c.price);
  if (ax == null || ay == null || bx == null || by == null || cx == null || cy == null) return;

  // Midpoint of BC
  const mx = (bx + cx) / 2, my = (by + cy) / 2;

  // Median line: A → midpoint, extended to canvas right
  const dx = mx - ax, dy = my - ay;
  const t = dx !== 0 ? (w - ax) / dx : (h / Math.max(Math.abs(dy), 0.001));
  const endX = ax + dx * t, endY = ay + dy * t;

  // handle is the median line
  setFabricLineCoords(handle, ax, ay, endX, endY);

  // Update fork lines
  const groupId = d.groupId;
  _fab.getObjects().forEach(obj => {
    if (obj.drawingType !== 'pitchfork-line' || obj.logicalData.groupId !== groupId) return;
    const fork = obj.logicalData.fork; // 'upper' | 'lower'
    const px = fork === 'upper' ? bx : cx;
    const py = fork === 'upper' ? by : cy;
    const ex = px + dx * t, ey = py + dy * t;
    setFabricLineCoords(obj, px, py, ex, ey);
  });
}

// ── Factory helpers ───────────────────────────────────────────────────────────

/** Shared line style */
function lineStyle(color = '#2962FF', width = 1.5, dashed = false) {
  return {
    stroke:           color,
    strokeWidth:      width,
    strokeDashArray:  dashed ? [5, 5] : null,
    selectable:       false,
    evented:          false,
    hasControls:      false,
    hasBorders:       false,
    lockMovementX:    true,
    lockMovementY:    true,
    hoverCursor:      'pointer',
  };
}

export function makeTrendLine(ax1, ay1, ax2, ay2, logical, opts = {}) {
  const line = new fabric.Line([ax1, ay1, ax2, ay2], {
    ...lineStyle(opts.color || '#2962FF', opts.width || 1.5, opts.dashed),
    id:          opts.id || crypto.randomUUID(),
    drawingType: opts.type || 'trendline',
    logicalData: logical,
  });
  _fab.add(line);
  _fab.requestRenderAll();
  return line;
}

export function makeHLine(price, logical, opts = {}) {
  const w = _fab.getWidth();
  const y = priceToY(price) ?? 200;
  const line = new fabric.Line([0, y, w, y], {
    ...lineStyle(opts.color || '#26a69a', opts.width || 1.5, opts.dashed),
    id:          opts.id || crypto.randomUUID(),
    drawingType: 'hline',
    logicalData: { ...logical, price },
  });
  _fab.add(line);
  _fab.requestRenderAll();
  return line;
}

export function makeVLine(time, logical, opts = {}) {
  const h = _fab.getHeight();
  const x = timeToX(time) ?? 200;
  const line = new fabric.Line([x, 0, x, h], {
    ...lineStyle(opts.color || '#FF9800', opts.width || 1.5, opts.dashed),
    id:          opts.id || crypto.randomUUID(),
    drawingType: 'vline',
    logicalData: { ...logical, time },
  });
  _fab.add(line);
  _fab.requestRenderAll();
  return line;
}

export function makeRect(x1, y1, x2, y2, logical, opts = {}) {
  const rect = new fabric.Rect({
    left:        Math.min(x1, x2),
    top:         Math.min(y1, y2),
    width:       Math.max(Math.abs(x2 - x1), 0.001),
    height:      Math.max(Math.abs(y2 - y1), 0.001),
    fill:        opts.fill || 'rgba(41,98,255,0.08)',
    stroke:      opts.color || '#2962FF',
    strokeWidth: opts.width || 1.5,
    selectable:  false,
    evented:     false,
    hasControls: false,
    hasBorders:  false,
    id:          opts.id || crypto.randomUUID(),
    drawingType: 'rect',
    logicalData: logical,
  });
  _fab.add(rect);
  _fab.requestRenderAll();
  return rect;
}

export function makeText(px, py, text, logical, opts = {}) {
  const t = new fabric.IText(text, {
    left:        px,
    top:         py,
    fill:        opts.color || '#D9D9D9',
    fontSize:    opts.size || 14,
    fontFamily:  'Arial, sans-serif',
    selectable:  false,
    evented:     false,
    hasControls: false,
    hasBorders:  false,
    editable:    false,
    id:          opts.id || crypto.randomUUID(),
    drawingType: 'text',
    logicalData: logical,
  });
  _fab.add(t);
  _fab.requestRenderAll();
  return t;
}

export function makeFib(ax1, ay1, ax2, ay2, logical, opts = {}) {
  const groupId = opts.id || crypto.randomUUID();
  const w = _fab.getWidth();

  // Diagonal anchor line (semi-transparent)
  const anchor = new fabric.Line([ax1, ay1, ax2, ay2], {
    ...lineStyle('#787B86', 1, true),
    id:          groupId,
    drawingType: 'fib',
    logicalData: { ...logical, groupId },
  });
  _fab.add(anchor);

  // Level lines
  FIB_LEVELS.forEach((level, i) => {
    const price = logical.start.price + (logical.end.price - logical.start.price) * level;
    const ly = priceToY(price) ?? 0;
    const left = Math.min(ax1, ax2);
    const line = new fabric.Line([left, ly, w, ly], {
      ...lineStyle(FIB_COLORS[i] || '#2962FF', 1),
      id:          crypto.randomUUID(),
      drawingType: 'fib-line',
      logicalData: { groupId, level },
    });

    // Label
    const label = new fabric.Text(`${(level * 100).toFixed(1)}%  ${price.toFixed(2)}`, {
      left:        left + 4,
      top:         ly - 14,
      fill:        FIB_COLORS[i] || '#2962FF',
      fontSize:    10,
      fontFamily:  'Arial',
      selectable:  false,
      evented:     false,
      id:          crypto.randomUUID(),
      drawingType: 'fib-line',
      logicalData: { groupId, level, isLabel: true, price },
    });

    _fab.add(line);
    _fab.add(label);
  });

  _fab.requestRenderAll();
  return anchor;
}

export function makePitchfork(ax, ay, bx, by, cx, cy, logical, opts = {}) {
  const groupId = opts.id || crypto.randomUUID();
  const w = _fab.getWidth();
  const mx = (bx + cx) / 2, my = (by + cy) / 2;
  const dx = mx - ax, dy = my - ay;
  const t = dx !== 0 ? (w - ax) / dx : 999;
  const endX = ax + dx * t, endY = ay + dy * t;

  const median = new fabric.Line([ax, ay, endX, endY], {
    ...lineStyle('#2962FF', 1.5),
    id:          groupId,
    drawingType: 'pitchfork',
    logicalData: { ...logical, groupId },
  });

  const upper = new fabric.Line([bx, by, bx + dx * t, by + dy * t], {
    ...lineStyle('#2962FF', 1),
    id:          crypto.randomUUID(),
    drawingType: 'pitchfork-line',
    logicalData: { groupId, fork: 'upper' },
  });

  const lower = new fabric.Line([cx, cy, cx + dx * t, cy + dy * t], {
    ...lineStyle('#2962FF', 1),
    id:          crypto.randomUUID(),
    drawingType: 'pitchfork-line',
    logicalData: { groupId, fork: 'lower' },
  });

  _fab.add(median); _fab.add(upper); _fab.add(lower);
  _fab.requestRenderAll();
  return median;
}

/** Preview object — live-updated during drag. Returns a fabric.Line. */
export function makePreviewLine(x1, y1, x2, y2) {
  const line = new fabric.Line([x1, y1, x2, y2], {
    stroke:         '#2962FF',
    strokeWidth:    1.5,
    strokeDashArray:[4, 4],
    selectable:     false,
    evented:        false,
    hasControls:    false,
    hasBorders:     false,
    opacity:        0.8,
    _isPreview:     true,
  });
  _fab.add(line);
  return line;
}

export function makePreviewRect(x1, y1, x2, y2) {
  const r = new fabric.Rect({
    left:        Math.min(x1, x2),
    top:         Math.min(y1, y2),
    width:       Math.max(Math.abs(x2 - x1), 0.001),
    height:      Math.max(Math.abs(y2 - y1), 0.001),
    fill:        'rgba(41,98,255,0.06)',
    stroke:      '#2962FF',
    strokeWidth: 1.5,
    strokeDashArray: [4, 4],
    selectable:  false,
    evented:     false,
    _isPreview:  true,
  });
  _fab.add(r);
  return r;
}

export function updatePreviewLine(line, x1, y1, x2, y2) {
  setFabricLineCoords(line, x1, y1, x2, y2);
  _fab.requestRenderAll();
}

export function updatePreviewRect(rect, x1, y1, x2, y2) {
  rect.set({
    left:   Math.min(x1, x2),
    top:    Math.min(y1, y2),
    width:  Math.max(Math.abs(x2 - x1), 0.001),
    height: Math.max(Math.abs(y2 - y1), 0.001),
  });
  rect.setCoords();
  _fab.requestRenderAll();
}

export function removeObject(obj) {
  // Also remove associated children (fib-lines, pitchfork-lines)
  if (obj.logicalData?.groupId) {
    const gid = obj.logicalData.groupId;
    _fab.getObjects()
      .filter(o => o.logicalData?.groupId === gid)
      .forEach(o => _fab.remove(o));
  }
  _fab.remove(obj);
  _fab.requestRenderAll();
}

export function clearAll() {
  _fab.getObjects().slice().forEach(o => _fab.remove(o));
  _fab.requestRenderAll();
}

/** Serialize all top-level drawing objects for storage */
export function serializeDrawings() {
  return _fab.getObjects()
    .filter(o => o.logicalData && !o._isPreview && o.drawingType !== 'fib-line' && o.drawingType !== 'pitchfork-line')
    .map(o => ({
      id:          o.id,
      drawingType: o.drawingType,
      logicalData: o.logicalData,
      stroke:      o.stroke,
      strokeWidth: o.strokeWidth,
    }));
}

/** Restore from serialized data */
export function deserializeDrawings(data, candleData) {
  clearAll();
  data.forEach(d => {
    switch (d.drawingType) {
      case 'trendline':
      case 'ray': {
        const x1 = timeToX(d.logicalData.start.time) ?? 0;
        const y1 = priceToY(d.logicalData.start.price) ?? 0;
        const x2 = timeToX(d.logicalData.end.time) ?? 100;
        const y2 = priceToY(d.logicalData.end.price) ?? 100;
        makeTrendLine(x1, y1, x2, y2, d.logicalData, { id: d.id, type: d.drawingType, color: d.stroke, width: d.strokeWidth });
        break;
      }
      case 'hline':
        makeHLine(d.logicalData.price, d.logicalData, { id: d.id, color: d.stroke, width: d.strokeWidth });
        break;
      case 'vline':
        makeVLine(d.logicalData.time, d.logicalData, { id: d.id, color: d.stroke, width: d.strokeWidth });
        break;
      case 'rect': {
        const x1 = timeToX(d.logicalData.start.time) ?? 0;
        const y1 = priceToY(d.logicalData.start.price) ?? 0;
        const x2 = timeToX(d.logicalData.end.time) ?? 100;
        const y2 = priceToY(d.logicalData.end.price) ?? 100;
        makeRect(x1, y1, x2, y2, d.logicalData, { id: d.id, color: d.stroke, width: d.strokeWidth });
        break;
      }
      case 'text': {
        const px = timeToX(d.logicalData.time) ?? 100;
        const py = priceToY(d.logicalData.price) ?? 100;
        makeText(px, py, d.logicalData.text, d.logicalData, { id: d.id, color: d.stroke });
        break;
      }
      case 'fib': {
        const x1 = timeToX(d.logicalData.start.time) ?? 0;
        const y1 = priceToY(d.logicalData.start.price) ?? 0;
        const x2 = timeToX(d.logicalData.end.time) ?? 100;
        const y2 = priceToY(d.logicalData.end.price) ?? 100;
        makeFib(x1, y1, x2, y2, d.logicalData, { id: d.id });
        break;
      }
      case 'pitchfork': {
        const ld = d.logicalData;
        const ax = timeToX(ld.a.time) ?? 0, ay = priceToY(ld.a.price) ?? 0;
        const bx = timeToX(ld.b.time) ?? 50, by = priceToY(ld.b.price) ?? 50;
        const cx = timeToX(ld.c.time) ?? 100, cy = priceToY(ld.c.price) ?? 100;
        makePitchfork(ax, ay, bx, by, cx, cy, ld, { id: d.id });
        break;
      }
    }
  });
  syncAllDrawings();
}
