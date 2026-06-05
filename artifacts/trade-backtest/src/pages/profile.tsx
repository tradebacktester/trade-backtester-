import React, { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useListStrategies, useListBacktests } from "@workspace/api-client-react";
import { AuthModal } from "@/components/auth-modal";
import { useLocation, Link } from "wouter";
import {
  User, Mail, BarChart2, TrendingUp, Trophy, LogOut,
  Star, Zap, Brain, Shield, CheckCircle, Target, Activity,
  CreditCard, Settings, ArrowRight, Lock, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

function StatBox({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: React.ElementType; color: string; sub?: string;
}) {
  return (
    <div className="p-4 rounded-2xl flex flex-col gap-2.5" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>{label}</span>
        <span className="h-6 w-6 rounded-lg flex items-center justify-center" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
          <Icon style={{ height: 11, width: 11, color }} />
        </span>
      </div>
      <div className="text-[24px] font-bold tracking-tight" style={{ color: "hsl(var(--foreground))" }}>{value}</div>
      {sub && <div className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{sub}</div>}
    </div>
  );
}

function AchievementRow({ icon: Icon, label, desc, unlocked, color }: {
  icon: React.ElementType; label: string; desc: string; unlocked: boolean; color: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl transition-all" style={{
      background: unlocked ? `${color}07` : "transparent",
      border: `1px solid ${unlocked ? `${color}20` : "var(--glass-border)"}`,
      opacity: unlocked ? 1 : 0.4,
    }}>
      <span className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{
        background: unlocked ? `${color}18` : "var(--glass-bg)",
        border: `1px solid ${unlocked ? `${color}30` : "var(--glass-border)"}`,
      }}>
        <Icon style={{ height: 15, width: 15, color: unlocked ? color : "hsl(var(--muted-foreground))" }} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold" style={{ color: unlocked ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))" }}>{label}</div>
        <div className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{desc}</div>
      </div>
      {unlocked && <CheckCircle style={{ height: 13, width: 13, color, flexShrink: 0 }} />}
    </div>
  );
}

export default function ProfilePage() {
  const { user, signout } = useAuth();
  const [, setLocation] = useLocation();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { data: strategies } = useListStrategies();
  const { data: backtests } = useListBacktests();

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6">
        <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <Lock style={{ height: 24, width: 24, color: "hsl(var(--muted-foreground))" }} />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold mb-1" style={{ color: "hsl(var(--foreground))" }}>Sign in to view your profile</h2>
          <p className="text-[13px]" style={{ color: "hsl(var(--muted-foreground))" }}>Create an account to track your trading stats and achievements.</p>
        </div>
        <button
          onClick={() => setShowAuthModal(true)}
          className="px-6 py-2.5 rounded-xl text-[13px] font-semibold"
          style={{ background: "#FFFFFF", color: "#050505" }}
        >
          Sign In
        </button>
        <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </div>
    );
  }

  const backtestArray = Array.isArray(backtests) ? backtests : [];
  const totalBacktests = backtestArray.length;
  const totalStrategies = strategies?.length ?? 0;
  const avgReturn = totalBacktests > 0
    ? backtestArray.reduce((s, b) => s + Number(b.totalReturn ?? 0), 0) / totalBacktests
    : 0;
  const avgWinRate = totalBacktests > 0
    ? backtestArray.reduce((s, b) => s + Number(b.winRate ?? 0), 0) / totalBacktests
    : 0;
  const bestBacktest = totalBacktests > 0
    ? backtestArray.reduce((best, b) => Number(b.totalReturn ?? -Infinity) > Number(best.totalReturn ?? -Infinity) ? b : best, backtestArray[0])
    : null;
  const worstBacktest = totalBacktests > 0
    ? backtestArray.reduce((worst, b) => Number(b.totalReturn ?? Infinity) < Number(worst.totalReturn ?? Infinity) ? b : worst, backtestArray[0])
    : null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">

      {/* Hero card */}
      <div className="rounded-3xl p-6 relative overflow-hidden" style={{
        background: "linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(168,85,247,0.06) 100%)",
        border: "1px solid rgba(99,102,241,0.2)",
      }}>
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 80% at 0% 0%, rgba(99,102,241,0.12) 0%, transparent 60%)" }} />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar */}
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-bold flex-shrink-0" style={{
            background: "linear-gradient(135deg, #6366f1, #a855f7)",
            color: "#fff",
            boxShadow: "0 4px 24px rgba(99,102,241,0.4)",
          }}>
            {user.name.charAt(0).toUpperCase()}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-[22px] font-bold tracking-tight mb-1" style={{ color: "hsl(var(--foreground))" }}>{user.name}</h1>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1.5 text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                <Mail style={{ height: 11, width: 11 }} />{user.email}
              </span>
              <span className="flex items-center gap-1.5 text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                <User style={{ height: 11, width: 11 }} />User #{user.id}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link href="/settings">
              <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "hsl(var(--muted-foreground))" }}>
                <Settings style={{ height: 12, width: 12 }} />Settings
              </button>
            </Link>
            <button
              onClick={() => { signout(); setLocation("/dashboard"); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}
            >
              <LogOut style={{ height: 12, width: 12 }} />Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div>
        <p className="text-[10px] uppercase tracking-widest font-mono mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>Trading Statistics</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox label="Backtests" value={totalBacktests} icon={BarChart2} color="#6366f1" sub="total runs" />
          <StatBox label="Strategies" value={totalStrategies} icon={Target} color="#0ea5e9" sub="created" />
          <StatBox label="Avg Return" value={`${avgReturn >= 0 ? "+" : ""}${avgReturn.toFixed(1)}%`} icon={TrendingUp} color={avgReturn >= 0 ? "#22c55e" : "#ef4444"} sub="across all backtests" />
          <StatBox label="Win Rate" value={`${avgWinRate.toFixed(1)}%`} icon={Activity} color="#f59e0b" sub="average" />
        </div>
      </div>

      {/* Best / Worst */}
      {(bestBacktest || worstBacktest) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {bestBacktest && (
            <Link href={`/backtests/${bestBacktest.id}`}>
              <div className="p-4 rounded-2xl border cursor-pointer hover:scale-[1.01] transition-transform" style={{ background: "rgba(34,197,94,0.04)", borderColor: "rgba(34,197,94,0.18)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Trophy style={{ height: 13, width: 13, color: "#22c55e" }} />
                  <span className="text-[10px] uppercase font-mono tracking-widest" style={{ color: "#22c55e" }}>Best Strategy</span>
                </div>
                <div className="text-[14px] font-semibold mb-1" style={{ color: "hsl(var(--foreground))" }}>
                  {(bestBacktest as any).strategyName ?? `Backtest #${bestBacktest.id}`}
                </div>
                <div className="flex items-end justify-between">
                  <div className="text-[24px] font-bold" style={{ color: "#22c55e" }}>
                    +{Number(bestBacktest.totalReturn ?? 0).toFixed(1)}%
                  </div>
                  <div className="flex items-center gap-1 text-[11px]" style={{ color: "#22c55e" }}>
                    View <ArrowUpRight style={{ height: 11, width: 11 }} />
                  </div>
                </div>
              </div>
            </Link>
          )}
          {worstBacktest && (
            <Link href={`/backtests/${worstBacktest.id}`}>
              <div className="p-4 rounded-2xl border cursor-pointer hover:scale-[1.01] transition-transform" style={{ background: "rgba(239,68,68,0.04)", borderColor: "rgba(239,68,68,0.18)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Activity style={{ height: 13, width: 13, color: "#ef4444" }} />
                  <span className="text-[10px] uppercase font-mono tracking-widest" style={{ color: "#ef4444" }}>Needs Work</span>
                </div>
                <div className="text-[14px] font-semibold mb-1" style={{ color: "hsl(var(--foreground))" }}>
                  {(worstBacktest as any).strategyName ?? `Backtest #${worstBacktest.id}`}
                </div>
                <div className="flex items-end justify-between">
                  <div className="text-[24px] font-bold" style={{ color: "#ef4444" }}>
                    {Number(worstBacktest.totalReturn ?? 0).toFixed(1)}%
                  </div>
                  <div className="flex items-center gap-1 text-[11px]" style={{ color: "#ef4444" }}>
                    View <ArrowDownRight style={{ height: 11, width: 11 }} />
                  </div>
                </div>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Achievements */}
      <div>
        <p className="text-[10px] uppercase tracking-widest font-mono mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>Achievements</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <AchievementRow icon={Zap} label="First Backtest" desc="Run your first strategy backtest" unlocked={totalBacktests >= 1} color="#6366f1" />
          <AchievementRow icon={Target} label="Strategist" desc="Create 5 trading strategies" unlocked={totalStrategies >= 5} color="#0ea5e9" />
          <AchievementRow icon={BarChart2} label="Power User" desc="Complete 10 backtests" unlocked={totalBacktests >= 10} color="#f59e0b" />
          <AchievementRow icon={Trophy} label="Veteran Trader" desc="Complete 100 backtests" unlocked={totalBacktests >= 100} color="#f59e0b" />
          <AchievementRow icon={TrendingUp} label="Strategy Master" desc="Create 10 unique strategies" unlocked={totalStrategies >= 10} color="#22c55e" />
          <AchievementRow icon={Star} label="Alpha Seeker" desc="Achieve 50%+ return in a backtest" unlocked={backtestArray.some(b => Number(b.totalReturn ?? 0) >= 50)} color="#ec4899" />
          <AchievementRow icon={Brain} label="AI Pioneer" desc="Use AI to generate a strategy" unlocked={backtestArray.some(b => (b as any).isAiGenerated)} color="#a855f7" />
          <AchievementRow icon={Shield} label="Risk Manager" desc="Run 5 stress tests" unlocked={false} color="#14b8a6" />
        </div>
      </div>

      {/* Account links */}
      <div>
        <p className="text-[10px] uppercase tracking-widest font-mono mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>Account</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Subscription & Plans", desc: "Manage your plan", icon: CreditCard, href: "/pricing", color: "#6366f1" },
            { label: "Billing History", desc: "View invoices", icon: BarChart2, href: "/billing", color: "#0ea5e9" },
            { label: "Settings", desc: "Preferences & security", icon: Settings, href: "/settings", color: "#f59e0b" },
          ].map(item => (
            <Link key={item.href} href={item.href}>
              <div className="p-4 rounded-2xl border cursor-pointer group hover:scale-[1.01] transition-all" style={{ background: "var(--glass-bg)", borderColor: "var(--glass-border)" }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: `${item.color}15`, border: `1px solid ${item.color}25` }}>
                    <item.icon style={{ height: 14, width: 14, color: item.color }} />
                  </span>
                  <ArrowRight style={{ height: 13, width: 13, color: "hsl(var(--muted-foreground))", opacity: 0 }} className="group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="text-[13px] font-semibold mb-0.5" style={{ color: "hsl(var(--foreground))" }}>{item.label}</div>
                <div className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{item.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
