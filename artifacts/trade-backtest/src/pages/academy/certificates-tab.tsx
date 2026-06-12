import React from "react";
import { Award, Download, Lock, CheckCircle2 } from "lucide-react";
import type { AcademyCertificate } from "./types";
import { PATH_META, PATH_ICONS } from "./types";

const SUCCESS = "#84CC16";
const BORDER = "#262626";
const CARD = "#171717";
const TEXT = "#A1A1AA";

const CERT_META: Record<string, { title: string; color: string; description: string; requirements: string[] }> = {
  beginner: {
    title: "Beginner Trader Certificate",
    color: SUCCESS,
    description: "Awarded for completing the Beginner trading path with fundamental knowledge of markets, charts, and risk management.",
    requirements: ["Complete 80%+ of Beginner path lessons", "Score 60%+ average on quizzes"],
  },
  intermediate: {
    title: "Intermediate Trader Certificate",
    color: "#22D3EE",
    description: "Demonstrates proficiency in price action, market structure, and intermediate trading concepts.",
    requirements: ["Complete 80%+ of Intermediate path lessons", "Score 60%+ average on quizzes"],
  },
  advanced: {
    title: "Advanced Trader Certificate",
    color: "#A78BFA",
    description: "Recognizes mastery of Smart Money Concepts, ICT methodology, and advanced market analysis.",
    requirements: ["Complete 80%+ of Advanced path lessons", "Score 60%+ average on quizzes"],
  },
  professional: {
    title: "Trade Lab Certified Trader",
    color: "#F59E0B",
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
  const pathMeta = PATH_META[pathId];
  const Icon = PATH_ICONS[pathId] ?? Award;
  const earned = !!cert;
  const pct = pathProgress.total > 0 ? Math.round((pathProgress.completed / pathProgress.total) * 100) : 0;

  function downloadCert() {
    if (!cert || !earned || !meta) return;
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 700;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#0A0A0A";
    ctx.fillRect(0, 0, 1000, 700);

    ctx.strokeStyle = meta.color;
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, 960, 660);

    ctx.strokeStyle = "#262626";
    ctx.lineWidth = 1;
    ctx.strokeRect(34, 34, 932, 632);

    ctx.fillStyle = meta.color;
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "center";
    ctx.fillText("TRADE LAB ACADEMY", 500, 100);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 38px Arial";
    ctx.fillText("Certificate of Completion", 500, 170);

    ctx.fillStyle = "#A1A1AA";
    ctx.font = "18px Arial";
    ctx.fillText("This is to certify that you have successfully completed", 500, 340);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 30px Arial";
    ctx.fillText(meta.title, 500, 400);

    ctx.fillStyle = meta.color;
    ctx.font = "16px Arial";
    ctx.fillText(`Achievement Score: ${cert.score}%`, 500, 450);

    ctx.fillStyle = "#A1A1AA";
    ctx.font = "14px Arial";
    ctx.fillText(`Issued: ${new Date(cert.issuedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 500, 500);

    ctx.fillStyle = "#404040";
    ctx.font = "12px Arial";
    ctx.fillText("Trade Lab · Professional Trading Education Platform", 500, 590);

    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `TradeLab-${pathId}-certificate.png`;
    a.click();
  }

  if (!meta) return null;

  return (
    <div style={{
      background: CARD, border: `1px solid ${earned ? meta.color + "30" : BORDER}`,
      borderRadius: "10px", padding: "20px",
      opacity: earned ? 1 : 0.85,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
        <div style={{
          width: "52px", height: "52px", borderRadius: "10px", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "#111111", border: `1px solid ${earned ? meta.color + "40" : BORDER}`,
          filter: earned ? "none" : "grayscale(60%)",
        }}>
          <Icon style={{ height: "22px", width: "22px", color: earned ? meta.color : TEXT }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF" }}>{meta.title}</span>
            {earned && (
              <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: SUCCESS, background: "#111111", padding: "2px 8px", borderRadius: "4px", border: `1px solid ${SUCCESS}40`, fontWeight: 600 }}>
                <CheckCircle2 style={{ height: "9px", width: "9px" }} /> Earned
              </span>
            )}
          </div>
          <div style={{ fontSize: "12px", color: TEXT, lineHeight: "1.5", marginBottom: "12px" }}>
            {meta.description}
          </div>

          {earned ? (
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ fontSize: "12px", color: TEXT }}>
                Score: <strong style={{ color: meta.color }}>{cert!.score}%</strong>
              </div>
              <div style={{ fontSize: "12px", color: TEXT }}>
                Issued: <strong style={{ color: "#FFFFFF" }}>{new Date(cert!.issuedAt).toLocaleDateString()}</strong>
              </div>
              <button
                onClick={downloadCert}
                style={{
                  display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px",
                  borderRadius: "6px", fontSize: "11px", fontWeight: 600, cursor: "pointer",
                  background: "#111111", border: "1px solid #FFFFFF", color: "#FFFFFF",
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#1a1a1a")}
                onMouseLeave={e => (e.currentTarget.style.background = "#111111")}
              >
                <Download style={{ height: "10px", width: "10px" }} /> Download
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: TEXT, marginBottom: "6px" }}>
                <Lock style={{ height: "10px", width: "10px" }} />
                Requirements
              </div>
              {meta.requirements.map(r => (
                <div key={r} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: TEXT, marginBottom: "3px" }}>
                  <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: BORDER, flexShrink: 0 }} />
                  {r}
                </div>
              ))}
              <div style={{ marginTop: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontSize: "10px", color: TEXT }}>Path completion</span>
                  <span style={{ fontSize: "10px", fontWeight: 600, color: "#FFFFFF" }}>{pct}%</span>
                </div>
                <div style={{ height: "2px", borderRadius: "1px", background: "#262626", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: "1px", width: `${pct}%`, background: meta.color, transition: "width 0.6s" }} />
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
  const earned = certificates.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Stats */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <div style={{ padding: "12px 16px", borderRadius: "10px", background: CARD, border: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#F59E0B" }}>{earned}</div>
          <div style={{ fontSize: "10px", color: TEXT, marginTop: "2px" }}>Earned</div>
        </div>
        <div style={{ padding: "12px 16px", borderRadius: "10px", background: CARD, border: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#FFFFFF" }}>{4 - earned}</div>
          <div style={{ fontSize: "10px", color: TEXT, marginTop: "2px" }}>Remaining</div>
        </div>
      </div>

      {earned > 0 && (
        <div style={{
          padding: "12px 16px", borderRadius: "8px",
          background: "#111111", border: `1px solid ${BORDER}`,
          display: "flex", alignItems: "center", gap: "10px",
        }}>
          <Award style={{ height: "16px", width: "16px", color: "#F59E0B", flexShrink: 0 }} />
          <div style={{ fontSize: "13px", color: "#FFFFFF" }}>
            {earned === 4 ? "All certificates earned — well done." : `${earned} certificate${earned > 1 ? "s" : ""} earned. Download them to share your achievement.`}
          </div>
        </div>
      )}

      {/* Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
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
