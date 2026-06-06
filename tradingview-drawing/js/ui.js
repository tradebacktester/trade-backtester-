// ── Toolbar DOM + events ──────────────────────────────────────────────────────
import { getMagnet, setMagnet } from './tools.js';
import { undo, redo } from './storage.js';

const TOOLS = [
  { name: 'cursor',    label: 'Cursor (V)',          group: 1, svg: `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 2.5L15.5 9.5L10.5 10.5L8 16L5 2.5Z" fill="currentColor"/></svg>` },
  { name: 'trendline', label: 'Trend Line',          group: 2, svg: `<svg viewBox="0 0 20 20" fill="none"><line x1="3" y1="16" x2="17" y2="4" stroke="currentColor" stroke-width="1.5"/><circle cx="3" cy="16" r="2" fill="currentColor"/><circle cx="17" cy="4" r="2" fill="currentColor"/></svg>` },
  { name: 'ray',       label: 'Ray',                 group: 2, svg: `<svg viewBox="0 0 20 20" fill="none"><line x1="3" y1="16" x2="17" y2="4" stroke="currentColor" stroke-width="1.5" stroke-dasharray="1 2"/><circle cx="3" cy="16" r="2" fill="currentColor"/></svg>` },
  { name: 'hline',     label: 'Horizontal Line',     group: 2, svg: `<svg viewBox="0 0 20 20" fill="none"><line x1="2" y1="10" x2="18" y2="10" stroke="currentColor" stroke-width="1.5"/><circle cx="2" cy="10" r="1.8" fill="currentColor"/><circle cx="18" cy="10" r="1.8" fill="currentColor"/></svg>` },
  { name: 'vline',     label: 'Vertical Line',       group: 2, svg: `<svg viewBox="0 0 20 20" fill="none"><line x1="10" y1="2" x2="10" y2="18" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="2" r="1.8" fill="currentColor"/><circle cx="10" cy="18" r="1.8" fill="currentColor"/></svg>` },
  { name: 'rect',      label: 'Rectangle',           group: 3, svg: `<svg viewBox="0 0 20 20" fill="none"><rect x="3" y="5" width="14" height="10" stroke="currentColor" stroke-width="1.5"/></svg>` },
  { name: 'text',      label: 'Text',                group: 3, svg: `<svg viewBox="0 0 20 20" fill="none"><text x="10" y="15" text-anchor="middle" font-size="15" font-weight="bold" fill="currentColor" font-family="Georgia,serif">T</text></svg>` },
  { name: 'fib',       label: 'Fibonacci Retracement',group: 4, svg: `<svg viewBox="0 0 20 20" fill="none"><line x1="2" y1="4" x2="18" y2="4" stroke="currentColor" stroke-width="1"/><line x1="2" y1="8" x2="18" y2="8" stroke="#26a69a" stroke-width="1"/><line x1="2" y1="11" x2="18" y2="11" stroke="#2962FF" stroke-width="1"/><line x1="2" y1="14" x2="18" y2="14" stroke="#ff9800" stroke-width="1"/><line x1="2" y1="17" x2="18" y2="17" stroke="currentColor" stroke-width="1"/><line x1="4" y1="2" x2="4" y2="19" stroke="currentColor" stroke-width="1.5"/></svg>` },
  { name: 'pitchfork', label: 'Pitchfork',           group: 4, svg: `<svg viewBox="0 0 20 20" fill="none"><path d="M4 16 L10 4 L16 16" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="4" y1="16" x2="1" y2="19" stroke="currentColor" stroke-width="1.5"/><line x1="16" y1="16" x2="19" y2="19" stroke="currentColor" stroke-width="1.5"/></svg>` },
];

export function initUI(toolManager) {
  const toolbar = document.getElementById('toolbar');
  if (!toolbar) return;

  let lastGroup = -1;

  TOOLS.forEach(({ name, label, group, svg }) => {
    if (group !== lastGroup && lastGroup !== -1) {
      toolbar.appendChild(mkSep());
    }
    lastGroup = group;

    const btn = document.createElement('button');
    btn.className   = 'tool-btn';
    btn.dataset.tool = name;
    btn.title       = label;
    btn.innerHTML   = svg;
    if (name === 'cursor') btn.classList.add('active');

    btn.addEventListener('click', () => toolManager.setTool(name));
    btn.addEventListener('mouseenter', (e) => showTooltip(e, label));
    btn.addEventListener('mouseleave', hideTooltip);

    toolbar.appendChild(btn);
  });

  // ── Undo/redo buttons (top-right of chart) ──────────────────────────────────
  const undoRedo = document.createElement('div');
  undoRedo.id = 'undo-redo';

  const btnUndo = _mkIconBtn('btn-undo', 'Undo (Ctrl+Z)', `<svg viewBox="0 0 20 20" fill="none"><path d="M4 9H13a4 4 0 010 8H8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M7 6L4 9l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
  const btnRedo = _mkIconBtn('btn-redo', 'Redo (Ctrl+Y)', `<svg viewBox="0 0 20 20" fill="none"><path d="M16 9H7a4 4 0 000 8h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M13 6l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`);

  btnUndo.disabled = true;
  btnRedo.disabled = true;
  btnUndo.addEventListener('click', undo);
  btnRedo.addEventListener('click', redo);

  undoRedo.appendChild(btnUndo);
  undoRedo.appendChild(btnRedo);
  document.getElementById('chart-wrapper').appendChild(undoRedo);

  // ── Magnet button ────────────────────────────────────────────────────────────
  const magnetBtn = document.createElement('button');
  magnetBtn.id = 'magnet-btn';
  magnetBtn.title = 'Magnet snap to OHLC';
  magnetBtn.innerHTML = `<svg viewBox="0 0 20 20" fill="none"><path d="M5 4h3v7a2 2 0 004 0V4h3V11a5 5 0 01-10 0V4z" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="5" y="2" width="3" height="3" rx="0.5" fill="currentColor"/><rect x="12" y="2" width="3" height="3" rx="0.5" fill="currentColor"/></svg>`;
  magnetBtn.addEventListener('click', () => {
    const on = !getMagnet();
    setMagnet(on);
    magnetBtn.classList.toggle('active', on);
  });
  document.getElementById('chart-wrapper').appendChild(magnetBtn);

  // ── Crosshair-move status bar ────────────────────────────────────────────────
  _buildStatusBar();

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
    // tool shortcuts
    const shortcuts = { v: 'cursor', t: 'trendline', h: 'hline', r: 'rect', f: 'fib' };
    if (!e.ctrlKey && !e.metaKey && shortcuts[e.key.toLowerCase()]) {
      toolManager.setTool(shortcuts[e.key.toLowerCase()]);
    }
  });
}

function _buildStatusBar() {
  const bar = document.createElement('div');
  bar.id = 'statusbar';
  bar.innerHTML = `
    <span id="sb-tool">CURSOR</span>
    <span id="sb-price">—</span>
    <span id="sb-time">—</span>
    <span style="margin-left:auto;color:#2A2E39">BTC/USDT · 1H</span>
  `;
  document.getElementById('chart-wrapper').appendChild(bar);
}

export function updateStatusBar(toolName, price, time) {
  const t = document.getElementById('sb-tool');
  const p = document.getElementById('sb-price');
  const tm = document.getElementById('sb-time');
  if (t)  t.textContent  = toolName?.toUpperCase() || '—';
  if (p)  p.textContent  = price != null ? `$${price.toFixed(2)}` : '—';
  if (tm) tm.textContent = time  ? new Date(time * 1000).toISOString().slice(0,16).replace('T', ' ') : '—';
}

// ── Tooltip ──────────────────────────────────────────────────────────────────
const _tip = (() => {
  const el = document.createElement('div');
  el.id = 'tooltip';
  document.body.appendChild(el);
  return el;
})();

function showTooltip(e, label) {
  _tip.textContent = label;
  const r = e.currentTarget.getBoundingClientRect();
  _tip.style.left = `${r.right + 8}px`;
  _tip.style.top  = `${r.top + r.height / 2 - 10}px`;
  _tip.classList.add('visible');
}
function hideTooltip() { _tip.classList.remove('visible'); }

function mkSep() {
  const s = document.createElement('div');
  s.className = 'tb-sep';
  return s;
}
function _mkIconBtn(id, title, svg) {
  const b = document.createElement('button');
  b.id = id; b.className = 'ur-btn'; b.title = title; b.innerHTML = svg;
  return b;
}
