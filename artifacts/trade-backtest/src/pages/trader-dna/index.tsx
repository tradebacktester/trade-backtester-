import React from "react";
import { Link } from "wouter";
import { Dna, BarChart2, Brain, Shield, BookOpen, Activity, ArrowRight, Sparkles } from "lucide-react";

const C = {
  text:   "hsl(var(--foreground))",
  sub:    "hsl(var(--muted-foreground))",
  border: "hsl(var(--border))",
};

const CARD: React.CSSProperties = {
  background: "var(--card-bg)",
  border: "1px solid hsl(var(--border))",
  boxShadow: "var(--shadow-card)",
};

const FEATURES = [
  {
    icon: BarChart2,
    title: "Performance",
    desc: "Win rate, Sharpe ratio, profit factor, drawdown, and trade history across all your backtests.",
    url: "/analytics",
    color: "#22c55e",
    cta: "View Analytics",
  },
  {
    icon: Brain,
    title: "Psychology",
    desc: "Discover your trading psychology profile and match your personality to optimal strategy styles.",
    url: "/psych-match",
    color: "#a855f7",
    cta: "Psych Match",
  },
  {
    icon: Shield,
    title: "Risk Profile",
    desc: "Analyze your risk behavior, position sizing patterns, and behavioral risk metrics.",
    url: "/analytics",
    color: "#f59e0b",
    cta: "Risk Metrics",
  },
  {
    icon: BookOpen,
    title: "Trade Journal",
    desc: "Log notes, emotions, and mistakes for each trade to build self-awareness over time.",
    url: "/backtests",
    color: "#3b82f6",
    cta: "Open Journal",
  },
  {
    icon: Activity,
    title: "Session Analysis",
    desc: "Identify your best and worst trading sessions, days of the week, and market conditions.",
    url: "/analytics",
    color: "#06b6d4",
    cta: "Coming Soon",
    soon: true,
  },
  {
    icon: Dna,
    title: "Strategy DNA",
    desc: "Deep-dive analysis of your strategy patterns, genetic optimization, and performance DNA.",
    url: "/strategy-dna",
    color: "#ec4899",
    cta: "Strategy DNA",
  },
] as const;

export default function TraderDnaPage() {
  return (
    <div className="flex flex-col gap-6 pb-4 page-enter">

      {/* Hero */}
      <div
        className="rounded-3xl p-6 sm:p-8 relative overflow-hidden"
        style={{
          background: "var(--card-bg)",
          border: "1px solid hsl(var(--border))",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 60% 80% at 100% 50%, rgba(168,85,247,0.07) 0%, transparent 65%)" }} />
        <div className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 50% 60% at 0% 30%, rgba(99,102,241,0.05) 0%, transparent 65%)" }} />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.25)" }}>
            <Dna className="h-7 w-7" style={{ color: "#a855f7" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-3xl sm:text-[36px] font-bold" style={{ color: C.text, letterSpacing: "-0.032em" }}>
                Trader DNA
              </h1>
              <span className="flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded-full"
                style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.25)", color: "#a855f7" }}>
                <Sparkles style={{ height: "8px", width: "8px" }} />
                AI-Powered
              </span>
            </div>
            <p className="text-sm font-mono" style={{ color: C.sub }}>
              Your personal trading intelligence center. Understand your performance, psychology,
              and behavioral patterns to become a consistently better trader.
            </p>
          </div>
        </div>
      </div>

      {/* Section grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map((f) => (
          <Link key={f.title} href={f.url}>
            <div
              className="rounded-2xl p-5 flex flex-col gap-4 h-full cursor-pointer group"
              style={{
                ...CARD,
                transition: "border-color 0.18s ease, box-shadow 0.18s ease",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = `${f.color}40`;
                (e.currentTarget as HTMLElement).style.boxShadow = `var(--shadow-card), 0 0 0 1px ${f.color}20`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = C.border;
                (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card)";
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${f.color}12`, border: `1px solid ${f.color}25` }}>
                  <f.icon style={{ height: "18px", width: "18px", color: f.color }} />
                </div>
                {f.soon && (
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: C.sub }}>
                    Coming Soon
                  </span>
                )}
              </div>

              <div className="flex-1">
                <h3 className="text-[15px] font-semibold mb-1.5" style={{ color: C.text }}>{f.title}</h3>
                <p className="text-[12px] font-mono leading-relaxed" style={{ color: C.sub }}>{f.desc}</p>
              </div>

              <div className="flex items-center gap-1.5 text-[12px] font-mono font-medium"
                style={{ color: f.soon ? C.sub : f.color }}>
                {f.cta}
                <ArrowRight style={{
                  height: "12px", width: "12px",
                  transform: "translateX(0)",
                  transition: "transform 0.18s ease",
                }} className="group-hover:translate-x-0.5" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Coming soon banner */}
      <div
        className="rounded-2xl p-5 flex items-center gap-4"
        style={{ background: "var(--glass-bg)", border: "1px solid hsl(var(--border))" }}
      >
        <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)" }}>
          <Sparkles className="h-5 w-5" style={{ color: "#a855f7" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold mb-0.5" style={{ color: C.text }}>
            AI Coaching Engine — Coming Soon
          </p>
          <p className="text-[11px] font-mono" style={{ color: C.sub }}>
            Behavioral mistake detection, live trade warnings, session analysis heatmaps, and personalized coaching insights based on your full trading history.
          </p>
        </div>
      </div>

    </div>
  );
}
