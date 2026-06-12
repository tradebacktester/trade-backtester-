import React, { useState } from "react";
import {
  Plus, Trash2, Hash, Loader2, Sparkles, FileText,
  Save, X, BookOpen, ArrowLeft,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";
import type { AcademyNote } from "./types";

const ACCENT = "#22D3EE";
const BORDER = "#262626";
const CARD = "#171717";
const TEXT = "#A1A1AA";
const DANGER = "#EF4444";

const AI_OPS = [
  { id: "summarize", label: "Summarize" },
  { id: "flashcards", label: "Flashcards" },
  { id: "revision", label: "Revision" },
  { id: "takeaways", label: "Takeaways" },
];

const SUGGESTED_TAGS = ["#RiskManagement", "#ICT", "#Psychology", "#PriceAction", "#SMC", "#Candlesticks", "#OrderBlocks", "#FVG", "#Liquidity"];

type View = "list" | "editor";

export function NotesTab({
  notes: initialNotes,
  onNotesChange,
}: {
  notes: AcademyNote[];
  onNotesChange: (notes: AcademyNote[]) => void;
}) {
  const { token } = useAuth();
  const [notes, setNotes] = useState<AcademyNote[]>(initialNotes ?? []);
  const [view, setView] = useState<View>("list");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [aiOp, setAiOp] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);

  React.useEffect(() => { setNotes(initialNotes ?? []); }, [initialNotes]);

  const selectedNote = notes.find(n => n.id === selectedId) ?? null;

  function openNote(note: AcademyNote) {
    setSelectedId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditTags(note.tags ?? []);
    setDirty(false);
    setAiResult(null);
    setView("editor");
  }

  function backToList() {
    if (dirty) void saveNote();
    setView("list");
    setSelectedId(null);
  }

  async function createNote() {
    try {
      const r = await fetch(`${API_BASE}/api/academy/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: "New Note", content: "", tags: [] }),
      });
      const note = await r.json() as AcademyNote;
      const updated = [note, ...notes];
      setNotes(updated);
      onNotesChange(updated);
      openNote(note);
    } catch { }
  }

  async function saveNote() {
    if (!selectedNote || !dirty) return;
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/academy/notes/${selectedNote.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: editTitle, content: editContent, tags: editTags }),
      });
      const updated = await r.json() as AcademyNote;
      const newNotes = notes.map(n => n.id === updated.id ? updated : n);
      setNotes(newNotes);
      onNotesChange(newNotes);
      setDirty(false);
    } catch { }
    setSaving(false);
  }

  async function deleteNote(id: number) {
    try {
      await fetch(`${API_BASE}/api/academy/notes/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const newNotes = notes.filter(n => n.id !== id);
      setNotes(newNotes);
      onNotesChange(newNotes);
      if (selectedId === id) { setSelectedId(null); setView("list"); }
    } catch { }
  }

  async function runAiOp(op: string) {
    if (!selectedNote) return;
    setAiLoading(true);
    setAiResult(null);
    setAiOp(op);
    try {
      const r = await fetch(`${API_BASE}/api/academy/notes/${selectedNote.id}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ operation: op }),
      });
      const data = await r.json();
      setAiResult(data.result ?? "");
    } catch { setAiResult("AI operation failed. Please try again."); }
    setAiLoading(false);
  }

  function addTag(t: string) {
    const tag = t.startsWith("#") ? t : `#${t}`;
    if (!editTags.includes(tag)) { setEditTags([...editTags, tag]); setDirty(true); }
    setTagInput("");
  }

  /* ── LIST VIEW ── */
  if (view === "list") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <button
          onClick={createNote}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "7px",
            padding: "13px", borderRadius: "12px", fontSize: "14px", fontWeight: 700,
            cursor: "pointer", background: "#111", border: "1px solid #FFFFFF", color: "#FFFFFF",
            width: "100%",
          }}
        >
          <Plus style={{ height: "14px", width: "14px" }} /> New Note
        </button>

        {notes.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: TEXT }}>
            <FileText style={{ height: "36px", width: "36px", margin: "0 auto 12px", opacity: 0.3 }} />
            <div style={{ fontSize: "16px", fontWeight: 600, color: "#FFFFFF", marginBottom: "6px" }}>No notes yet</div>
            <div style={{ fontSize: "13px" }}>Create your first note to start capturing insights.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {notes.map(note => (
              <div
                key={note.id}
                onClick={() => openNote(note)}
                style={{
                  background: CARD, border: `1px solid ${BORDER}`, borderRadius: "12px",
                  padding: "14px 16px", cursor: "pointer", transition: "border-color 0.12s",
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "#3a3a3a"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = BORDER}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {note.title || "Untitled"}
                    </div>
                    <div style={{ fontSize: "12px", color: TEXT, marginBottom: "8px", lineHeight: "1.5", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {note.content || "Empty note…"}
                    </div>
                    {(note.tags ?? []).length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "6px" }}>
                        {note.tags.slice(0, 4).map(t => (
                          <span key={t} style={{ fontSize: "11px", padding: "2px 7px", borderRadius: "5px", background: "#111", border: `1px solid ${BORDER}`, color: TEXT }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    <div style={{ fontSize: "11px", color: TEXT, opacity: 0.6 }}>
                      {new Date(note.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); deleteNote(note.id); }}
                    style={{ padding: "6px", borderRadius: "6px", background: "none", border: "none", cursor: "pointer", color: TEXT, flexShrink: 0 }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = DANGER}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = TEXT}
                  >
                    <Trash2 style={{ height: "14px", width: "14px" }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ── EDITOR VIEW ── */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* Editor header */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button onClick={backToList} style={{
          display: "flex", alignItems: "center", gap: "5px", padding: "8px 12px",
          borderRadius: "8px", background: "transparent", border: `1px solid ${BORDER}`,
          cursor: "pointer", color: TEXT, fontSize: "13px",
        }}>
          <ArrowLeft style={{ height: "12px", width: "12px" }} /> Notes
        </button>
        <div style={{ flex: 1 }} />
        {dirty && <span style={{ fontSize: "11px", color: TEXT }}>Unsaved</span>}
        <button
          onClick={saveNote} disabled={!dirty || saving}
          style={{
            display: "flex", alignItems: "center", gap: "5px", padding: "8px 14px",
            borderRadius: "8px", fontSize: "13px", fontWeight: 700,
            cursor: dirty ? "pointer" : "default",
            background: dirty ? "#111" : "transparent",
            border: `1px solid ${dirty ? "#FFFFFF" : BORDER}`,
            color: dirty ? "#FFFFFF" : TEXT, opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? <Loader2 style={{ height: "12px", width: "12px", animation: "spin 1s linear infinite" }} /> : <Save style={{ height: "12px", width: "12px" }} />}
          Save
        </button>
      </div>

      {/* Title */}
      <input
        value={editTitle}
        onChange={e => { setEditTitle(e.target.value); setDirty(true); }}
        placeholder="Note title…"
        style={{
          padding: "12px 14px", borderRadius: "10px", fontSize: "18px", fontWeight: 700,
          background: CARD, border: `1px solid ${BORDER}`, color: "#FFFFFF", outline: "none", width: "100%", boxSizing: "border-box",
        }}
      />

      {/* Tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", alignItems: "center", padding: "8px 12px", background: CARD, border: `1px solid ${BORDER}`, borderRadius: "10px" }}>
        {editTags.map(t => (
          <span key={t} style={{
            display: "flex", alignItems: "center", gap: "3px", fontSize: "12px",
            padding: "3px 8px", borderRadius: "6px", background: "#111", border: `1px solid ${BORDER}`, color: TEXT,
          }}>
            {t}
            <button onClick={() => { setEditTags(editTags.filter(x => x !== t)); setDirty(true); }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: TEXT, display: "flex" }}>
              <X style={{ height: "10px", width: "10px" }} />
            </button>
          </span>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
          <Hash style={{ height: "11px", width: "11px", color: TEXT }} />
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && tagInput.trim()) addTag(tagInput.trim()); }}
            placeholder="Add tag"
            style={{ background: "none", border: "none", outline: "none", fontSize: "12px", color: TEXT, width: "60px" }}
          />
        </div>
      </div>

      {/* Suggested tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
        {SUGGESTED_TAGS.filter(t => !editTags.includes(t)).slice(0, 5).map(t => (
          <button key={t} onClick={() => addTag(t)} style={{
            fontSize: "11px", padding: "3px 8px", borderRadius: "6px",
            background: "transparent", border: `1px solid ${BORDER}`, cursor: "pointer", color: TEXT,
          }}>
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <textarea
        value={editContent}
        onChange={e => { setEditContent(e.target.value); setDirty(true); }}
        placeholder="Start writing your notes… Use # headers, **bold**, - lists"
        style={{
          minHeight: "280px", padding: "14px", borderRadius: "10px", fontSize: "15px",
          background: CARD, border: `1px solid ${BORDER}`, color: "#FFFFFF",
          outline: "none", resize: "vertical", lineHeight: "1.7", fontFamily: "inherit", boxSizing: "border-box", width: "100%",
        }}
      />

      {/* AI Panel toggle */}
      <button
        onClick={() => setShowAiPanel(s => !s)}
        style={{
          display: "flex", alignItems: "center", gap: "6px", padding: "10px 14px",
          borderRadius: "10px", fontSize: "13px", fontWeight: 600, cursor: "pointer",
          background: showAiPanel ? "#111" : "transparent",
          border: `1px solid ${showAiPanel ? ACCENT : BORDER}`,
          color: showAiPanel ? ACCENT : TEXT, width: "100%", justifyContent: "center",
        }}
      >
        <Sparkles style={{ height: "12px", width: "12px" }} />
        {showAiPanel ? "Hide" : "Open"} Smart AI
      </button>

      {showAiPanel && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "14px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: TEXT, marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            AI Operations
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px", marginBottom: "10px" }}>
            {AI_OPS.map(op => (
              <button
                key={op.id}
                onClick={() => runAiOp(op.id)}
                disabled={aiLoading}
                style={{
                  padding: "9px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
                  cursor: "pointer",
                  background: aiOp === op.id ? "#111" : "transparent",
                  border: `1px solid ${aiOp === op.id ? ACCENT : BORDER}`,
                  color: aiOp === op.id ? ACCENT : TEXT,
                }}
              >
                {op.label}
              </button>
            ))}
          </div>
          {aiLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "12px", color: TEXT, padding: "8px 0" }}>
              <Loader2 style={{ height: "13px", width: "13px", animation: "spin 1s linear infinite" }} /> Generating…
            </div>
          )}
          {aiResult && !aiLoading && (
            <div style={{
              background: "#0f0f0f", borderRadius: "8px", padding: "12px 14px",
              fontSize: "13px", color: "#FFFFFF", lineHeight: "1.65",
              maxHeight: "200px", overflow: "auto", whiteSpace: "pre-wrap",
              border: `1px solid ${BORDER}`,
            }}>
              {aiResult}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
