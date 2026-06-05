import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useListStrategies, useListBacktests } from "@workspace/api-client-react";
import { AuthModal } from "@/components/auth-modal";
import { useLocation } from "wouter";
import {
  User, Mail, Calendar, BarChart2, TrendingUp, Trophy, LogOut,
  Star, Zap, Brain, Shield, CheckCircle, Target, Activity,
  CreditCard, Settings, ArrowRight, Lock,
} from "lucide-react";
import { Link } from "wouter";

function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: React.ElementType;
  color: string; sub?: string;
}) {
  return (
    <div className="p-4 rounded-2xl border flex flex-col gap-2" style={{
      background: "rgba(255,255,255,0.02)",
      borderColor: "rgba(255,255,255,0.08)",
    }}>
      <div className="flex items-center gap-2">
        <span className="h-7 w-7 rounded-xl flex items-center justify-center" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
          <Icon style={{ height: "13px", width: "13px", color }} />
        </span>
        <span className="text-[11px] uppercase tracking-widest font-mono" style={{ color: "hsl(220,14%,40%)" }}>{label}</span>
      </div>
      <div className="text-[22px] font-bold tracking-tight" style={{ color: "hsl(220,14%,92%)" }}>{value}</div>
      {sub && <div className="text-[11px]" style={{ color: "hsl(220,14%,40%)" }}>{sub}</div>}
    </div>
  );
}

function Achievement({ icon: Icon, label, desc, unlocked, color }: {
  icon: React.ElementType; label: string; desc: string; unlocked: boolean; color: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border transition-all" style={{
      background: unlocked ? `${color}08` : "rgba(255,255,255,0.02)",
      borderColor: unlocked ? `${color}25` : "rgba(255,255,255,0.06)",
      opacity: unlocked ? 1 : 0.45,
    }}>
      <span className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{
        background: unlocked ? `${color}18` : "rgba(255,255,255,0.05)",
        border: `1px solid ${unlocked ? `${color}30` : "rgba(255,255,255,0.08)"}`,
      }}>
        <Icon style={{ height: "16px", width: "16px", color: unlocked ? color : "hsl(220,14%,35%)" }} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold" style={{ color: unlocked ? "hsl(220,14%,88%)" : "hsl(220,14%,45%)" }}>{label}</div>
        <div className="text-[11px]" style={{ color: "hsl(220,14%,38%)" }}>{desc}</div>
      </div>
      {unlocked && <CheckCircle style={{ height: "14px", width: "14px", color, flexShrink: 0 }} />}
    </div>
  );
}

export default function ProfilePage() {
  const { user, signout } = useAuth();
  const [, setLocation] = useLocation();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { data: strategies } = useListStrategies();
  const { data: backtests } = useListBacktests();

  useEffect(() => {
    if (!user) setShowAuthModal(true);
  }, [user]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <Lock style={{ height: "24px", width: "24px", color: "hsl(220,14%,40%)" }} />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold mb-1" style={{ color: "hsl(220,14%,88%)" }}>Sign in to view profile</h2>
          <p className="text-sm" style={{ color: "hsl(220,14%,45%)" }}>Create an account to track your trading statistics.</p>
        </div>
        <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </div>
    );
  }

  const totalBacktests = backtests?.length ?? 0;
  const totalStrategies = strategies?.length ?? 0;
  const joinDate = new Date();
  joinDate.setFullYear(joinDate.getFullYear() - 1);

  const backtestArray = Array.isArray(backtests) ? backtests : [];
  const avgReturn = backtestArray.length > 0
    ? backtestArray.reduce((s, b) => s + Number(b.totalReturn ?? 0), 0) / backtestArray.length
    : 0;

  const bestBacktest = backtestArray.length > 0
    ? backtestArray.reduce((best, b) => Number(b.totalReturn ?? -Infinity) > Number(best.totalReturn ?? -Infinity) ? b : best, backtestArray[0])
    : null;

  const worstBacktest = backtestArray.length > 0
    ? backtestArray.reduce((worst, b) => Number(b.totalReturn ?? Infinity) < Number(worst.totalReturn ?? Infinity) ? b : worst, backtestArray[0])
    : null;

  const avgWinRate = backtestArray.length > 0
    ? backtestArray.reduce((s, b) => s + Number(b.winRate ?? 0), 0) / backtestArray.length
    : 0;

  return (
    <motion.div
      className="space-y-6 max-w-4xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Profile Header Card */}
      <div className="p-6 rounded-3xl border flex flex-col sm:flex-row items-start sm:items-center gap-5" style={{
        background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.05))",
        borderColor: "rgba(99,102,241,0.2)",
        boxShadow: "0 0 0 1px rgba(99,102,241,0.08) inset",
      }}>
        <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-bold flex-shrink-0" style={{
          background: "linear-gradient(135deg, #6366f1, #a855f7)",
          color: "white",
          boxShadow: "0 4px 24px rgba(99,102,241,0.35)",
        }}>
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight mb-0.5" style={{ color: "hsl(220,14%,92%)" }}>
            {user.name}
          </h1>
          <div className="flex items-center gap-1.5 text-sm" style={{ color: "hsl(220,14%,50%)" }}>
            <Mail style={{ height: "12px", width: "12px" }} />
            {user.email}
          </div>
          <div className="flex items-center gap-1.5 text-sm mt-0.5" style={{ color: "hsl(220,14%,40%)" }}>
            <Calendar style={{ height: "12px", width: "12px" }} />
            Member since {joinDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/settings">
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all" style={{
              border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
              color: "hsl(220,14%,55%)", cursor: "pointer",
            }}>
              <Settings style={{ height: "12px", width: "12px" }} />
              Settings
            </button>
          </Link>
          <button
            onClick={() => { signout(); setLocation("/dashboard"); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all"
            style={{
              border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.08)",
              color: "#ef4444", cursor: "pointer",
            }}
          >
            <LogOut style={{ height: "12px", width: "12px" }} />
            Sign Out
          </button>
        </div>
      </div>

      {/* Trading Statistics */}
      <div>
        <h2 className="text-[11px] font-mono uppercase tracking-widest mb-3" style={{ color: "hsl(220,14%,38%)" }}>Trading Statistics</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <StatCard label="Backtests" value={totalBacktests} icon={BarChart2} color="#6366f1" sub="total runs" />
          <StatCard label="Strategies" value={totalStrategies} icon={Target} color="#0ea5e9" sub="created" />
          <StatCard label="Avg Return" value={`${avgReturn >= 0 ? "+" : ""}${avgReturn.toFixed(1)}%`} icon={TrendingUp}
            color={avgReturn >= 0 ? "#22c55e" : "#ef4444"} sub="across backtests" />
          <StatCard label="Win Rate" value={`${avgWinRate.toFixed(1)}%`} icon={Activity} color="#f59e0b" sub="average" />
        </div>
      </div>

      {/* Best / Worst Strategy */}
      {(bestBacktest || worstBacktest) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {bestBacktest && (
            <div className="p-4 rounded-2xl border" style={{ background: "rgba(34,197,94,0.04)", borderColor: "rgba(34,197,94,0.15)" }}>
              <div className="flex items-center gap-2 mb-3">
                <Trophy style={{ height: "14px", width: "14px", color: "#22c55e" }} />
                <span className="text-[11px] uppercase font-mono tracking-widest" style={{ color: "#22c55e" }}>Best Strategy</span>
              </div>
              <div className="text-[15px] font-semibold mb-1" style={{ color: "hsl(220,14%,88%)" }}>
                {(bestBacktest as any).strategyName ?? `Backtest #${bestBacktest.id}`}
              </div>
              <div className="text-[22px] font-bold" style={{ color: "#22c55e" }}>
                +{Number(bestBacktest.totalReturn ?? 0).toFixed(1)}%
              </div>
              <Link href={`/backtests/${bestBacktest.id}`}>
                <span className="flex items-center gap-1 text-[11px] mt-2 cursor-pointer" style={{ color: "#22c55e" }}>
                  View details <ArrowRight style={{ height: "11px", width: "11px" }} />
                </span>
              </Link>
            </div>
          )}
          {worstBacktest && (
            <div className="p-4 rounded-2xl border" style={{ background: "rgba(239,68,68,0.04)", borderColor: "rgba(239,68,68,0.15)" }}>
              <div className="flex items-center gap-2 mb-3">
                <Activity style={{ height: "14px", width: "14px", color: "#ef4444" }} />
                <span className="text-[11px] uppercase font-mono tracking-widest" style={{ color: "#ef4444" }}>Needs Work</span>
              </div>
              <div className="text-[15px] font-semibold mb-1" style={{ color: "hsl(220,14%,88%)" }}>
                {(worstBacktest as any).strategyName ?? `Backtest #${worstBacktest.id}`}
              </div>
              <div className="text-[22px] font-bold" style={{ color: "#ef4444" }}>
                {Number(worstBacktest.totalReturn ?? 0).toFixed(1)}%
              </div>
              <Link href={`/backtests/${worstBacktest.id}`}>
                <span className="flex items-center gap-1 text-[11px] mt-2 cursor-pointer" style={{ color: "#ef4444" }}>
                  View details <ArrowRight style={{ height: "11px", width: "11px" }} />
                </span>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Achievements */}
      <div>
        <h2 className="text-[11px] font-mono uppercase tracking-widest mb-3" style={{ color: "hsl(220,14%,38%)" }}>Achievements</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Achievement icon={Zap} label="First Backtest" desc="Run your first strategy backtest" unlocked={totalBacktests >= 1} color="#6366f1" />
          <Achievement icon={Target} label="Strategist" desc="Create 5 trading strategies" unlocked={totalStrategies >= 5} color="#0ea5e9" />
          <Achievement icon={BarChart2} label="Power User" desc="Complete 10 backtests" unlocked={totalBacktests >= 10} color="#f59e0b" />
          <Achievement icon={Trophy} label="Veteran Trader" desc="Complete 100 backtests" unlocked={totalBacktests >= 100} color="#f59e0b" />
          <Achievement icon={TrendingUp} label="Strategy Master" desc="Create 10 unique strategies" unlocked={totalStrategies >= 10} color="#22c55e" />
          <Achievement icon={Star} label="Alpha Seeker" desc="Achieve 50%+ return in a backtest" unlocked={backtestArray.some(b => Number(b.totalReturn ?? 0) >= 50)} color="#ec4899" />
          <Achievement icon={Brain} label="AI Pioneer" desc="Use AI to generate a strategy" unlocked={backtestArray.some(b => (b as any).isAiGenerated)} color="#a855f7" />
          <Achievement icon={Shield} label="Risk Manager" desc="Run 5 stress tests" unlocked={false} color="#14b8a6" />
        </div>
      </div>

      {/* Account Links */}
      <div>
        <h2 className="text-[11px] font-mono uppercase tracking-widest mb-3" style={{ color: "hsl(220,14%,38%)" }}>Account</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Subscription & Plans", desc: "Manage your plan", icon: CreditCard, href: "/pricing", color: "#6366f1" },
            { label: "Billing History", desc: "View invoices", icon: BarChart2, href: "/billing", color: "#0ea5e9" },
            { label: "Settings", desc: "Preferences & security", icon: Settings, href: "/settings", color: "#f59e0b" },
          ].map(item => (
            <Link key={item.href} href={item.href}>
              <div className="p-4 rounded-2xl border cursor-pointer transition-all hover:scale-[1.01]" style={{
                background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.08)",
              }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: `${item.color}15`, border: `1px solid ${item.color}25` }}>
                    <item.icon style={{ height: "13px", width: "13px", color: item.color }} />
                  </span>
                </div>
                <div className="text-[13px] font-semibold mb-0.5" style={{ color: "hsl(220,14%,85%)" }}>{item.label}</div>
                <div className="text-[11px]" style={{ color: "hsl(220,14%,40%)" }}>{item.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
