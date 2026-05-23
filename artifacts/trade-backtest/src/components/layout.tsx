import React from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  CandlestickChart,
  FlaskConical,
  BarChart2,
  Settings,
  TrendingUp,
} from "lucide-react";

const NAV_ITEMS = [
  { title: "Dashboard",  url: "/dashboard",  icon: LayoutDashboard },
  { title: "Charts",     url: "/chart",      icon: CandlestickChart },
  { title: "Backtester", url: "/backtests",  icon: FlaskConical },
  { title: "Analytics",  url: "/strategies", icon: BarChart2 },
  { title: "Settings",   url: "/settings",   icon: Settings },
] as const;

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const isActive = (url: string) => {
    if (url === "/dashboard") return location === "/dashboard";
    return location.startsWith(url);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">

      {/* ── Top nav (desktop) ───────────────────────────────────── */}
      <header
        className="fixed top-0 inset-x-0 z-50 hidden md:flex items-center h-14"
        style={{
          background: "rgba(8, 10, 15, 0.92)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderBottom: "1px solid rgba(255,255,255,0.055)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.03), 0 4px 24px rgba(0,0,0,0.4)",
        }}
      >
        {/* Logo */}
        <Link href="/dashboard">
          <span className="flex items-center gap-2 px-5 h-full cursor-pointer select-none group">
            <span
              className="flex items-center justify-center h-7 w-7 rounded-lg"
              style={{
                background: "linear-gradient(135deg, hsl(217,91%,55%), hsl(210,80%,45%))",
                boxShadow: "0 0 14px hsla(217,91%,55%,0.35)",
              }}
            >
              <TrendingUp className="h-4 w-4 text-white" />
            </span>
            <span
              className="text-sm font-bold tracking-tight"
              style={{
                background: "linear-gradient(135deg, #fff 30%, hsl(217,91%,75%))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              TradeTest
            </span>
          </span>
        </Link>

        {/* Divider */}
        <div className="w-px h-5 mx-2" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Nav items */}
        <nav className="flex items-center h-full gap-0.5 px-2">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.url);
            return (
              <Link key={item.title} href={item.url}>
                <span
                  className="relative flex items-center gap-2 px-3.5 h-8 rounded-lg text-[13px] font-medium cursor-pointer select-none transition-all duration-200"
                  style={active ? {
                    background: "rgba(59,130,246,0.12)",
                    color: "hsl(217,91%,72%)",
                    boxShadow: "inset 0 1px 0 rgba(59,130,246,0.15)",
                  } : {
                    color: "hsl(220,14%,52%)",
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLSpanElement).style.color = "hsl(220,14%,80%)"; (e.currentTarget as HTMLSpanElement).style.background = "rgba(255,255,255,0.04)"; }}
                  onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLSpanElement).style.color = "hsl(220,14%,52%)"; (e.currentTarget as HTMLSpanElement).style.background = "transparent"; } }}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  {item.title}
                  {active && (
                    <span
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] rounded-full"
                      style={{
                        width: "60%",
                        background: "linear-gradient(90deg, transparent, hsl(217,91%,60%), transparent)",
                        boxShadow: "0 0 8px hsla(217,91%,60%,0.7)",
                      }}
                    />
                  )}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Right side — live indicator */}
        <div className="ml-auto flex items-center gap-3 pr-5">
          <span className="flex items-center gap-1.5 text-[11px] font-mono" style={{ color: "hsl(220,14%,38%)" }}>
            <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "hsl(150,90%,52%)", boxShadow: "0 0 6px hsl(150,90%,52%)" }} />
            LIVE
          </span>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────── */}
      <main
        className="flex-1 overflow-auto"
        style={{
          paddingTop: "56px",         /* top nav on desktop */
          paddingBottom: "0px",
        }}
      >
        {/* On mobile: add bottom padding for bottom nav */}
        <style>{`@media (max-width: 767px) { main { padding-top: 0 !important; padding-bottom: 68px !important; } }`}</style>
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-5 md:py-6 h-full">
          {children}
        </div>
      </main>

      {/* ── Bottom nav (mobile) ──────────────────────────────────── */}
      <nav
        className="fixed bottom-0 inset-x-0 z-50 flex md:hidden items-center h-[64px]"
        style={{
          background: "rgba(6, 8, 14, 0.97)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.5), 0 -1px 0 rgba(255,255,255,0.03)",
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
                {/* Icon container */}
                <span
                  className="flex items-center justify-center h-7 w-10 rounded-xl transition-all duration-200"
                  style={active ? {
                    background: "rgba(59,130,246,0.15)",
                    boxShadow: "0 0 16px rgba(59,130,246,0.2)",
                  } : {}}
                >
                  {/* Dot indicator */}
                  {active && (
                    <span
                      className="absolute top-[10px] h-1 w-1 rounded-full"
                      style={{
                        background: "hsl(217,91%,65%)",
                        boxShadow: "0 0 6px hsla(217,91%,65%,0.8)",
                      }}
                    />
                  )}
                  <item.icon
                    className="h-[19px] w-[19px] transition-all duration-200"
                    style={active ? {
                      color: "hsl(217,91%,68%)",
                      filter: "drop-shadow(0 0 6px hsla(217,91%,68%,0.6))",
                    } : {
                      color: "hsl(220,14%,45%)",
                    }}
                  />
                </span>
                <span
                  className="text-[10px] font-medium tracking-wide transition-all duration-200"
                  style={active ? {
                    color: "hsl(217,91%,68%)",
                  } : {
                    color: "hsl(220,14%,40%)",
                  }}
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
