// ── localStorage persistence + undo/redo stack ────────────────────────────────
import { debounce } from './utils.js';

const STORAGE_KEY = 'tv_drawings_v1';
const MAX_UNDO    = 50;

let _undoStack = [];  // array of serialized-state JSON strings
let _redoStack = [];

let _onSaveCallback = null;  // called with serialized array after save
let _onLoadCallback = null;  // called with array, restores drawings

export function initStorage(onSave, onLoad) {
  _onSaveCallback = onSave;
  _onLoadCallback = onLoad;
}

/** Push current state to undo stack (call BEFORE making a change for redo purposes,
 *  or AFTER for a simpler "redo current" pattern — we do AFTER). */
export function pushUndoState(serialized) {
  _undoStack.push(JSON.stringify(serialized));
  if (_undoStack.length > MAX_UNDO) _undoStack.shift();
  _redoStack = []; // new action clears redo
  _updateButtons();
}

export function undo() {
  if (_undoStack.length < 2) {
    // restore to empty
    if (_undoStack.length === 1) {
      _redoStack.push(_undoStack.pop());
      _onLoadCallback([]);
      _updateButtons();
    }
    return;
  }
  _redoStack.push(_undoStack.pop()); // move current to redo
  const prev = JSON.parse(_undoStack[_undoStack.length - 1]);
  _onLoadCallback(prev);
  saveRaw(prev);
  _updateButtons();
}

export function redo() {
  if (!_redoStack.length) return;
  const next = JSON.parse(_redoStack.pop());
  _undoStack.push(JSON.stringify(next));
  _onLoadCallback(next);
  saveRaw(next);
  _updateButtons();
}

/** Debounced save — called by drawing operations */
export const saveDrawings = debounce((serialized) => {
  saveRaw(serialized);
}, 500);

function saveRaw(serialized) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch (e) {
    console.warn('LocalStorage save failed', e);
  }
}

/** Load drawings from localStorage and restore them */
export function loadDrawings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return;
    if (_onLoadCallback) {
      _onLoadCallback(data);
      // seed undo stack with initial state
      _undoStack = [JSON.stringify(data)];
      _redoStack = [];
      _updateButtons();
    }
  } catch (e) {
    console.warn('LocalStorage load failed', e);
  }
}

function _updateButtons() {
  const u = document.getElementById('btn-undo');
  const r = document.getElementById('btn-redo');
  if (u) u.disabled = _undoStack.length < 2;
  if (r) r.disabled = _redoStack.length === 0;
}
