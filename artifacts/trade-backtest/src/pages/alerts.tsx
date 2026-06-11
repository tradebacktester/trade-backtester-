import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useSubscription } from "@/lib/subscription-context";
import { API_BASE } from "@/lib/api-config";
import { PremiumBanner } from "@/components/premium-gate";
import {
  Bell, BellOff, Plus, Trash2, Edit2, Sparkles, Activity,
  TrendingUp, Zap, BarChart2, DollarSign, Dna, Layers, Pencil,
  Crown, Check, X, ChevronDown, RefreshCw, BellRing,
  AlertTriangle, Info, ToggleLeft, ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AlertCondition {
  indicatorId: string;
  outputKey: string;
  operator: string;
  targetValue?: number;
  targetIndicatorId?: string;
  targetOutputKey?: string;
  logicOp: "AND" | "OR";
  groupId?: number;
  drawingId?: string;
  drawingEvent?: string;
}

interface AlertRow {
  id: number;
  name: string;
  type: "price" | "indicator" | "drawing" | "strategy" | "ai" | "dna";
  symbol: string;
  timeframe: string;
  conditions: AlertCondition[];
  deliveryChannels: string[];
  isActive: boolean;
  triggerOnce: boolean;
  triggerCount: number;
  lastTriggeredAt: string | null;
  createdAt: string;
}

interface CatalogEntry {
  key: string;
  indicatorId: string;
  outputKey: string;
  label: string;
  category: string;
  description: string;
  unit?: string;
  minPlan: "free" | "pro" | "elite";
}

interface Notification {
  id: number;
  alertId: number;
  message: string;
  isRead: boolean;
  triggeredAt: string;
}

interface UserStrategy {
  id: number;
  name: string;
  type: string;
  symbol: string;
  timeframe: string;
  parameters?: Record<string, unknown>;
}

interface SessionStat { label: string; winRate: number; trades: number; avgPnlPct: number }
interface DnaSuggestedAlert { name: string; description: string; conditions: AlertCondition[]; reasoning: string }

interface DnaAnalysis {
  totalTrades: number;
  avgWinRate: number;
  avgReturn: number;
  avgDrawdown: number;
  traderStyle: string;
  preferredSide: string;
  riskProfile: string;
  sessionStats: SessionStat[];
  bestSession: SessionStat | null;
  worstSession: SessionStat | null;
  topMistakes: { label: string; count: number }[];
  bestStrategy: { type: string; avgWinRate: number; avgReturn: number } | null;
  suggestedAlerts: DnaSuggestedAlert[];
  backtestCount: number;
}

const OPERATORS = [
  { value: "crossAbove",  label: "Crosses Above" },
  { value: "crossBelow",  label: "Crosses Below" },
  { value: "gt",          label: "Greater Than (>)" },
  { value: "lt",          label: "Less Than (<)" },
  { value: "eq",          label: "Equals (=)" },
  { value: "enters",      label: "Enters Zone" },
  { value: "exits",       label: "Exits Zone" },
  { value: "signal",      label: "Fires Signal" },
  { value: "touch",       label: "Touches Line" },
  { value: "breakAbove",  label: "Breaks Above" },
  { value: "breakBelow",  label: "Breaks Below" },
  { value: "enterZone",   label: "Enters Drawing Zone" },
  { value: "exitZone",    label: "Exits Drawing Zone" },
  { value: "fibLevel",    label: "Hits Fib Level" },
];

// Operators valid for drawing-type conditions
const DRAWING_OPERATORS = new Set(["touch", "breakAbove", "breakBelow", "enterZone", "exitZone", "fibLevel"]);

// Returns the operator list relevant for the selected indicator category
function operatorsForEntry(indicatorId: string): typeof OPERATORS {
  if (indicatorId === "drawing") return OPERATORS.filter(o => DRAWING_OPERATORS.has(o.value));
  if (indicatorId === "supertrend_10_3") return OPERATORS.filter(o => o.value === "signal" || !DRAWING_OPERATORS.has(o.value));
  return OPERATORS.filter(o => !DRAWING_OPERATORS.has(o.value) && o.value !== "signal");
}

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"];

const SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT",
  "DOGEUSDT", "AVAXUSDT", "LINKUSDT", "LTCUSDT", "DOTUSDT",
  "EURUSD", "GBPUSD", "USDJPY", "SPX500", "NAS100", "XAUUSD",
  "AAPL", "TSLA", "NVDA", "MSFT",
];

const TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string; minPlan: "free" | "pro" | "elite" }> = {
  price:     { label: "Price Alert",     icon: DollarSign, color: "hsl(142,70%,50%)",  minPlan: "free"  },
  indicator: { label: "Indicator Alert", icon: Activity,   color: "hsl(210,90%,60%)",  minPlan: "pro"   },
  drawing:   { label: "Drawing Alert",   icon: Pencil,     color: "hsl(38,100%,60%)",  minPlan: "pro"   },
  strategy:  { label: "Strategy Alert",  icon: Layers,     color: "hsl(270,90%,65%)",  minPlan: "pro"   },
  ai:        { label: "AI Alert",        icon: Sparkles,   color: "hsl(315,90%,65%)",  minPlan: "elite" },
  dna:       { label: "DNA Alert",       icon: Dna,        color: "hsl(180,90%,50%)",  minPlan: "elite" },
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  price:      DollarSign,
  trend:      TrendingUp,
  momentum:   Zap,
  volatility: Activity,
  volume:     BarChart2,
  drawing:    Pencil,
};

// ── Empty condition ────────────────────────────────────────────────────────────

function emptyCondition(logicOp: "AND" | "OR" = "AND"): AlertCondition {
  return {
    indicatorId: "price",
    outputKey: "close",
    operator: "crossAbove",
    targetValue: undefined,
    logicOp,
    groupId: 0,
  };
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const { token } = useAuth();
  const { isPro, isElite } = useSubscription();
  const { toast } = useToast();

  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [planSlug, setPlanSlug] = useState<string>("free");
  const [loading, setLoading] = useState(true);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingAlert, setEditingAlert] = useState<AlertRow | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "history" | "all">("active");
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");

  const [strategies, setStrategies] = useState<UserStrategy[]>([]);
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [selectedStrategyId, setSelectedStrategyId] = useState<number | null>(null);
  const [dnaData, setDnaData] = useState<DnaAnalysis | null>(null);
  const [dnaLoading, setDnaLoading] = useState(false);

  // ── Form state ───────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    name: "",
    type: "price" as AlertRow["type"],
    symbol: "BTCUSDT",
    timeframe: "1d",
    conditions: [emptyCondition("AND")] as AlertCondition[],
    deliveryChannels: ["in_app"] as string[],
    triggerOnce: false,
  });

  // ── Load catalog + alerts ───────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const [alertsRes, catalogRes, notifRes] = await Promise.all([
        fetch(`${API_BASE}/api/alerts`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/alerts/catalog`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/alerts/notifications`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (alertsRes.ok) {
        const d = await alertsRes.json() as { alerts: AlertRow[]; planSlug: string };
        setAlerts(d.alerts ?? []);
        setPlanSlug(d.planSlug ?? "free");
      }
      if (catalogRes.ok) {
        const d = await catalogRes.json() as { catalog: CatalogEntry[] };
        setCatalog(d.catalog ?? []);
      }
      if (notifRes.ok) {
        const d = await notifRes.json() as Notification[];
        setNotifications(d ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if ("Notification" in window) setNotifPermission(Notification.permission);
  }, []);

  // ── SSE listener: receive real-time alert_fired events ──────────────────────
  const sseRef = useRef<EventSource | null>(null);
  useEffect(() => {
    if (!token) return;
    const es = new EventSource(`${API_BASE}/api/alerts/stream?token=${encodeURIComponent(token)}`);
    sseRef.current = es;

    es.addEventListener("alert_fired", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as { alertName?: string; message?: string };
        // Refresh notifications badge
        load();
        // Browser notification if permission granted
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification(data.alertName ?? "Alert Fired", {
            body: data.message ?? "One of your Trade Lab alerts was triggered.",
            icon: "/favicon.ico",
          });
        }
      } catch { /* ignore malformed event */ }
    });

    es.onerror = () => {
      es.close();
      sseRef.current = null;
    };

    return () => {
      es.close();
      sseRef.current = null;
    };
  }, [token, load]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const unreadCount = notifications.filter(n => !n.isRead).length;

  function openCreate(overrides?: { type?: AlertRow["type"]; symbol?: string }) {
    setEditingAlert(null);
    setForm({ name: "", type: overrides?.type ?? "price", symbol: overrides?.symbol ?? "BTCUSDT", timeframe: "1d", conditions: [emptyCondition()], deliveryChannels: ["in_app"], triggerOnce: false });
    setShowDialog(true);
  }

  // Handle ?from= query params to pre-fill the dialog from strategy/backtest/drawing links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const from = params.get("from");
    const type = params.get("type") as AlertRow["type"] | null;
    const sym = params.get("symbol");
    const stratId = params.get("strategyId");
    const stratType = params.get("strategyType");
    const stratName = params.get("strategyName");
    if (from || type) {
      let preType: AlertRow["type"] =
        type ?? (from === "drawing" ? "drawing" : from === "strategy" ? "strategy" : "price");
      const preSym = sym ?? "BTCUSDT";
      setForm(prev => ({ ...prev, type: preType, symbol: preSym }));
      setShowDialog(true);
      // Auto-load strategy conditions if strategyId + strategyType present
      if (from === "strategy" && stratId && stratType) {
        setTimeout(() => {
          const fakeStrategy: UserStrategy = {
            id: Number(stratId), name: stratName ?? stratType,
            type: stratType, symbol: preSym, timeframe: "1d",
          };
          loadFromStrategy(fakeStrategy);
        }, 300);
      }
      // Clear params without reloading
      window.history.replaceState({}, "", window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openEdit(a: AlertRow) {
    setEditingAlert(a);
    setForm({ name: a.name, type: a.type, symbol: a.symbol, timeframe: a.timeframe, conditions: a.conditions.length ? a.conditions : [emptyCondition()], deliveryChannels: a.deliveryChannels, triggerOnce: a.triggerOnce });
    setShowDialog(true);
  }

  async function saveAlert() {
    if (!token) {
      toast({ title: "Sign in required", description: "Please sign in to create and manage alerts.", variant: "destructive" });
      setShowDialog(false);
      return;
    }
    if (!form.name.trim()) { toast({ title: "Alert name is required", variant: "destructive" }); return; }

    const body = {
      name: form.name.trim(),
      type: form.type,
      symbol: form.symbol,
      timeframe: form.timeframe,
      conditions: form.conditions,
      deliveryChannels: form.deliveryChannels,
      triggerOnce: form.triggerOnce,
    };

    try {
      const url = editingAlert ? `${API_BASE}/api/alerts/${editingAlert.id}` : `${API_BASE}/api/alerts`;
      const method = editingAlert ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      const data = await res.json() as { error?: string } & AlertRow;
      if (!res.ok) { toast({ title: "Error", description: data.error ?? "Failed to save alert", variant: "destructive" }); return; }
      toast({ title: editingAlert ? "Alert updated" : "Alert created" });
      setShowDialog(false);
      load();
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
  }

  async function deleteAlert(id: number) {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/alerts/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { toast({ title: "Failed to delete alert", variant: "destructive" }); return; }
      setAlerts(prev => prev.filter(a => a.id !== id));
      toast({ title: "Alert deleted" });
    } catch {
      toast({ title: "Network error", description: "Could not delete alert", variant: "destructive" });
    }
  }

  async function toggleActive(a: AlertRow) {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/alerts/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive: !a.isActive }),
      });
      if (res.ok) {
        setAlerts(prev => prev.map(x => x.id === a.id ? { ...x, isActive: !x.isActive } : x));
      } else {
        toast({ title: "Failed to update alert", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Could not update alert", variant: "destructive" });
    }
  }

  async function markRead(id: number) {
    if (!token) return;
    await fetch(`${API_BASE}/api/alerts/notifications/${id}/read`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  }

  async function requestNotifPermission() {
    if (!("Notification" in window)) { toast({ title: "Browser notifications not supported" }); return; }
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    if (result === "granted") toast({ title: "Browser notifications enabled" });
    else toast({ title: "Notifications blocked", description: "Allow notifications in your browser settings.", variant: "destructive" });
  }

  // ── Load strategies for Strategy Alert picker ───────────────────────────────
  useEffect(() => {
    if (form.type === "strategy" && token && strategies.length === 0 && !strategyLoading) {
      fetch(`${API_BASE}/api/strategies`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then((d: { strategies?: UserStrategy[] } | null) => { if (d) setStrategies(d.strategies ?? []); })
        .catch(() => {});
    }
    if (form.type === "dna" && token && !dnaData && !dnaLoading) {
      setDnaLoading(true);
      fetch(`${API_BASE}/api/alerts/dna-analysis`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then((d: DnaAnalysis | null) => { if (d) setDnaData(d); })
        .catch(() => {})
        .finally(() => setDnaLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type, token]);

  async function loadFromStrategy(strategy: UserStrategy) {
    if (!token) return;
    setStrategyLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/alerts/from-strategy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ strategyType: strategy.type, parameters: strategy.parameters ?? {}, symbol: form.symbol, name: strategy.name }),
      });
      const d = await res.json() as { name?: string; conditions?: AlertCondition[]; error?: string; snappedPeriods?: { indicator: string; original: number; snapped: number }[] };
      if (!res.ok || d.error) { toast({ title: d.error ?? "Failed to load strategy", variant: "destructive" }); return; }
      if (d.conditions?.length) {
        setSelectedStrategyId(strategy.id);
        setForm(prev => ({ ...prev, name: d.name ?? prev.name, conditions: d.conditions! }));
        toast({ title: "Strategy conditions loaded", description: `${d.conditions.length} condition(s) applied from "${strategy.name}"` });
        if (d.snappedPeriods && d.snappedPeriods.length > 0) {
          const snapDesc = d.snappedPeriods.map(s => `${s.indicator}(${s.original}) → ${s.indicator}(${s.snapped})`).join(", ");
          toast({ title: "Indicator periods adjusted", description: `${snapDesc}. Edit the alert to use a custom period.`, variant: "default" });
        }
      }
    } finally {
      setStrategyLoading(false);
    }
  }

  function applyDnaSuggestion(suggested: DnaSuggestedAlert) {
    setForm(prev => ({ ...prev, name: suggested.name, conditions: suggested.conditions, type: "dna" }));
    toast({ title: "DNA alert applied", description: suggested.reasoning.slice(0, 80) + "…" });
  }

  async function aiSuggest() {
    if (!token || !isElite) return;
    setAiLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/alerts/ai-suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ symbol: form.symbol, timeframe: form.timeframe, alertType: form.type }),
      });
      const d = await res.json() as { name?: string; conditions?: AlertCondition[]; rationale?: string; error?: string };
      if (!res.ok || d.error) { toast({ title: d.error ?? "AI suggestion failed", variant: "destructive" }); return; }
      if (d.conditions?.length) {
        setForm(prev => ({ ...prev, name: d.name ?? prev.name, conditions: d.conditions! }));
        toast({ title: "AI suggestion applied", description: d.rationale ?? "" });
      }
    } finally {
      setAiLoading(false);
    }
  }

  // ── Condition helpers (group-aware) ──────────────────────────────────────────
  // Conditions within the same groupId are AND-ed; groups are OR-ed against each other.

  function addConditionToGroup(groupId: number) {
    setForm(prev => ({ ...prev, conditions: [...prev.conditions, { ...emptyCondition("AND"), groupId }] }));
  }

  function addGroup() {
    const ids = form.conditions.map(c => c.groupId ?? 0);
    const nextGroupId = ids.length > 0 ? Math.max(...ids) + 1 : 1;
    setForm(prev => ({ ...prev, conditions: [...prev.conditions, { ...emptyCondition("AND"), groupId: nextGroupId }] }));
  }

  function removeCondition(idx: number) {
    setForm(prev => {
      const next = prev.conditions.filter((_, i) => i !== idx);
      return { ...prev, conditions: next.length > 0 ? next : [emptyCondition("AND")] };
    });
  }

  function updateCondition(idx: number, patch: Partial<AlertCondition>) {
    setForm(prev => ({ ...prev, conditions: prev.conditions.map((c, i) => i === idx ? { ...c, ...patch } : c) }));
  }

  // Groups derived from conditions
  function getGroups(): { groupId: number; conditions: { cond: AlertCondition; globalIdx: number }[] }[] {
    const map = new Map<number, { cond: AlertCondition; globalIdx: number }[]>();
    form.conditions.forEach((cond, idx) => {
      const gid = cond.groupId ?? 0;
      if (!map.has(gid)) map.set(gid, []);
      map.get(gid)!.push({ cond, globalIdx: idx });
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([groupId, conditions]) => ({ groupId, conditions }));
  }

  // ── Plan gate check ──────────────────────────────────────────────────────────
  function canUseType(type: AlertRow["type"]): boolean {
    const meta = TYPE_META[type];
    if (!meta) return false;
    if (meta.minPlan === "free") return true;
    if (meta.minPlan === "pro") return isPro || isElite;
    if (meta.minPlan === "elite") return isElite;
    return false;
  }

  // ── Catalog grouped ──────────────────────────────────────────────────────────
  const catalogByCategory = catalog.reduce<Record<string, CatalogEntry[]>>((acc, e) => {
    if (!acc[e.category]) acc[e.category] = [];
    acc[e.category]!.push(e);
    return acc;
  }, {});

  // ── Filtered alerts ──────────────────────────────────────────────────────────
  const filtered = alerts.filter(a => {
    if (activeTab === "active") return a.isActive;
    if (activeTab === "history") return a.triggerCount > 0;
    return true;
  });

  // ── Stats ────────────────────────────────────────────────────────────────────
  const activeCount = alerts.filter(a => a.isActive).length;
  const triggeredToday = alerts.filter(a => {
    if (!a.lastTriggeredAt) return false;
    return new Date(a.lastTriggeredAt).toDateString() === new Date().toDateString();
  }).length;

  return (
    <div className="space-y-5">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Alert Engine</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            Multi-condition alerts for every indicator, drawing, and strategy
          </p>
        </div>
        <div className="flex items-center gap-2">
          {notifPermission !== "granted" && (
            <button
              onClick={requestNotifPermission}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", color: "hsl(38,100%,60%)" }}
            >
              <BellRing className="h-3.5 w-3.5" />
              Enable Notifications
            </button>
          )}
          <button
            onClick={() => setShowNotifPanel(p => !p)}
            className="relative flex items-center justify-center rounded-xl"
            style={{ width: 36, height: 36, background: "var(--card-bg)", border: "1px solid var(--border)" }}
          >
            <Bell className="h-4 w-4" style={{ color: unreadCount > 0 ? "hsl(38,100%,60%)" : "var(--text-muted)" }} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                style={{ background: "hsl(0,80%,60%)", color: "#fff" }}>{unreadCount}</span>
            )}
          </button>
          <Button onClick={() => openCreate()} size="sm" className="flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New Alert
          </Button>
        </div>
      </div>

      {/* ── Stats bar ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Alerts", value: alerts.length, icon: Bell, color: "hsl(210,90%,60%)" },
          { label: "Active", value: activeCount, icon: Activity, color: "hsl(142,70%,50%)" },
          { label: "Triggered Today", value: triggeredToday, icon: Zap, color: "hsl(38,100%,60%)" },
          { label: "Unread Notifs", value: unreadCount, icon: BellRing, color: "hsl(315,90%,65%)" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-3 flex items-center gap-3"
            style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
            <div className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${s.color}18`, border: `1px solid ${s.color}30` }}>
              <s.icon className="h-3.5 w-3.5" style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{s.label}</p>
              <p className="text-lg font-bold leading-none mt-0.5" style={{ color: "var(--text-primary)" }}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Plan banner (free tier) ────────────────────────────────────── */}
      {planSlug === "free" && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl flex-wrap"
          style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.2)" }}>
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4" style={{ color: "hsl(265,89%,65%)" }} />
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
              <strong>Free plan:</strong> 5 price alerts max. Upgrade for indicator, drawing, strategy, AI & DNA alerts.
            </span>
          </div>
          <a href="/pricing" className="text-xs font-semibold px-3 py-1.5 rounded-xl"
            style={{ background: "linear-gradient(135deg, hsl(265,89%,60%), hsl(285,89%,60%))", color: "#fff" }}>
            Upgrade
          </a>
        </div>
      )}

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit"
        style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
        {(["active", "history", "all"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
            style={{
              background: activeTab === tab ? "var(--nav-active-bg)" : "transparent",
              color: activeTab === tab ? "var(--nav-active-color)" : "var(--text-muted)",
              border: activeTab === tab ? "1px solid var(--nav-active-border)" : "1px solid transparent",
            }}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── Alert list ────────────────────────────────────────────────── */}
      {!token ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Bell className="h-10 w-10 opacity-20" style={{ color: "var(--text-muted)" }} />
          <p style={{ color: "var(--text-muted)" }}>Sign in to manage your alerts</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-5 w-5 animate-spin" style={{ color: "var(--text-muted)" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center rounded-2xl"
          style={{ background: "var(--card-bg)", border: "1px dashed var(--border)" }}>
          <Bell className="h-10 w-10 opacity-20" style={{ color: "var(--text-muted)" }} />
          <div>
            <p className="font-medium" style={{ color: "var(--text-primary)" }}>No alerts yet</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Create your first alert to start monitoring the market</p>
          </div>
          <Button onClick={() => openCreate()} size="sm"><Plus className="h-3.5 w-3.5 mr-1.5" />New Alert</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(a => {
            const meta = TYPE_META[a.type] ?? TYPE_META["price"]!;
            const Icon = meta.icon;
            return (
              <div key={a.id} className="flex items-start gap-3 p-4 rounded-2xl transition-all"
                style={{ background: "var(--card-bg)", border: `1px solid ${a.isActive ? "var(--border)" : "rgba(0,0,0,0.05)"}`, opacity: a.isActive ? 1 : 0.6 }}>
                <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}30` }}>
                  <Icon className="h-4 w-4" style={{ color: meta.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{a.name}</span>
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono"
                      style={{ background: `${meta.color}15`, color: meta.color }}>{meta.label}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md"
                      style={{ background: "var(--card-hover)", color: "var(--text-muted)" }}>
                      {a.symbol} · {a.timeframe}
                    </span>
                    {a.triggerCount > 0 && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md"
                        style={{ background: "rgba(245,158,11,0.1)", color: "hsl(38,100%,60%)" }}>
                        ⚡ {a.triggerCount}×
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-1 font-mono truncate" style={{ color: "var(--text-muted)" }}>
                    {a.conditions.slice(0, 2).map((c, i) => (
                      <span key={i}>{i > 0 ? ` ${c.logicOp} ` : ""}{c.indicatorId}.{c.outputKey} {c.operator} {c.targetValue ?? c.targetIndicatorId ?? ""}</span>
                    ))}
                    {a.conditions.length > 2 && <span> +{a.conditions.length - 2} more</span>}
                  </p>
                  {a.lastTriggeredAt && (
                    <p className="text-[10px] mt-0.5 font-mono" style={{ color: "var(--text-muted)" }}>
                      Last triggered: {new Date(a.lastTriggeredAt).toLocaleString()}
                    </p>
                  )}
                  {a.deliveryChannels.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5">
                      {a.deliveryChannels.map(ch => (
                        <span key={ch} className="text-[9px] font-mono px-1.5 py-0.5 rounded-md"
                          style={{ background: "rgba(34,197,94,0.08)", color: "hsl(142,70%,50%)", border: "1px solid rgba(34,197,94,0.18)" }}>
                          {ch === "in_app" ? "In-App" : ch === "browser" ? "Browser" : ch}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => toggleActive(a)} title={a.isActive ? "Pause alert" : "Resume alert"}
                    className="h-7 w-7 rounded-lg flex items-center justify-center transition-all"
                    style={{ background: "var(--card-hover)", border: "1px solid var(--border)" }}>
                    {a.isActive
                      ? <ToggleRight className="h-4 w-4" style={{ color: "hsl(142,70%,50%)" }} />
                      : <ToggleLeft className="h-4 w-4" style={{ color: "var(--text-muted)" }} />}
                  </button>
                  <button onClick={() => openEdit(a)} title="Edit"
                    className="h-7 w-7 rounded-lg flex items-center justify-center transition-all"
                    style={{ background: "var(--card-hover)", border: "1px solid var(--border)" }}>
                    <Edit2 className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />
                  </button>
                  <button onClick={() => deleteAlert(a.id)} title="Delete"
                    className="h-7 w-7 rounded-lg flex items-center justify-center transition-all"
                    style={{ background: "var(--card-hover)", border: "1px solid var(--border)" }}>
                    <Trash2 className="h-3.5 w-3.5" style={{ color: "hsl(0,80%,60%)" }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Notification panel ────────────────────────────────────────── */}
      {showNotifPanel && (
        <div className="fixed inset-y-0 right-0 z-50 flex flex-col w-80 shadow-2xl md:top-[56px]"
          style={{ background: "hsl(var(--background))", borderLeft: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Notifications</h3>
            <button onClick={() => setShowNotifPanel(false)}>
              <X className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
                <Bell className="h-8 w-8 opacity-20" style={{ color: "var(--text-muted)" }} />
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>No notifications yet</p>
              </div>
            ) : notifications.map(n => (
              <div key={n.id} onClick={() => markRead(n.id)}
                className="flex items-start gap-3 p-3 cursor-pointer transition-all"
                style={{
                  background: n.isRead ? "transparent" : "rgba(245,158,11,0.05)",
                  borderBottom: "1px solid var(--border)",
                  opacity: n.isRead ? 0.6 : 1,
                }}>
                <div className="h-2 w-2 rounded-full mt-1.5 flex-shrink-0"
                  style={{ background: n.isRead ? "var(--text-muted)" : "hsl(38,100%,60%)" }} />
                <div>
                  <p className="text-xs" style={{ color: "var(--text-primary)" }}>{n.message}</p>
                  <p className="text-[10px] mt-0.5 font-mono" style={{ color: "var(--text-muted)" }}>
                    {new Date(n.triggeredAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Create / Edit Dialog ───────────────────────────────────────── */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-8"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowDialog(false); }}>
          <div className="w-full max-w-xl rounded-3xl shadow-2xl flex flex-col"
            style={{ background: "hsl(var(--background))", border: "1px solid var(--border)" }}>

            {/* Dialog header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="font-bold" style={{ color: "var(--text-primary)" }}>
                {editingAlert ? "Edit Alert" : "New Alert"}
              </h2>
              <button onClick={() => setShowDialog(false)}>
                <X className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: "70vh" }}>

              {/* Name */}
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Alert Name</label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. BTC RSI Oversold" />
              </div>

              {/* Type selector */}
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Alert Type</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.entries(TYPE_META) as [AlertRow["type"], typeof TYPE_META[string]][]).map(([type, meta]) => {
                    const allowed = canUseType(type);
                    const Icon = meta.icon;
                    return (
                      <button key={type} onClick={() => allowed && setForm(p => ({ ...p, type }))}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                        style={{
                          background: form.type === type ? `${meta.color}18` : "var(--card-bg)",
                          border: `1px solid ${form.type === type ? meta.color + "40" : "var(--border)"}`,
                          color: allowed ? (form.type === type ? meta.color : "var(--text-secondary)") : "var(--text-muted)",
                          opacity: allowed ? 1 : 0.5,
                          cursor: allowed ? "pointer" : "not-allowed",
                        }}>
                        <Icon className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{meta.label.replace(" Alert", "")}</span>
                        {!allowed && <Crown className="h-2.5 w-2.5 ml-auto flex-shrink-0" style={{ color: "hsl(265,89%,65%)" }} />}
                      </button>
                    );
                  })}
                </div>
                {/* Plan gate banners — shown below type grid when selected type is locked */}
                {form.type !== "price" && !canUseType(form.type) && (
                  <div className="mt-3">
                    <PremiumBanner requiredPlan={TYPE_META[form.type]?.minPlan === "elite" ? "elite" : "pro"} />
                  </div>
                )}
              </div>

              {/* Symbol + Timeframe */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Symbol</label>
                  <select value={form.symbol} onChange={e => setForm(p => ({ ...p, symbol: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{ background: "var(--card-bg)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                    {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Timeframe</label>
                  <select value={form.timeframe} onChange={e => setForm(p => ({ ...p, timeframe: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{ background: "var(--card-bg)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                    {TIMEFRAMES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* ── Strategy Picker (type === "strategy") ──────────────────── */}
              {form.type === "strategy" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Pick a Strategy</label>
                    <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>auto-fills conditions below</span>
                  </div>
                  {strategies.length === 0 ? (
                    <div className="flex items-center gap-2 px-3 py-3 rounded-xl text-xs"
                      style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)", color: "var(--text-muted)" }}>
                      <Layers className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "hsl(270,90%,65%)" }} />
                      No saved strategies found — create one in the Strategies page first.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-44 overflow-y-auto">
                      {strategies.map(s => {
                        const active = selectedStrategyId === s.id;
                        return (
                          <button key={s.id} onClick={() => loadFromStrategy(s)} disabled={strategyLoading}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                            style={{
                              background: active ? "rgba(139,92,246,0.12)" : "var(--card-bg)",
                              border: `1px solid ${active ? "rgba(139,92,246,0.4)" : "var(--border)"}`,
                            }}>
                            <div className="h-6 w-6 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.2)" }}>
                              <Layers className="h-3 w-3" style={{ color: "hsl(270,90%,65%)" }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold truncate" style={{ color: active ? "hsl(270,90%,75%)" : "var(--text-primary)" }}>{s.name}</p>
                              <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{s.type} · {s.symbol} · {s.timeframe}</p>
                            </div>
                            {active && <Check className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "hsl(270,90%,65%)" }} />}
                            {strategyLoading && selectedStrategyId !== s.id && <RefreshCw className="h-3 w-3 animate-spin flex-shrink-0 opacity-40" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── DNA Suggested Alerts (type === "dna") ─────────────────── */}
              {form.type === "dna" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                      <Dna className="h-3.5 w-3.5" style={{ color: "hsl(180,90%,50%)" }} />
                      DNA-Powered Alert Suggestions
                    </label>
                    <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>based on your trade history</span>
                  </div>
                  {dnaLoading ? (
                    <div className="flex items-center gap-2 px-3 py-4 rounded-xl text-xs"
                      style={{ background: "rgba(0,229,255,0.04)", border: "1px solid rgba(0,229,255,0.12)", color: "var(--text-muted)" }}>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" style={{ color: "hsl(180,90%,50%)" }} />
                      Analysing your trade DNA…
                    </div>
                  ) : !dnaData ? (
                    <div className="px-3 py-3 rounded-xl text-xs" style={{ background: "rgba(0,229,255,0.04)", border: "1px solid rgba(0,229,255,0.12)", color: "var(--text-muted)" }}>
                      Not enough data yet — run some backtests to unlock DNA insights.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Profile snapshot */}
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {[
                          { label: "Style", value: dnaData.traderStyle },
                          { label: "Win Rate", value: `${dnaData.avgWinRate}%` },
                          { label: "Risk", value: dnaData.riskProfile },
                        ].map(s => (
                          <div key={s.label} className="rounded-xl px-2 py-1.5 text-center"
                            style={{ background: "rgba(0,229,255,0.04)", border: "1px solid rgba(0,229,255,0.12)" }}>
                            <p className="text-[9px] font-mono uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{s.label}</p>
                            <p className="text-xs font-bold font-mono" style={{ color: "hsl(180,90%,60%)" }}>{s.value}</p>
                          </div>
                        ))}
                      </div>
                      {/* Session bars */}
                      {dnaData.sessionStats.length > 0 && (
                        <div className="rounded-xl px-3 py-2.5 mb-2"
                          style={{ background: "rgba(0,229,255,0.04)", border: "1px solid rgba(0,229,255,0.12)" }}>
                          <p className="text-[9px] font-mono uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Session Performance</p>
                          {dnaData.sessionStats.map(s => (
                            <div key={s.label} className="mb-1.5">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-[10px] font-mono" style={{ color: "var(--text-secondary)" }}>{s.label}</span>
                                <span className="text-[10px] font-mono font-bold" style={{ color: s.winRate >= 50 ? "hsl(142,70%,50%)" : "hsl(0,80%,60%)" }}>{s.winRate.toFixed(0)}%</span>
                              </div>
                              <div className="h-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                                <div className="h-full rounded-full transition-all duration-700"
                                  style={{ width: `${s.winRate}%`, background: s.winRate >= 50 ? "hsl(142,70%,50%)" : "hsl(0,80%,60%)" }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Suggested alerts */}
                      {dnaData.suggestedAlerts.length === 0 ? (
                        <p className="text-xs text-center py-2" style={{ color: "var(--text-muted)" }}>Run more backtests to unlock personalized DNA alert suggestions.</p>
                      ) : (
                        <>
                          <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Suggested for You</p>
                          {dnaData.suggestedAlerts.map((s, i) => (
                            <div key={i} className="rounded-xl p-3 space-y-2"
                              style={{ background: "rgba(0,229,255,0.04)", border: "1px solid rgba(0,229,255,0.15)" }}>
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-xs font-semibold" style={{ color: "hsl(180,90%,65%)" }}>{s.name}</p>
                                  <p className="text-[10px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>{s.description}</p>
                                </div>
                                <button onClick={() => applyDnaSuggestion(s)}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold flex-shrink-0"
                                  style={{ background: "rgba(0,229,255,0.1)", border: "1px solid rgba(0,229,255,0.25)", color: "hsl(180,90%,60%)" }}>
                                  <Check className="h-2.5 w-2.5" />
                                  Use
                                </button>
                              </div>
                              <p className="text-[10px] font-mono leading-relaxed" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
                                💡 {s.reasoning}
                              </p>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Condition builder — grouped (AND within group, OR between groups) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Conditions</label>
                    <span className="ml-2 text-[9px] font-mono uppercase tracking-widest opacity-50" style={{ color: "var(--text-muted)" }}>AND within group · OR between groups</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isElite && (
                      <button onClick={aiSuggest} disabled={aiLoading}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                        style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.3)", color: "hsl(265,89%,65%)" }}>
                        {aiLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        AI Suggest
                      </button>
                    )}
                    <button onClick={addGroup}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium"
                      style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "hsl(38,100%,60%)" }}>
                      <Plus className="h-3 w-3" />
                      New Group
                    </button>
                  </div>
                </div>

                {/* Grouped condition list */}
                {(() => {
                  const groups = getGroups();
                  return (
                    <div className="space-y-3">
                      {groups.map((grp, grpIdx) => (
                        <div key={grp.groupId}>
                          {/* OR separator between groups */}
                          {grpIdx > 0 && (
                            <div className="flex items-center gap-2 my-2">
                              <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase"
                                style={{ background: "rgba(245,158,11,0.12)", color: "hsl(38,100%,60%)", border: "1px solid rgba(245,158,11,0.25)" }}>
                                OR
                              </span>
                              <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                            </div>
                          )}

                          {/* Group container */}
                          <div className="rounded-xl p-2.5 space-y-2"
                            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] font-mono uppercase tracking-widest"
                                style={{ color: "var(--text-muted)", opacity: 0.5 }}>
                                Group {grpIdx + 1}
                              </span>
                              <button onClick={() => addConditionToGroup(grp.groupId)}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium"
                                style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", color: "hsl(142,70%,50%)" }}>
                                <Plus className="h-2.5 w-2.5" />
                                AND
                              </button>
                            </div>

                            {grp.conditions.map(({ cond, globalIdx }, ciIdx) => (
                              <div key={globalIdx}>
                                {/* AND label between conditions within group */}
                                {ciIdx > 0 && (
                                  <div className="flex items-center gap-2 my-1.5">
                                    <div className="flex-1 h-px" style={{ background: "rgba(34,197,94,0.15)" }} />
                                    <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded"
                                      style={{ background: "rgba(34,197,94,0.08)", color: "hsl(142,70%,50%)" }}>
                                      AND
                                    </span>
                                    <div className="flex-1 h-px" style={{ background: "rgba(34,197,94,0.15)" }} />
                                  </div>
                                )}

                                {/* Condition row */}
                                <div className="flex items-start gap-1.5 p-2 rounded-lg"
                                  style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
                                  {/* Indicator selector */}
                                  <select value={`${cond.indicatorId}__${cond.outputKey}`}
                                    onChange={e => {
                                      const [iid, okey] = e.target.value.split("__");
                                      updateCondition(globalIdx, { indicatorId: iid ?? "price", outputKey: okey ?? "close" });
                                    }}
                                    className="flex-1 px-2 py-1.5 rounded-lg text-xs min-w-0"
                                    style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                                    {Object.entries(catalogByCategory).map(([cat, entries]) => (
                                      <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
                                        {entries.map(e => (
                                          <option key={e.key} value={`${e.indicatorId}__${e.outputKey}`}>{e.label}</option>
                                        ))}
                                      </optgroup>
                                    ))}
                                    {catalog.length === 0 && (
                                      <>
                                        <option value="price__close">Close Price</option>
                                        <option value="price__high">High Price</option>
                                        <option value="price__low">Low Price</option>
                                        <option value="price__open">Open Price</option>
                                        <option value="price__volume">Volume</option>
                                      </>
                                    )}
                                  </select>

                                  {/* Operator — filtered by indicator category */}
                                  <select value={cond.operator}
                                    onChange={e => updateCondition(globalIdx, { operator: e.target.value })}
                                    className="px-2 py-1.5 rounded-lg text-xs"
                                    style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                                    {operatorsForEntry(cond.indicatorId).map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                                  </select>

                                  {/* Value */}
                                  <input
                                    type="number"
                                    value={cond.targetValue ?? ""}
                                    onChange={e => updateCondition(globalIdx, { targetValue: e.target.value ? Number(e.target.value) : undefined })}
                                    placeholder="Value"
                                    className="w-20 px-2 py-1.5 rounded-lg text-xs"
                                    style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                                  />

                                  {form.conditions.length > 1 && (
                                    <button onClick={() => removeCondition(globalIdx)}
                                      className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                      style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
                                      <X className="h-3 w-3" style={{ color: "hsl(0,80%,60%)" }} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Delivery channels */}
              <div>
                <label className="text-xs font-medium mb-2 block" style={{ color: "var(--text-secondary)" }}>Delivery Channels</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { id: "in_app", label: "In-App" },
                    { id: "browser", label: "Browser" },
                  ].map(ch => {
                    const active = form.deliveryChannels.includes(ch.id);
                    return (
                      <button key={ch.id} onClick={() => setForm(p => ({
                        ...p,
                        deliveryChannels: active ? p.deliveryChannels.filter(c => c !== ch.id) : [...p.deliveryChannels, ch.id],
                      }))}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                        style={{
                          background: active ? "rgba(34,197,94,0.12)" : "var(--card-bg)",
                          border: `1px solid ${active ? "rgba(34,197,94,0.3)" : "var(--border)"}`,
                          color: active ? "hsl(142,70%,50%)" : "var(--text-muted)",
                        }}>
                        {active ? <Check className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
                        {ch.label}
                      </button>
                    );
                  })}

                  {/* Trigger once */}
                  <button onClick={() => setForm(p => ({ ...p, triggerOnce: !p.triggerOnce }))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ml-auto"
                    style={{
                      background: form.triggerOnce ? "rgba(139,92,246,0.12)" : "var(--card-bg)",
                      border: `1px solid ${form.triggerOnce ? "rgba(139,92,246,0.3)" : "var(--border)"}`,
                      color: form.triggerOnce ? "hsl(265,89%,65%)" : "var(--text-muted)",
                    }}>
                    {form.triggerOnce ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                    Trigger Once
                  </button>
                </div>
              </div>

            </div>

            {/* Dialog footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4" style={{ borderTop: "1px solid var(--border)" }}>
              <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button onClick={saveAlert}>{editingAlert ? "Save Changes" : "Create Alert"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
