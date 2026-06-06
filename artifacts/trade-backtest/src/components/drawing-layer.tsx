// Drawing layer — Fabric.js canvas overlay synced to LightweightCharts viewport
// Fabric is loaded from CDN once (avoids install step); stored in window.fabric
import { useEffect, useRef, useCallback } from "react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Fab = any;
type FObj = any;

export interface DrawingLayerHandle {
  setTool: (t: string) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

interface Props {
  chartRef: React.RefObject<IChartApi | null>;
  seriesRef: React.RefObject<ISeriesApi<"Candlestick"> | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  activeTool: string;
  symbol: string;
  onHandleReady?: (h: DrawingLayerHandle) => void;
}

// ── Fabric CDN loader (singleton promise) ─────────────────────────────────────
let _fabPromise: Promise<void> | null = null;
function ensureFabric(): Promise<void> {
  if ((window as any).fabric) return Promise.resolve();
  if (_fabPromise) return _fabPromise;
  _fabPromise = new Promise<void>((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://unpkg.com/fabric@5.3.0/dist/fabric.min.js";
    s.onload = () => res();
    s.onerror = () => rej(new Error("Fabric CDN load failed"));
    document.head.appendChild(s);
  });
  return _fabPromise;
}

// ── Coordinate helpers ────────────────────────────────────────────────────────
function timeToX(chart: IChartApi, t: number): number | null {
  return chart.timeScale().timeToCoordinate(t as any);
}
function xToTime(chart: IChartApi, x: number): number | null {
  return chart.timeScale().coordinateToTime(x) as number | null;
}
function priceToY(series: ISeriesApi<"Candlestick">, p: number): number | null {
  return series.priceToCoordinate(p);
}
function yToPrice(series: ISeriesApi<"Candlestick">, y: number): number | null {
  return series.coordinateToPrice(y);
}

// ── Update a fabric.Line to new absolute canvas coords ────────────────────────
function setLineCoords(line: FObj, ax1: number, ay1: number, ax2: number, ay2: number) {
  line.x1 = ax1; line.y1 = ay1; line.x2 = ax2; line.y2 = ay2;
  line.width  = Math.max(Math.abs(ax2 - ax1), 0.001);
  line.height = Math.max(Math.abs(ay2 - ay1), 0.001);
  line.left   = Math.min(ax1, ax2);
  line.top    = Math.min(ay1, ay2);
  line.setCoords();
}

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const FIB_COLORS = ["#ef5350","#26a69a","#2962ff","#ff9800","#9c27b0","#26a69a","#ef5350"];
const LINE_DEFAULTS = { selectable: false, evented: false, hasControls: false, hasBorders: false };

// ── Main DrawingController class ──────────────────────────────────────────────
class DrawingController {
  fab: Fab;
  container: HTMLElement;
  chartRef: React.RefObject<IChartApi | null>;
  seriesRef: React.RefObject<ISeriesApi<"Candlestick"> | null>;
  symbol: string;

  activeTool = "cursor";
  isDrawing  = false;
  preview: FObj | null = null;
  startX = 0; startY = 0;
  startTime = 0; startPrice = 0;
  undoStack: string[] = [];
  redoStack: string[] = [];
  pitchClicks: { x: number; y: number; time: number; price: number }[] = [];
  pitchPreviews: FObj[] = [];
  _unsubs: Array<() => void> = [];
  _mouseBound: { down: (e: MouseEvent) => void; move: (e: MouseEvent) => void; up: (e: MouseEvent) => void; key: (e: KeyboardEvent) => void };
  _ro: ResizeObserver;

  constructor(
    fabricCanvas: Fab,
    container: HTMLElement,
    chartRef: React.RefObject<IChartApi | null>,
    seriesRef: React.RefObject<ISeriesApi<"Candlestick"> | null>,
    symbol: string
  ) {
    this.fab = fabricCanvas;
    this.container = container;
    this.chartRef = chartRef;
    this.seriesRef = seriesRef;
    this.symbol = symbol;

    // Bind mouse handlers
    const onDown = this._onDown.bind(this);
    const onMove = this._onMove.bind(this);
    const onUp   = this._onUp.bind(this);
    const onKey  = this._onKey.bind(this);
    container.addEventListener("mousedown", onDown);
    container.addEventListener("mousemove", onMove);
    container.addEventListener("mouseup",   onUp);
    document.addEventListener("keydown",   onKey);
    this._mouseBound = { down: onDown, move: onMove, up: onUp, key: onKey };

    // Chart sync subscriptions
    const chart = chartRef.current;
    if (chart) {
      const sync = () => this.syncAll();
      chart.timeScale().subscribeVisibleTimeRangeChange(sync);
      chart.timeScale().subscribeVisibleLogicalRangeChange(sync);
      this._unsubs.push(
        () => chart.timeScale().unsubscribeVisibleTimeRangeChange(sync),
        () => chart.timeScale().unsubscribeVisibleLogicalRangeChange(sync),
      );
    }

    // Resize
    this._ro = new ResizeObserver(() => {
      this.fab.setDimensions({ width: container.clientWidth, height: container.clientHeight });
      this.syncAll();
    });
    this._ro.observe(container);

    // Load saved drawings
    this._load();
    this._pushUndo(); // seed undo stack
  }

  // ── Tool switching ──────────────────────────────────────────────────────────
  setTool(tool: string) {
    this._cancelDrawing();
    this.activeTool = tool;
    const upper = this.fab.upperCanvasEl as HTMLElement;
    if (tool === "cursor") {
      upper.style.pointerEvents = "all";
      upper.style.cursor = "default";
      this.fab.selection = true;
      this.fab.skipTargetFind = false;
    } else {
      upper.style.pointerEvents = "all";
      upper.style.cursor = "crosshair";
      this.fab.selection = false;
      this.fab.skipTargetFind = true;
    }
  }

  // ── Coordinate helpers using current chart refs ─────────────────────────────
  private _toLogical(x: number, y: number) {
    const chart = this.chartRef.current;
    const series = this.seriesRef.current;
    if (!chart || !series) return null;
    const time  = xToTime(chart, x);
    const price = yToPrice(series, y);
    if (time == null || price == null) return null;
    return { time, price };
  }
  private _toPixel(time: number, price: number) {
    const chart = this.chartRef.current;
    const series = this.seriesRef.current;
    if (!chart || !series) return null;
    const x = timeToX(chart, time);
    const y = priceToY(series, price);
    if (x == null || y == null) return null;
    return { x, y };
  }

  // ── Mouse handlers ──────────────────────────────────────────────────────────
  private _eventXY(e: MouseEvent) {
    const r = this.container.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private _onDown(e: MouseEvent) {
    if (this.activeTool === "cursor") return; // fabric handles natively
    const { x, y } = this._eventXY(e);
    const lg = this._toLogical(x, y);
    if (!lg) return;

    if (this.activeTool === "hline") {
      this._makeHLine(lg.price);
      this._finalize();
      return;
    }
    if (this.activeTool === "vline") {
      this._makeVLine(lg.time);
      this._finalize();
      return;
    }
    if (this.activeTool === "pitchfork") {
      this._handlePitchClick(x, y, lg.time, lg.price);
      return;
    }
    // Tools that need drag: trendline, ray, rect, fib, text
    if (this.activeTool === "text") {
      this._startText(x, y, lg.time, lg.price);
      return;
    }
    this.isDrawing = true;
    this.startX = x; this.startY = y;
    this.startTime = lg.time; this.startPrice = lg.price;
    const F = (window as any).fabric;
    if (this.activeTool === "rect") {
      this.preview = new F.Rect({ left: x, top: y, width: 0.001, height: 0.001, fill: "rgba(41,98,255,0.06)", stroke: "#2962FF", strokeWidth: 1.5, strokeDashArray: [4,4], selectable: false, evented: false, _isPreview: true });
    } else {
      this.preview = new F.Line([x, y, x, y], { stroke: "#2962FF", strokeWidth: 1.5, strokeDashArray: [4,4], opacity: 0.8, selectable: false, evented: false, _isPreview: true });
    }
    this.fab.add(this.preview);
  }

  private _onMove(e: MouseEvent) {
    if (!this.isDrawing || !this.preview) return;
    const { x, y } = this._eventXY(e);
    if (this.activeTool === "rect") {
      this.preview.set({ left: Math.min(x, this.startX), top: Math.min(y, this.startY), width: Math.max(Math.abs(x - this.startX), 0.001), height: Math.max(Math.abs(y - this.startY), 0.001) });
      this.preview.setCoords();
    } else {
      setLineCoords(this.preview, this.startX, this.startY, x, y);
    }
    this.fab.requestRenderAll();
  }

  private _onUp(e: MouseEvent) {
    if (!this.isDrawing) return;
    const { x, y } = this._eventXY(e);
    const lg = this._toLogical(x, y);
    this.isDrawing = false;
    if (this.preview) { this.fab.remove(this.preview); this.preview = null; }
    if (!lg) return;
    if (Math.hypot(x - this.startX, y - this.startY) < 4) return;

    const tool = this.activeTool;
    if (tool === "trendline" || tool === "ray") {
      this._makeTrendLine(this.startTime, this.startPrice, lg.time, lg.price, tool);
    } else if (tool === "rect") {
      this._makeRect(this.startTime, this.startPrice, lg.time, lg.price);
    } else if (tool === "fib") {
      this._makeFib(this.startTime, this.startPrice, lg.time, lg.price);
    }
    this._finalize();
    this.fab.requestRenderAll();
  }

  private _onKey(e: KeyboardEvent) {
    if ((e.target as HTMLElement)?.tagName === "INPUT") return;
    if (e.key === "Escape") this._cancelDrawing();
    if ((e.key === "Delete" || e.key === "Backspace") && this.activeTool === "cursor") {
      this.fab.getActiveObjects().forEach((o: FObj) => this._removeObj(o));
      this.fab.discardActiveObject();
      this._finalize();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); this.undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "z"))) { e.preventDefault(); this.redo(); }
  }

  private _cancelDrawing() {
    this.isDrawing = false;
    if (this.preview) { this.fab.remove(this.preview); this.preview = null; }
    this.pitchPreviews.forEach(l => this.fab.remove(l));
    this.pitchPreviews = []; this.pitchClicks = [];
    this.fab.requestRenderAll();
  }

  // ── Pitchfork (3-click) ─────────────────────────────────────────────────────
  private _handlePitchClick(x: number, y: number, time: number, price: number) {
    this.pitchClicks.push({ x, y, time, price });
    const F = (window as any).fabric;
    if (this.pitchClicks.length >= 2) {
      const prev = this.pitchClicks[this.pitchClicks.length - 2];
      const curr = this.pitchClicks[this.pitchClicks.length - 1];
      const l = new F.Line([prev.x, prev.y, curr.x, curr.y], { stroke: "#2962FF", strokeWidth: 1, strokeDashArray: [3,3], selectable: false, evented: false, _isPreview: true });
      this.pitchPreviews.push(l);
      this.fab.add(l);
    }
    if (this.pitchClicks.length === 3) {
      const [a, b, c] = this.pitchClicks;
      this.pitchPreviews.forEach(l => this.fab.remove(l));
      this.pitchPreviews = []; this.pitchClicks = [];
      this._makePitchfork(a, b, c);
      this._finalize();
    }
    this.fab.requestRenderAll();
  }

  // ── Text tool ───────────────────────────────────────────────────────────────
  private _startText(x: number, y: number, time: number, price: number) {
    let overlay = document.getElementById("drawing-text-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "drawing-text-overlay";
      overlay.style.cssText = "position:absolute;z-index:100;display:none;";
      const inp = document.createElement("input");
      inp.type = "text"; inp.id = "drawing-text-input";
      inp.placeholder = "Type label…";
      inp.style.cssText = "background:#1E222D;border:1px solid #2962FF;color:#D9D9D9;padding:3px 8px;font-size:13px;border-radius:3px;outline:none;min-width:100px;";
      overlay.appendChild(inp);
      this.container.appendChild(overlay);
    }
    overlay.style.left = `${x}px`; overlay.style.top = `${y - 22}px`; overlay.style.display = "block";
    const inp = document.getElementById("drawing-text-input") as HTMLInputElement;
    inp.value = ""; inp.focus();
    inp.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === "Escape") {
        const txt = inp.value.trim();
        overlay!.style.display = "none";
        if (txt && e.key === "Enter") {
          this._makeText(x, y, time, price, txt);
          this._finalize();
        }
      }
    };
  }

  // ── Drawing object factories ────────────────────────────────────────────────
  private _makeTrendLine(t1: number, p1: number, t2: number, p2: number, type = "trendline") {
    const F = (window as any).fabric;
    const px1 = this._toPixel(t1, p1); const px2 = this._toPixel(t2, p2);
    const x1 = px1?.x ?? 0, y1 = px1?.y ?? 0, x2 = px2?.x ?? 100, y2 = px2?.y ?? 100;
    const line = new F.Line([x1, y1, x2, y2], { ...LINE_DEFAULTS, stroke: "#2962FF", strokeWidth: 1.5, drawingType: type, logicalData: { start: { time: t1, price: p1 }, end: { time: t2, price: p2 } } });
    this.fab.add(line);
    return line;
  }
  private _makeHLine(price: number) {
    const F = (window as any).fabric;
    const w = this.fab.getWidth();
    const y = (this.seriesRef.current ? priceToY(this.seriesRef.current, price) : 200) ?? 200;
    const line = new F.Line([0, y, w, y], { ...LINE_DEFAULTS, stroke: "#26a69a", strokeWidth: 1.5, drawingType: "hline", logicalData: { price } });
    this.fab.add(line);
    return line;
  }
  private _makeVLine(time: number) {
    const F = (window as any).fabric;
    const h = this.fab.getHeight();
    const x = (this.chartRef.current ? timeToX(this.chartRef.current, time) : 200) ?? 200;
    const line = new F.Line([x, 0, x, h], { ...LINE_DEFAULTS, stroke: "#FF9800", strokeWidth: 1.5, drawingType: "vline", logicalData: { time } });
    this.fab.add(line);
    return line;
  }
  private _makeRect(t1: number, p1: number, t2: number, p2: number) {
    const F = (window as any).fabric;
    const px1 = this._toPixel(t1, p1)!; const px2 = this._toPixel(t2, p2)!;
    const rect = new F.Rect({ left: Math.min(px1.x, px2.x), top: Math.min(px1.y, px2.y), width: Math.abs(px2.x - px1.x), height: Math.abs(px2.y - px1.y), fill: "rgba(41,98,255,0.08)", stroke: "#2962FF", strokeWidth: 1.5, ...LINE_DEFAULTS, drawingType: "rect", logicalData: { start: { time: t1, price: p1 }, end: { time: t2, price: p2 } } });
    this.fab.add(rect);
    return rect;
  }
  private _makeText(x: number, y: number, time: number, price: number, text: string) {
    const F = (window as any).fabric;
    const t = new F.IText(text, { left: x, top: y, fill: "#D9D9D9", fontSize: 13, fontFamily: "JetBrains Mono, monospace", ...LINE_DEFAULTS, editable: false, drawingType: "text", logicalData: { time, price, text } });
    this.fab.add(t);
    return t;
  }
  private _makeFib(t1: number, p1: number, t2: number, p2: number) {
    const F = (window as any).fabric;
    const groupId = crypto.randomUUID();
    const px1 = this._toPixel(t1, p1)!; const px2 = this._toPixel(t2, p2)!;
    const w = this.fab.getWidth();
    const left = Math.min(px1.x, px2.x);
    // Diagonal anchor
    const anchor = new F.Line([px1.x, px1.y, px2.x, px2.y], { ...LINE_DEFAULTS, stroke: "#787B86", strokeWidth: 1, strokeDashArray: [4,4], drawingType: "fib", logicalData: { start: { time: t1, price: p1 }, end: { time: t2, price: p2 }, groupId } });
    this.fab.add(anchor);
    // Level lines
    FIB_LEVELS.forEach((level, i) => {
      const price = p1 + (p2 - p1) * level;
      const ly = this.seriesRef.current ? (priceToY(this.seriesRef.current, price) ?? 0) : 0;
      const line = new F.Line([left, ly, w, ly], { ...LINE_DEFAULTS, stroke: FIB_COLORS[i], strokeWidth: 1, drawingType: "fib-line", logicalData: { groupId, level } });
      const label = new F.Text(`${(level*100).toFixed(1)}%  ${price.toFixed(2)}`, { left: left + 4, top: ly - 13, fill: FIB_COLORS[i], fontSize: 9, fontFamily: "monospace", ...LINE_DEFAULTS, drawingType: "fib-line", logicalData: { groupId, level, isLabel: true, price } });
      this.fab.add(line); this.fab.add(label);
    });
    return anchor;
  }
  private _makePitchfork(a: {x:number;y:number;time:number;price:number}, b: {x:number;y:number;time:number;price:number}, c: {x:number;y:number;time:number;price:number}) {
    const F = (window as any).fabric;
    const groupId = crypto.randomUUID();
    const w = this.fab.getWidth();
    const mx = (b.x+c.x)/2, my = (b.y+c.y)/2;
    const dx = mx-a.x, dy = my-a.y;
    const tEnd = dx !== 0 ? (w-a.x)/dx : 999;
    const ex = a.x + dx*tEnd, ey = a.y + dy*tEnd;
    const median = new F.Line([a.x,a.y,ex,ey], { ...LINE_DEFAULTS, stroke:"#2962FF", strokeWidth:1.5, drawingType:"pitchfork", logicalData:{a:{time:a.time,price:a.price},b:{time:b.time,price:b.price},c:{time:c.time,price:c.price},groupId} });
    const upper = new F.Line([b.x,b.y,b.x+dx*tEnd,b.y+dy*tEnd], { ...LINE_DEFAULTS, stroke:"#2962FF", strokeWidth:1, drawingType:"pitchfork-line", logicalData:{groupId,fork:"upper"} });
    const lower = new F.Line([c.x,c.y,c.x+dx*tEnd,c.y+dy*tEnd], { ...LINE_DEFAULTS, stroke:"#2962FF", strokeWidth:1, drawingType:"pitchfork-line", logicalData:{groupId,fork:"lower"} });
    this.fab.add(median); this.fab.add(upper); this.fab.add(lower);
  }

  private _removeObj(obj: FObj) {
    if (obj.logicalData?.groupId) {
      const gid = obj.logicalData.groupId;
      this.fab.getObjects().filter((o: FObj) => o.logicalData?.groupId === gid).forEach((o: FObj) => this.fab.remove(o));
    }
    this.fab.remove(obj);
  }

  // ── Sync all drawings to current viewport ───────────────────────────────────
  syncAll() {
    const chart = this.chartRef.current;
    const series = this.seriesRef.current;
    if (!chart || !series || !this.fab) return;
    const w = this.fab.getWidth(), h = this.fab.getHeight();

    this.fab.getObjects().forEach((obj: FObj) => {
      if (!obj.logicalData || obj._isPreview) return;
      const d = obj.logicalData;
      switch (obj.drawingType) {
        case "trendline":
        case "ray": {
          const x1 = timeToX(chart, d.start.time), y1 = priceToY(series, d.start.price);
          const x2 = timeToX(chart, d.end.time),   y2 = priceToY(series, d.end.price);
          if (x1!=null && y1!=null && x2!=null && y2!=null) {
            if (obj.drawingType === "ray") {
              const dx=x2-x1,dy=y2-y1; const ts: number[]=[];
              if (Math.abs(dx)>0.001){ts.push((0-x1)/dx);ts.push((w-x1)/dx);}
              if (Math.abs(dy)>0.001){ts.push((0-y1)/dy);ts.push((h-y1)/dy);}
              const maxT=Math.max(...ts.filter(t=>t>0));
              setLineCoords(obj,x1,y1,x1+dx*maxT,y1+dy*maxT);
            } else {
              setLineCoords(obj, x1, y1, x2, y2);
            }
          }
          break;
        }
        case "hline": { const y=priceToY(series,d.price); if(y!=null) setLineCoords(obj,0,y,w,y); break; }
        case "vline": { const x=timeToX(chart,d.time); if(x!=null) setLineCoords(obj,x,0,x,h); break; }
        case "rect": {
          const x1=timeToX(chart,d.start.time),y1=priceToY(series,d.start.price);
          const x2=timeToX(chart,d.end.time),  y2=priceToY(series,d.end.price);
          if(x1!=null&&y1!=null&&x2!=null&&y2!=null){obj.set({left:Math.min(x1,x2),top:Math.min(y1,y2),width:Math.max(Math.abs(x2-x1),0.001),height:Math.max(Math.abs(y2-y1),0.001)});obj.setCoords();}
          break;
        }
        case "text": { const x=timeToX(chart,d.time),y=priceToY(series,d.price); if(x!=null&&y!=null){obj.set({left:x,top:y});obj.setCoords();} break; }
        case "fib": {
          const x1=timeToX(chart,d.start.time),y1=priceToY(series,d.start.price);
          const x2=timeToX(chart,d.end.time),  y2=priceToY(series,d.end.price);
          if(x1!=null&&y1!=null&&x2!=null&&y2!=null){
            setLineCoords(obj,x1,y1,x2,y2);
            const left=Math.min(x1,x2);
            this.fab.getObjects().filter((o:FObj)=>o.drawingType==="fib-line"&&o.logicalData?.groupId===d.groupId).forEach((o:FObj)=>{
              const level=o.logicalData.level; const price=d.start.price+(d.end.price-d.start.price)*level;
              const ly=priceToY(series,price);
              if(ly==null)return;
              if(o.logicalData.isLabel){o.set({left:left+4,top:ly-13});o.setCoords();}
              else setLineCoords(o,left,ly,w,ly);
            });
          }
          break;
        }
        case "pitchfork": {
          const ld=d; const ax=timeToX(chart,ld.a.time),ay=priceToY(series,ld.a.price);
          const bx=timeToX(chart,ld.b.time),by=priceToY(series,ld.b.price);
          const cx=timeToX(chart,ld.c.time),cy=priceToY(series,ld.c.price);
          if(ax!=null&&ay!=null&&bx!=null&&by!=null&&cx!=null&&cy!=null){
            const mx=(bx+cx)/2,my=(by+cy)/2; const dx=mx-ax,dy=my-ay;
            const t=dx!==0?(w-ax)/dx:999; const ex=ax+dx*t,ey=ay+dy*t;
            setLineCoords(obj,ax,ay,ex,ey);
            this.fab.getObjects().filter((o:FObj)=>o.drawingType==="pitchfork-line"&&o.logicalData?.groupId===ld.groupId).forEach((o:FObj)=>{
              const [px,py]=o.logicalData.fork==="upper"?[bx,by]:[cx,cy];
              setLineCoords(o,px,py,px+dx*t,py+dy*t);
            });
          }
          break;
        }
      }
    });
    this.fab.requestRenderAll();
  }

  // ── Persistence ─────────────────────────────────────────────────────────────
  private _storageKey() { return `tv_drawings_${this.symbol}`; }

  private _serialize(): object[] {
    return this.fab.getObjects()
      .filter((o:FObj) => o.logicalData && !o._isPreview && o.drawingType !== "fib-line" && o.drawingType !== "pitchfork-line")
      .map((o:FObj) => ({ drawingType: o.drawingType, logicalData: o.logicalData, stroke: o.stroke, strokeWidth: o.strokeWidth }));
  }

  private _load() {
    try {
      const raw = localStorage.getItem(this._storageKey());
      if (!raw) return;
      const data = JSON.parse(raw) as Array<{drawingType:string;logicalData:any;stroke:string;strokeWidth:number}>;
      data.forEach(d => this._restoreOne(d));
      this.syncAll();
    } catch { /* ignore */ }
  }

  private _restoreOne(d: {drawingType:string;logicalData:any;stroke:string;strokeWidth:number}) {
    const ld = d.logicalData;
    switch (d.drawingType) {
      case "trendline": case "ray": this._makeTrendLine(ld.start.time, ld.start.price, ld.end.time, ld.end.price, d.drawingType); break;
      case "hline": this._makeHLine(ld.price); break;
      case "vline": this._makeVLine(ld.time); break;
      case "rect":  this._makeRect(ld.start.time, ld.start.price, ld.end.time, ld.end.price); break;
      case "text":  { const px=this._toPixel(ld.time,ld.price); this._makeText(px?.x??100,px?.y??100,ld.time,ld.price,ld.text); break; }
      case "fib":   this._makeFib(ld.start.time, ld.start.price, ld.end.time, ld.end.price); break;
    }
  }

  private _save() {
    try { localStorage.setItem(this._storageKey(), JSON.stringify(this._serialize())); } catch { /* ignore */ }
  }

  private _finalize() {
    this._pushUndo();
    this._save();
  }

  // ── Undo / Redo ─────────────────────────────────────────────────────────────
  private _pushUndo() {
    this.undoStack.push(JSON.stringify(this._serialize()));
    if (this.undoStack.length > 50) this.undoStack.shift();
    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length < 2) { if (this.undoStack.length===1){this.redoStack.push(this.undoStack.pop()!);this._restore([]);} return; }
    this.redoStack.push(this.undoStack.pop()!);
    this._restore(JSON.parse(this.undoStack[this.undoStack.length-1]));
    this._save();
  }
  redo() {
    if (!this.redoStack.length) return;
    const next = this.redoStack.pop()!;
    this.undoStack.push(next);
    this._restore(JSON.parse(next));
    this._save();
  }

  private _restore(data: Array<{drawingType:string;logicalData:any;stroke:string;strokeWidth:number}>) {
    this.fab.getObjects().slice().forEach((o:FObj)=>this.fab.remove(o));
    data.forEach(d => this._restoreOne(d));
    this.syncAll();
  }

  clear() {
    this.fab.getObjects().slice().forEach((o:FObj)=>this.fab.remove(o));
    this.fab.requestRenderAll();
    this._finalize();
  }

  destroy() {
    this._cancelDrawing();
    this._unsubs.forEach(fn => fn());
    this._ro.disconnect();
    const { down, move, up, key } = this._mouseBound;
    this.container.removeEventListener("mousedown", down);
    this.container.removeEventListener("mousemove", move);
    this.container.removeEventListener("mouseup", up);
    document.removeEventListener("keydown", key);
    try { this.fab.dispose(); } catch { /* ignore */ }
  }
}

// ── React component ───────────────────────────────────────────────────────────
export function DrawingLayer({ chartRef, seriesRef, containerRef, activeTool, symbol, onHandleReady }: Props) {
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<DrawingController | null>(null);
  const prevToolRef   = useRef(activeTool);

  // Init controller when chart is ready
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;
    let ctrl: DrawingController | null = null;

    // We need the chart to be initialized — poll briefly
    let tries = 0;
    const tryInit = () => {
      if (!chartRef.current || !seriesRef.current) {
        if (++tries < 50) { setTimeout(tryInit, 200); return; }
        return;
      }
      const F = (window as any).fabric;
      const container = containerRef.current!;
      const canvas = new F.Canvas(canvasRef.current!, {
        selection: false, renderOnAddRemove: false, skipTargetFind: true, preserveObjectStacking: true,
      });
      canvas.setWidth(container.clientWidth);
      canvas.setHeight(container.clientHeight);

      ctrl = new DrawingController(canvas, container, chartRef, seriesRef, symbol);
      controllerRef.current = ctrl;
      ctrl.setTool(prevToolRef.current);
      onHandleReady?.({
        setTool: (t) => ctrl!.setTool(t),
        undo: () => ctrl!.undo(),
        redo: () => ctrl!.redo(),
        clear: () => ctrl!.clear(),
      });
    };

    ensureFabric().then(tryInit);

    return () => {
      ctrl?.destroy();
      controllerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]); // Re-init on symbol change (different drawing set)

  // Tool changes — just update controller
  useEffect(() => {
    prevToolRef.current = activeTool;
    controllerRef.current?.setTool(activeTool);
  }, [activeTool]);

  // Expose handle when it arrives
  const syncHandle = useCallback(() => {
    const ctrl = controllerRef.current;
    if (ctrl) {
      onHandleReady?.({
        setTool: (t) => ctrl.setTool(t),
        undo:  () => ctrl.undo(),
        redo:  () => ctrl.redo(),
        clear: () => ctrl.clear(),
      });
    }
  }, [onHandleReady]);
  useEffect(() => { syncHandle(); }, [syncHandle]);

  // The canvas element itself — Fabric creates an upper-canvas sibling automatically
  return (
    <canvas
      ref={canvasRef}
      id={`drawing-canvas-${symbol}`}
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 15 }}
    />
  );
}
