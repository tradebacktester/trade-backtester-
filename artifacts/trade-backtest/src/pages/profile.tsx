import React, { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useListStrategies, useListBacktests } from "@workspace/api-client-react";
import type { Backtest } from "@workspace/api-client-react";
import { AuthModal } from "@/components/auth-modal";
import { useLocation, Link } from "wouter";
import {
  User, Mail, BarChart2, TrendingUp, Trophy, LogOut,
  Star, Zap, Brain, Shield, CheckCircle, Target, Activity,
  CreditCard, Settings, ArrowRight, Lock, ArrowUpRight, ArrowDownRight,
  Pencil, X, Check, Loader2,
} from "lucide-react";
import { API_BASE } from "@/lib/api-config";

interface BacktestDetail extends Backtest {
  strategyName?: string;
  isAiGenerated?: boolean;
}

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
  const { user, token, setUser, signout } = useAuth();
  const [, setLocation] = useLocation();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { data: strategies } = useListStrategies({ query: { enabled: !!token } });
  const { data: backtests } = useListBacktests({ query: { enabled: !!token } });

  // Username editing state
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [nameSuccess, setNameSuccess] = useState(false);

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

  async function handleSaveName() {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed.length < 2) { setNameError("Name must be at least 2 characters"); return; }
    if (trimmed.length > 60) { setNameError("Name must be at most 60 characters"); return; }
    setNameSaving(true);
    setNameError("");
    try {
      const res = await fetch(`${API_BASE}/api/users/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setNameError((err as any).error ?? "Failed to update name");
        return;
      }
      const updated = await res.json() as { id: number; name: string; email: string };
      setUser({ ...user, name: updated.name });
      setEditingName(false);
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
    } catch {
      setNameError("Network error — please try again");
    } finally {
      setNameSaving(false);
    }
  }

  function startEditing() {
    setNameInput(user.name);
    setNameError("");
    setEditingName(true);
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">

      {/* Hero card */}
      <div className="rounded-3xl p-6 relative overflow-hidden" style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)",
        border: "1px solid rgba(255,255,255,0.14)",
        backdropFilter: "blur(24px) saturate(160%)",
        WebkitBackdropFilter: "blur(24px) saturate(160%)",
        boxShadow: "0 4px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.20)",
      }}>
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 55% 70% at 0% 0%, rgba(255,255,255,0.06) 0%, transparent 60%)" }} />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar */}
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-bold flex-shrink-0" style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.07))",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.24)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.50), inset 0 1px 0 rgba(255,255,255,0.28)",
          }}>
            {user.name.charAt(0).toUpperCase()}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={nameInput}
                    onChange={e => { setNameInput(e.target.value); setNameError(""); }}
                    onKeyDown={e => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }}
                    className="text-[18px] font-bold rounded-lg px-3 py-1.5 flex-1 min-w-0 outline-none"
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.2)", color: "hsl(var(--foreground))" }}
                    placeholder="Your display name"
                    maxLength={60}
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={nameSaving}
                    className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
                    style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e" }}
                  >
                    {nameSaving ? <Loader2 style={{ height: 14, width: 14 }} className="animate-spin" /> : <Check style={{ height: 14, width: 14 }} />}
                  </button>
                  <button
                    onClick={() => setEditingName(false)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "hsl(var(--muted-foreground))" }}
                  >
                    <X style={{ height: 14, width: 14 }} />
                  </button>
                </div>
                {nameError && <p className="text-[11px]" style={{ color: "#ef4444" }}>{nameError}</p>}
                <p className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>Press Enter to save, Escape to cancel</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "hsl(var(--foreground))" }}>{user.name}</h1>
                  <button
                    onClick={startEditing}
                    title="Change display name"
                    className="h-7 w-7 rounded-lg flex items-center justify-center transition-all opacity-50 hover:opacity-100"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    <Pencil style={{ height: 11, width: 11, color: "hsl(var(--muted-foreground))" }} />
                  </button>
                  {nameSuccess && (
                    <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: "#22c55e" }}>
                      <Check style={{ height: 10, width: 10 }} /> Saved
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1.5 text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                    <Mail style={{ height: 11, width: 11 }} />{user.email}
                  </span>
                  <span className="flex items-center gap-1.5 text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                    <User style={{ height: 11, width: 11 }} />User #{user.id}
                  </span>
                </div>
              </div>
            )}
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
          <StatBox label="Backtests" value={totalBacktests} icon={BarChart2} color="rgba(255,255,255,0.65)" sub="total runs" />
          <StatBox label="Strategies" value={totalStrategies} icon={Target} color="rgba(255,255,255,0.65)" sub="created" />
          <StatBox label="Avg Return" value={`${avgReturn >= 0 ? "+" : ""}${avgReturn.toFixed(1)}%`} icon={TrendingUp} color={avgReturn >= 0 ? "#22c55e" : "#ef4444"} sub="across all backtests" />
          <StatBox label="Win Rate" value={`${avgWinRate.toFixed(1)}%`} icon={Activity} color="rgba(255,255,255,0.65)" sub="average" />
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
                  {(bestBacktest as BacktestDetail).strategyName ?? `Backtest #${bestBacktest.id}`}
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
                  {(worstBacktest as BacktestDetail).strategyName ?? `Backtest #${worstBacktest.id}`}
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
          <AchievementRow icon={Zap} label="First Backtest" desc="Run your first strategy backtest" unlocked={totalBacktests >= 1} color="rgba(255,255,255,0.80)" />
          <AchievementRow icon={Target} label="Strategist" desc="Create 5 trading strategies" unlocked={totalStrategies >= 5} color="rgba(255,255,255,0.80)" />
          <AchievementRow icon={BarChart2} label="Power User" desc="Complete 10 backtests" unlocked={totalBacktests >= 10} color="rgba(255,255,255,0.80)" />
          <AchievementRow icon={Trophy} label="Veteran Trader" desc="Complete 100 backtests" unlocked={totalBacktests >= 100} color="rgba(255,255,255,0.80)" />
          <AchievementRow icon={TrendingUp} label="Strategy Master" desc="Create 10 unique strategies" unlocked={totalStrategies >= 10} color="rgba(255,255,255,0.80)" />
          <AchievementRow icon={Star} label="Alpha Seeker" desc="Achieve 50%+ return in a backtest" unlocked={backtestArray.some(b => Number(b.totalReturn ?? 0) >= 50)} color="rgba(255,255,255,0.80)" />
          <AchievementRow icon={Brain} label="AI Pioneer" desc="Use AI to generate a strategy" unlocked={backtestArray.some(b => (b as BacktestDetail).isAiGenerated)} color="rgba(255,255,255,0.80)" />
          <AchievementRow icon={Shield} label="Risk Manager" desc="Run 5 stress tests" unlocked={false} color="rgba(255,255,255,0.80)" />
        </div>
      </div>

      {/* Account links */}
      <div>
        <p className="text-[10px] uppercase tracking-widest font-mono mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>Account</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Subscription & Plans", desc: "Manage your plan", icon: CreditCard, href: "/pricing", color: "rgba(255,255,255,0.65)" },
            { label: "Billing History", desc: "View invoices", icon: BarChart2, href: "/billing", color: "rgba(255,255,255,0.65)" },
            { label: "Settings", desc: "Preferences & security", icon: Settings, href: "/settings", color: "rgba(255,255,255,0.65)" },
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
