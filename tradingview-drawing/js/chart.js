// ── Lightweight Charts instance + coordinate bridge ─────────────────────────
import { CANDLE_DATA } from '../data/mockData.js';

let _chart  = null;
let _series = null;
const _syncSubs = [];

export function initChart(container) {
  _chart = LightweightCharts.createChart(container, {
    width:  container.clientWidth,
    height: container.clientHeight,
    layout: {
      background: { color: '#131722' },
      textColor:  '#D9D9D9',
    },
    grid: {
      vertLines: { color: '#2B2B43' },
      horzLines: { color: '#2B2B43' },
    },
    crosshair: { mode: 0 },
    timeScale: {
      timeVisible:    true,
      secondsVisible: false,
      borderColor:    '#2B2B43',
    },
    rightPriceScale: { borderColor: '#2B2B43' },
    handleScroll:    true,
    handleScale:     true,
  });

  _series = _chart.addCandlestickSeries({
    upColor:       '#26a69a',
    downColor:     '#ef5350',
    borderVisible: false,
    wickUpColor:   '#26a69a',
    wickDownColor: '#ef5350',
  });

  _series.setData(CANDLE_DATA);
  _chart.timeScale().fitContent();

  // ── Subscribe to ALL viewport changes ──────────────────────────────────────
  _chart.timeScale().subscribeVisibleTimeRangeChange(_notify);
  _chart.timeScale().subscribeVisibleLogicalRangeChange(_notify);

  // Also catch autoscale price changes via a price-scale subscription
  _series.priceScale().applyOptions({});   // wake the price scale
  // Lightweight Charts doesn't have a direct price-scale-change subscription,
  // but visibleLogicalRangeChange fires on zoom which also changes Y.
  // We additionally hook into chart's subscribeCrosshairMove to catch
  // pinch-zoom autoscale events (fires during gesture scroll).
  _chart.subscribeCrosshairMove(_notify);

  return { chart: _chart, series: _series };
}

/** Subscribe a sync callback — called on every viewport change */
export function subscribeSync(fn) { _syncSubs.push(fn); }
export function unsubscribeSync(fn) {
  const i = _syncSubs.indexOf(fn);
  if (i !== -1) _syncSubs.splice(i, 1);
}

function _notify() { _syncSubs.forEach(fn => fn()); }

// ── Coordinate transforms (safe — return null when out of range) ─────────────

/** Unix-time → canvas X pixel (null if outside visible range) */
export function timeToX(time) {
  if (!_chart) return null;
  return _chart.timeScale().timeToCoordinate(time);
}

/** Canvas X pixel → Unix-time (null if outside) */
export function xToTime(x) {
  if (!_chart) return null;
  return _chart.timeScale().coordinateToTime(x);
}

/** Price → canvas Y pixel (null if no series) */
export function priceToY(price) {
  if (!_series) return null;
  return _series.priceToCoordinate(price);
}

/** Canvas Y pixel → price */
export function yToPrice(y) {
  if (!_series) return null;
  return _series.coordinateToPrice(y);
}

// ── Accessors ────────────────────────────────────────────────────────────────
export function getChart()      { return _chart; }
export function getSeries()     { return _series; }
export function getCandleData() { return CANDLE_DATA; }

/** Resize chart to match container */
export function resizeChart(w, h) {
  if (!_chart) return;
  _chart.applyOptions({ width: w, height: h });
}
