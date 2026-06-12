import React from "react";
import {
  Flame, Trophy, BookOpen, Clock, Target, FileText, Award, Zap,
  TrendingUp, Play, Star, ChevronRight, Lock,
} from "lucide-react";
import type { AcademyDashboard } from "./types";
import { PATH_META } from "./types";

const C = {
  purple: "#a855f7", cyan: "#06b6d4", green: "#22c55e",
  amber: "#f59e0b", pink: "#ec4899", blue: "#3b82f6",
};

function StatCard({ icon: Icon, label, value, color, sub }: {
  icon: React.ElementType; label: string; value: string | number; color: string; sub?: string;
}) {
  return (
    <div style={{
      background: "var(--card-bg)", border: "1px solid hsl(var(--border))",
      borderRadius: "14px", padding: "18px 20px", display: "flex", flexDirection: "column", gap: "8px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{
          width: "32px", height: "32px", borderRadius: "9px", display: "flex",
          alignItems: "center", justifyContent: "center",
          background: `${color}18`, border: `1px solid ${color}30`,
        }}>
          <Icon style={{ height: "15px", width: "15px", color }} />
        </div>
        <span style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: "26px", fontWeight: 700, color: "hsl(var(--foreground))", letterSpacing: "-0.03em" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>{sub}</div>}
    </div>
  );
}

function XpBar({ xp, level }: { xp: number; level: number }) {
  const xpInLevel = xp % 500;
  const pct = (xpInLevel / 500) * 100;
  return (
    <div style={{
      border: "1px solid hsl(var(--border))",
      borderRadius: "16px", padding: "20px 24px",
      background: `linear-gradient(135deg, ${C.purple}12, ${C.cyan}08)`,
      borderColor: `${C.purple}30`,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "40px", height: "40px", borderRadius: "50%", display: "flex",
              alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: 800,
              background: `linear-gradient(135deg, ${C.purple}, ${C.cyan})`,
              color: "white", boxShadow: `0 0 20px ${C.purple}40`,
            }}>{level}</div>
            <div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "hsl(var(--foreground))" }}>
                Level {level} Trader
              </div>
              <div style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>
                {xp.toLocaleString()} XP total
              </div>
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))" }}>
            {xpInLevel} / 500 XP
          </div>
          <div style={{ fontSize: "11px", color: C.purple }}>to Level {level + 1}</div>
        </div>
      </div>
      <div style={{ height: "8px", borderRadius: "4px", background: "hsl(var(--muted))", overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: "4px", width: `${pct}%`,
          background: `linear-gradient(90deg, ${C.purple}, ${C.cyan})`,
          transition: "width 0.8s ease",
          boxShadow: `0 0 8px ${C.purple}60`,
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
  const meta = PATH_META[pathId];
  const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  const locked = pathId === "advanced" && (PATH_META["intermediate"] !== undefined) ||
    pathId === "professional";
  // Simple lock logic — locked if beginner not started
  const isLocked = false; // We'll show progress for all

  return (
    <div
      onClick={() => onNavigate("paths")}
      style={{
        background: "var(--card-bg)", border: "1px solid hsl(var(--border))",
        borderRadius: "14px", padding: "16px 18px", cursor: "pointer",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = meta.color + "60"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "hsl(var(--border))"; }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "22px" }}>{meta.icon}</span>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "hsl(var(--foreground))" }}>{meta.title}</div>
            <div style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))" }}>
              {progress.completed}/{progress.total} lessons
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
          <span style={{ fontSize: "18px", fontWeight: 700, color: meta.color }}>{pct}%</span>
          {progress.quizScore !== null && (
            <span style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))" }}>
              Quiz: {progress.quizScore}%
            </span>
          )}
        </div>
      </div>
      <div style={{ height: "6px", borderRadius: "3px", background: "hsl(var(--muted))", overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: "3px", width: `${pct}%`,
          background: meta.color, transition: "width 0.6s ease",
          boxShadow: pct > 0 ? `0 0 6px ${meta.color}60` : "none",
        }} />
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
      <div style={{ display: "grid", gap: "16px" }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ height: "80px", borderRadius: "14px", background: "hsl(var(--muted))", animation: "pulse 1.5s infinite" }} />
        ))}
      </div>
    );
  }

  const { xp, totalLessonsCompleted, totalStudyMinutes, quizAccuracy, notesCreated, certificatesEarned, pathProgress, lastLesson } = data;

  const studyHours = Math.floor(totalStudyMinutes / 60);
  const studyMins = totalStudyMinutes % 60;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* XP Bar */}
      <XpBar xp={xp.xp} level={xp.level} />

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px" }}>
        <StatCard icon={BookOpen} label="Lessons Done" value={totalLessonsCompleted} color={C.cyan} />
        <StatCard
          icon={Clock} label="Study Time"
          value={studyHours > 0 ? `${studyHours}h ${studyMins}m` : `${totalStudyMinutes}m`}
          color={C.purple}
        />
        <StatCard icon={Flame} label="Streak" value={`${xp.streakDays}🔥`} color={C.amber}
          sub={`Longest: ${xp.longestStreak} days`} />
        <StatCard icon={Target} label="Quiz Accuracy" value={`${quizAccuracy}%`} color={C.green} />
        <StatCard icon={FileText} label="Notes" value={notesCreated} color={C.blue} />
        <StatCard icon={Award} label="Certificates" value={certificatesEarned} color={C.pink} />
      </div>

      {/* Continue Learning */}
      {lastLesson && (
        <button
          onClick={onContinue}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "18px 22px", borderRadius: "14px", cursor: "pointer",
            background: `linear-gradient(135deg, ${C.purple}20, ${C.cyan}10)`,
            border: `1px solid ${C.purple}40`,
            width: "100%", textAlign: "left",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{
              width: "42px", height: "42px", borderRadius: "12px", display: "flex",
              alignItems: "center", justifyContent: "center",
              background: `linear-gradient(135deg, ${C.purple}, ${C.cyan})`,
            }}>
              <Play style={{ height: "18px", width: "18px", color: "white" }} />
            </div>
            <div>
              <div style={{ fontSize: "11px", color: C.purple, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Continue Learning
              </div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "hsl(var(--foreground))", marginTop: "2px" }}>
                {lastLesson.title}
              </div>
              <div style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>
                {lastLesson.courseTitle}
              </div>
            </div>
          </div>
          <ChevronRight style={{ height: "18px", width: "18px", color: C.purple, flexShrink: 0 }} />
        </button>
      )}

      {/* Path progress */}
      <div>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "hsl(var(--foreground))", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
          <TrendingUp style={{ height: "14px", width: "14px", color: C.purple }} />
          Learning Path Progress
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
          {Object.entries(pathProgress).map(([pathId, progress]) => (
            <PathProgressCard key={pathId} pathId={pathId} progress={progress} onNavigate={onNavigate} />
          ))}
        </div>
      </div>

      {/* Badges */}
      {xp.badges.length > 0 && (
        <div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "hsl(var(--foreground))", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Star style={{ height: "14px", width: "14px", color: C.amber }} />
            Badges Earned
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {xp.badges.map(b => (
              <div key={b} style={{
                padding: "4px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: 600,
                background: `${C.amber}18`, border: `1px solid ${C.amber}40`, color: C.amber,
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
