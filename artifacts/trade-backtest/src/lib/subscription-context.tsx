import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./auth-context";
import { API_BASE } from "@/lib/api-config";

export interface PlanFeatures {
  maxBacktestsPerMonth: number;
  aiQueriesPerDay: number;
  maxLeverage: number;
  communityPost: boolean;
  replayMode: boolean;
  multiTfView: boolean;
  dataExport: boolean;
  priorityBadge: boolean;
  allIndicators: boolean;
}

export interface SubscriptionPlan {
  id: number;
  name: string;
  slug: string;
  description: string;
  priceMonthly: number;
  currency: string;
  features: PlanFeatures;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
}

export interface UserSubscription {
  id: number;
  planId: number;
  status: string;
  grantedByAdmin: boolean;
  currentPeriodEnd: string | null;
  createdAt: string;
}

interface SubscriptionContextType {
  plan: SubscriptionPlan | null;
  subscription: UserSubscription | null;
  loading: boolean;
  refresh: () => void;
  isPro: boolean;
  isElite: boolean;
  canAccess: (feature: keyof PlanFeatures) => boolean;
}

const FREE_FEATURES: PlanFeatures = {
  maxBacktestsPerMonth: 5,
  aiQueriesPerDay: 0,
  maxLeverage: 5,
  communityPost: false,
  replayMode: false,
  multiTfView: false,
  dataExport: false,
  priorityBadge: false,
  allIndicators: false,
};

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!user) { setPlan(null); setSubscription(null); return; }
    setLoading(true);
    try {
      const token = localStorage.getItem("tt_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/subscription/status`, { headers });
      if (res.ok) {
        const data = await res.json();
        setPlan(data.plan ?? null);
        setSubscription(data.subscription ?? null);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const features = plan?.features ?? FREE_FEATURES;
  const slug = plan?.slug ?? "free";
  const isPro = slug === "pro" || slug === "elite";
  const isElite = slug === "elite";

  function canAccess(feature: keyof PlanFeatures): boolean {
    const val = features[feature];
    if (typeof val === "boolean") return val;
    if (typeof val === "number") return val !== 0;
    return false;
  }

  return (
    <SubscriptionContext.Provider value={{ plan, subscription, loading, refresh: fetchStatus, isPro, isElite, canAccess }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be within SubscriptionProvider");
  return ctx;
}
