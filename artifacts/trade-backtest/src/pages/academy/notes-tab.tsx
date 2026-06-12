import React, { useState } from "react";
import {
  Plus, Trash2, Tag, Loader2, Sparkles, FileText, Hash,
  ChevronDown, Save, X, BookOpen,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";
import type { AcademyNote } from "./types";

const C = { purple: "#a855f7", cyan: "#06b6d4", green: "#22c55e", amber: "#f59e0b", blue: "#3b82f6" };

const AI_OPS = [
  { id: "summarize", label: "✨ Summarize", desc: "3-5 key bullet points" },
  { id: "flashcards", label: "🃏 Flashcards", desc: "Q&A format" },
  { id: "revision", label: "📄 Revision Sheet", desc: "One-page summary" },
  { id: "takeaways", label: "🎯 Key Takeaways", desc: "Top 5 lessons" },
];

const SUGGESTED_TAGS = ["#RiskManagement", "#ICT", "#Psychology", "#PriceAction", "#SMC", "#Candlesticks", "#TradingJournal", "#SetupIdeas", "#OrderBlocks", "#FVG", "#Liquidity"];

function NoteCard({ note, selected, onSelect, onDelete }: {
  note: AcademyNote; selected: boolean; onSelect: () => void; onDelete: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        padding: "12px 14px", borderRadius: "12px", cursor: "pointer",
        background: selected ? `${C.purple}12` : "var(--card-bg)",
        border: `1px solid ${selected ? C.purple + "40" : "hsl(var(--border))"}`,
        transition: "all 0.12s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: selected ? C.purple : "hsl(var(--foreground))", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {note.title || "Untitled"}
          </div>
          <div style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {note.content || "Empty note..."}
          </div>
          {note.tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "6px" }}>
              {note.tags.slice(0, 3).map(t => (
                <span key={t} style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "8px", background: `${C.purple}15`, color: C.purple }}>
                  {t}
                </span>
              ))}
              {note.tags.length > 3 && <span style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))" }}>+{note.tags.length - 3}</span>}
            </div>
          )}
          <div style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", marginTop: "6px" }}>
            {new Date(note.updatedAt).toLocaleDateString()}
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{ padding: "4px", borderRadius: "6px", background: "none", border: "none", cursor: "pointer", color: "hsl(var(--muted-foreground))", flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#ef4444"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "hsl(var(--muted-foreground))"}
        >
          <Trash2 style={{ height: "12px", width: "12px" }} />
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
  const [selectedId, setSelectedId] = useState<number | null>(notes[0]?.id ?? null);
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

  React.useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

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
    } catch { /* ignore */ }
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
    } catch { /* ignore */ }
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
    } catch { /* ignore */ }
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
    <div style={{ display: "flex", gap: "16px", height: "calc(100vh - 200px)", minHeight: "500px" }}>
      {/* Sidebar */}
      <div style={{ width: "240px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
        <button
          onClick={createNote}
          style={{
            display: "flex", alignItems: "center", gap: "6px", padding: "9px 14px",
            borderRadius: "10px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
            background: `linear-gradient(135deg, ${C.purple}, ${C.cyan})`,
            border: "none", color: "white",
          }}
        >
          <Plus style={{ height: "13px", width: "13px" }} /> New Note
        </button>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px", overflow: "auto", flex: 1 }}>
          {notes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 10px", color: "hsl(var(--muted-foreground))", fontSize: "12px" }}>
              <FileText style={{ height: "28px", width: "28px", margin: "0 auto 8px", opacity: 0.3 }} />
              No notes yet
            </div>
          ) : (
            notes.map(n => (
              <NoteCard
                key={n.id} note={n}
                selected={n.id === selectedId}
                onSelect={() => { if (dirty) saveNote(); setSelectedId(n.id); }}
                onDelete={() => deleteNote(n.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Editor */}
      {selectedNote ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px", minWidth: 0 }}>
          {/* Title */}
          <input
            value={editTitle}
            onChange={e => { setEditTitle(e.target.value); setDirty(true); }}
            style={{
              padding: "10px 14px", borderRadius: "12px", fontSize: "16px", fontWeight: 700,
              background: "var(--card-bg)", border: "1px solid hsl(var(--border))",
              color: "hsl(var(--foreground))", outline: "none", boxSizing: "border-box", width: "100%",
            }}
            placeholder="Note title..."
          />

          {/* Tags */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
            {editTags.map(t => (
              <span key={t} style={{
                display: "flex", alignItems: "center", gap: "4px",
                fontSize: "11px", padding: "2px 8px", borderRadius: "12px",
                background: `${C.purple}15`, color: C.purple, border: `1px solid ${C.purple}30`,
              }}>
                {t}
                <button onClick={() => { setEditTags(editTags.filter(x => x !== t)); setDirty(true); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: "0", color: C.purple, display: "flex" }}>
                  <X style={{ height: "10px", width: "10px" }} />
                </button>
              </span>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <Hash style={{ height: "11px", width: "11px", color: "hsl(var(--muted-foreground))" }} />
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && tagInput.trim()) { addTag(tagInput.trim()); } }}
                placeholder="Add tag..."
                style={{ background: "none", border: "none", outline: "none", fontSize: "11px", color: "hsl(var(--muted-foreground))", width: "80px" }}
              />
            </div>
            {SUGGESTED_TAGS.filter(t => !editTags.includes(t)).slice(0, 4).map(t => (
              <button key={t} onClick={() => addTag(t)} style={{
                fontSize: "10px", padding: "2px 7px", borderRadius: "10px",
                background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))",
                cursor: "pointer", color: "hsl(var(--muted-foreground))",
              }}>{t}</button>
            ))}
          </div>

          {/* Content editor */}
          <textarea
            value={editContent}
            onChange={e => { setEditContent(e.target.value); setDirty(true); }}
            style={{
              flex: 1, padding: "16px", borderRadius: "12px", fontSize: "13px",
              background: "var(--card-bg)", border: "1px solid hsl(var(--border))",
              color: "hsl(var(--foreground))", outline: "none", resize: "none",
              lineHeight: "1.7", fontFamily: "inherit",
            }}
            placeholder="Start writing your notes here... Use markdown formatting for headers (#), bold (**text**), and lists (- item)"
          />

          {/* AI Panel */}
          {showAiPanel && (
            <div style={{
              background: "var(--card-bg)", border: `1px solid ${C.purple}30`,
              borderRadius: "14px", padding: "14px 16px",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, color: C.purple }}>
                  <Sparkles style={{ height: "13px", width: "13px" }} /> Smart Notes AI
                </div>
                <button onClick={() => setShowAiPanel(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "hsl(var(--muted-foreground))", display: "flex" }}>
                  <X style={{ height: "13px", width: "13px" }} />
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
                {AI_OPS.map(op => (
                  <button
                    key={op.id}
                    onClick={() => runAiOp(op.id)}
                    disabled={aiLoading}
                    style={{
                      padding: "5px 12px", borderRadius: "10px", fontSize: "11px", fontWeight: 600,
                      cursor: "pointer", background: aiOp === op.id ? `${C.purple}20` : "hsl(var(--muted))",
                      border: `1px solid ${aiOp === op.id ? C.purple + "40" : "hsl(var(--border))"}`,
                      color: aiOp === op.id ? C.purple : "hsl(var(--muted-foreground))",
                    }}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
              {aiLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "hsl(var(--muted-foreground))" }}>
                  <Loader2 style={{ height: "13px", width: "13px", animation: "spin 1s linear infinite" }} />
                  Generating...
                </div>
              )}
              {aiResult && !aiLoading && (
                <div style={{
                  background: "hsl(var(--muted))", borderRadius: "10px", padding: "12px 14px",
                  fontSize: "12px", color: "hsl(var(--foreground))", lineHeight: "1.6",
                  maxHeight: "200px", overflow: "auto",
                  whiteSpace: "pre-wrap",
                }}>
                  {aiResult}
                </div>
              )}
            </div>
          )}

          {/* Bottom toolbar */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={() => setShowAiPanel(s => !s)}
              style={{
                display: "flex", alignItems: "center", gap: "5px", padding: "7px 12px",
                borderRadius: "9px", fontSize: "11px", fontWeight: 600, cursor: "pointer",
                background: showAiPanel ? `${C.purple}15` : "hsl(var(--muted))",
                border: `1px solid ${showAiPanel ? C.purple + "30" : "hsl(var(--border))"}`,
                color: showAiPanel ? C.purple : "hsl(var(--muted-foreground))",
              }}
            >
              <Sparkles style={{ height: "11px", width: "11px" }} /> Smart AI
            </button>
            <div style={{ flex: 1 }} />
            {dirty && (
              <span style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>Unsaved changes</span>
            )}
            <button
              onClick={saveNote}
              disabled={!dirty || saving}
              style={{
                display: "flex", alignItems: "center", gap: "5px", padding: "7px 14px",
                borderRadius: "9px", fontSize: "12px", fontWeight: 600, cursor: dirty ? "pointer" : "default",
                background: dirty ? `linear-gradient(135deg, ${C.purple}, ${C.cyan})` : "hsl(var(--muted))",
                border: "none", color: dirty ? "white" : "hsl(var(--muted-foreground))",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? <Loader2 style={{ height: "12px", width: "12px", animation: "spin 1s linear infinite" }} /> : <Save style={{ height: "12px", width: "12px" }} />}
              Save
            </button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "12px" }}>
          <BookOpen style={{ height: "40px", width: "40px", color: "hsl(var(--muted-foreground))", opacity: 0.4 }} />
          <div style={{ fontSize: "14px", color: "hsl(var(--muted-foreground))" }}>Create your first note</div>
          <button onClick={createNote} style={{
            display: "flex", alignItems: "center", gap: "6px", padding: "9px 18px",
            borderRadius: "10px", fontSize: "13px", fontWeight: 600, cursor: "pointer",
            background: `linear-gradient(135deg, ${C.purple}, ${C.cyan})`, border: "none", color: "white",
          }}>
            <Plus style={{ height: "13px", width: "13px" }} /> New Note
          </button>
        </div>
      )}
    </div>
  );
}
