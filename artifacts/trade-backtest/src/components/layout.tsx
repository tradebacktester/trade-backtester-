import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, CandlestickChart, FlaskConical,
  BarChart2, Settings, Newspaper, Zap, TrendingUp, Brain,
  MoreHorizontal, X, ChevronRight, BookOpen,
} from "lucide-react";
import { useSettings } from "@/lib/settings-context";

const DESKTOP_ITEMS = [
  { title: "Charts",  url: "/chart",      icon: CandlestickChart },
  { title: "Demo",    url: "/demo",       icon: Zap },
  { title: "Home",    url: "/dashboard",  icon: LayoutDashboard,  home: true },
  { title: "AI",      url: "/ai",         icon: Brain },
  { title: "Journal", url: "/backtests",  icon: FlaskConical },
] as const;

const MOBILE_MAIN = [
  { title: "Home",   url: "/dashboard", icon: LayoutDashboard, home: true },
  { title: "Charts", url: "/chart",     icon: CandlestickChart },
  { title: "Demo",   url: "/demo",      icon: Zap },
  { title: "AI",     url: "/ai",        icon: Brain },
] as const;

const DESKTOP_MORE = [
  { title: "Analytics", url: "/strategies", icon: BarChart2 },
  { title: "News",      url: "/news",       icon: Newspaper },
  { title: "Settings",  url: "/settings",   icon: Settings },
] as const;

const MOBILE_MORE = [
  { title: "Journal",   url: "/backtests",  icon: BookOpen },
  { title: "Analytics", url: "/strategies", icon: BarChart2 },
  { title: "News",      url: "/news",       icon: Newspaper },
  { title: "Settings",  url: "/settings",   icon: Settings },
] as const;

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { resolvedTheme } = useSettings();
  const [moreOpen, setMoreOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    if (!moreOpen) return;
    function handler(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [moreOpen]);

  useEffect(() => { setSheetOpen(false); setMoreOpen(false); }, [location]);

  const isActive = (url: string) => {
    if (url === "/dashboard") return location === "/" || location === "/dashboard";
    return location.startsWith(url);
  };

  const moreActive = DESKTOP_MORE.some(i => isActive(i.url));
  const mobileMoreActive = MOBILE_MORE.some(i => isActive(i.url));

  const navBg = isDark ? "rgba(6,8,14,0.85)" : "rgba(248,250,253,0.88)";
  const navBorder = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)";
  const dim = isDark ? "hsl(220,14%,46%)" : "hsl(220,14%,42%)";
  const mobileBg = isDark ? "rgba(5,7,12,0.95)" : "rgba(250,251,254,0.95)";

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">

      {/* ── DESKTOP TOP NAV ─────────────────────────────────────── */}
      <header
        className="fixed top-0 inset-x-0 z-50 hidden md:flex items-center h-14"
        style={{
          background: navBg,
          backdropFilter: "blur(32px) saturate(200%)",
          WebkitBackdropFilter: "blur(32px) saturate(200%)",
          borderBottom: `1px solid ${navBorder}`,
          boxShadow: isDark
            ? "0 1px 0 rgba(255,255,255,0.04), 0 4px 32px rgba(0,0,0,0.55)"
            : "0 1px 0 rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.08)",
        }}
      >
        {/* Logo */}
        <Link href="/dashboard">
          <span className="flex items-center gap-2 px-5 cursor-pointer select-none group">
            <span
              className="flex items-center justify-center h-7 w-7 rounded-lg transition-all duration-200 group-hover:scale-105"
              style={{
                background: "linear-gradient(135deg, hsl(190,90%,42%), hsl(210,80%,52%))",
                boxShadow: "0 0 18px rgba(0,229,255,0.45)",
              }}
            >
              <TrendingUp className="h-4 w-4 text-white" />
            </span>
            <span
              className="text-sm font-bold tracking-tight"
              style={{
                background: isDark
                  ? "linear-gradient(135deg, #fff 40%, hsl(190,90%,65%))"
                  : "linear-gradient(135deg, hsl(222,47%,18%) 40%, hsl(190,80%,42%))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              TradeTest
            </span>
          </span>
        </Link>

        <div className="w-px h-5 mx-1 flex-shrink-0" style={{ background: navBorder }} />

        {/* Centered nav */}
        <nav className="flex-1 flex items-center justify-center gap-1 px-3">
          {DESKTOP_ITEMS.map((item) => {
            const active = isActive(item.url);
            return (
              <Link key={item.title} href={item.url}>
                <span
                  className="relative flex items-center gap-1.5 cursor-pointer select-none transition-all duration-200"
                  style={item.home ? {
                    padding: "7px 18px",
                    borderRadius: "12px",
                    fontSize: "13px",
                    fontWeight: 600,
                    ...(active ? {
                      background: "linear-gradient(135deg, rgba(0,229,255,0.18), rgba(59,130,246,0.1))",
                      color: "hsl(190,90%,68%)",
                      boxShadow: "0 0 0 1px rgba(0,229,255,0.38), 0 0 28px rgba(0,229,255,0.18)",
                    } : {
                      background: "rgba(0,229,255,0.04)",
                      color: dim,
                      boxShadow: "0 0 0 1px rgba(0,229,255,0.12)",
                    }),
                  } : {
                    padding: "6px 14px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: 500,
                    ...(active ? {
                      background: "hsl(var(--primary) / 0.12)",
                      color: "hsl(var(--primary))",
                      boxShadow: "0 0 0 1px hsl(var(--primary) / 0.2), 0 0 16px hsl(var(--primary) / 0.1)",
                    } : {
                      color: dim,
                    }),
                  }}
                >
                  <item.icon style={{ height: item.home ? "15px" : "14px", width: item.home ? "15px" : "14px", flexShrink: 0 }} />
                  {item.title}
                  {active && item.home && (
                    <span
                      className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 h-0.5 rounded-full"
                      style={{
                        width: "50%",
                        background: "linear-gradient(90deg, transparent, rgba(0,229,255,0.9), transparent)",
                        boxShadow: "0 0 10px rgba(0,229,255,0.8)",
                      }}
                    />
                  )}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2 pr-4 flex-shrink-0">
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setMoreOpen(v => !v)}
              className="flex items-center gap-1.5 cursor-pointer select-none transition-all duration-200"
              style={{
                padding: "6px 14px",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: 500,
                ...(moreOpen || moreActive ? {
                  background: "hsl(var(--primary) / 0.12)",
                  color: "hsl(var(--primary))",
                  boxShadow: "0 0 0 1px hsl(var(--primary) / 0.2)",
                } : {
                  color: dim,
                }),
              }}
            >
              <MoreHorizontal style={{ height: "14px", width: "14px", flexShrink: 0 }} />
              More
            </button>

            {moreOpen && (
              <div
                className="absolute right-0 top-[calc(100%+8px)] w-48 rounded-2xl p-1.5 flex flex-col gap-0.5"
                style={{
                  background: isDark ? "rgba(7,9,17,0.97)" : "rgba(248,250,254,0.99)",
                  border: `1px solid ${navBorder}`,
                  backdropFilter: "blur(32px)",
                  boxShadow: isDark
                    ? "0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)"
                    : "0 16px 48px rgba(0,0,0,0.15)",
                  zIndex: 200,
                }}
              >
                {DESKTOP_MORE.map(item => {
                  const active = isActive(item.url);
                  return (
                    <Link key={item.title} href={item.url} onClick={() => setMoreOpen(false)}>
                      <span
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-all"
                        style={active ? {
                          background: "hsl(var(--primary) / 0.1)",
                          color: "hsl(var(--primary))",
                        } : {
                          color: isDark ? "hsl(220,14%,68%)" : "hsl(220,14%,30%)",
                        }}
                      >
                        <item.icon style={{ height: "15px", width: "15px", flexShrink: 0 }} />
                        {item.title}
                        {active && <ChevronRight style={{ height: "12px", width: "12px", marginLeft: "auto" }} />}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <span className="flex items-center gap-1.5 text-[11px] font-mono" style={{ color: isDark ? "hsl(220,14%,35%)" : "hsl(220,14%,52%)" }}>
            <span
              className="h-1.5 w-1.5 rounded-full animate-pulse"
              style={{ background: "hsl(150,90%,52%)", boxShadow: "0 0 8px hsl(150,90%,52%)" }}
            />
            LIVE
          </span>
        </div>
      </header>

      {/* ── MAIN CONTENT ────────────────────────────────────────── */}
      <main
        className="flex-1 overflow-x-hidden overflow-y-auto"
        style={{ paddingTop: "56px" }}
      >
        <style>{`
          @media (max-width: 767px) {
            main { padding-top: 0 !important; padding-bottom: 72px !important; }
          }
          @keyframes tt-slide-up {
            from { transform: translateY(100%); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
          }
        `}</style>
        <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 py-4 sm:py-5 md:py-6 h-full overflow-x-hidden">
          {children}
        </div>
      </main>

      {/* ── MOBILE BOTTOM NAV ───────────────────────────────────── */}
      <nav
        className="fixed bottom-0 inset-x-0 z-50 flex md:hidden items-stretch h-16"
        style={{
          background: mobileBg,
          backdropFilter: "blur(32px) saturate(200%)",
          WebkitBackdropFilter: "blur(32px) saturate(200%)",
          borderTop: `1px solid ${navBorder}`,
          boxShadow: "0 -4px 32px rgba(0,0,0,0.55), 0 -1px 0 rgba(255,255,255,0.04)",
        }}
      >
        {MOBILE_MAIN.map((item) => {
          const active = isActive(item.url);
          return (
            <Link key={item.title} href={item.url} className="flex-1">
              <span
                className="flex flex-col items-center justify-center gap-[3px] h-full w-full cursor-pointer select-none transition-all duration-150 active:scale-90"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <span
                  className="flex items-center justify-center w-10 h-6 rounded-xl transition-all duration-200"
                  style={active ? (item.home ? {
                    background: "linear-gradient(135deg, rgba(0,229,255,0.2), rgba(59,130,246,0.15))",
                    boxShadow: "0 0 18px rgba(0,229,255,0.32), 0 0 0 1px rgba(0,229,255,0.3)",
                  } : {
                    background: "hsl(var(--primary) / 0.15)",
                    boxShadow: "0 0 14px hsl(var(--primary) / 0.28)",
                  }) : {}}
                >
                  <item.icon
                    style={{
                      height: "17px", width: "17px",
                      transition: "all 0.2s",
                      ...(active ? (item.home ? {
                        color: "hsl(190,90%,65%)",
                        filter: "drop-shadow(0 0 5px rgba(0,229,255,0.7))",
                      } : {
                        color: "hsl(var(--primary))",
                        filter: "drop-shadow(0 0 5px hsl(var(--primary) / 0.6))",
                      }) : { color: dim }),
                    }}
                  />
                </span>
                <span
                  className="text-[9px] font-medium tracking-wide"
                  style={{
                    transition: "color 0.2s",
                    ...(active ? (item.home ? { color: "hsl(190,90%,65%)" } : { color: "hsl(var(--primary))" }) : { color: dim }),
                  }}
                >
                  {item.title}
                </span>
              </span>
            </Link>
          );
        })}

        {/* More button */}
        <button
          onClick={() => setSheetOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-[3px] h-full cursor-pointer select-none transition-all duration-150 active:scale-90"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <span
            className="flex items-center justify-center w-10 h-6 rounded-xl transition-all duration-200"
            style={mobileMoreActive ? {
              background: "hsl(var(--primary) / 0.15)",
              boxShadow: "0 0 14px hsl(var(--primary) / 0.28)",
            } : {}}
          >
            <MoreHorizontal
              style={{
                height: "17px", width: "17px",
                color: mobileMoreActive ? "hsl(var(--primary))" : dim,
              }}
            />
          </span>
          <span
            className="text-[9px] font-medium tracking-wide"
            style={{ color: mobileMoreActive ? "hsl(var(--primary))" : dim }}
          >
            More
          </span>
        </button>
      </nav>

      {/* ── MOBILE MORE SHEET ────────────────────────────────────── */}
      {sheetOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] md:hidden"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
            onClick={() => setSheetOpen(false)}
          />
          <div
            className="fixed bottom-0 inset-x-0 z-[61] md:hidden rounded-t-[28px] pb-8"
            style={{
              background: isDark ? "rgba(6,8,16,0.98)" : "rgba(248,250,254,0.99)",
              borderTop: `1px solid ${navBorder}`,
              borderLeft: `1px solid ${navBorder}`,
              borderRight: `1px solid ${navBorder}`,
              backdropFilter: "blur(40px)",
              boxShadow: "0 -12px 60px rgba(0,0,0,0.65)",
              animation: "tt-slide-up 0.22s cubic-bezier(0.32,0.72,0,1)",
            }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
            </div>

            <div className="flex items-center justify-between px-5 py-3">
              <p className="text-xs font-mono uppercase tracking-widest" style={{ color: dim }}>More options</p>
              <button
                onClick={() => setSheetOpen(false)}
                className="h-7 w-7 flex items-center justify-center rounded-full transition-all"
                style={{ background: "rgba(255,255,255,0.07)", color: dim }}
              >
                <X style={{ height: "14px", width: "14px" }} />
              </button>
            </div>

            <div className="px-4 flex flex-col gap-1.5">
              {MOBILE_MORE.map(item => {
                const active = isActive(item.url);
                return (
                  <Link key={item.title} href={item.url} onClick={() => setSheetOpen(false)}>
                    <span
                      className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl cursor-pointer transition-all"
                      style={active ? {
                        background: "hsl(var(--primary) / 0.1)",
                        border: "1px solid hsl(var(--primary) / 0.22)",
                        color: "hsl(var(--primary))",
                      } : {
                        background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                        border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.06)",
                        color: isDark ? "hsl(220,14%,72%)" : "hsl(220,14%,25%)",
                      }}
                    >
                      <span
                        className="h-9 w-9 flex-shrink-0 rounded-xl flex items-center justify-center"
                        style={active ? {
                          background: "hsl(var(--primary) / 0.15)",
                        } : {
                          background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                        }}
                      >
                        <item.icon
                          style={{
                            height: "18px", width: "18px",
                            color: active ? "hsl(var(--primary))" : dim,
                          }}
                        />
                      </span>
                      <span className="text-[15px] font-medium">{item.title}</span>
                      {active && (
                        <ChevronRight style={{ height: "15px", width: "15px", marginLeft: "auto", color: "hsl(var(--primary))" }} />
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
