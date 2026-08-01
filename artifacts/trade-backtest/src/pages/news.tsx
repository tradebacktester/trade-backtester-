import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Newspaper, Calendar, TrendingUp, Globe2, AlertTriangle,
  Clock, RefreshCw, Filter, X, ChevronRight, Zap
} from "lucide-react";
import { format, parse, isValid } from "date-fns";
import { API_BASE } from "@/lib/api-config";

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
  High:           { dot: "#f87171", label: "High",    ring: "rgba(248,113,113,0.20)", text: "#f87171" },
  Medium:         { dot: "#fbbf24", label: "Med",     ring: "rgba(251,191,36,0.18)",  text: "#fbbf24" },
  Low:            { dot: "#6b7280", label: "Low",     ring: "rgba(107,114,128,0.15)", text: "#6b7280" },
  Holiday:        { dot: "#4b5563", label: "Holiday", ring: "rgba(75,85,99,0.12)",    text: "#9ca3af" },
  "Non-Economic": { dot: "#374151", label: "—",       ring: "rgba(55,65,81,0.10)",    text: "#6b7280" },
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
    const formats = ["MM-dd-yyyy","MMM dd yyyy","MMM d yyyy","MMMM dd yyyy","MMMM d yyyy","yyyy-MM-dd"];
    for (const fmt of formats) {
      const d = parse(dateStr, fmt, new Date());
      if (isValid(d)) return d;
    }
    const direct = new Date(dateStr);
    if (isValid(direct)) return direct;
    return null;
  } catch { return null; }
}

// ─── Bento Event Row ─────────────────────────────────────────────────────────

function EventRow({ event }: { event: CalendarEvent }) {
  const cfg = IMPACT_CONFIG[event.impact] ?? IMPACT_CONFIG.Low;
  const flag = FLAG[event.country] ?? "🌐";
  const hasActual = event.actual && event.actual !== "";
  const actualColor =
    hasActual && event.forecast
      ? parseFloat(event.actual) > parseFloat(event.forecast) ? "#4ade80"
      : parseFloat(event.actual) < parseFloat(event.forecast) ? "#f87171"
      : "#e8e8e8"
    : "#e8e8e8";

  return (
    <div
      className="group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150"
      style={{ background: "rgba(255,255,255,0.025)" }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
      onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
    >
      {/* Impact stripe */}
      <div className="w-0.5 h-7 rounded-full shrink-0" style={{ background: cfg.dot, opacity: 0.7 }} />

      {/* Time */}
      <span className="text-[10px] font-mono w-12 text-right shrink-0" style={{ color: "#71797E" }}>
        {event.time || "All Day"}
      </span>

      {/* Flag + currency */}
      <div className="flex items-center gap-1 shrink-0 w-14">
        <span className="text-sm leading-none">{flag}</span>
        <span className="text-[10px] font-mono font-semibold" style={{ color: "#878681" }}>{event.country}</span>
      </div>

      {/* Impact badge */}
      <div
        className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded"
        style={{ background: cfg.ring, color: cfg.text, border: `1px solid ${cfg.dot}22` }}
      >
        {cfg.label}
      </div>

      {/* Title */}
      <p className="flex-1 text-xs font-medium truncate min-w-0" style={{ color: "#D1D1D6" }}>
        {event.title}
      </p>

      {/* F / A / P */}
      <div className="shrink-0 hidden sm:flex items-center gap-4 text-right">
        {[
          { label: "F", value: event.forecast || "—", color: "#71797E" },
          { label: "A", value: hasActual ? event.actual : "—", color: actualColor },
          { label: "P", value: event.previous || "—", color: "#71797E" },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <div className="text-[8px] uppercase tracking-wider mb-0.5" style={{ color: "#4b5563" }}>{label}</div>
            <div className="text-[11px] font-mono font-semibold" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function BentoSkeleton() {
  return (
    <div className="space-y-3">
      {[60, 80, 70, 90, 65].map((w, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <div className="skeleton-shimmer w-0.5 h-7 rounded-full" />
          <div className="skeleton-shimmer h-3 w-10" />
          <div className="skeleton-shimmer h-3 w-12" />
          <div className="skeleton-shimmer h-3" style={{ width: `${w}%` }} />
          <div className="skeleton-shimmer h-3 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ─── Day Bento Tile ───────────────────────────────────────────────────────────

function DayTile({ dateStr, events, isToday }: { dateStr: string; events: CalendarEvent[]; isToday: boolean }) {
  const d = parseEventDate(dateStr);
  const label = !d ? dateStr : isToday ? "Today" : format(d, "EEEE");
  const sub = d ? format(d, "MMM d, yyyy") : dateStr;
  const day = d ? format(d, "d") : "—";
  const high = events.filter(e => e.impact === "High").length;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: isToday ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
        border: isToday ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* Day header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 font-mono"
            style={{
              background: isToday ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)",
              color: isToday ? "#F5F5F5" : "#878681",
              border: isToday ? "1px solid rgba(255,255,255,0.22)" : "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {day}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: isToday ? "#F5F5F5" : "#D1D1D6" }}>
                {label}
              </span>
              {isToday && (
                <span
                  className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.12)", color: "#C0C0C0", border: "1px solid rgba(255,255,255,0.18)" }}
                >
                  LIVE
                </span>
              )}
            </div>
            <div className="text-[11px]" style={{ color: "#71797E" }}>{sub}</div>
          </div>
        </div>

        {/* Counts */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono" style={{ color: "#71797E" }}>
            {events.length} event{events.length !== 1 ? "s" : ""}
          </span>
          {high > 0 && (
            <div
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(248,113,113,0.12)", color: "#f87171", border: "1px solid rgba(248,113,113,0.20)" }}
            >
              <Zap className="h-2.5 w-2.5" />
              {high}
            </div>
          )}
        </div>
      </div>

      {/* Events */}
      <div className="p-2 space-y-0.5">
        {events.map((ev, i) => (
          <EventRow key={i} event={ev} />
        ))}
      </div>
    </div>
  );
}

// ─── Stat Tile ────────────────────────────────────────────────────────────────

function StatTile({ label, value, icon: Icon, accent }: {
  label: string; value: number | string; icon: React.ElementType; accent?: string;
}) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col justify-between min-h-[90px]"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className="h-7 w-7 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)" }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: accent ?? "#878681" }} />
        </div>
        <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "#4b5563" }}>
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold font-mono tabular" style={{ color: accent ?? "#D1D1D6" }}>
        {value}
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
      const res = await fetch(`${API_BASE}/api/news/calendar?week=${week}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const filtered = useMemo(() => {
    if (!events) return [];
    return events.filter(e => {
      if (impact !== "all" && e.impact !== impact) return false;
      if (currency !== "all" && e.country !== currency) return false;
      return true;
    });
  }, [events, impact, currency]);

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of filtered) {
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

  const highImpact = events?.filter(e => e.impact === "High").length ?? 0;
  const hasActual  = events?.filter(e => e.actual !== "").length ?? 0;
  const todayKey   = format(new Date(), "yyyy-MM-dd");
  const activeFilters = (impact !== "all" ? 1 : 0) + (currency !== "all" ? 1 : 0);

  return (
    <div className="space-y-3 float-up px-0">

      {/* ── BENTO HEADER TILE ─────────────────────────────────────────── */}
      <div
        className="rounded-2xl px-5 py-4 flex items-center justify-between"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <Newspaper className="h-5 w-5" style={{ color: "#C0C0C0" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: "#F5F5F5", letterSpacing: "-0.030em" }}>
              Market Research
            </h1>
            <p className="text-[11px] font-mono" style={{ color: "#71797E" }}>
              Economic calendar · Forex Factory
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Week switcher pill */}
          <div
            className="flex items-center p-1 rounded-xl gap-0.5"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {(["this", "next"] as const).map(w => (
              <button
                key={w}
                onClick={() => setWeek(w)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer"
                style={week === w ? {
                  background: "rgba(255,255,255,0.12)",
                  color: "#F5F5F5",
                  border: "1px solid rgba(255,255,255,0.16)",
                } : {
                  color: "#71797E",
                  border: "1px solid transparent",
                }}
              >
                {w === "this" ? "This Week" : "Next Week"}
              </button>
            ))}
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer disabled:opacity-40"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} style={{ color: "#878681" }} />
          </button>
        </div>
      </div>

      {/* ── BENTO STATS ROW ───────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Total Events" value={events?.length ?? "—"} icon={Calendar} accent="#C0C0C0" />
        <StatTile label="High Impact"  value={highImpact || "—"}      icon={AlertTriangle} accent="#f87171" />
        <StatTile label="Released"     value={hasActual || "—"}        icon={TrendingUp}  accent="#4ade80" />
      </div>

      {/* ── BENTO FILTER TILE ─────────────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <button
          onClick={() => setShowFilters(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 cursor-pointer transition-all duration-150"
          style={{ color: "#D1D1D6" }}
        >
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5" style={{ color: "#71797E" }} />
            <span className="text-sm font-medium">Filters</span>
            {activeFilters > 0 && (
              <span
                className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.10)", color: "#C0C0C0", border: "1px solid rgba(255,255,255,0.14)" }}
              >
                {activeFilters} active
              </span>
            )}
          </div>
          <ChevronRight
            className="h-4 w-4 transition-transform duration-200"
            style={{ color: "#4b5563", transform: showFilters ? "rotate(90deg)" : "rotate(0deg)" }}
          />
        </button>

        {showFilters && (
          <div className="px-4 pb-4 space-y-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="pt-3 flex items-center justify-between">
              <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "#4b5563" }}>
                Impact Level
              </span>
              {activeFilters > 0 && (
                <button
                  onClick={() => { setImpact("all"); setCurrency("all"); }}
                  className="flex items-center gap-1 text-[10px] font-medium transition-colors duration-150 cursor-pointer"
                  style={{ color: "#71797E" }}
                >
                  <X className="h-2.5 w-2.5" /> Reset all
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(["all", "High", "Medium", "Low"] as const).map(i => (
                <button
                  key={i}
                  onClick={() => setImpact(i)}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer"
                  style={impact === i ? {
                    background: "rgba(255,255,255,0.12)",
                    border: "1px solid rgba(255,255,255,0.20)",
                    color: "#F5F5F5",
                  } : {
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#71797E",
                  }}
                >
                  {i === "all" ? "All Impact" : i}
                </button>
              ))}
            </div>

            <div>
              <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "#4b5563" }}>
                Currency
              </span>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {["all", ...CURRENCIES].map(c => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    className="px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer"
                    style={currency === c ? {
                      background: "rgba(255,255,255,0.12)",
                      border: "1px solid rgba(255,255,255,0.20)",
                      color: "#F5F5F5",
                    } : {
                      background: "transparent",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#71797E",
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

      {/* ── BENTO CALENDAR FEED ───────────────────────────────────────── */}
      {isLoading ? (
        <div
          className="rounded-2xl p-4"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <BentoSkeleton />
        </div>
      ) : isError ? (
        <div
          className="rounded-2xl py-16 flex flex-col items-center gap-4"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
          >
            <Globe2 className="h-7 w-7" style={{ color: "#4b5563" }} />
          </div>
          <div className="text-center">
            <p className="font-semibold text-sm" style={{ color: "#D1D1D6" }}>Could not load calendar</p>
            <p className="text-xs mt-1" style={{ color: "#71797E" }}>Forex Factory may be temporarily unavailable.</p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl transition-all duration-150 cursor-pointer"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#C0C0C0" }}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Try Again
          </button>
        </div>
      ) : grouped.length === 0 ? (
        <div
          className="rounded-2xl py-16 flex flex-col items-center gap-3"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <Calendar className="h-10 w-10 opacity-20" style={{ color: "#878681" }} />
          <div className="text-center">
            <p className="font-semibold text-sm" style={{ color: "#D1D1D6" }}>No events match your filters</p>
            <p className="text-xs mt-1" style={{ color: "#71797E" }}>Try adjusting impact level or currency.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(([date, evs]) => (
            <DayTile
              key={date}
              dateStr={date}
              events={evs}
              isToday={date === todayKey}
            />
          ))}
        </div>
      )}

      {/* ── FOOTER ────────────────────────────────────────────────────── */}
      {!isLoading && !isError && events && events.length > 0 && (
        <p className="text-[10px] font-mono text-center py-2" style={{ color: "#4b5563" }}>
          Data sourced from{" "}
          <a
            href="https://www.forexfactory.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 transition-colors duration-150 hover:text-[#878681]"
          >
            Forex Factory
          </a>
          {" "}· Times shown in ET · {events.length} events
        </p>
      )}
    </div>
  );
}
