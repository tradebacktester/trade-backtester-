import React, { useState, useEffect, useCallback } from "react";
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight, Zap, Activity, TrendingUp, Layers, AlertTriangle, CheckCircle2, MapPin } from "lucide-react";
import { PremiumGate } from "@/components/premium-gate";
import { useToast } from "@/hooks/use-toast";
import { type FootprintCandle } from "@/hooks/useFootprintData";

interface FootprintAlert {
  id: string;
  name: string;
  symbol: string;
  condition: FootprintAlertCondition;
  isActive: boolean;
  triggeredAt: string | null;
  createdAt: string;
}

type FootprintAlertCondition =
  | { type: "delta_threshold"; value: number; direction: "above" | "below" }
  | { type: "imbalance_detected"; minCount: number }
  | { type: "absorption_signal"; side: "buy" | "sell" | "any" }
  | { type: "cvd_divergence" }
  | { type: "exhaustion" }
  | { type: "liquidity_zone_touch"; zoneType: "hvn" | "lvn" | "any" };

const CONDITION_META: Record<string, { label: string; icon: React.ElementType; color: string; desc: string }> = {
  delta_threshold:     { label: "Delta Threshold",    icon: TrendingUp,    color: "#22c55e",  desc: "Alert when delta crosses a value" },
  imbalance_detected:  { label: "Imbalance Detected", icon: Layers,        color: "#f59e0b",  desc: "Alert when N+ imbalance levels appear" },
  absorption_signal:   { label: "Absorption Signal",  icon: Activity,      color: "#a855f7",  desc: "Alert on buy or sell absorption" },
  cvd_divergence:      { label: "CVD Divergence",     icon: Zap,           color: "#3b82f6",  desc: "Alert on price/CVD divergence" },
  exhaustion:          { label: "Exhaustion",          icon: AlertTriangle, color: "#ef4444",  desc: "Alert when candle shows exhaustion" },
  liquidity_zone_touch:{ label: "Liquidity Zone",     icon: MapPin,        color: "#06b6d4",  desc: "Alert when price touches HVN or LVN" },
};

const STORAGE_KEY = "tt_footprint_alerts";

function loadAlerts(): FootprintAlert[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as FootprintAlert[]; }
  catch { return []; }
}
function saveAlerts(alerts: FootprintAlert[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts)); } catch { /* ignore */ }
}

/** Compute HVN/LVN sets from recent candle data — same logic as FootprintGrid */
function computeZoneSets(candles: FootprintCandle[]): { hvnKeys: Set<string>; lvnKeys: Set<string> } {
  const volByPrice = new Map<string, number>();
  for (const c of candles) {
    for (const l of c.levels) {
      const key = l.price.toFixed(4);
      volByPrice.set(key, (volByPrice.get(key) ?? 0) + l.totalVol);
    }
  }
  const vols = Array.from(volByPrice.values()).sort((a, b) => a - b);
  const p10 = vols[Math.floor(vols.length * 0.10)] ?? 0;
  const p90 = vols[Math.floor(vols.length * 0.90)] ?? Infinity;
  const hvnKeys = new Set<string>();
  const lvnKeys = new Set<string>();
  for (const [k, v] of volByPrice.entries()) {
    if (v >= p90) hvnKeys.add(k);
    if (v <= p10) lvnKeys.add(k);
  }
  return { hvnKeys, lvnKeys };
}

function checkAlertTriggered(alert: FootprintAlert, candles: FootprintCandle[]): boolean {
  if (!alert.isActive || candles.length === 0) return false;
  const recent = candles.slice(-3);
  const cond = alert.condition;
  switch (cond.type) {
    case "delta_threshold": {
      const totalDelta = recent.reduce((a, c) => a + c.delta, 0);
      return cond.direction === "above" ? totalDelta > cond.value : totalDelta < cond.value;
    }
    case "imbalance_detected": {
      const totalImbalances = recent.reduce((a, c) => a + c.levels.filter(l => l.isImbalance).length, 0);
      return totalImbalances >= cond.minCount;
    }
    case "absorption_signal": {
      return recent.some(c => c.levels.some(l =>
        cond.side === "any" ? (l.isBuyAbsorption || l.isSellAbsorption)
          : cond.side === "buy" ? l.isBuyAbsorption : l.isSellAbsorption
      ));
    }
    case "cvd_divergence":
      return recent.some(c => c.isDivergence);
    case "exhaustion":
      return recent.some(c => c.isExhaustion);
    case "liquidity_zone_touch": {
      // Check if last candle's price range overlaps with any HVN or LVN level
      const lastCandle = recent[recent.length - 1];
      if (!lastCandle) return false;
      const { hvnKeys, lvnKeys } = computeZoneSets(candles);

      const touchesZone = (keys: Set<string>) => {
        for (const key of keys) {
          const p = parseFloat(key);
          if (p >= lastCandle.low && p <= lastCandle.high) return true;
        }
        return false;
      };

      if (cond.zoneType === "hvn") return touchesZone(hvnKeys);
      if (cond.zoneType === "lvn") return touchesZone(lvnKeys);
      return touchesZone(hvnKeys) || touchesZone(lvnKeys);
    }
    default: return false;
  }
}

function AlertRow({ alert, onDelete, onToggle }: { alert: FootprintAlert; onDelete: () => void; onToggle: () => void }) {
  const meta = CONDITION_META[alert.condition.type]!;
  const Icon = meta.icon;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "10px", background: "hsl(var(--muted)/0.3)", border: "1px solid hsl(var(--border))", marginBottom: "6px" }}>
      <div style={{ background: `${meta.color}15`, borderRadius: "7px", padding: "5px", border: `1px solid ${meta.color}30`, flexShrink: 0 }}>
        <Icon style={{ height: "12px", width: "12px", color: meta.color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "12px", fontWeight: 600, color: "hsl(var(--foreground))", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {alert.name}
        </div>
        <div style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))" }}>
          {meta.label} · {alert.symbol}
          {alert.triggeredAt && <span style={{ color: "#22c55e", marginLeft: "6px" }}>✓ Triggered</span>}
        </div>
      </div>
      <button onClick={onToggle} style={{ background: "none", border: "none", cursor: "pointer", color: alert.isActive ? "#22c55e" : "hsl(var(--muted-foreground))", padding: "2px" }}>
        {alert.isActive ? <ToggleRight style={{ height: "16px", width: "16px" }} /> : <ToggleLeft style={{ height: "16px", width: "16px" }} />}
      </button>
      <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: "2px", opacity: 0.6 }}>
        <Trash2 style={{ height: "12px", width: "12px" }} />
      </button>
    </div>
  );
}

interface FootprintAlertsProps {
  candles: FootprintCandle[];
  symbol: string;
}

function FootprintAlertsContent({ candles, symbol }: FootprintAlertsProps) {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<FootprintAlert[]>(loadAlerts);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    conditionType: string;
    deltaValue: number;
    deltaDir: "above" | "below";
    imbalMin: number;
    absorptionSide: "buy" | "sell" | "any";
    zoneType: "hvn" | "lvn" | "any";
  }>({
    name: "", conditionType: "delta_threshold", deltaValue: 100000, deltaDir: "above",
    imbalMin: 3, absorptionSide: "any", zoneType: "any",
  });

  const checkAlerts = useCallback(() => {
    if (candles.length === 0) return;
    let updated = false;
    const newAlerts = alerts.map(a => {
      if (!a.isActive || a.triggeredAt) return a;
      if (checkAlertTriggered(a, candles)) {
        updated = true;
        toast({ title: `🔔 Alert: ${a.name}`, description: `${CONDITION_META[a.condition.type]?.label} triggered on ${a.symbol}` });
        return { ...a, triggeredAt: new Date().toISOString() };
      }
      return a;
    });
    if (updated) { setAlerts(newAlerts); saveAlerts(newAlerts); }
  }, [alerts, candles, toast]);

  useEffect(() => { checkAlerts(); }, [candles, checkAlerts]);

  function buildCondition(): FootprintAlertCondition {
    switch (form.conditionType) {
      case "delta_threshold":      return { type: "delta_threshold", value: form.deltaValue, direction: form.deltaDir };
      case "imbalance_detected":   return { type: "imbalance_detected", minCount: form.imbalMin };
      case "absorption_signal":    return { type: "absorption_signal", side: form.absorptionSide };
      case "cvd_divergence":       return { type: "cvd_divergence" };
      case "exhaustion":           return { type: "exhaustion" };
      case "liquidity_zone_touch": return { type: "liquidity_zone_touch", zoneType: form.zoneType };
      default:                     return { type: "exhaustion" };
    }
  }

  function createAlert() {
    if (!form.name.trim()) { toast({ title: "Alert name required", variant: "destructive" }); return; }
    const newAlert: FootprintAlert = {
      id: `fp_${Date.now()}`,
      name: form.name.trim(),
      symbol,
      condition: buildCondition(),
      isActive: true,
      triggeredAt: null,
      createdAt: new Date().toISOString(),
    };
    const next = [...alerts, newAlert];
    setAlerts(next);
    saveAlerts(next);
    setShowCreate(false);
    setForm(f => ({ ...f, name: "" }));
    toast({ title: "Alert created" });
  }

  function deleteAlert(id: string) {
    const next = alerts.filter(a => a.id !== id);
    setAlerts(next); saveAlerts(next);
  }

  function toggleAlert(id: string) {
    const next = alerts.map(a => a.id === id ? { ...a, isActive: !a.isActive, triggeredAt: null } : a);
    setAlerts(next); saveAlerts(next);
  }

  const activeCount = alerts.filter(a => a.isActive).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 style={{ fontSize: "13px", fontWeight: 700, color: "hsl(var(--foreground))", margin: 0 }}>Smart Alerts</h3>
          <p style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", margin: "2px 0 0" }}>{activeCount} active · stored locally</p>
        </div>
        <button
          onClick={() => setShowCreate(s => !s)}
          style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "8px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#22c55e", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>
          <Plus style={{ height: "11px", width: "11px" }} />
          New Alert
        </button>
      </div>

      {showCreate && (
        <div style={{ background: "hsl(var(--muted)/0.3)", borderRadius: "12px", padding: "14px", marginBottom: "14px", border: "1px solid hsl(var(--border))" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: "10px" }}>New Footprint Alert</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Alert name…"
              style={{ padding: "7px 10px", borderRadius: "7px", border: "1px solid hsl(var(--border))", background: "var(--card-bg)", color: "hsl(var(--foreground))", fontSize: "12px", outline: "none" }}
            />
            <select
              value={form.conditionType}
              onChange={e => setForm(f => ({ ...f, conditionType: e.target.value }))}
              style={{ padding: "7px 10px", borderRadius: "7px", border: "1px solid hsl(var(--border))", background: "var(--card-bg)", color: "hsl(var(--foreground))", fontSize: "12px" }}>
              {Object.entries(CONDITION_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>

            {form.conditionType === "delta_threshold" && (
              <div style={{ display: "flex", gap: "6px" }}>
                <select value={form.deltaDir} onChange={e => setForm(f => ({ ...f, deltaDir: e.target.value as "above" | "below" }))}
                  style={{ flex: 1, padding: "7px 10px", borderRadius: "7px", border: "1px solid hsl(var(--border))", background: "var(--card-bg)", color: "hsl(var(--foreground))", fontSize: "12px" }}>
                  <option value="above">Above</option>
                  <option value="below">Below</option>
                </select>
                <input type="number" value={form.deltaValue} onChange={e => setForm(f => ({ ...f, deltaValue: Number(e.target.value) }))}
                  style={{ flex: 1, padding: "7px 10px", borderRadius: "7px", border: "1px solid hsl(var(--border))", background: "var(--card-bg)", color: "hsl(var(--foreground))", fontSize: "12px" }} />
              </div>
            )}
            {form.conditionType === "imbalance_detected" && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", whiteSpace: "nowrap" }}>Min levels:</span>
                <input type="number" min={1} max={20} value={form.imbalMin} onChange={e => setForm(f => ({ ...f, imbalMin: Number(e.target.value) }))}
                  style={{ flex: 1, padding: "7px 10px", borderRadius: "7px", border: "1px solid hsl(var(--border))", background: "var(--card-bg)", color: "hsl(var(--foreground))", fontSize: "12px" }} />
              </div>
            )}
            {form.conditionType === "absorption_signal" && (
              <select value={form.absorptionSide} onChange={e => setForm(f => ({ ...f, absorptionSide: e.target.value as "buy" | "sell" | "any" }))}
                style={{ padding: "7px 10px", borderRadius: "7px", border: "1px solid hsl(var(--border))", background: "var(--card-bg)", color: "hsl(var(--foreground))", fontSize: "12px" }}>
                <option value="any">Any absorption</option>
                <option value="buy">Buy absorption only</option>
                <option value="sell">Sell absorption only</option>
              </select>
            )}
            {form.conditionType === "liquidity_zone_touch" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <select value={form.zoneType} onChange={e => setForm(f => ({ ...f, zoneType: e.target.value as "hvn" | "lvn" | "any" }))}
                  style={{ padding: "7px 10px", borderRadius: "7px", border: "1px solid hsl(var(--border))", background: "var(--card-bg)", color: "hsl(var(--foreground))", fontSize: "12px" }}>
                  <option value="any">Any liquidity zone (HVN or LVN)</option>
                  <option value="hvn">HVN only (High Volume Node)</option>
                  <option value="lvn">LVN only (Low Volume Node)</option>
                </select>
                <p style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", margin: 0, lineHeight: 1.4 }}>
                  Triggers when price enters a High or Low Volume Node — key areas where price typically stalls, reverses, or accelerates.
                </p>
              </div>
            )}

            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={createAlert} style={{ flex: 1, padding: "7px", borderRadius: "7px", background: "#22c55e", color: "#fff", fontSize: "12px", fontWeight: 600, border: "none", cursor: "pointer" }}>
                Create Alert
              </button>
              <button onClick={() => setShowCreate(false)} style={{ padding: "7px 12px", borderRadius: "7px", background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", fontSize: "12px", border: "none", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {alerts.length === 0 && (
        <div style={{ textAlign: "center", padding: "32px 0" }}>
          <Bell style={{ height: "28px", width: "28px", color: "hsl(var(--muted-foreground))", margin: "0 auto 8px" }} />
          <p style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))" }}>No alerts yet. Create one above.</p>
        </div>
      )}

      {alerts.map(a => (
        <AlertRow key={a.id} alert={a} onDelete={() => deleteAlert(a.id)} onToggle={() => toggleAlert(a.id)} />
      ))}

      {alerts.some(a => a.triggeredAt) && (
        <div style={{ marginTop: "8px", padding: "8px 10px", borderRadius: "8px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", display: "flex", alignItems: "center", gap: "6px" }}>
          <CheckCircle2 style={{ height: "12px", width: "12px", color: "#22c55e", flexShrink: 0 }} />
          <span style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>Triggered alerts will reset when you toggle them off and back on.</span>
        </div>
      )}
    </div>
  );
}

export function FootprintAlerts(props: FootprintAlertsProps) {
  return (
    <PremiumGate feature="dataExport" requiredPlan="elite">
      <FootprintAlertsContent {...props} />
    </PremiumGate>
  );
}
