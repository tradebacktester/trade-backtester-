import React from "react";
import { useLocation } from "wouter";
import { Crown, Lock } from "lucide-react";
import { useSubscription, type PlanFeatures } from "@/lib/subscription-context";

interface PremiumGateProps {
  feature: keyof PlanFeatures;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requiredPlan?: "pro" | "elite";
}

export function PremiumGate({ feature, children, fallback, requiredPlan = "pro" }: PremiumGateProps) {
  const { canAccess } = useSubscription();
  if (canAccess(feature)) return <>{children}</>;
  if (fallback) return <>{fallback}</>;
  return <PremiumBanner requiredPlan={requiredPlan} />;
}

export function PremiumBanner({ requiredPlan = "pro" }: { requiredPlan?: "pro" | "elite" }) {
  const [, navigate] = useLocation();
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-10 rounded-2xl text-center"
      style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.2)" }}>
      <div className="h-12 w-12 rounded-full flex items-center justify-center"
        style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)" }}>
        <Crown className="h-6 w-6" style={{ color: "hsl(265,89%,70%)" }} />
      </div>
      <div>
        <p className="text-base font-semibold" style={{ color: "#111" }}>
          {requiredPlan === "elite" ? "Elite" : "Pro"} Feature
        </p>
        <p className="text-sm mt-1" style={{ color: "#888" }}>
          Upgrade to {requiredPlan === "elite" ? "Elite" : "Pro or Elite"} to unlock this feature.
        </p>
      </div>
      <button
        onClick={() => navigate("/pricing")}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
        style={{ background: "linear-gradient(135deg, hsl(265,89%,60%), hsl(285,89%,60%))", color: "#fff", boxShadow: "0 4px 16px rgba(139,92,246,0.4)" }}
      >
        <Crown className="h-4 w-4" />
        Upgrade to {requiredPlan === "elite" ? "Elite" : "Pro"}
      </button>
    </div>
  );
}

export function PremiumBadge({ plan }: { plan: string }) {
  if (plan === "free") return null;
  const isElite = plan === "elite";
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={isElite
        ? { background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(234,88,12,0.15))", border: "1px solid rgba(245,158,11,0.3)", color: "hsl(38,100%,60%)" }
        : { background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)", color: "hsl(265,89%,65%)" }
      }>
      <Crown className="h-2.5 w-2.5" />
      {isElite ? "Elite" : "Pro"}
    </span>
  );
}

export function LockedFeatureRow({ label, plan }: { label: string; plan: "pro" | "elite" }) {
  const [, navigate] = useLocation();
  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-xl opacity-60"
      style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.06)" }}>
      <div className="flex items-center gap-2">
        <Lock className="h-3.5 w-3.5" style={{ color: "#aaa" }} />
        <span className="text-sm" style={{ color: "#888" }}>{label}</span>
      </div>
      <button
        onClick={() => navigate("/pricing")}
        className="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
        style={{ background: "rgba(139,92,246,0.1)", color: "hsl(265,89%,65%)", border: "1px solid rgba(139,92,246,0.2)" }}
      >
        Upgrade
      </button>
    </div>
  );
}
