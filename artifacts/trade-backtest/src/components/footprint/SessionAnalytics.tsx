import React, { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";
import { Loader2 } from "lucide-react";

interface SessionData {
  session: string;
  label: string;
  color: string;
  delta: number;
  volume: number;
  dominancePct: number;
  bullishCandles: number;
  bearishCandles: number;
}

interface SessionAnalyticsResponse {
  sessions: SessionData[];
  totalVol: number;
  dominantSession: string;
  symbol: string;
}

function fmtNum(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

interface SessionAnalyticsProps {
  symbol: string;
}

export function SessionAnalytics({ symbol }: SessionAnalyticsProps) {
  const { token } = useAuth();
  const [data, setData] = useState<SessionAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    fetch(`${API_BASE}/api/footprint/session-analytics?symbol=${encodeURIComponent(symbol)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() as Promise<SessionAnalyticsResponse> : Promise.reject())
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [token, symbol]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2" style={{ color: "hsl(var(--muted-foreground))", fontSize: "12px" }}>
        <Loader2 style={{ height: "14px", width: "14px" }} className="animate-spin" />
        Loading session data…
      </div>
    );
  }

  if (!data) return <p style={{ textAlign: "center", color: "hsl(var(--muted-foreground))", fontSize: "12px", padding: "24px 0" }}>Failed to load session analytics.</p>;

  const volumeData = data.sessions.map(s => ({ name: s.label, volume: s.volume, color: s.color }));
  const deltaData = data.sessions.map(s => ({ name: s.label, delta: s.delta, color: s.color }));
  const pieData = data.sessions.map(s => ({ name: s.label, value: s.dominancePct, color: s.color }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 style={{ fontSize: "13px", fontWeight: 700, color: "hsl(var(--foreground))", margin: 0 }}>Session Analytics</h3>
          <p style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", margin: "2px 0 0" }}>{symbol} · London / NY / Tokyo / Sydney</p>
        </div>
        {data.dominantSession && (
          <div style={{ padding: "4px 10px", borderRadius: "8px", background: "hsl(var(--muted)/0.5)", border: "1px solid hsl(var(--border))", fontSize: "11px", fontWeight: 600, color: "hsl(var(--foreground))" }}>
            Dominant: {data.sessions.find(s => s.session === data.dominantSession)?.label ?? data.dominantSession}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 sm:grid-cols-4">
        {data.sessions.map(s => (
          <div key={s.session} style={{ background: "hsl(var(--muted)/0.3)", borderRadius: "10px", padding: "12px", border: `1px solid ${s.color}30`, textAlign: "center" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: s.color, margin: "0 auto 6px" }} />
            <div style={{ fontSize: "11px", fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: "4px" }}>{s.label}</div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: s.color, fontFamily: "var(--app-font-mono)" }}>{s.dominancePct}%</div>
            <div style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))" }}>Vol: {fmtNum(s.volume)}</div>
            <div style={{ fontSize: "10px", color: s.delta >= 0 ? "#22c55e" : "#ef4444", fontFamily: "var(--app-font-mono)" }}>
              Δ{s.delta >= 0 ? "+" : ""}{fmtNum(s.delta)}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div style={{ background: "var(--card-bg)", borderRadius: "12px", padding: "14px", border: "1px solid hsl(var(--border))" }}>
          <p style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "hsl(var(--muted-foreground))", marginBottom: "10px" }}>Session Volume</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={volumeData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={fmtNum} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "var(--card-bg)", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} formatter={(v: number) => [fmtNum(v), "Volume"]} />
              <Bar dataKey="volume" radius={[3, 3, 0, 0]}>
                {volumeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: "var(--card-bg)", borderRadius: "12px", padding: "14px", border: "1px solid hsl(var(--border))" }}>
          <p style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "hsl(var(--muted-foreground))", marginBottom: "10px" }}>Session Dominance</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={60} innerRadius={32} dataKey="value" strokeWidth={0}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: "10px" }} />
              <Tooltip contentStyle={{ background: "var(--card-bg)", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} formatter={(v: number) => [`${v}%`, "Dominance"]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ background: "var(--card-bg)", borderRadius: "12px", padding: "14px", border: "1px solid hsl(var(--border))", marginTop: "12px" }}>
        <p style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "hsl(var(--muted-foreground))", marginBottom: "10px" }}>Session Delta</p>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={deltaData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={fmtNum} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "var(--card-bg)", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} formatter={(v: number) => [`${v >= 0 ? "+" : ""}${fmtNum(v)}`, "Delta"]} />
            <Bar dataKey="delta" radius={[3, 3, 0, 0]}>
              {deltaData.map((entry, i) => <Cell key={i} fill={entry.delta >= 0 ? "#22c55e" : "#ef4444"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
