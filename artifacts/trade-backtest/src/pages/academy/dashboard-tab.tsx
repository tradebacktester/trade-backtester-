import React from "react";
import {
  BookOpen, Clock, Flame, Target, FileText, Award,
  TrendingUp, ChevronRight, ArrowRight,
} from "lucide-react";
import type { AcademyDashboard } from "./types";
import { PATH_ICONS } from "./types";

const ACCENT = "#22D3EE";
const SUCCESS = "#84CC16";
const BORDER = "#262626";
const CARD = "#171717";
const TEXT = "#A1A1AA";

function StatCard({ icon: Icon, label, value, sub }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string;
}) {
  return (
    <div style={{
      background: CARD, border: `1px solid ${BORDER}`,
      borderRadius: "10px", padding: "16px 18px",
      display: "flex", flexDirection: "column", gap: "10px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Icon style={{ height: "14px", width: "14px", color: TEXT }} />
        <span style={{ fontSize: "11px", color: TEXT, fontWeight: 500, letterSpacing: "0.02em" }}>{label}</span>
      </div>
      <div style={{ fontSize: "24px", fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.03em" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: "11px", color: TEXT }}>{sub}</div>}
    </div>
  );
}

function LevelBar({ xp, level }: { xp: number; level: number }) {
  const xpInLevel = xp % 500;
  const pct = (xpInLevel / 500) * 100;
  return (
    <div style={{
      border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "18px 20px",
      background: CARD,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "8px",
            background: "#111111", border: `1px solid ${BORDER}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "14px", fontWeight: 700, color: "#FFFFFF",
          }}>{level}</div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "#FFFFFF" }}>Level {level} Trader</div>
            <div style={{ fontSize: "11px", color: TEXT }}>{xp.toLocaleString()} XP total</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "12px", color: TEXT }}>{xpInLevel} / 500 XP</div>
          <div style={{ fontSize: "11px", color: ACCENT }}>to Level {level + 1}</div>
        </div>
      </div>
      <div style={{ height: "3px", borderRadius: "2px", background: "#262626", overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: "2px", width: `${pct}%`,
          background: ACCENT, transition: "width 0.8s ease",
        }} />
      </div>
    </div>
  );
}

function PathProgressCard({
  pathId, progress, onNavigate,
}: {
  pathId: string;
  progress: { total: number; completed: number; quizScore: number | null };
  onNavigate: (tab: string) => void;
}) {
  const meta = { beginner: { title: "Beginner", color: SUCCESS }, intermediate: { title: "Intermediate", color: ACCENT }, advanced: { title: "Advanced", color: "#A78BFA" }, professional: { title: "Professional", color: "#F59E0B" } }[pathId] ?? { title: pathId, color: TEXT };
  const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  const Icon = PATH_ICONS[pathId] ?? BookOpen;

  return (
    <div
      onClick={() => onNavigate("library")}
      style={{
        background: CARD, border: `1px solid ${BORDER}`,
        borderRadius: "10px", padding: "14px 16px", cursor: "pointer",
        transition: "border-color 0.15s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#3a3a3a"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Icon style={{ height: "14px", width: "14px", color: TEXT }} />
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#FFFFFF" }}>{meta.title}</span>
        </div>
        <span style={{ fontSize: "16px", fontWeight: 700, color: "#FFFFFF" }}>{pct}%</span>
      </div>
      <div style={{ height: "2px", borderRadius: "1px", background: "#262626", overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: "1px", width: `${pct}%`,
          background: pct === 100 ? SUCCESS : ACCENT, transition: "width 0.6s ease",
        }} />
      </div>
      <div style={{ fontSize: "10px", color: TEXT, marginTop: "6px" }}>
        {progress.completed} / {progress.total} lessons
      </div>
    </div>
  );
}

export function DashboardTab({
  data,
  onNavigate,
  onContinue,
}: {
  data: AcademyDashboard | null;
  onNavigate: (tab: string) => void;
  onContinue: () => void;
}) {
  if (!data) {
    return (
      <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ height: "90px", borderRadius: "10px", background: CARD, border: `1px solid ${BORDER}`, opacity: 0.5 }} />
        ))}
      </div>
    );
  }

  const { xp, totalLessonsCompleted, totalStudyMinutes, quizAccuracy, notesCreated, certificatesEarned, pathProgress, lastLesson } = data;
  const studyHours = Math.floor(totalStudyMinutes / 60);
  const studyMins = totalStudyMinutes % 60;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Level bar */}
      <LevelBar xp={xp.xp} level={xp.level} />

      {/* Continue Learning */}
      {lastLesson && (
        <button
          onClick={onContinue}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 20px", borderRadius: "10px", cursor: "pointer",
            background: "#111111", border: `1px solid ${BORDER}`,
            width: "100%", textAlign: "left", transition: "border-color 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#3a3a3a"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}
        >
          <div>
            <div style={{ fontSize: "10px", color: TEXT, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
              Continue Learning
            </div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "#FFFFFF" }}>
              {lastLesson.title}
            </div>
            <div style={{ fontSize: "11px", color: TEXT, marginTop: "2px" }}>
              {lastLesson.courseTitle}
            </div>
          </div>
          <ArrowRight style={{ height: "16px", width: "16px", color: TEXT, flexShrink: 0 }} />
        </button>
      )}

      {/* Stats grid */}
      <div>
        <div style={{ fontSize: "11px", fontWeight: 600, color: TEXT, marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Statistics
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "10px" }}>
          <StatCard icon={BookOpen} label="Lessons Completed" value={totalLessonsCompleted} />
          <StatCard
            icon={Clock} label="Study Time"
            value={studyHours > 0 ? `${studyHours}h ${studyMins}m` : `${totalStudyMinutes}m`}
          />
          <StatCard icon={Flame} label="Day Streak" value={xp.streakDays} sub={`Longest: ${xp.longestStreak} days`} />
          <StatCard icon={Target} label="Quiz Accuracy" value={`${quizAccuracy}%`} />
          <StatCard icon={FileText} label="Notes Created" value={notesCreated} />
          <StatCard icon={Award} label="Certificates" value={certificatesEarned} />
        </div>
      </div>

      {/* Path progress */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: TEXT, textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: "6px" }}>
            <TrendingUp style={{ height: "12px", width: "12px" }} />
            Learning Paths
          </div>
          <button
            onClick={() => onNavigate("library")}
            style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: TEXT, background: "none", border: "none", cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#FFFFFF")}
            onMouseLeave={e => (e.currentTarget.style.color = TEXT)}
          >
            View all <ChevronRight style={{ height: "11px", width: "11px" }} />
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px" }}>
          {Object.entries(pathProgress).map(([pathId, progress]) => (
            <PathProgressCard key={pathId} pathId={pathId} progress={progress} onNavigate={onNavigate} />
          ))}
        </div>
      </div>

      {/* Badges */}
      {xp.badges.length > 0 && (
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, color: TEXT, marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Achievements
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {xp.badges.map(b => (
              <div key={b} style={{
                padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 500,
                background: "#111111", border: `1px solid ${BORDER}`, color: TEXT,
              }}>
                {b.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
