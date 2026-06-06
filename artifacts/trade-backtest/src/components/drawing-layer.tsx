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
export interface PosDraw { id: string; kind: "long" | "short"; entry: number; stop: number; target: number }

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

const ND = { selectable: false, evented: false, hasControls: false, hasBorders: false };
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

    this._load();
    this._pushUndo();
  }

  // ── Mode ────────────────────────────────────────────────────────────────────
  setTool(t: string) {
    this._cancelDraw();
    this.tool = t;
    const upper = this.fab.upperCanvasEl as HTMLElement;
    if (t === "cursor") {
      upper.style.pointerEvents = "all";
      upper.style.cursor = "default";
      this.fab.selection    = !this.locked;
      this.fab.skipTargetFind = this.locked;
      this._selectable(!this.locked);
    } else {
      upper.style.pointerEvents = "none";
      upper.style.cursor = "crosshair";
      this.fab.selection    = false;
      this.fab.skipTargetFind = true;
      this._selectable(false);
    }
  }

  private _selectable(v: boolean) {
    this.fab.getObjects().forEach((o: FObj) => {
      if (o._isPreview) return;
      o.set({ selectable: v, evented: v });
      if (v) { o.set({ hasControls: true, hasBorders: true }); }
      else   { o.set({ hasControls: false, hasBorders: false }); }
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
    if (this.tool === "cursor") return;
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
    if (tool === "hline") { this._mkHLine(pt.price); this._fin(); return; }
    if (tool === "vline") { this._mkVLine(pt.time); this._fin(); return; }
    if (tool === "text")  { this._startText(pt.x, pt.y, pt.time, pt.price); return; }
    if (tool === "long")  { this._placeLong(pt.price); return; }
    if (tool === "short") { this._placeShort(pt.price); return; }

    // ── Pitchfork (3-click) ─────────────────────────────────────────────────
    if (tool === "pitchfork") {
      this.pitchPts.push(pt);
      if (this.pitchPts.length >= 2) {
        const prev = this.pitchPts[this.pitchPts.length - 2];
        const F = (window as any).fabric;
        const l = new F.Line([prev.x, prev.y, pt.x, pt.y], { ...ND, stroke: "#2962FF", strokeWidth: 1, strokeDashArray: [3,3], _isPreview: true });
        this.pitchLines.push(l); this.fab.add(l); this.fab.requestRenderAll();
      }
      if (this.pitchPts.length === 3) {
        const [a, b, c] = this.pitchPts;
        this.pitchLines.forEach(l => this.fab.remove(l));
        this.pitchLines = []; this.pitchPts = [];
        if (this.preview) { this.fab.remove(this.preview); this.preview = null; }
        this._mkPitchfork(a, b, c);
        this._fin(); this.phase = "idle";
      } else {
        this.p1 = pt; this.phase = "placing";
        if (!this.preview) {
          const F = (window as any).fabric;
          this.preview = new F.Line([pt.x, pt.y, pt.x, pt.y], { stroke: "#2962FF55", strokeWidth: 1, selectable: false, evented: false, _isPreview: true });
          this.fab.add(this.preview);
        }
      }
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

  // ── Move (live preview) ──────────────────────────────────────────────────────
  private _onMove(e: MouseEvent) {
    if (this.tool === "cursor" || this.phase !== "placing" || !this.p1 || !this.preview) return;
    const { x, y } = this._xy(e);
    this._updPreview(x, y);
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
  private _onTS(e: TouchEvent) { if (this.tool === "cursor") return; e.preventDefault(); }
  private _onTM(e: TouchEvent) {
    if (this.tool === "cursor") return; e.preventDefault();
    if (this.phase !== "placing" || !this.preview) return;
    const { x, y } = this._xy(e); this._updPreview(x, y);
  }
  private _onTE(e: TouchEvent) {
    if (this.tool === "cursor") return; e.preventDefault();
    const { x, y } = this._xy(e); this._handlePt(x, y);
  }

  // ── Cancel ──────────────────────────────────────────────────────────────────
  private _cancelDraw() {
    this.phase = "idle"; this.p1 = null;
    if (this.preview) { this.fab.remove(this.preview); this.preview = null; }
    this.pitchLines.forEach(l => this.fab.remove(l));
    this.pitchLines = []; this.pitchPts = [];
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

  private _mkText(x: number, y: number, time: number, price: number, text: string) {
    const F = (window as any).fabric;
    const t = new F.IText(text, { left: x, top: y, fill: "#D9D9D9", fontSize: 13, fontFamily: "monospace", ...ND, editable: false, drawingType: "text", logicalData: { time, price, text } });
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

  // ── Text overlay ─────────────────────────────────────────────────────────────
  private _startText(x: number, y: number, time: number, price: number) {
    let ov = document.getElementById("dl-text-ov");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "dl-text-ov";
      ov.style.cssText = "position:absolute;z-index:300;display:none;align-items:center;gap:0;box-shadow:0 4px 24px rgba(0,0,0,0.5);";
      const inp = document.createElement("input");
      inp.id = "dl-text-inp"; inp.type = "text"; inp.placeholder = "Label text…";
      inp.setAttribute("autocomplete","off");
      inp.style.cssText = "background:#131722;border:1.5px solid #2962FF;color:#e0e3eb;padding:6px 10px;font-size:13px;border-radius:4px 0 0 4px;outline:none;min-width:130px;font-family:monospace;";
      const btn = document.createElement("button");
      btn.id = "dl-text-btn"; btn.textContent = "✓"; btn.type = "button";
      btn.style.cssText = "background:#2962FF;border:none;color:#fff;padding:6px 13px;font-size:15px;border-radius:0 4px 4px 0;cursor:pointer;touch-action:manipulation;";
      ov.appendChild(inp); ov.appendChild(btn);
      this.container.appendChild(ov);
    }
    const ww = this.container.clientWidth;
    ov.style.left = `${Math.max(4, Math.min(x, ww - 200))}px`;
    ov.style.top  = `${Math.max(4, y - 26)}px`;
    ov.style.display = "flex";
    const inp = document.getElementById("dl-text-inp") as HTMLInputElement;
    const btn = document.getElementById("dl-text-btn") as HTMLButtonElement;
    inp.value = ""; inp.focus();
    const commit = (ok: boolean) => {
      const txt = inp.value.trim();
      ov!.style.display = "none";
      inp.onkeydown = null; inp.onblur = null; btn.onclick = null;
      if (ok && txt) { this._mkText(x, y, time, price, txt); this._fin(); }
    };
    inp.onkeydown = e => { if (e.key==="Enter"){e.preventDefault();commit(true);} if(e.key==="Escape"){e.preventDefault();commit(false);} };
    inp.onblur    = () => setTimeout(() => commit(true), 100);
    btn.onclick   = e => { e.preventDefault(); e.stopPropagation(); inp.onblur = null; commit(true); };
  }

  // ── Position tools ───────────────────────────────────────────────────────────
  private _placeLong(entry: number) {
    const pos: PosDraw = { id: crypto.randomUUID(), kind:"long", entry, stop: entry*0.985, target: entry*1.03 };
    this.positions = [...this.positions, pos]; this._savePosns(); this.onPositions(this.positions);
    this.onToolChange("cursor"); this.setTool("cursor");
  }
  private _placeShort(entry: number) {
    const pos: PosDraw = { id: crypto.randomUUID(), kind:"short", entry, stop: entry*1.015, target: entry*0.97 };
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
          if(x1!=null&&y1!=null&&x2!=null&&y2!=null){ const dx=x2-x1,dy=y2-y1; const ts:number[]=[]; if(Math.abs(dx)>0.001){ts.push((0-x1)/dx);ts.push((w-x1)/dx);} if(Math.abs(dy)>0.001){ts.push((0-y1)/dy);ts.push((h-y1)/dy);} const mx=Math.max(...ts.filter(t=>t>0)); setLC(obj,x1,y1,x1+dx*mx,y1+dy*mx); }
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
      case "text":  { const px=this._px(ld.time,ld.price); this._mkText(px?.x??100,px?.y??100,ld.time,ld.price,ld.text); break; }
      case "fib":   this._mkFib(ld.start.time,ld.start.price,ld.end.time,ld.end.price); break;
    }
  }
  private _fin() { this._pushUndo(); this._save(); }
  private _pushUndo() { this.undoStack.push(JSON.stringify(this._ser())); if(this.undoStack.length>60)this.undoStack.shift(); this.redoStack=[]; }
  undo() { if(this.undoStack.length<2){if(this.undoStack.length===1){this.redoStack.push(this.undoStack.pop()!);this._restoreAll([]);}return;} this.redoStack.push(this.undoStack.pop()!); this._restoreAll(JSON.parse(this.undoStack[this.undoStack.length-1])); this._save(); }
  redo() { if(!this.redoStack.length)return; const n=this.redoStack.pop()!; this.undoStack.push(n); this._restoreAll(JSON.parse(n)); this._save(); }
  private _restoreAll(data: any[]) { this.fab.getObjects().slice().forEach((o:FObj)=>this.fab.remove(o)); data.forEach(d=>this._restore1(d)); this.syncAll(); }
  clear() { this.fab.getObjects().slice().forEach((o:FObj)=>this.fab.remove(o)); this.positions=[]; this._savePosns(); this.onPositions([]); this.fab.requestRenderAll(); this._fin(); }

  destroy() {
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
// PositionTool — DOM overlay for Long / Short position drawings
// ═════════════════════════════════════════════════════════════════════════════
interface PTProps {
  pos:     PosDraw;
  series:  ISeriesApi<"Candlestick"> | null;
  syncTick: number;
  onUpdate: (id:string, patch:Partial<PosDraw>) => void;
  onRemove: (id:string) => void;
  containerH: number;
}

function PositionTool({ pos, series, syncTick: _tick, onUpdate, onRemove, containerH }: PTProps) {
  const drag = useRef<{field:"entry"|"stop"|"target"; startY:number; startPrice:number}|null>(null);

  const ey = series ? (p2y(series, pos.entry)  ?? -999) : -999;
  const sy = series ? (p2y(series, pos.stop)   ?? -999) : -999;
  const ty = series ? (p2y(series, pos.target) ?? -999) : -999;
  if (ey < 0 || ey > containerH + 200) return null;

  const isLong  = pos.kind === "long";
  const risk    = Math.abs(pos.entry - pos.stop);
  const reward  = Math.abs(pos.target - pos.entry);
  const rr      = risk > 0 ? (reward / risk).toFixed(2) : "–";
  const risktPct  = risk   > 0 ? ((risk   / pos.entry) * 100).toFixed(2) : "0";
  const rewardPct = reward > 0 ? ((reward / pos.entry) * 100).toFixed(2) : "0";

  const zoneTop  = isLong ? Math.min(ey, ty) : Math.min(ey, sy);
  const zoneBotSL = isLong ? Math.max(ey, sy) : Math.max(ey, ty);
  const zoneH_tp = Math.abs(ey - ty);
  const zoneH_sl = Math.abs(ey - sy);

  function startDrag(field: "entry"|"stop"|"target") {
    return (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      const startY = "touches" in e ? e.touches[0].clientY : e.clientY;
      drag.current = { field, startY, startPrice: pos[field] };

      const onMove = (ev: MouseEvent | TouchEvent) => {
        if (!drag.current || !series) return;
        const cy = "touches" in ev ? (ev as TouchEvent).touches[0].clientY : (ev as MouseEvent).clientY;
        const dy = cy - drag.current.startY;
        const newY = (p2y(series, drag.current.startPrice) ?? 0) + dy;
        const newPrice = y2p(series, newY);
        if (newPrice == null) return;
        onUpdate(pos.id, { [drag.current.field]: newPrice });
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

  const lineStyle = (color: string): React.CSSProperties => ({
    position: "absolute", left: 0, right: 0, height: 1.5, background: color,
    pointerEvents: "all", cursor: "ns-resize", zIndex: 40,
  });

  const labelStyle = (color: string, right?: boolean): React.CSSProperties => ({
    position: "absolute", [right ? "right" : "left"]: right ? 8 : 44,
    background: color, color: "#fff", fontSize: 10, fontFamily: "monospace",
    padding: "1px 6px", borderRadius: 3, whiteSpace: "nowrap", fontWeight: 600,
    pointerEvents: "none", userSelect: "none", top: "50%", transform: "translateY(-50%)",
  });

  const handleStyle = (color: string): React.CSSProperties => ({
    position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)",
    width: 28, height: 16, borderRadius: 3, background: color, display: "flex",
    alignItems: "center", justifyContent: "center", cursor: "ns-resize",
    pointerEvents: "all", zIndex: 2,
  });

  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 30 }}>
      {/* TP zone */}
      <div style={{ position: "absolute", left: 0, right: 0, top: isLong ? ty : ey, height: zoneH_tp, background: "rgba(38,166,154,0.13)", pointerEvents: "none" }} />
      {/* SL zone */}
      <div style={{ position: "absolute", left: 0, right: 0, top: isLong ? ey : sy, height: zoneH_sl, background: "rgba(239,83,80,0.13)", pointerEvents: "none" }} />

      {/* Target line */}
      <div style={{ ...lineStyle("#26a69a"), top: ty }}>
        <div style={handleStyle("#26a69a")} onMouseDown={startDrag("target")} onTouchStart={startDrag("target")}>
          <svg width="14" height="8" viewBox="0 0 14 8"><path d="M1 4h12M7 1l3 3-3 3" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
        </div>
        <span style={labelStyle("#26a69a")}>TP {pos.target.toFixed(isLong?2:4)} +{rewardPct}%</span>
        <span style={labelStyle("#26a69a", true)}>R:R {rr}</span>
      </div>

      {/* Entry line */}
      <div style={{ ...lineStyle("#F79009"), top: ey }}>
        <div style={handleStyle("#F79009")} onMouseDown={startDrag("entry")} onTouchStart={startDrag("entry")}>
          <svg width="14" height="8" viewBox="0 0 14 8"><path d="M1 4h12" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
        </div>
        <span style={labelStyle("#F79009")}>{isLong ? "Long" : "Short"} {pos.entry.toFixed(pos.entry > 10 ? 2 : 4)}</span>
        <button
          onClick={() => onRemove(pos.id)}
          style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "rgba(239,83,80,0.8)", border: "none", color: "#fff", width: 18, height: 18, borderRadius: "50%", cursor: "pointer", fontSize: 12, lineHeight: "18px", textAlign: "center", pointerEvents: "all" }}>×</button>
      </div>

      {/* Stop line */}
      <div style={{ ...lineStyle("#ef5350"), top: sy }}>
        <div style={handleStyle("#ef5350")} onMouseDown={startDrag("stop")} onTouchStart={startDrag("stop")}>
          <svg width="14" height="8" viewBox="0 0 14 8"><path d="M1 4h12M7 1l3 3-3 3" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" transform={isLong?"rotate(180 7 4)":""}/>  </svg>
        </div>
        <span style={labelStyle("#ef5350")}>SL {pos.stop.toFixed(pos.stop > 10 ? 2 : 4)} -{risktPct}%</span>
      </div>
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
  const [containerH, setContainerH] = useState(600);

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
      setContainerH(container.clientHeight);

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
          containerH={containerH}
          onUpdate={(id, patch) => { ctrlRef.current?.updatePos(id, patch); }}
          onRemove={(id) => { ctrlRef.current?.removePos(id); }}
        />
      ))}
    </>
  );
}
