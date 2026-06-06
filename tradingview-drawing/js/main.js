// ── App bootstrap — init order matters ───────────────────────────────────────
import { initChart, getCandleData, getChart, getSeries, xToTime, yToPrice } from './chart.js';
import { initDrawingLayer, syncAllDrawings, serializeDrawings, deserializeDrawings, getFabricCanvas } from './drawingLayer.js';
import { ToolManager } from './tools.js';
import { initStorage, loadDrawings, saveDrawings, pushUndoState } from './storage.js';
import { initUI, updateStatusBar } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
  const chartContainer = document.getElementById('chart-container');
  const chartWrapper   = document.getElementById('chart-wrapper');

  // ── 1. Init LWC chart ────────────────────────────────────────────────────────
  const { chart, series } = initChart(chartContainer);

  // ── 2. Init Fabric drawing layer (subscribes to chart sync automatically) ────
  const fab = initDrawingLayer(chartWrapper);

  // ── 3. Init storage with load/save callbacks ─────────────────────────────────
  initStorage(
    (data) => { /* onSave — already debounced, nothing extra needed */ },
    (data) => { deserializeDrawings(data); }   // onLoad
  );

  // ── 4. Init tool manager ──────────────────────────────────────────────────────
  const toolManager = new ToolManager(chartWrapper);

  // ── 5. Init toolbar UI ────────────────────────────────────────────────────────
  initUI(toolManager);

  // ── 6. Load saved drawings (after chart + fabric are ready) ──────────────────
  // Must wait a frame so that LWC coordinate functions are initialized
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      loadDrawings();
      // Seed undo with empty state if nothing loaded
      const fab2 = getFabricCanvas();
      if (fab2 && fab2.getObjects().length === 0) {
        pushUndoState([]);
      }
    });
  });

  // ── 7. Crosshair → status bar ─────────────────────────────────────────────────
  chart.subscribeCrosshairMove(param => {
    if (!param || !param.point) return;
    const price = yToPrice(param.point.y);
    const time  = xToTime(param.point.x);
    updateStatusBar(toolManager.activeTool, price, time);
  });

  // ── 8. Fabric object:modified → auto save ────────────────────────────────────
  fab.on('object:modified', () => {
    const data = serializeDrawings();
    pushUndoState(data);
    saveDrawings(data);
    syncAllDrawings();
  });

  fab.on('object:removed', () => {
    saveDrawings(serializeDrawings());
  });

  // ── 9. Dev helper: expose globals for console debugging ───────────────────────
  window._tv = { chart, series, fab, toolManager, syncAllDrawings, serializeDrawings };
});
