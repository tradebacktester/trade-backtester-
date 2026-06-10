import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { X, ArrowRight, BarChart2, Cpu, TrendingUp, Sparkles, CheckCircle2 } from "lucide-react";

const STORAGE_KEY = "tt_onboarding_v1";

interface Step {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: string;
  path: string;
  color: string;
}

const STEPS: Step[] = [
  {
    icon: <BarChart2 className="h-7 w-7" />,
    title: "Create Your First Strategy",
    description: "Choose an indicator type (SMA, RSI, MACD…) and configure its parameters. Your strategy defines the rules for entering and exiting trades.",
    action: "Create Strategy",
    path: "/strategies/new",
    color: "#06b6d4",
  },
  {
    icon: <TrendingUp className="h-7 w-7" />,
    title: "Run a Backtest",
    description: "Pick a symbol, date range, and initial capital. The engine will simulate your strategy against historical price data and score it.",
    action: "New Backtest",
    path: "/backtests/new",
    color: "#22c55e",
  },
  {
    icon: <Cpu className="h-7 w-7" />,
    title: "Analyze Performance",
    description: "View your Sharpe ratio, max drawdown, win rate, and equity curve. Use the optimizer tab to search for better parameter values.",
    action: "View Backtests",
    path: "/backtests",
    color: "#a855f7",
  },
  {
    icon: <Sparkles className="h-7 w-7" />,
    title: "Explore AI Insights",
    description: "The AI Trader OS analyzes your trading history and gives personalized coaching — health score, rank, FOMO detector, and more.",
    action: "Open AI OS",
    path: "/trading-os",
    color: "#f59e0b",
  },
];

export function OnboardingWizard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!user) return;
    const done = localStorage.getItem(STORAGE_KEY);
    if (done) return;
    const timer = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(timer);
  }, [user]);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  }

  function goToStep(path: string) {
    dismiss();
    setLocation(path);
  }

  function nextStep() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      dismiss();
    }
  }

  if (!open) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
      >
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 h-7 w-7 flex items-center justify-center rounded-full z-10 transition-colors hover:bg-muted"
          style={{ color: "hsl(var(--muted-foreground))" }}
        >
          <X className="h-4 w-4" />
        </button>

        {/* Progress dots */}
        <div className="flex gap-1.5 px-6 pt-5 pb-0">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === step ? 24 : 8,
                background: i === step ? current.color : "hsl(var(--muted))",
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: `${current.color}18`, color: current.color, border: `1px solid ${current.color}30` }}
          >
            {current.icon}
          </div>

          <div className="mb-1 text-[11px] font-mono uppercase tracking-widest" style={{ color: "hsl(var(--muted-foreground))" }}>
            Step {step + 1} of {STEPS.length}
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: "hsl(var(--foreground))" }}>
            {current.title}
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
            {current.description}
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex items-center gap-3">
          <button
            onClick={() => goToStep(current.path)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
            style={{ background: current.color, color: "#fff" }}
          >
            {current.action}
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={nextStep}
            className="px-4 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-muted"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            {isLast ? (
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />Done</span>
            ) : "Skip →"}
          </button>
        </div>

        {/* Welcome hint on step 0 */}
        {step === 0 && (
          <div className="mx-6 mb-5 px-3 py-2.5 rounded-xl text-[12px]"
            style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>
            👋 Welcome! This quick guide walks you through the core TradeLab workflow in 4 steps.
          </div>
        )}
      </div>
    </div>
  );
}
