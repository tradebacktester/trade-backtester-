import React, { useState } from "react";
import {
  Plus, Trash2, Hash, Loader2, Sparkles, FileText,
  Save, X, BookOpen,
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
  { id: "summarize", label: "Summarize", desc: "Key bullet points" },
  { id: "flashcards", label: "Flashcards", desc: "Q&A format" },
  { id: "revision", label: "Revision Sheet", desc: "One-page summary" },
  { id: "takeaways", label: "Key Takeaways", desc: "Top 5 lessons" },
];

const SUGGESTED_TAGS = ["#RiskManagement", "#ICT", "#Psychology", "#PriceAction", "#SMC", "#Candlesticks", "#OrderBlocks", "#FVG", "#Liquidity"];

function NoteCard({ note, selected, onSelect, onDelete }: {
  note: AcademyNote; selected: boolean; onSelect: () => void; onDelete: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        padding: "10px 12px", borderRadius: "8px", cursor: "pointer",
        background: selected ? "#111111" : "transparent",
        border: `1px solid ${selected ? "#333" : BORDER}`,
        transition: "all 0.12s",
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = "#0d0d0d"; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "6px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: "12px", fontWeight: 600,
            color: selected ? "#FFFFFF" : TEXT,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            marginBottom: "3px",
          }}>
            {note.title || "Untitled"}
          </div>
          <div style={{ fontSize: "11px", color: TEXT, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {note.content || "Empty note…"}
          </div>
          {note.tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", marginTop: "5px" }}>
              {note.tags.slice(0, 3).map(t => (
                <span key={t} style={{ fontSize: "10px", padding: "1px 5px", borderRadius: "4px", background: "#111111", border: `1px solid ${BORDER}`, color: TEXT }}>
                  {t}
                </span>
              ))}
              {note.tags.length > 3 && <span style={{ fontSize: "10px", color: TEXT }}>+{note.tags.length - 3}</span>}
            </div>
          )}
          <div style={{ fontSize: "10px", color: TEXT, marginTop: "5px", opacity: 0.7 }}>
            {new Date(note.updatedAt).toLocaleDateString()}
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{ padding: "4px", borderRadius: "4px", background: "none", border: "none", cursor: "pointer", color: TEXT, flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = DANGER}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = TEXT}
        >
          <Trash2 style={{ height: "11px", width: "11px" }} />
        </button>
      </div>
    </div>
  );
}

export function NotesTab({
  notes: initialNotes,
  onNotesChange,
}: {
  notes: AcademyNote[];
  onNotesChange: (notes: AcademyNote[]) => void;
}) {
  const { token } = useAuth();
  const [notes, setNotes] = useState<AcademyNote[]>(initialNotes);
  const [selectedId, setSelectedId] = useState<number | null>(initialNotes[0]?.id ?? null);
  const [editTitle, setEditTitle] = useState(initialNotes[0]?.title ?? "");
  const [editContent, setEditContent] = useState(initialNotes[0]?.content ?? "");
  const [editTags, setEditTags] = useState<string[]>(initialNotes[0]?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [aiOp, setAiOp] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);

  React.useEffect(() => { setNotes(initialNotes); }, [initialNotes]);

  const selectedNote = notes.find(n => n.id === selectedId) ?? null;

  React.useEffect(() => {
    if (selectedNote) {
      setEditTitle(selectedNote.title);
      setEditContent(selectedNote.content);
      setEditTags(selectedNote.tags);
      setDirty(false);
      setAiResult(null);
    }
  }, [selectedId]);

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
      setSelectedId(note.id);
      setEditTitle("New Note");
      setEditContent("");
      setEditTags([]);
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
      if (selectedId === id) setSelectedId(newNotes[0]?.id ?? null);
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
    } catch {
      setAiResult("AI operation failed. Please try again.");
    }
    setAiLoading(false);
  }

  function addTag(t: string) {
    const tag = t.startsWith("#") ? t : `#${t}`;
    if (!editTags.includes(tag)) {
      setEditTags([...editTags, tag]);
      setDirty(true);
    }
    setTagInput("");
  }

  return (
    <div style={{ display: "flex", gap: "14px", height: "calc(100vh - 220px)", minHeight: "480px" }}>
      {/* Sidebar */}
      <div style={{ width: "220px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
        <button
          onClick={createNote}
          style={{
            display: "flex", alignItems: "center", gap: "6px", padding: "8px 12px",
            borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
            background: "#111111", border: "1px solid #FFFFFF",
            color: "#FFFFFF", transition: "background 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#1a1a1a")}
          onMouseLeave={e => (e.currentTarget.style.background = "#111111")}
        >
          <Plus style={{ height: "12px", width: "12px" }} /> New Note
        </button>

        <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
          {notes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 8px", color: TEXT, fontSize: "12px" }}>
              <FileText style={{ height: "24px", width: "24px", margin: "0 auto 8px", opacity: 0.3 }} />
              No notes yet
            </div>
          ) : (
            notes.map(n => (
              <NoteCard
                key={n.id} note={n}
                selected={n.id === selectedId}
                onSelect={() => { if (dirty) void saveNote(); setSelectedId(n.id); }}
                onDelete={() => deleteNote(n.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Editor */}
      {selectedNote ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 }}>
          <input
            value={editTitle}
            onChange={e => { setEditTitle(e.target.value); setDirty(true); }}
            style={{
              padding: "10px 14px", borderRadius: "8px", fontSize: "16px", fontWeight: 700,
              background: CARD, border: `1px solid ${BORDER}`,
              color: "#FFFFFF", outline: "none", boxSizing: "border-box", width: "100%",
            }}
            placeholder="Note title…"
          />

          {/* Tags */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", alignItems: "center" }}>
            {editTags.map(t => (
              <span key={t} style={{
                display: "flex", alignItems: "center", gap: "3px",
                fontSize: "11px", padding: "2px 8px", borderRadius: "4px",
                background: "#111111", border: `1px solid ${BORDER}`, color: TEXT,
              }}>
                {t}
                <button
                  onClick={() => { setEditTags(editTags.filter(x => x !== t)); setDirty(true); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: "0", color: TEXT, display: "flex" }}
                >
                  <X style={{ height: "9px", width: "9px" }} />
                </button>
              </span>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
              <Hash style={{ height: "10px", width: "10px", color: TEXT }} />
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && tagInput.trim()) addTag(tagInput.trim()); }}
                placeholder="Add tag…"
                style={{ background: "none", border: "none", outline: "none", fontSize: "11px", color: TEXT, width: "70px" }}
              />
            </div>
            {SUGGESTED_TAGS.filter(t => !editTags.includes(t)).slice(0, 3).map(t => (
              <button key={t} onClick={() => addTag(t)} style={{
                fontSize: "10px", padding: "2px 7px", borderRadius: "4px",
                background: "transparent", border: `1px solid ${BORDER}`,
                cursor: "pointer", color: TEXT, transition: "border-color 0.12s",
              }}>{t}</button>
            ))}
          </div>

          <textarea
            value={editContent}
            onChange={e => { setEditContent(e.target.value); setDirty(true); }}
            style={{
              flex: 1, padding: "14px", borderRadius: "8px", fontSize: "13px",
              background: CARD, border: `1px solid ${BORDER}`,
              color: "#FFFFFF", outline: "none", resize: "none",
              lineHeight: "1.7", fontFamily: "inherit",
            }}
            placeholder="Start writing your notes… Use # headers, **bold**, and - lists"
          />

          {/* AI Panel */}
          {showAiPanel && (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: 600, color: TEXT }}>
                  <Sparkles style={{ height: "12px", width: "12px" }} /> Smart Notes AI
                </div>
                <button onClick={() => setShowAiPanel(false)} style={{ background: "none", border: "none", cursor: "pointer", color: TEXT, display: "flex" }}>
                  <X style={{ height: "12px", width: "12px" }} />
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "8px" }}>
                {AI_OPS.map(op => (
                  <button
                    key={op.id}
                    onClick={() => runAiOp(op.id)}
                    disabled={aiLoading}
                    style={{
                      padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 500,
                      cursor: "pointer",
                      background: aiOp === op.id ? "#111111" : "transparent",
                      border: `1px solid ${aiOp === op.id ? ACCENT : BORDER}`,
                      color: aiOp === op.id ? ACCENT : TEXT,
                    }}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
              {aiLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: TEXT }}>
                  <Loader2 style={{ height: "12px", width: "12px", animation: "spin 1s linear infinite" }} />
                  Generating…
                </div>
              )}
              {aiResult && !aiLoading && (
                <div style={{
                  background: "#0f0f0f", borderRadius: "6px", padding: "10px 12px",
                  fontSize: "12px", color: "#FFFFFF", lineHeight: "1.6",
                  maxHeight: "180px", overflow: "auto", whiteSpace: "pre-wrap", border: `1px solid ${BORDER}`,
                }}>
                  {aiResult}
                </div>
              )}
            </div>
          )}

          {/* Toolbar */}
          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <button
              onClick={() => setShowAiPanel(s => !s)}
              style={{
                display: "flex", alignItems: "center", gap: "5px", padding: "6px 10px",
                borderRadius: "6px", fontSize: "11px", fontWeight: 500, cursor: "pointer",
                background: showAiPanel ? "#111111" : "transparent",
                border: `1px solid ${showAiPanel ? ACCENT : BORDER}`,
                color: showAiPanel ? ACCENT : TEXT,
              }}
            >
              <Sparkles style={{ height: "10px", width: "10px" }} /> Smart AI
            </button>
            <div style={{ flex: 1 }} />
            {dirty && <span style={{ fontSize: "11px", color: TEXT }}>Unsaved</span>}
            <button
              onClick={saveNote}
              disabled={!dirty || saving}
              style={{
                display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px",
                borderRadius: "6px", fontSize: "12px", fontWeight: 600,
                cursor: dirty ? "pointer" : "default",
                background: dirty ? "#111111" : "transparent",
                border: `1px solid ${dirty ? "#FFFFFF" : BORDER}`,
                color: dirty ? "#FFFFFF" : TEXT,
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? <Loader2 style={{ height: "11px", width: "11px", animation: "spin 1s linear infinite" }} /> : <Save style={{ height: "11px", width: "11px" }} />}
              Save
            </button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "12px" }}>
          <BookOpen style={{ height: "32px", width: "32px", color: TEXT, opacity: 0.3 }} />
          <div style={{ fontSize: "13px", color: TEXT }}>Create your first note</div>
          <button onClick={createNote} style={{
            display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px",
            borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
            background: "#111111", border: "1px solid #FFFFFF", color: "#FFFFFF",
          }}>
            <Plus style={{ height: "12px", width: "12px" }} /> New Note
          </button>
        </div>
      )}
    </div>
  );
}
