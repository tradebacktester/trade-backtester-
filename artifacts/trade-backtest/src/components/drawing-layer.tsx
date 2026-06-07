// ── Professional Drawing Layer — TradingView-style ────────────────────────────
import { useEffect, useRef, useState, useCallback } from "react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Fab = any;
type FObj = any;

// ── Public handle ─────────────────────────────────────────────────────────────
export interface DrawingLayerHandle {
  setTool:          (t: string) => void;
  undo:             () => void;
  redo:             () => void;
  clear:            () => void;
  toggleLock:       () => void;
  toggleVisibility: () => void;
  deleteSelected:   () => void;
  isLocked:         boolean;
  isVisible:        boolean;
}

// ── Internal types ────────────────────────────────────────────────────────────
interface Pt { x: number; y: number; time: number; price: number }
export interface PosDraw {
  id: string; kind: "long" | "short";
  entry: number; stop: number; target: number;
  accountSize: number;  // e.g. 10000
  riskPct:     number;  // 0-100, e.g. 1 = 1%
}

interface Props {
  chartRef:      React.RefObject<IChartApi | null>;
  seriesRef:     React.RefObject<ISeriesApi<"Candlestick"> | null>;
  containerRef:  React.RefObject<HTMLDivElement | null>;
  activeTool:    string;
  onToolChange:  (t: string) => void;
  symbol:        string;
  interval:      string;
  onHandleReady?: (h: DrawingLayerHandle) => void;
}

// ── Fabric CDN ────────────────────────────────────────────────────────────────
let _fabP: Promise<void> | null = null;
function ensureFabric(): Promise<void> {
  if ((window as any).fabric) return Promise.resolve();
  if (_fabP) return _fabP;
  _fabP = new Promise<void>((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://unpkg.com/fabric@5.3.0/dist/fabric.min.js";
    s.onload = () => res();
    s.onerror = () => rej(new Error("Fabric CDN failed"));
    document.head.appendChild(s);
  });
  return _fabP;
}

// ── Coord helpers ─────────────────────────────────────────────────────────────
const t2x = (c: IChartApi, t: number) => c.timeScale().timeToCoordinate(t as any);
const x2t = (c: IChartApi, x: number) => c.timeScale().coordinateToTime(x) as number | null;
const p2y = (s: ISeriesApi<"Candlestick">, p: number) => s.priceToCoordinate(p);
const y2p = (s: ISeriesApi<"Candlestick">, y: number) => s.coordinateToPrice(y);

function setLC(l: FObj, x1: number, y1: number, x2: number, y2: number) {
  l.x1 = x1; l.y1 = y1; l.x2 = x2; l.y2 = y2;
  l.width  = Math.max(Math.abs(x2 - x1), 0.001);
  l.height = Math.max(Math.abs(y2 - y1), 0.001);
  l.left   = Math.min(x1, x2);
  l.top    = Math.min(y1, y2);
  l.setCoords();
}

// lockMovementX/Y prevent fabric from moving drawings freely; cursor mode still
// allows selection (for Delete key) but drawings must not drift since logicalData
// would be stale and syncAll() would snap them back to the original position.
const ND = { selectable: false, evented: false, hasControls: false, hasBorders: false, lockMovementX: true, lockMovementY: true };
const FIB  = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const FIBC = ["#ef5350","#26a69a","#2962ff","#ff9800","#9c27b0","#26a69a","#ef5350"];

// ═════════════════════════════════════════════════════════════════════════════
// DrawingController
// ═════════════════════════════════════════════════════════════════════════════
class DrawingController {
  fab: Fab; container: HTMLElement;
  chartRef: React.RefObject<IChartApi | null>;
  seriesRef: React.RefObject<ISeriesApi<"Candlestick"> | null>;
  symbol: string; interval: string;
  onToolChange: (t: string) => void;
  onPositions:  (p: PosDraw[]) => void;
  onSync:       () => void;

  tool       = "cursor";
  phase: "idle" | "placing" = "idle";
  p1:    Pt | null = null;
  preview: FObj | null = null;
  pitchPts: Pt[] = []; pitchLines: FObj[] = [];
  locked  = false;
  visible = true;
  positions: PosDraw[] = [];
  undoStack: string[] = []; redoStack: string[] = [];
  _unsubs: Array<() => void> = [];
  _ro: ResizeObserver;
  // RAF throttle for move events — only one preview update per animation frame
  _rafId:     number | null = null;
  _pendingXY: { x: number; y: number } | null = null;
  _b: { click:(e:MouseEvent)=>void; move:(e:MouseEvent)=>void; key:(e:KeyboardEvent)=>void;
        ts:(e:TouchEvent)=>void; tm:(e:TouchEvent)=>void; te:(e:TouchEvent)=>void };

  constructor(
    fab: Fab, container: HTMLElement,
    chartRef: React.RefObject<IChartApi | null>,
    seriesRef: React.RefObject<ISeriesApi<"Candlestick"> | null>,
    symbol: string, interval: string,
    onToolChange: (t: string) => void,
    onPositions: (p: PosDraw[]) => void,
    onSync: () => void,
  ) {
    this.fab = fab; this.container = container;
    this.chartRef = chartRef; this.seriesRef = seriesRef;
    this.symbol = symbol; this.interval = interval;
    this.onToolChange = onToolChange;
    this.onPositions = onPositions;
    this.onSync = onSync;

    const click = this._onClick.bind(this);
    const move  = this._onMove.bind(this);
    const key   = this._onKey.bind(this);
    const ts    = this._onTS.bind(this);
    const tm    = this._onTM.bind(this);
    const te    = this._onTE.bind(this);
    this._b = { click, move, key, ts, tm, te };

    container.addEventListener("click",      click);
    container.addEventListener("mousemove",  move);
    document.addEventListener("keydown",     key);
    container.addEventListener("touchstart", ts, { passive: false });
    container.addEventListener("touchmove",  tm, { passive: false });
    container.addEventListener("touchend",   te, { passive: false });

    const chart = chartRef.current;
    if (chart) {
      const sync = () => { this.syncAll(); this.onSync(); };
      chart.timeScale().subscribeVisibleTimeRangeChange(sync);
      chart.timeScale().subscribeVisibleLogicalRangeChange(sync);
      // NOTE: crosshairMove is NOT subscribed — it fires on every pixel of mouse
      // movement and causes heavy re-renders. timeRange + logicalRange cover
      // all pan/zoom cases including pinch-zoom.
      this._unsubs.push(
        () => chart.timeScale().unsubscribeVisibleTimeRangeChange(sync),
        () => chart.timeScale().unsubscribeVisibleLogicalRangeChange(sync),
      );
    }

    this._ro = new ResizeObserver(() => {
      fab.setDimensions({ width: container.clientWidth, height: container.clientHeight });
      this.syncAll(); this.onSync();
    });
    this._ro.observe(container);

    // Eraser: delete any object clicked while in eraser mode
    fab.on("mouse:down", (opts: any) => {
      if (this.tool !== "eraser") return;
      const target = opts.target;
      if (!target || target._isPreview) return;
      this._rmObj(target);
      fab.discardActiveObject();
      this._fin();
      fab.requestRenderAll();
    });

    this._load();
    this._pushUndo();
  }

  // ── Mode ────────────────────────────────────────────────────────────────────
  setTool(t: string) {
    this._cancelDraw();
    this.tool = t;
    const upper = this.fab.upperCanvasEl as HTMLElement;
    const chart = this.chartRef.current;

    if (t === "cursor") {
      upper.style.pointerEvents = "all";
      upper.style.cursor = "default";
      this.fab.selection     = !this.locked;
      this.fab.skipTargetFind = this.locked;
      this._selectable(!this.locked);
      // Restore chart panning/zooming in cursor mode
      chart?.applyOptions({ handleScroll: true, handleScale: true });
    } else if (t === "eraser") {
      upper.style.pointerEvents = "all";
      upper.style.cursor = "cell";
      this.fab.selection     = false;
      this.fab.skipTargetFind = false;
      this._selectable(true);
      // Eraser intercepts clicks — keep chart from panning at the same time
      chart?.applyOptions({ handleScroll: false, handleScale: false });
    } else {
      // Any drawing tool: events pass through the transparent upper canvas to
      // the container below. Disable chart's own scroll/scale so it doesn't
      // pan while the user is placing a drawing.
      upper.style.pointerEvents = "none";
      upper.style.cursor = "crosshair";
      this.fab.selection     = false;
      this.fab.skipTargetFind = true;
      this._selectable(false);
      chart?.applyOptions({ handleScroll: false, handleScale: false });
    }
  }

  private _selectable(v: boolean) {
    this.fab.getObjects().forEach((o: FObj) => {
      if (o._isPreview) return;
      o.set({ selectable: v, evented: v });
      if (v) {
        // Keep lockMovement even when selectable so cursor mode only allows
        // selecting (for Delete key) — not free dragging, which would desync
        // pixel position from logicalData and cause snap-back on next zoom/pan.
        o.set({ hasControls: true, hasBorders: true, lockMovementX: true, lockMovementY: true });
      } else {
        o.set({ hasControls: false, hasBorders: false });
      }
    });
    this.fab.requestRenderAll();
  }

  // ── Coords ──────────────────────────────────────────────────────────────────
  private _xy(e: MouseEvent | TouchEvent) {
    const r = this.container.getBoundingClientRect();
    let cx: number, cy: number;
    if ("touches" in e && e.touches.length > 0)                    { cx = e.touches[0].clientX;        cy = e.touches[0].clientY; }
    else if ("changedTouches" in e && e.changedTouches.length > 0) { cx = e.changedTouches[0].clientX; cy = e.changedTouches[0].clientY; }
    else                                                            { cx = (e as MouseEvent).clientX;   cy = (e as MouseEvent).clientY; }
    return { x: cx - r.left, y: cy - r.top };
  }

  private _toPt(x: number, y: number): Pt | null {
    const c = this.chartRef.current, s = this.seriesRef.current;
    if (!c || !s) return null;
    const time = x2t(c, x), price = y2p(s, y);
    if (time == null || price == null) return null;
    return { x, y, time, price };
  }

  private _px(time: number, price: number) {
    const c = this.chartRef.current, s = this.seriesRef.current;
    if (!c || !s) return null;
    const x = t2x(c, time), y = p2y(s, price);
    if (x == null || y == null) return null;
    return { x, y };
  }

  // ── Click / tap ─────────────────────────────────────────────────────────────
  private _onClick(e: MouseEvent) {
    if (this.tool === "cursor" || this.tool === "eraser") return;
    // Suppress clicks that originated from a touch (touchend fires click too)
    if ((e as any).sourceCapabilities?.firesTouchEvents) return;
    const { x, y } = this._xy(e);
    this._handlePt(x, y);
  }

  private _handlePt(x: number, y: number) {
    const pt = this._toPt(x, y);
    if (!pt) return;
    const tool = this.tool;

    // ── 1-click tools ───────────────────────────────────────────────────────
    if (tool === "hline") { this._mkHLine(pt.price); this._fin(); this.fab.requestRenderAll(); return; }
    if (tool === "vline") { this._mkVLine(pt.time);  this._fin(); this.fab.requestRenderAll(); return; }
    if (tool === "text")  { this._startText(pt.x, pt.y, pt.time, pt.price); return; }
    if (tool === "long")  { this._placeLong(pt.price); return; }
    if (tool === "short") { this._placeShort(pt.price); return; }

    // ── Pitchfork (3-click) ─────────────────────────────────────────────────
    if (tool === "pitchfork") {
      const F = (window as any).fabric;
      this.pitchPts.push(pt);

      if (this.pitchPts.length >= 2) {
        // Draw the committed segment from previous click to this click
        const prev = this.pitchPts[this.pitchPts.length - 2];
        const seg = new F.Line([prev.x, prev.y, pt.x, pt.y], {
          ...ND, stroke: "#2962FF", strokeWidth: 1, strokeDashArray: [3,3], _isPreview: true,
        });
        this.pitchLines.push(seg);
        this.fab.add(seg);
      }

      if (this.pitchPts.length === 3) {
        // All 3 points placed — finalise the pitchfork
        const [a, b, c] = this.pitchPts;
        this.pitchLines.forEach(l => this.fab.remove(l));
        this.pitchLines = []; this.pitchPts = [];
        if (this.preview) { this.fab.remove(this.preview); this.preview = null; }
        this._mkPitchfork(a, b, c);
        this._fin(); this.phase = "idle";
      } else {
        // After click 1 or 2: keep the preview line tracking the mouse from this point
        this.p1 = pt; this.phase = "placing";
        if (this.preview) {
          // Reuse existing preview line: update its start to the new click point
          setLC(this.preview, pt.x, pt.y, pt.x, pt.y);
        } else {
          this.preview = new F.Line([pt.x, pt.y, pt.x, pt.y], {
            stroke: "#2962FF55", strokeWidth: 1, selectable: false, evented: false, _isPreview: true,
          });
          this.fab.add(this.preview);
        }
      }
      this.fab.requestRenderAll();
      return;
    }

    // ── 2-click tools ───────────────────────────────────────────────────────
    if (this.phase === "idle") {
      this.p1 = pt; this.phase = "placing";
      const F = (window as any).fabric;
      if (tool === "rect") {
        this.preview = new F.Rect({ left: x, top: y, width: 0.001, height: 0.001, fill: "rgba(41,98,255,0.06)", stroke: "#2962FF", strokeWidth: 1.5, strokeDashArray: [4,4], selectable: false, evented: false, _isPreview: true });
      } else {
        this.preview = new F.Line([x, y, x, y], { stroke: "#2962FF", strokeWidth: 1.5, strokeDashArray: [4,4], opacity: 0.8, selectable: false, evented: false, _isPreview: true });
      }
      this.fab.add(this.preview);
    } else if (this.phase === "placing" && this.p1) {
      const p1 = this.p1;
      if (this.preview) { this.fab.remove(this.preview); this.preview = null; }
      this.phase = "idle"; this.p1 = null;
      if (Math.hypot(x - p1.x, y - p1.y) < 4) return;
      if      (tool === "trendline" || tool === "ray") this._mkTrendLine(p1.time, p1.price, pt.time, pt.price, tool);
      else if (tool === "rect")                        this._mkRect(p1.time, p1.price, pt.time, pt.price);
      else if (tool === "fib")                         this._mkFib(p1.time, p1.price, pt.time, pt.price);
      this._fin(); this.fab.requestRenderAll();
    }
  }

  // ── Move (live preview) — RAF-throttled for smooth mobile performance ────────
  private _schedulePreview(x: number, y: number) {
    this._pendingXY = { x, y };
    if (this._rafId !== null) return;           // already scheduled for this frame
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      if (!this._pendingXY) return;
      const { x: px, y: py } = this._pendingXY;
      this._pendingXY = null;
      this._applyPreview(px, py);
    });
  }

  private _applyPreview(x: number, y: number) {
    // Pitchfork: preview tracks from the LAST clicked point to the cursor.
    if (this.tool === "pitchfork" && this.pitchPts.length > 0 && this.preview) {
      const last = this.pitchPts[this.pitchPts.length - 1];
      setLC(this.preview, last.x, last.y, x, y);
      this.fab.requestRenderAll();
      return;
    }
    if (this.phase !== "placing" || !this.p1 || !this.preview) return;
    this._updPreview(x, y);
  }

  private _onMove(e: MouseEvent) {
    if (this.tool === "cursor") return;
    const { x, y } = this._xy(e);
    this._schedulePreview(x, y);
  }

  private _updPreview(x: number, y: number) {
    if (!this.preview || !this.p1) return;
    const { x: sx, y: sy } = this.p1;
    if (this.tool === "rect") {
      this.preview.set({ left: Math.min(x, sx), top: Math.min(y, sy), width: Math.max(Math.abs(x - sx), 0.001), height: Math.max(Math.abs(y - sy), 0.001) });
      this.preview.setCoords();
    } else {
      setLC(this.preview, sx, sy, x, y);
    }
    this.fab.requestRenderAll();
  }

  // ── Keyboard ────────────────────────────────────────────────────────────────
  private _onKey(e: KeyboardEvent) {
    if ((e.target as HTMLElement)?.tagName === "INPUT") return;
    if (e.key === "Escape") this._cancelDraw();
    if ((e.key === "Delete" || e.key === "Backspace") && this.tool === "cursor") this.deleteSelected();
    if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); this.undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "z"))) { e.preventDefault(); this.redo(); }
    if (e.key === "v" || e.key === "V") { this.onToolChange("cursor"); this.setTool("cursor"); }
  }

  // ── Touch ────────────────────────────────────────────────────────────────────
  private _onTS(e: TouchEvent) { if (this.tool === "cursor" || this.tool === "eraser") return; e.preventDefault(); }
  private _onTM(e: TouchEvent) {
    if (this.tool === "cursor" || this.tool === "eraser") return;
    e.preventDefault();  // Must be synchronous (passive:false listener)
    const { x, y } = this._xy(e);
    this._schedulePreview(x, y);  // RAF-throttled, same path as mouse
  }
  private _onTE(e: TouchEvent) {
    if (this.tool === "cursor" || this.tool === "eraser") return; e.preventDefault();
    const { x, y } = this._xy(e); this._handlePt(x, y);
  }

  // ── Cancel ──────────────────────────────────────────────────────────────────
  private _cancelDraw() {
    this.phase = "idle"; this.p1 = null;
    if (this.preview) { this.fab.remove(this.preview); this.preview = null; }
    this.pitchLines.forEach(l => this.fab.remove(l));
    this.pitchLines = []; this.pitchPts = [];
    // Dismiss the text-label popup if it's open
    document.getElementById("dl-text-ov")?.remove();
    this.fab.requestRenderAll();
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  deleteSelected() {
    if (this.locked) return;
    this.fab.getActiveObjects().forEach((o: FObj) => this._rmObj(o));
    this.fab.discardActiveObject();
    this._fin(); this.fab.requestRenderAll();
  }

  // ── Lock / Visibility ────────────────────────────────────────────────────────
  toggleLock() {
    this.locked = !this.locked;
    if (this.tool === "cursor") this.setTool("cursor");
    return this.locked;
  }
  toggleVisibility() {
    this.visible = !this.visible;
    this.fab.getObjects().forEach((o: FObj) => { if (!o._isPreview) o.set({ opacity: this.visible ? 1 : 0 }); });
    const upper = this.fab.upperCanvasEl as HTMLElement;
    if (!this.visible) upper.style.pointerEvents = "none";
    else if (this.tool === "cursor") upper.style.pointerEvents = "all";
    this.fab.requestRenderAll();
    return this.visible;
  }

  // ── Drawing factories ────────────────────────────────────────────────────────
  private _mkTrendLine(t1: number, p1: number, t2: number, p2: number, type = "trendline") {
    const F = (window as any).fabric;
    const a = this._px(t1, p1)!, b = this._px(t2, p2)!;
    const line = new F.Line([a.x, a.y, b.x, b.y], { ...ND, stroke: "#2962FF", strokeWidth: 1.5, drawingType: type, logicalData: { start: { time: t1, price: p1 }, end: { time: t2, price: p2 } } });
    this.fab.add(line); return line;
  }

  private _mkHLine(price: number) {
    const F = (window as any).fabric; const w = this.fab.getWidth();
    const y = (this.seriesRef.current ? p2y(this.seriesRef.current, price) : 200) ?? 200;
    const line = new F.Line([0, y, w, y], { ...ND, stroke: "#26a69a", strokeWidth: 1.5, drawingType: "hline", logicalData: { price } });
    this.fab.add(line); return line;
  }

  private _mkVLine(time: number) {
    const F = (window as any).fabric; const h = this.fab.getHeight();
    const x = (this.chartRef.current ? t2x(this.chartRef.current, time) : 200) ?? 200;
    const line = new F.Line([x, 0, x, h], { ...ND, stroke: "#FF9800", strokeWidth: 1.5, drawingType: "vline", logicalData: { time } });
    this.fab.add(line); return line;
  }

  private _mkRect(t1: number, p1: number, t2: number, p2: number) {
    const F = (window as any).fabric;
    const a = this._px(t1, p1)!, b = this._px(t2, p2)!;
    const rect = new F.Rect({ left: Math.min(a.x, b.x), top: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y), fill: "rgba(41,98,255,0.08)", stroke: "#2962FF", strokeWidth: 1.5, ...ND, drawingType: "rect", logicalData: { start: { time: t1, price: p1 }, end: { time: t2, price: p2 } } });
    this.fab.add(rect); return rect;
  }

  private _mkText(x: number, y: number, time: number, price: number, text: string, color = "#D9D9D9", size = 13) {
    const F = (window as any).fabric;
    const t = new F.IText(text, { left: x, top: y, fill: color, fontSize: size, fontFamily: "system-ui,sans-serif", fontWeight: size >= 18 ? "600" : "400", ...ND, editable: false, drawingType: "text", logicalData: { time, price, text, color, size } });
    this.fab.add(t); return t;
  }

  private _mkFib(t1: number, p1: number, t2: number, p2: number) {
    const F = (window as any).fabric; const gid = crypto.randomUUID();
    const a = this._px(t1, p1)!, b = this._px(t2, p2)!;
    const w = this.fab.getWidth(); const left = Math.min(a.x, b.x);
    const anchor = new F.Line([a.x, a.y, b.x, b.y], { ...ND, stroke: "#787B86", strokeWidth: 1, strokeDashArray: [4,4], drawingType: "fib", logicalData: { start: { time: t1, price: p1 }, end: { time: t2, price: p2 }, groupId: gid } });
    this.fab.add(anchor);
    FIB.forEach((level, i) => {
      const price = p1 + (p2 - p1) * level;
      const ly = this.seriesRef.current ? (p2y(this.seriesRef.current, price) ?? 0) : 0;
      const line  = new F.Line([left, ly, w, ly], { ...ND, stroke: FIBC[i], strokeWidth: 1, drawingType: "fib-line", logicalData: { groupId: gid, level } });
      const label = new F.Text(`${(level*100).toFixed(1)}%  ${price.toFixed(2)}`, { left: left+4, top: ly-13, fill: FIBC[i], fontSize: 9, fontFamily: "monospace", ...ND, drawingType: "fib-line", logicalData: { groupId: gid, level, isLabel: true, price } });
      this.fab.add(line); this.fab.add(label);
    });
    return anchor;
  }

  private _mkPitchfork(a: Pt, b: Pt, c: Pt) {
    const F = (window as any).fabric; const gid = crypto.randomUUID(); const w = this.fab.getWidth();
    const mx = (b.x+c.x)/2, my = (b.y+c.y)/2; const dx = mx-a.x, dy = my-a.y;
    const te = dx!==0?(w-a.x)/dx:999;
    const ex = a.x+dx*te, ey = a.y+dy*te;
    const med = new F.Line([a.x,a.y,ex,ey], { ...ND, stroke:"#2962FF", strokeWidth:1.5, drawingType:"pitchfork", logicalData:{a:{time:a.time,price:a.price},b:{time:b.time,price:b.price},c:{time:c.time,price:c.price},groupId:gid} });
    const up  = new F.Line([b.x,b.y,b.x+dx*te,b.y+dy*te], { ...ND, stroke:"#2962FF", strokeWidth:1, drawingType:"pitchfork-line", logicalData:{groupId:gid,fork:"upper"} });
    const lo  = new F.Line([c.x,c.y,c.x+dx*te,c.y+dy*te], { ...ND, stroke:"#2962FF", strokeWidth:1, drawingType:"pitchfork-line", logicalData:{groupId:gid,fork:"lower"} });
    this.fab.add(med); this.fab.add(up); this.fab.add(lo);
  }

  // ── Text overlay — improved panel with color/size options ────────────────────
  private _startText(x: number, y: number, time: number, price: number) {
    // Remove any stale overlay from a previous mount
    document.getElementById("dl-text-ov")?.remove();

    const TEXT_COLORS = ["#D9D9D9","#F79009","#26a69a","#ef5350","#2962FF","#9C27B0","#FFEB3B"];
    const TEXT_SIZES  = [{ label:"S", px:11 },{ label:"M", px:14 },{ label:"L", px:20 }];
    let pickedColor = TEXT_COLORS[0];
    let pickedSize  = TEXT_SIZES[1].px;  // default Medium

    const ov = document.createElement("div");
    ov.id = "dl-text-ov";
    ov.style.cssText = [
      "position:absolute;z-index:300;",
      "display:flex;flex-direction:column;gap:8px;",
      "background:rgba(13,17,28,0.97);",
      "border:1px solid rgba(41,98,255,0.45);",
      "border-radius:10px;padding:10px 12px;",
      "box-shadow:0 8px 40px rgba(0,0,0,0.7);",
      "min-width:220px;",
    ].join("");

    // ── Input row ──────────────────────────────────────────────────────────────
    const row1 = document.createElement("div");
    row1.style.cssText = "display:flex;gap:0;";
    const inp = document.createElement("input");
    inp.id = "dl-text-inp"; inp.type = "text"; inp.placeholder = "Type label…";
    inp.setAttribute("autocomplete","off");
    inp.style.cssText = [
      "flex:1;background:rgba(255,255,255,0.06);",
      "border:1.5px solid rgba(41,98,255,0.5);border-right:none;",
      "color:#e0e3eb;padding:7px 10px;font-size:13px;",
      "border-radius:6px 0 0 6px;outline:none;",
      "font-family:system-ui,sans-serif;",
    ].join("");

    const addBtn = document.createElement("button");
    addBtn.textContent = "Add"; addBtn.type = "button";
    addBtn.style.cssText = [
      "background:#2962FF;border:none;color:#fff;",
      "padding:7px 14px;font-size:12px;font-weight:600;",
      "border-radius:0 6px 6px 0;cursor:pointer;",
      "font-family:system-ui,sans-serif;white-space:nowrap;",
      "touch-action:manipulation;",
    ].join("");
    row1.appendChild(inp); row1.appendChild(addBtn);

    // ── Size row ───────────────────────────────────────────────────────────────
    const row2 = document.createElement("div");
    row2.style.cssText = "display:flex;align-items:center;gap:4px;";
    const szLabel = document.createElement("span");
    szLabel.textContent = "Size:";
    szLabel.style.cssText = "font-size:10px;color:rgba(165,170,195,0.6);font-family:system-ui,sans-serif;margin-right:2px;";
    row2.appendChild(szLabel);

    TEXT_SIZES.forEach(sz => {
      const b = document.createElement("button");
      b.textContent = sz.label; b.type = "button";
      b.dataset["px"] = String(sz.px);
      b.style.cssText = [
        `background:${pickedSize===sz.px?"rgba(41,98,255,0.3)":"rgba(255,255,255,0.07)"};`,
        `border:1px solid ${pickedSize===sz.px?"rgba(41,98,255,0.7)":"rgba(255,255,255,0.12)"};`,
        "color:#D9D9D9;border-radius:5px;padding:3px 9px;",
        "font-size:11px;cursor:pointer;font-family:system-ui,sans-serif;",
        "touch-action:manipulation;",
      ].join("");
      b.addEventListener("mousedown", e => {
        e.preventDefault();
        pickedSize = sz.px;
        row2.querySelectorAll("button").forEach((bb: Element) => {
          const bbEl = bb as HTMLButtonElement;
          const active = bbEl.dataset["px"] === String(sz.px);
          bbEl.style.background = active ? "rgba(41,98,255,0.3)" : "rgba(255,255,255,0.07)";
          bbEl.style.border     = `1px solid ${active ? "rgba(41,98,255,0.7)" : "rgba(255,255,255,0.12)"}`;
        });
      });
      row2.appendChild(b);
    });

    // ── Color row ──────────────────────────────────────────────────────────────
    const row3 = document.createElement("div");
    row3.style.cssText = "display:flex;align-items:center;gap:5px;";
    const cLabel = document.createElement("span");
    cLabel.textContent = "Color:";
    cLabel.style.cssText = "font-size:10px;color:rgba(165,170,195,0.6);font-family:system-ui,sans-serif;margin-right:2px;";
    row3.appendChild(cLabel);

    TEXT_COLORS.forEach(c => {
      const swatch = document.createElement("button");
      swatch.type = "button"; swatch.dataset["color"] = c;
      swatch.style.cssText = [
        `background:${c};`,
        `width:${pickedColor===c?18:14}px;height:${pickedColor===c?18:14}px;`,
        `border:${pickedColor===c?"2px solid #fff":"2px solid transparent"};`,
        "border-radius:50%;cursor:pointer;flex-shrink:0;",
        "touch-action:manipulation;padding:0;",
      ].join("");
      swatch.addEventListener("mousedown", e => {
        e.preventDefault();
        pickedColor = c;
        inp.style.color = c;
        row3.querySelectorAll("button").forEach((sw: Element) => {
          const swEl = sw as HTMLButtonElement;
          const sel = swEl.dataset["color"] === c;
          swEl.style.width  = sel ? "18px" : "14px";
          swEl.style.height = sel ? "18px" : "14px";
          swEl.style.border = sel ? "2px solid #fff" : "2px solid transparent";
        });
      });
      row3.appendChild(swatch);
    });

    ov.appendChild(row1); ov.appendChild(row2); ov.appendChild(row3);

    // Position the panel, keeping it inside the container
    const ww = this.container.clientWidth;
    const wh = this.container.clientHeight;
    ov.style.left = `${Math.max(4, Math.min(x, ww - 240))}px`;
    ov.style.top  = `${Math.max(4, Math.min(y - 10, wh - 130))}px`;
    this.container.appendChild(ov);
    inp.focus();

    const commit = (ok: boolean) => {
      const txt = inp.value.trim();
      ov.remove();
      if (ok && txt) {
        this._mkText(x, y, time, price, txt, pickedColor, pickedSize);
        this._fin();
        // Auto-revert to cursor after placing a label
        this.onToolChange("cursor");
        this.setTool("cursor");
      }
    };

    inp.addEventListener("keydown", e => {
      if (e.key === "Enter")  { e.preventDefault(); commit(true); }
      if (e.key === "Escape") { e.preventDefault(); commit(false); }
    });
    // Small timeout so clicking a size/color swatch doesn't blur-commit
    inp.addEventListener("blur", () => setTimeout(() => { if (document.getElementById("dl-text-ov")) commit(true); }, 150));
    addBtn.addEventListener("mousedown", e => { e.preventDefault(); inp.removeEventListener("blur", () => {}); commit(true); });
    addBtn.addEventListener("click",     e => { e.preventDefault(); e.stopPropagation(); commit(true); });
  }

  // ── Position tools ───────────────────────────────────────────────────────────
  private _placeLong(entry: number) {
    const pos: PosDraw = { id: crypto.randomUUID(), kind:"long", entry, stop: entry*0.985, target: entry*1.03, accountSize: 10000, riskPct: 1 };
    this.positions = [...this.positions, pos]; this._savePosns(); this.onPositions(this.positions);
    this.onToolChange("cursor"); this.setTool("cursor");
  }
  private _placeShort(entry: number) {
    const pos: PosDraw = { id: crypto.randomUUID(), kind:"short", entry, stop: entry*1.015, target: entry*0.97, accountSize: 10000, riskPct: 1 };
    this.positions = [...this.positions, pos]; this._savePosns(); this.onPositions(this.positions);
    this.onToolChange("cursor"); this.setTool("cursor");
  }
  updatePos(id: string, patch: Partial<PosDraw>) {
    this.positions = this.positions.map(p => p.id===id ? {...p,...patch} : p);
    this._savePosns(); this.onPositions(this.positions);
  }
  removePos(id: string) {
    this.positions = this.positions.filter(p => p.id!==id);
    this._savePosns(); this.onPositions(this.positions);
  }
  private _posKey() { return `dl_pos_${this.symbol}_${this.interval}`; }
  private _savePosns() { try { localStorage.setItem(this._posKey(), JSON.stringify(this.positions)); } catch {} }
  private _loadPosns() { try { const r=localStorage.getItem(this._posKey()); if(r){ this.positions=JSON.parse(r); this.onPositions(this.positions); } } catch {} }

  // ── Remove ───────────────────────────────────────────────────────────────────
  private _rmObj(obj: FObj) {
    if (obj.logicalData?.groupId) {
      const gid = obj.logicalData.groupId;
      this.fab.getObjects().filter((o:FObj)=>o.logicalData?.groupId===gid).forEach((o:FObj)=>this.fab.remove(o));
    }
    this.fab.remove(obj);
  }

  // ── Sync ─────────────────────────────────────────────────────────────────────
  syncAll() {
    const chart = this.chartRef.current, series = this.seriesRef.current;
    if (!chart || !series || !this.fab) return;
    const w = this.fab.getWidth(), h = this.fab.getHeight();
    this.fab.getObjects().forEach((obj: FObj) => {
      if (!obj.logicalData || obj._isPreview) return;
      const d = obj.logicalData;
      switch (obj.drawingType) {
        case "trendline": { const x1=t2x(chart,d.start.time),y1=p2y(series,d.start.price),x2=t2x(chart,d.end.time),y2=p2y(series,d.end.price); if(x1!=null&&y1!=null&&x2!=null&&y2!=null) setLC(obj,x1,y1,x2,y2); break; }
        case "ray": {
          const x1=t2x(chart,d.start.time),y1=p2y(series,d.start.price),x2=t2x(chart,d.end.time),y2=p2y(series,d.end.price);
          if(x1!=null&&y1!=null&&x2!=null&&y2!=null){
            const dx=x2-x1,dy=y2-y1;
            const ts:number[]=[];
            if(Math.abs(dx)>0.001){ts.push((0-x1)/dx);ts.push((w-x1)/dx);}
            if(Math.abs(dy)>0.001){ts.push((0-y1)/dy);ts.push((h-y1)/dy);}
            // Guard: if no positive-t intersections (degenerate or zero-length ray), skip
            const pos=ts.filter(t=>t>0);
            if(pos.length===0) break;
            const mx=Math.max(...pos);
            setLC(obj,x1,y1,x1+dx*mx,y1+dy*mx);
          }
          break;
        }
        case "hline": { const y=p2y(series,d.price); if(y!=null) setLC(obj,0,y,w,y); break; }
        case "vline": { const x=t2x(chart,d.time);   if(x!=null) setLC(obj,x,0,x,h); break; }
        case "rect": {
          const x1=t2x(chart,d.start.time),y1=p2y(series,d.start.price),x2=t2x(chart,d.end.time),y2=p2y(series,d.end.price);
          if(x1!=null&&y1!=null&&x2!=null&&y2!=null){obj.set({left:Math.min(x1,x2),top:Math.min(y1,y2),width:Math.max(Math.abs(x2-x1),0.001),height:Math.max(Math.abs(y2-y1),0.001)});obj.setCoords();}
          break;
        }
        case "text": { const x=t2x(chart,d.time),y=p2y(series,d.price); if(x!=null&&y!=null){obj.set({left:x,top:y});obj.setCoords();} break; }
        case "fib": {
          const x1=t2x(chart,d.start.time),y1=p2y(series,d.start.price),x2=t2x(chart,d.end.time),y2=p2y(series,d.end.price);
          if(x1!=null&&y1!=null&&x2!=null&&y2!=null){
            setLC(obj,x1,y1,x2,y2); const left=Math.min(x1,x2);
            this.fab.getObjects().filter((o:FObj)=>o.drawingType==="fib-line"&&o.logicalData?.groupId===d.groupId).forEach((o:FObj)=>{
              const lv=o.logicalData.level; const pr=d.start.price+(d.end.price-d.start.price)*lv; const ly=p2y(series,pr);
              if(ly==null)return;
              if(o.logicalData.isLabel){o.set({left:left+4,top:ly-13});o.setCoords();}
              else setLC(o,left,ly,w,ly);
            });
          }
          break;
        }
        case "pitchfork": {
          const ld=d; const ax=t2x(chart,ld.a.time),ay=p2y(series,ld.a.price),bx=t2x(chart,ld.b.time),by=p2y(series,ld.b.price),cx=t2x(chart,ld.c.time),cy=p2y(series,ld.c.price);
          if(ax!=null&&ay!=null&&bx!=null&&by!=null&&cx!=null&&cy!=null){
            const mx=(bx+cx)/2,my=(by+cy)/2; const dx=mx-ax,dy=my-ay; const t=dx!==0?(w-ax)/dx:999; const ex=ax+dx*t,ey=ay+dy*t;
            setLC(obj,ax,ay,ex,ey);
            this.fab.getObjects().filter((o:FObj)=>o.drawingType==="pitchfork-line"&&o.logicalData?.groupId===ld.groupId).forEach((o:FObj)=>{
              const [px,py]=o.logicalData.fork==="upper"?[bx,by]:[cx,cy]; setLC(o,px,py,px+dx*t,py+dy*t);
            });
          }
          break;
        }
      }
    });
    this.fab.requestRenderAll();
  }

  // ── Persistence ──────────────────────────────────────────────────────────────
  private _key() { return `dl_draw_${this.symbol}_${this.interval}`; }
  private _ser(): object[] {
    return this.fab.getObjects()
      .filter((o:FObj)=>o.logicalData&&!o._isPreview&&o.drawingType!=="fib-line"&&o.drawingType!=="pitchfork-line")
      .map((o:FObj)=>({drawingType:o.drawingType,logicalData:o.logicalData,stroke:o.stroke,strokeWidth:o.strokeWidth}));
  }
  private _save() { try { localStorage.setItem(this._key(), JSON.stringify(this._ser())); } catch {} }
  private _load() {
    try {
      const r = localStorage.getItem(this._key());
      if (r) { (JSON.parse(r) as any[]).forEach(d => this._restore1(d)); this.syncAll(); }
    } catch {}
    this._loadPosns();
  }
  private _restore1(d: {drawingType:string;logicalData:any}) {
    const ld = d.logicalData;
    switch (d.drawingType) {
      case "trendline": case "ray": this._mkTrendLine(ld.start.time,ld.start.price,ld.end.time,ld.end.price,d.drawingType); break;
      case "hline": this._mkHLine(ld.price); break;
      case "vline": this._mkVLine(ld.time); break;
      case "rect":  this._mkRect(ld.start.time,ld.start.price,ld.end.time,ld.end.price); break;
      case "text":  { const px=this._px(ld.time,ld.price); this._mkText(px?.x??100,px?.y??100,ld.time,ld.price,ld.text,ld.color,ld.size); break; }
      case "fib":   this._mkFib(ld.start.time,ld.start.price,ld.end.time,ld.end.price); break;
      case "pitchfork": {
        // Resolve pixels at restore time so _mkPitchfork has valid coords;
        // syncAll() runs immediately after and corrects any off-screen positions.
        const pa = this._px(ld.a.time, ld.a.price) ?? { x: 0, y: 0 };
        const pb = this._px(ld.b.time, ld.b.price) ?? { x: 0, y: 0 };
        const pc = this._px(ld.c.time, ld.c.price) ?? { x: 0, y: 0 };
        this._mkPitchfork(
          { x: pa.x, y: pa.y, time: ld.a.time, price: ld.a.price },
          { x: pb.x, y: pb.y, time: ld.b.time, price: ld.b.price },
          { x: pc.x, y: pc.y, time: ld.c.time, price: ld.c.price },
        );
        break;
      }
    }
  }
  private _fin() { this._pushUndo(); this._save(); }
  private _pushUndo() { this.undoStack.push(JSON.stringify(this._ser())); if(this.undoStack.length>60)this.undoStack.shift(); this.redoStack=[]; }
  undo() { if(this.undoStack.length<2){if(this.undoStack.length===1){this.redoStack.push(this.undoStack.pop()!);this._restoreAll([]);}return;} this.redoStack.push(this.undoStack.pop()!); this._restoreAll(JSON.parse(this.undoStack[this.undoStack.length-1])); this._save(); }
  redo() { if(!this.redoStack.length)return; const n=this.redoStack.pop()!; this.undoStack.push(n); this._restoreAll(JSON.parse(n)); this._save(); }
  private _restoreAll(data: any[]) { this.fab.getObjects().slice().forEach((o:FObj)=>this.fab.remove(o)); data.forEach(d=>this._restore1(d)); this.syncAll(); }
  clear() { this.fab.getObjects().slice().forEach((o:FObj)=>this.fab.remove(o)); this.positions=[]; this._savePosns(); this.onPositions([]); this.fab.requestRenderAll(); this._fin(); }

  destroy() {
    // Cancel pending RAF before anything else
    if (this._rafId !== null) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    this._pendingXY = null;
    // Restore chart interactivity
    this.chartRef.current?.applyOptions({ handleScroll: true, handleScale: true });
    this._cancelDraw(); this._unsubs.forEach(f=>f()); this._ro.disconnect();
    const {click,move,key,ts,tm,te}=this._b;
    this.container.removeEventListener("click",click);
    this.container.removeEventListener("mousemove",move);
    document.removeEventListener("keydown",key);
    this.container.removeEventListener("touchstart",ts);
    this.container.removeEventListener("touchmove",tm);
    this.container.removeEventListener("touchend",te);
    try{this.fab.dispose();}catch{}
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// PositionTool — TradingView-style Long / Short overlay with full position sizing
// ═════════════════════════════════════════════════════════════════════════════
interface PTProps {
  pos:      PosDraw;
  series:   ISeriesApi<"Candlestick"> | null;
  syncTick: number;
  onUpdate: (id: string, patch: Partial<PosDraw>) => void;
  onRemove: (id: string) => void;
  containerH: number;
}

function PositionTool({ pos, series, syncTick: _tick, onUpdate, onRemove, containerH }: PTProps) {
  const [showSettings, setShowSettings] = useState(false);
  const drag = useRef<{ field: "entry"|"stop"|"target"; startY: number; startPrice: number } | null>(null);

  // ── Pixel positions ────────────────────────────────────────────────────────
  const ey = series ? (p2y(series, pos.entry)  ?? -999) : -999;
  const sy = series ? (p2y(series, pos.stop)   ?? -999) : -999;
  const ty = series ? (p2y(series, pos.target) ?? -999) : -999;
  if (ey < -200 || ey > containerH + 200) return null;

  const isLong = pos.kind === "long";

  // ── Metrics ────────────────────────────────────────────────────────────────
  const risk      = Math.abs(pos.entry - pos.stop);
  const reward    = Math.abs(pos.target - pos.entry);
  const rr        = risk > 0 ? (reward / risk).toFixed(2) : "–";
  const riskPctPx = risk   > 0 ? ((risk   / pos.entry) * 100).toFixed(2) : "0";
  const rewPctPx  = reward > 0 ? ((reward / pos.entry) * 100).toFixed(2) : "0";
  const acctSz    = pos.accountSize ?? 10000;
  const riskPct   = pos.riskPct    ?? 1;
  const riskUsd   = acctSz * riskPct / 100;
  const posSize   = risk > 0 ? riskUsd / risk : 0;
  const rewUsd    = posSize * reward;
  const fmt       = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;

  const zoneH_tp = Math.abs(ey - ty);
  const zoneH_sl = Math.abs(ey - sy);

  // ── Drag handles ──────────────────────────────────────────────────────────
  function startDrag(field: "entry"|"stop"|"target") {
    return (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      const startY = "touches" in e ? e.touches[0].clientY : e.clientY;
      drag.current = { field, startY, startPrice: pos[field] };
      const onMove = (ev: MouseEvent | TouchEvent) => {
        if (!drag.current || !series) return;
        const cy = "touches" in ev ? (ev as TouchEvent).touches[0].clientY : (ev as MouseEvent).clientY;
        const newY = (p2y(series, drag.current.startPrice) ?? 0) + (cy - drag.current.startY);
        const newP = y2p(series, newY);
        if (newP != null) onUpdate(pos.id, { [drag.current.field]: newP });
      };
      const onUp = () => {
        drag.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.removeEventListener("touchmove", onMove as any);
        document.removeEventListener("touchend", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.addEventListener("touchmove", onMove as any, { passive: false });
      document.addEventListener("touchend", onUp);
    };
  }

  // ── Style helpers ──────────────────────────────────────────────────────────
  const tpC = "#26a69a", slC = "#ef5350", enC = "#F79009";

  const lineS = (color: string, top: number): React.CSSProperties => ({
    position: "absolute", left: 0, right: 0, top, height: 2,
    background: color, pointerEvents: "all", cursor: "ns-resize", zIndex: 40,
  });
  const handleS = (color: string): React.CSSProperties => ({
    position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)",
    width: 30, height: 18, borderRadius: 3, background: color,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "ns-resize", pointerEvents: "all", zIndex: 2,
  });
  const lbl = (color: string, left: number | string): React.CSSProperties => ({
    position: "absolute", left, background: color, color: "#fff",
    fontSize: 10, fontFamily: "monospace", padding: "1px 6px",
    borderRadius: 3, whiteSpace: "nowrap", fontWeight: 600,
    pointerEvents: "none", userSelect: "none",
    top: "50%", transform: "translateY(-50%)",
  });
  const lblGhost = (color: string, left: number | string): React.CSSProperties => ({
    ...lbl(color + "77", left),
  });

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 30 }}>

      {/* ── Coloured zones ─── */}
      <div style={{ position: "absolute", left: 0, right: 0, top: isLong ? ty : ey, height: zoneH_tp, background: "rgba(38,166,154,0.10)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: isLong ? ey : sy, height: zoneH_sl, background: "rgba(239,83,80,0.10)", pointerEvents: "none" }} />

      {/* ── Take-Profit line ─── */}
      <div style={lineS(tpC, ty)}>
        <div style={handleS(tpC)} onMouseDown={startDrag("target")} onTouchStart={startDrag("target")}>
          <svg width="14" height="8" viewBox="0 0 14 8"><path d="M1 4h12M7 1l3 3-3 3" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
        </div>
        <span style={lbl(tpC, 44)}>TP {pos.target.toFixed(pos.target > 10 ? 2 : 4)} +{rewPctPx}%</span>
        <span style={lblGhost(tpC, "30%")}>{fmt(rewUsd)} profit</span>
        <span style={{ ...lbl(tpC + "cc", "auto"), right: 8 }}>R:R 1:{rr}</span>
      </div>

      {/* ── Entry line ─── */}
      <div style={lineS(enC, ey)}>
        <div style={handleS(enC)} onMouseDown={startDrag("entry")} onTouchStart={startDrag("entry")}>
          <svg width="14" height="8" viewBox="0 0 14 8"><path d="M1 4h12" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
        </div>
        <span style={lbl(enC, 44)}>{isLong ? "▲ Long" : "▼ Short"} {pos.entry.toFixed(pos.entry > 10 ? 2 : 4)}</span>
        <span style={lblGhost(enC, "30%")}>
          {posSize > 0 ? `${posSize.toFixed(4)} units · ${fmt(riskUsd)} risk (${riskPct}%)` : `${fmt(acctSz)} account`}
        </span>
        {/* Settings gear */}
        <button
          onMouseDown={e => { e.stopPropagation(); setShowSettings(s => !s); }}
          onTouchStart={e => { e.stopPropagation(); setShowSettings(s => !s); }}
          style={{ position: "absolute", right: 30, top: "50%", transform: "translateY(-50%)",
            background: showSettings ? enC : "rgba(40,44,60,0.85)",
            border: `1px solid ${enC}88`, color: "#fff", width: 22, height: 22,
            borderRadius: 4, cursor: "pointer", fontSize: 12, lineHeight: "22px",
            textAlign: "center", pointerEvents: "all" }}
          title="Position sizing settings"
        >⚙</button>
        {/* Remove */}
        <button
          onClick={() => onRemove(pos.id)}
          style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
            background: "rgba(239,83,80,0.85)", border: "none", color: "#fff",
            width: 20, height: 20, borderRadius: "50%", cursor: "pointer",
            fontSize: 14, lineHeight: "20px", textAlign: "center", pointerEvents: "all" }}>×</button>
      </div>

      {/* ── Stop-Loss line ─── */}
      <div style={lineS(slC, sy)}>
        <div style={handleS(slC)} onMouseDown={startDrag("stop")} onTouchStart={startDrag("stop")}>
          <svg width="14" height="8" viewBox="0 0 14 8">
            <path d="M1 4h12M7 1l3 3-3 3" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round"
              transform={isLong ? "rotate(180 7 4)" : ""} />
          </svg>
        </div>
        <span style={lbl(slC, 44)}>SL {pos.stop.toFixed(pos.stop > 10 ? 2 : 4)} -{riskPctPx}%</span>
        <span style={lblGhost(slC, "30%")}>{fmt(riskUsd)} max loss</span>
      </div>

      {/* ── Settings panel ─── */}
      {showSettings && (
        <div
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          style={{
            position: "absolute", top: Math.max(8, ey + 10), left: 44,
            background: "rgba(13,17,28,0.97)",
            border: `1px solid ${enC}55`,
            borderRadius: 10, padding: "12px 16px",
            zIndex: 80, pointerEvents: "all",
            boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
            fontFamily: "monospace", color: "#D9D9D9", fontSize: 11,
            minWidth: 230,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 10, color: enC, fontSize: 12 }}>
            {isLong ? "▲ Long" : "▼ Short"} Position Sizing
          </div>

          {/* Account size */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
            <span style={{ width: 96, opacity: 0.65 }}>Account Size</span>
            <span style={{ opacity: 0.5 }}>$</span>
            <input
              type="number" min={100} step={500}
              value={acctSz}
              onChange={e => onUpdate(pos.id, { accountSize: Number(e.target.value) })}
              style={{ width: 80, background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#fff", borderRadius: 4, padding: "3px 7px",
                fontFamily: "monospace", fontSize: 11 }}
            />
          </label>

          {/* Risk % */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ width: 96, opacity: 0.65 }}>Risk per Trade</span>
            <input
              type="number" min={0.1} max={100} step={0.1}
              value={riskPct}
              onChange={e => onUpdate(pos.id, { riskPct: Number(e.target.value) })}
              style={{ width: 80, background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#fff", borderRadius: 4, padding: "3px 7px",
                fontFamily: "monospace", fontSize: 11 }}
            />
            <span style={{ opacity: 0.5 }}>%</span>
          </label>

          {/* Computed results */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
            {[
              { label: "$ at Risk",      val: `$${riskUsd.toFixed(2)}`,  color: slC },
              { label: "Position Size",  val: `${posSize.toFixed(4)} units`, color: "#D9D9D9" },
              { label: "$ Reward",       val: `$${rewUsd.toFixed(2)}`,  color: tpC },
              { label: "Risk : Reward",  val: `1 : ${rr}`,
                color: rr !== "–" && parseFloat(rr) >= 2 ? tpC : rr !== "–" && parseFloat(rr) >= 1 ? enC : slC },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ opacity: 0.55 }}>{row.label}</span>
                <span style={{ fontWeight: 700, color: row.color }}>{row.val}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// DrawingLayer — React wrapper
// ═════════════════════════════════════════════════════════════════════════════
export function DrawingLayer({ chartRef, seriesRef, containerRef, activeTool, onToolChange, symbol, interval, onHandleReady }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const ctrlRef    = useRef<DrawingController | null>(null);
  const prevTool   = useRef(activeTool);
  const [positions, setPositions] = useState<PosDraw[]>([]);
  const [locked,  setLocked]  = useState(false);
  const [visible, setVisible] = useState(true);
  const [syncTick, setSyncTick] = useState(0);
  // Derive containerH live from the ref so it stays accurate after window resize
  // without needing a separate state update — syncTick re-renders PositionTool on
  // every viewport change, so reading clientHeight inline is always fresh.

  const buildHandle = useCallback((ctrl: DrawingController): DrawingLayerHandle => ({
    setTool:          (t) => { prevTool.current = t; ctrl.setTool(t); },
    undo:             () => ctrl.undo(),
    redo:             () => ctrl.redo(),
    clear:            () => ctrl.clear(),
    deleteSelected:   () => ctrl.deleteSelected(),
    toggleLock:       () => { const v = ctrl.toggleLock(); setLocked(v); },
    toggleVisibility: () => { const v = ctrl.toggleVisibility(); setVisible(v); },
    isLocked:  ctrl.locked,
    isVisible: ctrl.visible,
  }), []);

  // Init controller
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;
    let ctrl: DrawingController | null = null;
    let tries = 0;
    const tryInit = () => {
      if (!chartRef.current || !seriesRef.current) {
        if (++tries < 50) { setTimeout(tryInit, 200); return; }
        return;
      }
      const F = (window as any).fabric;
      const container = containerRef.current!;

      const fab = new F.Canvas(canvasRef.current!, {
        selection: false, renderOnAddRemove: false, skipTargetFind: true, preserveObjectStacking: true,
      });
      fab.setWidth(container.clientWidth);
      fab.setHeight(container.clientHeight);

      ctrl = new DrawingController(
        fab, container, chartRef, seriesRef, symbol, interval,
        onToolChange,
        (p) => setPositions([...p]),
        () => setSyncTick(t => t + 1),
      );
      ctrlRef.current = ctrl;
      ctrl.setTool(prevTool.current);
      setPositions([...ctrl.positions]);
      setLocked(ctrl.locked);
      setVisible(ctrl.visible);
      onHandleReady?.(buildHandle(ctrl));
    };
    ensureFabric().then(tryInit);
    return () => { ctrl?.destroy(); ctrlRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, interval]);

  // Tool changes
  useEffect(() => {
    prevTool.current = activeTool;
    ctrlRef.current?.setTool(activeTool);
  }, [activeTool]);

  // Re-emit handle when lock/visible changes
  useEffect(() => {
    const ctrl = ctrlRef.current;
    if (ctrl) onHandleReady?.(buildHandle(ctrl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, visible]);

  return (
    <>
      <canvas
        ref={canvasRef}
        id={`dl-canvas-${symbol}`}
        style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 15 }}
      />
      {positions.map(pos => (
        <PositionTool
          key={pos.id}
          pos={pos}
          series={seriesRef.current}
          syncTick={syncTick}
          containerH={containerRef.current?.clientHeight ?? 600}
          onUpdate={(id, patch) => { ctrlRef.current?.updatePos(id, patch); }}
          onRemove={(id) => { ctrlRef.current?.removePos(id); }}
        />
      ))}
    </>
  );
}
