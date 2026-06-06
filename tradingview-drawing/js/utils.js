// ── Math & geometry helpers ──────────────────────────────────────────────────

export function dist(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Binary-search for candle whose time is nearest to `t` */
export function findNearestCandle(t, candles) {
  if (!candles.length) return null;
  let lo = 0, hi = candles.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].time < t) lo = mid + 1; else hi = mid;
  }
  if (lo > 0 && Math.abs(candles[lo - 1].time - t) < Math.abs(candles[lo].time - t)) lo--;
  return candles[lo];
}

/**
 * Magnet snap: if mouse is within `radius` px of a candle's OHLC value,
 * return snapped {time, price}, otherwise return original coords.
 */
export function magnetSnap(mouseX, mouseY, radius, candles, timeToX, priceToY) {
  const t = /* timeToX inverse done by caller */ 0; // placeholder — caller passes time
  return null;
}

/**
 * Update a fabric.Line to new ABSOLUTE canvas coords without recreating it.
 * Fabric v5 stores x1,y1,x2,y2 in bounding-box-relative space;
 * left/top = top-left corner of bbox; calcLinePoints() uses sign of x1,x2.
 */
export function setFabricLineCoords(line, ax1, ay1, ax2, ay2) {
  const newLeft   = Math.min(ax1, ax2);
  const newTop    = Math.min(ay1, ay2);
  const newWidth  = Math.max(Math.abs(ax2 - ax1), 0.001);
  const newHeight = Math.max(Math.abs(ay2 - ay1), 0.001);

  line.x1     = ax1;
  line.y1     = ay1;
  line.x2     = ax2;
  line.y2     = ay2;
  line.width  = newWidth;
  line.height = newHeight;
  line.left   = newLeft;
  line.top    = newTop;
  line.setCoords();
}

/** Simple throttle */
export function throttle(fn, ms) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last < ms) return;
    last = now;
    return fn.apply(this, args);
  };
}

/** Debounce */
export function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

/** Convert event coords to canvas-relative coords.
 *  Handles MouseEvent, TouchEvent (touches) and TouchEvent (changedTouches on touchend). */
export function eventToCanvas(e, el) {
  const r = el.getBoundingClientRect();
  let clientX, clientY;
  if (e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else if (e.changedTouches && e.changedTouches.length > 0) {
    clientX = e.changedTouches[0].clientX;
    clientY = e.changedTouches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }
  return { x: clientX - r.left, y: clientY - r.top };
}

/** Extend a line segment from (x1,y1)→(x2,y2) to hit canvas edges */
export function extendLineToEdges(x1, y1, x2, y2, w, h) {
  if (Math.abs(x2 - x1) < 0.001) {
    // Vertical
    return { x1, y1: 0, x2: x1, y2: h };
  }
  const m = (y2 - y1) / (x2 - x1);
  const b = y1 - m * x1;
  // Intersect with x=0, x=w, y=0, y=h
  const pts = [];
  const atX = x => ({ x, y: m * x + b });
  const atY = y => ({ x: (y - b) / m, y });
  [atX(0), atX(w), atY(0), atY(h)].forEach(p => {
    if (p.x >= -1 && p.x <= w + 1 && p.y >= -1 && p.y <= h + 1) pts.push(p);
  });
  if (pts.length < 2) return { x1, y1, x2, y2 };
  return { x1: pts[0].x, y1: pts[0].y, x2: pts[pts.length - 1].x, y2: pts[pts.length - 1].y };
}

/** Extend a ray from (x1,y1) through (x2,y2) to canvas edge */
export function extendRayToEdge(x1, y1, x2, y2, w, h) {
  const dx = x2 - x1, dy = y2 - y1;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return { x1, y1, x2, y2 };
  // parametric: P = (x1,y1) + t*(dx,dy), find max t in canvas
  const ts = [];
  if (Math.abs(dx) > 0.001) {
    ts.push((0 - x1) / dx);
    ts.push((w - x1) / dx);
  }
  if (Math.abs(dy) > 0.001) {
    ts.push((0 - y1) / dy);
    ts.push((h - y1) / dy);
  }
  const maxT = Math.max(...ts.filter(t => t > 0));
  return { x1, y1, x2: x1 + dx * maxT, y2: y1 + dy * maxT };
}
