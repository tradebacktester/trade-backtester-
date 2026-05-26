import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Newspaper, Calendar, TrendingUp, Globe2, AlertTriangle,
  Clock, ChevronLeft, ChevronRight, RefreshCw, Filter
} from "lucide-react";
import { format, parse, isValid } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CalendarEvent {
  title: string;
  country: string;
  date: string;
  time: string;
  impact: "High" | "Medium" | "Low" | "Holiday" | "Non-Economic";
  forecast: string;
  previous: string;
  actual: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const IMPACT_CONFIG = {
  High:         { cls: "impact-high",    dot: "#f87171", label: "High" },
  Medium:       { cls: "impact-medium",  dot: "#fbbf24", label: "Med"  },
  Low:          { cls: "impact-low",     dot: "#4ade80", label: "Low"  },
  Holiday:      { cls: "impact-holiday", dot: "#94a3b8", label: "Holiday" },
  "Non-Economic": { cls: "impact-holiday", dot: "#94a3b8", label: "—" },
} as const;

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD", "CNY"];

const FLAG: Record<string, string> = {
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵",
  AUD: "🇦🇺", CAD: "🇨🇦", CHF: "🇨🇭", NZD: "🇳🇿",
  CNY: "🇨🇳", MXN: "🇲🇽", BRL: "🇧🇷", INR: "🇮🇳",
  KRW: "🇰🇷", HKD: "🇭🇰", SGD: "🇸🇬", SEK: "🇸🇪",
  NOK: "🇳🇴", DKK: "🇩🇰", ZAR: "🇿🇦",
};

function parseEventDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  try {
    const formats = [
      "MM-dd-yyyy",
      "MMM dd yyyy",
      "MMM d yyyy",
      "MMMM dd yyyy",
      "MMMM d yyyy",
      "yyyy-MM-dd",
    ];
    for (const fmt of formats) {
      const d = parse(dateStr, fmt, new Date());
      if (isValid(d)) return d;
    }
    const direct = new Date(dateStr);
    if (isValid(direct)) return direct;
    return null;
  } catch {
    return null;
  }
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ event }: { event: CalendarEvent }) {
  const cfg = IMPACT_CONFIG[event.impact] ?? IMPACT_CONFIG.Low;
  const flag = FLAG[event.country] ?? "🌐";
  const hasActual = event.actual && event.actual !== "";

  const actualColor =
    hasActual && event.forecast
      ? parseFloat(event.actual) > parseFloat(event.forecast)
        ? "text-green-400"
        : parseFloat(event.actual) < parseFloat(event.forecast)
        ? "text-red-400"
        : "text-foreground"
      : "text-foreground";

  return (
    <div
      className="neon-hover-subtle flex items-stretch gap-0 rounded-xl border border-white/[0.07] overflow-hidden"
      style={{ background: "rgba(255,255,255,0.03)" }}
    >
      {/* Impact stripe */}
      <div
        className="w-1 shrink-0"
        style={{ background: cfg.dot, opacity: 0.7 }}
      />

      <div className="flex items-center gap-3 px-4 py-3 flex-1 min-w-0">
        {/* Time */}
        <div className="shrink-0 w-16 text-right">
          <span className="text-[11px] font-mono text-muted-foreground">{event.time || "All Day"}</span>
        </div>

        {/* Currency */}
        <div className="shrink-0 flex items-center gap-1.5">
          <span className="text-base leading-none">{flag}</span>
          <span className="text-[11px] font-mono font-semibold text-muted-foreground">{event.country}</span>
        </div>

        {/* Impact dot */}
        <div
          className="shrink-0 h-2 w-2 rounded-full"
          style={{ background: cfg.dot, boxShadow: `0 0 6px ${cfg.dot}` }}
        />

        {/* Title */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{event.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cfg.cls}`}>
              {cfg.label}
            </span>
          </div>
        </div>

        {/* F / A / P */}
        <div className="shrink-0 hidden md:flex items-center gap-4 text-right">
          <div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Forecast</div>
            <div className="text-xs font-mono">{event.forecast || "—"}</div>
          </div>
          <div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Actual</div>
            <div className={`text-xs font-mono font-semibold ${actualColor}`}>
              {hasActual ? event.actual : "—"}
            </div>
          </div>
          <div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Prev</div>
            <div className="text-xs font-mono text-muted-foreground">{event.previous || "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.07]">
      <div className="skeleton-shimmer h-4 w-12 shrink-0" />
      <div className="skeleton-shimmer h-4 w-8 shrink-0" />
      <div className="skeleton-shimmer h-2 w-2 rounded-full shrink-0" />
      <div className="skeleton-shimmer h-4 flex-1" />
      <div className="hidden md:flex gap-4">
        <div className="skeleton-shimmer h-4 w-10" />
        <div className="skeleton-shimmer h-4 w-10" />
        <div className="skeleton-shimmer h-4 w-10" />
      </div>
    </div>
  );
}

// ─── Date Group Header ────────────────────────────────────────────────────────

function DateHeader({ dateStr }: { dateStr: string }) {
  const d = parseEventDate(dateStr);
  if (!d) return <div className="text-sm font-semibold text-muted-foreground py-2">{dateStr}</div>;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);

  const label = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday" : format(d, "EEEE");
  const sub = format(d, "MMMM d, yyyy");

  return (
    <div className="flex items-center gap-3 py-3 mt-2">
      <div
        className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
        style={{
          background: diff === 0 ? "hsl(var(--primary) / 0.15)" : "rgba(255,255,255,0.05)",
          color: diff === 0 ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
          border: diff === 0 ? "1px solid hsl(var(--primary) / 0.25)" : "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {format(d, "d")}
      </div>
      <div>
        <div className="text-sm font-semibold" style={{ color: diff === 0 ? "hsl(var(--primary))" : undefined }}>
          {label}
          {diff === 0 && (
            <span
              className="ml-2 text-[9px] font-mono px-1.5 py-0.5 rounded-full"
              style={{ background: "hsl(var(--primary) / 0.2)", color: "hsl(var(--primary))" }}
            >LIVE</span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground">{sub}</div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NewsPage() {
  const [week, setWeek] = useState<"this" | "next">("this");
  const [impact, setImpact] = useState<"all" | "High" | "Medium" | "Low">("all");
  const [currency, setCurrency] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  const { data: events, isLoading, isError, refetch, isFetching } = useQuery<CalendarEvent[]>({
    queryKey: ["news-calendar", week],
    queryFn: async () => {
      const res = await fetch(`/api/news/calendar?week=${week}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const filtered = useMemo(() => {
    if (!events) return [];
    return events.filter((e) => {
      if (impact !== "all" && e.impact !== impact) return false;
      if (currency !== "all" && e.country !== currency) return false;
      return true;
    });
  }, [events, impact, currency]);

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of filtered) {
      // Normalize to YYYY-MM-DD so all events on the same calendar day are grouped together
      const d = parseEventDate(e.date);
      const key = d && isValid(d) ? format(d, "yyyy-MM-dd") : e.date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()).sort((a, b) => {
      const da = parseEventDate(a[0])?.getTime() ?? 0;
      const db = parseEventDate(b[0])?.getTime() ?? 0;
      return da - db;
    });
  }, [filtered]);

  const highImpact = events?.filter((e) => e.impact === "High").length ?? 0;
  const hasActual  = events?.filter((e) => e.actual !== "").length ?? 0;

  return (
    <div className="space-y-6 float-up">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="float-up flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <span
              className="flex items-center justify-center h-9 w-9 rounded-xl"
              style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))" }}
            >
              <Newspaper className="h-5 w-5" />
            </span>
            Market News
          </h1>
          <p className="text-muted-foreground mt-1">Economic calendar powered by Forex Factory</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* ── Stats Row ───────────────────────────────────────────────── */}
      <div className="float-up-1 grid grid-cols-3 gap-3">
        {[
          { label: "Total Events",  value: events?.length ?? "—",  icon: Calendar,    color: "hsl(var(--primary))" },
          { label: "High Impact",   value: highImpact || "—",       icon: AlertTriangle, color: "#f87171"            },
          { label: "Released",      value: hasActual || "—",        icon: TrendingUp,  color: "#4ade80"             },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="glass-card neon-hover-subtle rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon className="h-3.5 w-3.5" style={{ color }} />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
            </div>
            <div className="text-2xl font-bold font-mono" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Week Tabs + Filters ──────────────────────────────────────── */}
      <div className="float-up-2 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Week switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/30 border border-white/[0.07]">
            {(["this", "next"] as const).map((w) => (
              <button
                key={w}
                onClick={() => setWeek(w)}
                className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer select-none"
                style={week === w ? {
                  background: "hsl(var(--background))",
                  color: "hsl(var(--foreground))",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                } : { color: "hsl(var(--muted-foreground))" }}
              >
                {w === "this" ? "This Week" : "Next Week"}
              </button>
            ))}
          </div>

          {/* Filter toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters((v) => !v)}
            className="gap-1.5"
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {(impact !== "all" || currency !== "all") && (
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: "hsl(var(--primary))" }}
              />
            )}
          </Button>
        </div>

        {/* Filter chips */}
        {showFilters && (
          <div className="glass-panel rounded-xl p-4 space-y-3">
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Impact</p>
              <div className="flex flex-wrap gap-1.5">
                {(["all", "High", "Medium", "Low"] as const).map((i) => (
                  <button
                    key={i}
                    onClick={() => setImpact(i)}
                    className="px-3 py-1 rounded-full text-xs font-medium border transition-all duration-150 cursor-pointer"
                    style={impact === i ? {
                      background: "hsl(var(--primary) / 0.15)",
                      borderColor: "hsl(var(--primary) / 0.4)",
                      color: "hsl(var(--primary))",
                    } : {
                      background: "transparent",
                      borderColor: "rgba(255,255,255,0.08)",
                      color: "hsl(var(--muted-foreground))",
                    }}
                  >
                    {i === "all" ? "All Impact" : i}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Currency</p>
              <div className="flex flex-wrap gap-1.5">
                {["all", ...CURRENCIES].map((c) => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    className="px-3 py-1 rounded-full text-xs font-medium border transition-all duration-150 cursor-pointer"
                    style={currency === c ? {
                      background: "hsl(var(--primary) / 0.15)",
                      borderColor: "hsl(var(--primary) / 0.4)",
                      color: "hsl(var(--primary))",
                    } : {
                      background: "transparent",
                      borderColor: "rgba(255,255,255,0.08)",
                      color: "hsl(var(--muted-foreground))",
                    }}
                  >
                    {c === "all" ? "All" : `${FLAG[c] ?? ""} ${c}`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Calendar Feed ────────────────────────────────────────────── */}
      <div className="float-up-3 space-y-1">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : isError ? (
          <div
            className="glass-panel rounded-xl py-14 flex flex-col items-center gap-3 text-muted-foreground"
          >
            <Globe2 className="h-10 w-10 opacity-20" />
            <div className="text-center">
              <p className="font-medium text-foreground">Could not load calendar</p>
              <p className="text-sm mt-1">Forex Factory may be temporarily unavailable.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Try Again
            </Button>
          </div>
        ) : grouped.length === 0 ? (
          <div
            className="glass-panel rounded-xl py-14 flex flex-col items-center gap-3 text-muted-foreground"
          >
            <Calendar className="h-10 w-10 opacity-20" />
            <div className="text-center">
              <p className="font-medium text-foreground">No events match your filters</p>
              <p className="text-sm">Try adjusting impact level or currency.</p>
            </div>
          </div>
        ) : (
          grouped.map(([date, evs]) => (
            <div key={date}>
              <DateHeader dateStr={date} />
              <div className="space-y-1.5 ml-11">
                {evs.map((ev, i) => (
                  <EventCard key={`${date}-${i}`} event={ev} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Footer note ─────────────────────────────────────────────── */}
      {!isLoading && !isError && events && events.length > 0 && (
        <p className="text-[11px] text-muted-foreground text-center py-2">
          Data sourced from{" "}
          <a
            href="https://www.forexfactory.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Forex Factory
          </a>
          {" "}· Times shown in ET · {events.length} events this {week === "this" ? "week" : "next week"}
        </p>
      )}
    </div>
  );
}
