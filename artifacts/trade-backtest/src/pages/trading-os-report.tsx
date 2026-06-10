import React, { useState, useCallback, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";
import { AuthModal } from "@/components/auth-modal";
import {
  ArrowLeft, RefreshCw, Download, FileText, CheckCircle2, ArrowUpRight,
  Brain,
} from "lucide-react";

const C = {
  text:   "hsl(var(--foreground))",
  sub:    "hsl(var(--muted-foreground))",
  border: "hsl(var(--border))",
  green:  "#22c55e",
  red:    "#ef4444",
  amber:  "#f59e0b",
  blue:   "#3b82f6",
  cyan:   "#06b6d4",
  purple: "#a855f7",
};
const CARD:  React.CSSProperties = { background: "var(--card-bg)", border: "1px solid hsl(var(--border))", boxShadow: "var(--shadow-card)" };
const GLASS: React.CSSProperties = { background: "var(--glass-bg)", border: "1px solid var(--glass-border)" };

function Skel({ className = "" }: { className?: string }) {
  return <div className={`rounded-lg animate-pulse ${className}`} style={{ background: "hsl(var(--muted))" }} />;
}

function useReportFetch(token: string | null) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${API_BASE}/api/trading-os/weekly-report`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(await r.text());
      setData(await r.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);
  return { data, loading, error, reload: load };
}

function handlePrint() {
  window.print();
}

export default function TradingOsReportPage() {
  const { token } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { data: d, loading, error, reload } = useReportFetch(token);

  const ratingColor = (r: string) =>
    r === "Outperforming" ? C.green :
    r === "Cautiously Optimistic" ? C.amber :
    r === "Neutral" ? C.blue : C.red;

  if (!token) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <Brain className="h-12 w-12 mx-auto mb-4" style={{ color: C.purple }} />
            <h2 className="text-xl font-bold mb-2" style={{ color: C.text }}>Sign in to view your report</h2>
            <p className="text-sm mb-5" style={{ color: C.sub }}>Your Personal Hedge Fund Report requires an account</p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm"
              style={{ background: C.purple, color: "#fff" }}
            >
              Sign In
            </button>
          </div>
        </div>
        <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .print-card {
            border: 1px solid #ddd !important;
            background: white !important;
            box-shadow: none !important;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="min-h-screen" style={{ background: "hsl(var(--background))" }}>
        {/* Header */}
        <div className="px-4 pt-6 pb-4 no-print">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
            <div className="flex items-center gap-3">
              <Link href="/trading-os">
                <button className="h-8 w-8 flex items-center justify-center rounded-xl transition-colors hover:opacity-70"
                  style={GLASS}>
                  <ArrowLeft className="h-4 w-4" style={{ color: C.sub }} />
                </button>
              </Link>
              <div>
                <h1 className="text-xl font-bold" style={{ color: C.text }}>Personal Hedge Fund Report</h1>
                <p className="text-xs" style={{ color: C.sub }}>Institutional-grade weekly performance analysis</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={reload}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors hover:opacity-70 no-print"
                style={GLASS}>
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} style={{ color: C.sub }} />
                Refresh
              </button>
              <button onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors hover:opacity-80 no-print"
                style={{ background: C.purple, color: "#fff" }}>
                <Download className="h-4 w-4" />
                Download PDF
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 pb-16 max-w-3xl mx-auto">
          {loading ? (
            <div className="flex flex-col gap-4">
              <Skel className="h-24" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[0,1,2,3].map(i => <Skel key={i} className="h-20" />)}
              </div>
              <Skel className="h-36" />
              <Skel className="h-28" />
              <Skel className="h-28" />
            </div>
          ) : error || (d as Record<string, unknown>)?.error ? (
            <div className="rounded-2xl p-8 text-center print-card" style={CARD}>
              <FileText className="h-10 w-10 mx-auto mb-3" style={{ color: C.sub }} />
              <p className="text-sm" style={{ color: C.sub }}>
                {((d as Record<string, unknown>)?.error as string) ?? error}
              </p>
              <button onClick={reload} className="mt-4 px-4 py-2 rounded-xl text-sm font-medium no-print"
                style={{ background: `${C.purple}20`, color: C.purple, border: `1px solid ${C.purple}40` }}>
                Try again
              </button>
            </div>
          ) : d ? (
            <div className="flex flex-col gap-5">
              {/* Report header card */}
              <div className="rounded-2xl p-6 print-card"
                style={{ ...CARD, background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(220 40% 8%) 100%)" }}>
                <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: C.sub }}>
                  WEEKLY PERFORMANCE REPORT · TRADE LAB
                </p>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <p className="text-2xl font-bold" style={{ color: C.text }}>{d.headline as string}</p>
                  {d.analystRating && (
                    <span className="text-sm px-3 py-1 rounded-full font-semibold shrink-0"
                      style={{
                        background: `${ratingColor(d.analystRating as string)}20`,
                        color: ratingColor(d.analystRating as string),
                        border: `1px solid ${ratingColor(d.analystRating as string)}40`,
                      }}>
                      {d.analystRating as string}
                    </span>
                  )}
                </div>
              </div>

              {/* Metrics */}
              {d.metrics && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Win Rate",   value: `${(d.metrics as Record<string, unknown>).winRate}%`,  color: (d.metrics as Record<string, number>).winRate >= 50 ? C.green : C.red },
                    { label: "Sharpe",     value: `${(d.metrics as Record<string, unknown>).sharpe}`,    color: (d.metrics as Record<string, number>).sharpe >= 1 ? C.green : C.amber },
                    { label: "Drawdown",   value: `-${(d.metrics as Record<string, unknown>).drawdown}%`, color: (d.metrics as Record<string, number>).drawdown < 15 ? C.green : C.red },
                    { label: "Avg Return", value: `${(d.metrics as Record<string, number>).avgReturn >= 0 ? "+" : ""}${(d.metrics as Record<string, unknown>).avgReturn}%`, color: (d.metrics as Record<string, number>).avgReturn >= 0 ? C.green : C.red },
                  ].map(m => (
                    <div key={m.label} className="rounded-2xl p-4 text-center print-card" style={GLASS}>
                      <p className="text-2xl font-bold font-mono mb-1" style={{ color: m.color }}>{m.value}</p>
                      <p className="text-[10px] font-mono uppercase" style={{ color: C.sub }}>{m.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Performance summary */}
              <div className="rounded-2xl p-6 print-card" style={CARD}>
                <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: C.sub }}>Performance Summary</p>
                <p className="text-sm leading-relaxed" style={{ color: C.text }}>{d.performanceSummary as string}</p>
              </div>

              {/* Strengths + Improvements */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl p-5 print-card" style={CARD}>
                  <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: C.green }}>Strengths Found</p>
                  <div className="flex flex-col gap-2.5">
                    {((d.strengthsFound ?? []) as string[]).map((s, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: C.green }} />
                        <p className="text-sm" style={{ color: C.text }}>{s}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl p-5 print-card" style={CARD}>
                  <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: C.amber }}>Areas for Improvement</p>
                  <div className="flex flex-col gap-2.5">
                    {((d.areasForImprovement ?? []) as string[]).map((a, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <ArrowUpRight className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: C.amber }} />
                        <p className="text-sm" style={{ color: C.text }}>{a}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Psychology + Focus */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl p-5 print-card" style={GLASS}>
                  <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: C.sub }}>Psychology Note</p>
                  <p className="text-sm" style={{ color: C.text }}>{d.psychologyNote as string}</p>
                </div>
                <div className="rounded-2xl p-5 print-card" style={{ ...GLASS, border: `1px solid ${C.cyan}40` }}>
                  <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: C.cyan }}>Next Week Focus</p>
                  <p className="text-sm font-medium" style={{ color: C.text }}>{d.nextWeekFocus as string}</p>
                </div>
              </div>

              {/* Footer */}
              <p className="text-[10px] text-center font-mono pb-4" style={{ color: C.sub }}>
                Generated {d.generatedAt ? new Date(d.generatedAt as string).toLocaleDateString() : "now"} · Powered by AI analysis of your full trading history · Trade Lab
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
