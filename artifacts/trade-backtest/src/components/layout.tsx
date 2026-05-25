import React from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  CandlestickChart,
  FlaskConical,
  BarChart2,
  Settings,
  TrendingUp,
  Newspaper,
} from "lucide-react";
import { useSettings } from "@/lib/settings-context";

const NAV_ITEMS = [
  { title: "Dashboard",  url: "/dashboard",  icon: LayoutDashboard },
  { title: "Charts",     url: "/chart",      icon: CandlestickChart },
  { title: "Backtester", url: "/backtests",  icon: FlaskConical },
  { title: "Analytics",  url: "/strategies", icon: BarChart2 },
  { title: "News",       url: "/news",       icon: Newspaper },
  { title: "Settings",   url: "/settings",   icon: Settings },
] as const;

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { resolvedTheme } = useSettings();

  const isDark = resolvedTheme === "dark";

  const navBg = isDark
    ? "rgba(6, 8, 14, 0.75)"
    : "rgba(248, 250, 253, 0.75)";
  const navBorder = isDark
    ? "rgba(255,255,255,0.07)"
    : "rgba(0,0,0,0.08)";
  const logoTextStyle = isDark
    ? { background: "linear-gradient(135deg, #fff 30%, hsl(var(--primary)))", WebkitBackgroundClip: "text" as const, WebkitTextFillColor: "transparent" as const }
    : { background: "linear-gradient(135deg, hsl(222,47%,15%) 30%, hsl(var(--primary)))", WebkitBackgroundClip: "text" as const, WebkitTextFillColor: "transparent" as const };
  const inactiveColor = isDark ? "hsl(220,14%,52%)" : "hsl(220,14%,42%)";
  const hoverColor = isDark ? "hsl(220,14%,80%)" : "hsl(220,14%,20%)";
  const hoverBg = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";

  const mobileNavBg = isDark
    ? "rgba(5, 7, 12, 0.92)"
    : "rgba(250, 251, 254, 0.92)";
  const mobileNavBorder = isDark
    ? "rgba(255,255,255,0.08)"
    : "rgba(0,0,0,0.07)";

  const isActive = (url: string) => {
    if (url === "/dashboard") return location === "/dashboard";
    return location.startsWith(url);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">

      {/* ── Top nav (desktop) ───────────────────────────────────────── */}
      <header
        className="fixed top-0 inset-x-0 z-50 hidden md:flex items-center h-14"
        style={{
          background: navBg,
          backdropFilter: "blur(28px) saturate(200%)",
          WebkitBackdropFilter: "blur(28px) saturate(200%)",
          borderBottom: `1px solid ${navBorder}`,
          boxShadow: isDark
            ? "0 1px 0 rgba(255,255,255,0.04), 0 4px 32px rgba(0,0,0,0.5)"
            : "0 1px 0 rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.08)",
        }}
      >
        {/* Logo */}
        <Link href="/dashboard">
          <span className="flex items-center gap-2 px-5 h-full cursor-pointer select-none group">
            <span
              className="flex items-center justify-center h-7 w-7 rounded-lg transition-all duration-200 group-hover:scale-105"
              style={{
                background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))",
                boxShadow: "0 0 16px hsl(var(--primary) / 0.45)",
              }}
            >
              <TrendingUp className="h-4 w-4 text-white" />
            </span>
            <span className="text-sm font-bold tracking-tight" style={logoTextStyle}>
              TradeTest
            </span>
          </span>
        </Link>

        {/* Divider */}
        <div className="w-px h-5 mx-2" style={{ background: navBorder }} />

        {/* Nav items */}
        <nav className="flex items-center h-full gap-0.5 px-2">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.url);
            return (
              <Link key={item.title} href={item.url}>
                <span
                  className="relative flex items-center gap-2 px-3.5 h-8 rounded-lg text-[13px] font-medium cursor-pointer select-none transition-all duration-200"
                  style={active ? {
                    background: "hsl(var(--primary) / 0.12)",
                    color: "hsl(var(--primary))",
                    boxShadow: "inset 0 1px 0 hsl(var(--primary) / 0.15)",
                  } : { color: inactiveColor }}
                  onMouseEnter={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.color = hoverColor;
                      (e.currentTarget as HTMLElement).style.background = hoverBg;
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.color = inactiveColor;
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                    }
                  }}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  {item.title}
                  {active && (
                    <span
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] rounded-full"
                      style={{
                        width: "60%",
                        background: "linear-gradient(90deg, transparent, hsl(var(--primary)), transparent)",
                        boxShadow: "0 0 10px hsl(var(--primary) / 0.8)",
                      }}
                    />
                  )}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Right — live indicator */}
        <div className="ml-auto flex items-center gap-3 pr-5">
          <span
            className="flex items-center gap-1.5 text-[11px] font-mono"
            style={{ color: isDark ? "hsl(220,14%,38%)" : "hsl(220,14%,50%)" }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full animate-pulse"
              style={{
                background: "hsl(150,90%,52%)",
                boxShadow: "0 0 8px hsl(150,90%,52%)",
              }}
            />
            LIVE
          </span>
        </div>
      </header>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto inertia-scroll" style={{ paddingTop: "56px" }}>
        <style>{`@media (max-width: 767px) { main { padding-top: 0 !important; padding-bottom: 68px !important; } }`}</style>
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-5 md:py-6 h-full">
          {children}
        </div>
      </main>

      {/* ── Bottom nav (mobile) ───────────────────────────────────────── */}
      <nav
        className="fixed bottom-0 inset-x-0 z-50 flex md:hidden items-center h-[64px]"
        style={{
          background: mobileNavBg,
          backdropFilter: "blur(28px) saturate(200%)",
          WebkitBackdropFilter: "blur(28px) saturate(200%)",
          borderTop: `1px solid ${mobileNavBorder}`,
          boxShadow: isDark
            ? "0 -4px 32px rgba(0,0,0,0.55), 0 -1px 0 rgba(255,255,255,0.04)"
            : "0 -4px 16px rgba(0,0,0,0.08)",
        }}
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.url);
          return (
            <Link key={item.title} href={item.url} className="flex-1">
              <span
                className="flex flex-col items-center justify-center gap-1 py-2 h-full cursor-pointer select-none transition-all duration-200 active:scale-90"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <span
                  className="flex items-center justify-center h-7 w-10 rounded-xl transition-all duration-200"
                  style={active ? {
                    background: "hsl(var(--primary) / 0.15)",
                    boxShadow: "0 0 16px hsl(var(--primary) / 0.25)",
                  } : {}}
                >
                  <item.icon
                    className="h-[18px] w-[18px] transition-all duration-200"
                    style={active ? {
                      color: "hsl(var(--primary))",
                      filter: "drop-shadow(0 0 6px hsl(var(--primary) / 0.6))",
                    } : { color: inactiveColor }}
                  />
                </span>
                <span
                  className="text-[9px] font-medium tracking-wide transition-all duration-200"
                  style={active ? { color: "hsl(var(--primary))" } : { color: inactiveColor }}
                >
                  {item.title}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
