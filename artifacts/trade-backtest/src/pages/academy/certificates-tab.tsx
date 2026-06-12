import React from "react";
import { Award, Download, Lock, CheckCircle2, BookOpen, Target, Clock } from "lucide-react";
import type { AcademyCertificate } from "./types";
import { PATH_META } from "./types";

const C = { purple: "#a855f7", cyan: "#06b6d4", green: "#22c55e", amber: "#f59e0b", pink: "#ec4899" };

const CERT_META: Record<string, { title: string; icon: string; color: string; description: string; requirements: string[] }> = {
  beginner: {
    title: "Beginner Trader Certificate",
    icon: "🥉",
    color: C.green,
    description: "Awarded for completing the Beginner trading path with fundamental knowledge of markets, charts, and risk management.",
    requirements: ["Complete 80%+ of Beginner path lessons", "Score 60%+ average on quizzes"],
  },
  intermediate: {
    title: "Intermediate Trader Certificate",
    icon: "🥈",
    color: C.cyan,
    description: "Demonstrates proficiency in price action, market structure, and intermediate trading concepts.",
    requirements: ["Complete 80%+ of Intermediate path lessons", "Score 60%+ average on quizzes"],
  },
  advanced: {
    title: "Advanced Trader Certificate",
    icon: "🥇",
    color: C.purple,
    description: "Recognizes mastery of Smart Money Concepts, ICT methodology, and advanced market analysis.",
    requirements: ["Complete 80%+ of Advanced path lessons", "Score 60%+ average on quizzes"],
  },
  professional: {
    title: "Trade Lab Certified Trader",
    icon: "🏆",
    color: C.amber,
    description: "The highest Trade Lab certification — awarded to traders who have mastered professional-level concepts.",
    requirements: ["Complete 80%+ of Professional path lessons", "Score 60%+ average on quizzes"],
  },
};

function CertificateCard({ pathId, cert, pathProgress }: {
  pathId: string;
  cert: AcademyCertificate | null;
  pathProgress: { total: number; completed: number; quizScore: number | null };
}) {
  const meta = CERT_META[pathId];
  const earned = !!cert;
  const pct = pathProgress.total > 0 ? Math.round((pathProgress.completed / pathProgress.total) * 100) : 0;

  function downloadCert() {
    if (!cert || !earned) return;
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 700;
    const ctx = canvas.getContext("2d")!;

    // Background
    ctx.fillStyle = "#0f0f14";
    ctx.fillRect(0, 0, 1000, 700);

    // Border gradient
    const borderGrad = ctx.createLinearGradient(0, 0, 1000, 700);
    borderGrad.addColorStop(0, meta.color);
    borderGrad.addColorStop(1, C.cyan);
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 6;
    ctx.strokeRect(20, 20, 960, 660);

    // Inner border
    ctx.strokeStyle = meta.color + "40";
    ctx.lineWidth = 1;
    ctx.strokeRect(32, 32, 936, 636);

    // Title
    ctx.fillStyle = meta.color;
    ctx.font = "bold 28px Arial";
    ctx.textAlign = "center";
    ctx.fillText("TRADE LAB ACADEMY", 500, 100);

    // Cert type
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 42px Arial";
    ctx.fillText("Certificate of Completion", 500, 180);

    // Icon
    ctx.font = "72px Arial";
    ctx.fillText(meta.icon, 500, 290);

    // Award text
    ctx.fillStyle = "#a0a0b0";
    ctx.font = "20px Arial";
    ctx.fillText("This is to certify that you have successfully completed", 500, 360);

    // Certificate title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px Arial";
    ctx.fillText(meta.title, 500, 420);

    // Score
    ctx.fillStyle = meta.color;
    ctx.font = "18px Arial";
    ctx.fillText(`Achievement Score: ${cert.score}%`, 500, 470);

    // Date
    ctx.fillStyle = "#a0a0b0";
    ctx.font = "16px Arial";
    ctx.fillText(`Issued: ${new Date(cert.issuedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 500, 520);

    // Footer
    ctx.fillStyle = "#606070";
    ctx.font = "14px Arial";
    ctx.fillText("Trade Lab · Professional Trading Education Platform", 500, 600);

    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `TradeLab-${pathId}-certificate.png`;
    a.click();
  }

  return (
    <div style={{
      background: earned
        ? `linear-gradient(135deg, ${meta.color}12, ${meta.color}06)`
        : "var(--card-bg)",
      border: `1px solid ${earned ? meta.color + "40" : "hsl(var(--border))"}`,
      borderRadius: "20px", padding: "24px",
      position: "relative", overflow: "hidden",
      opacity: earned ? 1 : 0.85,
    }}>
      {earned && (
        <div style={{
          position: "absolute", top: "16px", right: "16px",
          display: "flex", alignItems: "center", gap: "4px",
          fontSize: "10px", fontWeight: 700, color: C.green,
          background: `${C.green}18`, padding: "3px 8px", borderRadius: "10px",
          border: `1px solid ${C.green}30`,
        }}>
          <CheckCircle2 style={{ height: "9px", width: "9px" }} /> EARNED
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
        <div style={{
          width: "64px", height: "64px", borderRadius: "16px", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: "34px",
          background: `${meta.color}18`, border: `2px solid ${earned ? meta.color + "60" : meta.color + "20"}`,
          filter: earned ? "none" : "grayscale(80%)",
          boxShadow: earned ? `0 0 20px ${meta.color}30` : "none",
        }}>
          {meta.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "15px", fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: "4px" }}>
            {meta.title}
          </div>
          <div style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))", lineHeight: "1.5", marginBottom: "12px" }}>
            {meta.description}
          </div>

          {earned ? (
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))" }}>
                Score: <strong style={{ color: meta.color }}>{cert!.score}%</strong>
              </div>
              <div style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))" }}>
                Issued: <strong>{new Date(cert!.issuedAt).toLocaleDateString()}</strong>
              </div>
              <button
                onClick={downloadCert}
                style={{
                  display: "flex", alignItems: "center", gap: "5px", padding: "6px 14px",
                  borderRadius: "9px", fontSize: "11px", fontWeight: 600, cursor: "pointer",
                  background: meta.color, border: "none", color: "white",
                  boxShadow: `0 2px 8px ${meta.color}40`,
                }}
              >
                <Download style={{ height: "11px", width: "11px" }} /> Download Certificate
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "hsl(var(--muted-foreground))", marginBottom: "2px", display: "flex", alignItems: "center", gap: "5px" }}>
                <Lock style={{ height: "10px", width: "10px" }} /> Requirements
              </div>
              {meta.requirements.map(r => (
                <div key={r} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "hsl(var(--muted-foreground))" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: meta.color + "60", flexShrink: 0 }} />
                  {r}
                </div>
              ))}
              <div style={{ marginTop: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>
                    Path completion
                  </span>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: meta.color }}>{pct}%</span>
                </div>
                <div style={{ height: "5px", borderRadius: "3px", background: "hsl(var(--muted))", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: "3px", width: `${pct}%`, background: meta.color, transition: "width 0.6s ease" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CertificatesTab({
  certificates,
  pathProgress,
}: {
  certificates: AcademyCertificate[];
  pathProgress: Record<string, { total: number; completed: number; quizScore: number | null }>;
}) {
  const certByPath = new Map(certificates.map(c => [c.pathId, c]));
  const earnedCount = certificates.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header stats */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <div style={{ padding: "14px 20px", borderRadius: "12px", background: "var(--card-bg)", border: "1px solid hsl(var(--border))" }}>
          <div style={{ fontSize: "24px", fontWeight: 700, color: C.amber }}>{earnedCount}</div>
          <div style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>Certificates Earned</div>
        </div>
        <div style={{ padding: "14px 20px", borderRadius: "12px", background: "var(--card-bg)", border: "1px solid hsl(var(--border))" }}>
          <div style={{ fontSize: "24px", fontWeight: 700, color: C.purple }}>{4 - earnedCount}</div>
          <div style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>Certificates Remaining</div>
        </div>
      </div>

      {earnedCount > 0 && (
        <div style={{
          padding: "14px 18px", borderRadius: "12px",
          background: `${C.amber}10`, border: `1px solid ${C.amber}30`,
          display: "flex", alignItems: "center", gap: "10px",
        }}>
          <span style={{ fontSize: "22px" }}>🏆</span>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "hsl(var(--foreground))" }}>
              {earnedCount === 4 ? "Congratulations! You've earned all certificates!" : `You've earned ${earnedCount} certificate${earnedCount > 1 ? "s" : ""}!`}
            </div>
            <div style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>
              Download your certificates to share your achievement.
            </div>
          </div>
        </div>
      )}

      {/* Certificate cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {["beginner", "intermediate", "advanced", "professional"].map(pathId => (
          <CertificateCard
            key={pathId}
            pathId={pathId}
            cert={certByPath.get(pathId) ?? null}
            pathProgress={pathProgress[pathId] ?? { total: 0, completed: 0, quizScore: null }}
          />
        ))}
      </div>
    </div>
  );
}
