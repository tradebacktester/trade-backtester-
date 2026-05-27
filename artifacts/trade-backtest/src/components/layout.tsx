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
  { title: "Home",    url: "/dashboard",  icon: LayoutDashboard, home: true },
  { title: "AI",      url: "/ai",         icon: Brain },
  { title: "Journal", url: "/backtests",  icon: FlaskConical },
] as const;

const MOBILE_MAIN = [
  { title: "Charts", url: "/chart",     icon: CandlestickChart },
  { title: "Demo",   url: "/demo",      icon: Zap },
  { title: "Home",   url: "/dashboard", icon: LayoutDashboard, home: true },
  { title: "AI",     url: "/ai",        icon: Brain },
  { title: "More",   url: null,         icon: MoreHorizontal },
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

  /* ── color tokens ── */
  const navBg = "rgba(18,21,30,0.88)";
  const navBorder = "rgba(255,255,255,0.07)";
  const mobileBg = "rgba(15,18,26,0.96)";
  const dim = "hsl(218,12%,46%)";
  const accentColor = "hsl(210,90%,62%)";

  return (
    <div className="tt-root">

      {/* ── DESKTOP TOP NAV ─────────────────────────────────────── */}
      <header
        className="tt-desktop-nav fixed top-0 inset-x-0 z-50 hidden md:flex items-center h-14"
        style={{
          background: navBg,
          backdropFilter: "blur(28px) saturate(160%)",
          WebkitBackdropFilter: "blur(28px) saturate(160%)",
          borderBottom: `1px solid ${navBorder}`,
          boxShadow: "0 1px 0 rgba(255,255,255,0.035), 0 4px 20px rgba(0,0,0,0.45)",
        }}
      >
        {/* Logo */}
        <Link href="/dashboard">
          <span className="flex items-center gap-2.5 px-5 cursor-pointer select-none group">
            <span
              className="flex items-center justify-center h-7 w-7 rounded-xl transition-all duration-200 group-hover:scale-105"
              style={{
                background: "linear-gradient(135deg, hsl(200,85%,46%), hsl(215,80%,56%))",
                boxShadow: "0 0 14px rgba(59,130,246,0.38)",
              }}
            >
              <TrendingUp className="h-4 w-4 text-white" />
            </span>
            <span
              className="text-sm font-bold tracking-tight"
              style={{
                background: "linear-gradient(135deg, #e2e8f0 40%, hsl(210,90%,68%))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              TradeTest
            </span>
          </span>
        </Link>

        <div className="w-px h-5 mx-2 flex-shrink-0" style={{ background: navBorder }} />

        {/* Centered nav */}
        <nav className="flex-1 flex items-center justify-center gap-0.5 px-3">
          {DESKTOP_ITEMS.map((item) => {
            const active = isActive(item.url);
            return (
              <Link key={item.title} href={item.url}>
                <span
                  className="relative flex items-center gap-1.5 cursor-pointer select-none transition-all duration-200"
                  style={item.home ? {
                    padding: "6px 16px",
                    borderRadius: "12px",
                    fontSize: "13px",
                    fontWeight: 600,
                    ...(active ? {
                      background: "linear-gradient(135deg, rgba(59,130,246,0.18), rgba(59,130,246,0.1))",
                      color: accentColor,
                      boxShadow: "0 0 0 1px rgba(59,130,246,0.32), 0 0 20px rgba(59,130,246,0.12)",
                    } : {
                      background: "rgba(59,130,246,0.05)",
                      color: dim,
                      boxShadow: "0 0 0 1px rgba(59,130,246,0.1)",
                    }),
                  } : {
                    padding: "6px 12px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: 500,
                    ...(active ? {
                      background: "rgba(59,130,246,0.1)",
                      color: accentColor,
                    } : {
                      color: dim,
                    }),
                  }}
                >
                  <item.icon style={{ height: "14px", width: "14px", flexShrink: 0 }} />
                  {item.title}
                  {active && item.home && (
                    <span
                      className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 h-0.5 rounded-full"
                      style={{
                        width: "55%",
                        background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.85), transparent)",
                        boxShadow: "0 0 8px rgba(59,130,246,0.7)",
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
                padding: "6px 12px",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: 500,
                ...(moreOpen || moreActive ? {
                  background: "rgba(59,130,246,0.1)",
                  color: accentColor,
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
                  background: "rgba(14,17,26,0.98)",
                  border: `1px solid ${navBorder}`,
                  backdropFilter: "blur(28px)",
                  boxShadow: "0 20px 50px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04)",
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
                          background: "rgba(59,130,246,0.1)",
                          color: accentColor,
                        } : {
                          color: "hsl(218,12%,65%)",
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

          <span className="flex items-center gap-1.5 text-[11px] font-mono" style={{ color: "hsl(218,12%,34%)" }}>
            <span
              className="h-1.5 w-1.5 rounded-full animate-pulse"
              style={{ background: "hsl(150,85%,50%)", boxShadow: "0 0 6px hsl(150,85%,50%)" }}
            />
            LIVE
          </span>
        </div>
      </header>

      {/* ── MAIN CONTENT ────────────────────────────────────────── */}
      <main className="tt-main">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 py-4 sm:py-5 md:py-6">
          {children}
        </div>
      </main>

      {/* ── PREMIUM MOBILE BOTTOM NAV ────────────────────────────── */}
      <nav
        className="tt-bottom-nav fixed bottom-0 inset-x-0 z-50 flex md:hidden"
        style={{
          background: mobileBg,
          backdropFilter: "blur(24px) saturate(150%)",
          WebkitBackdropFilter: "blur(24px) saturate(150%)",
          borderTop: `1px solid ${navBorder}`,
          boxShadow: "0 -1px 0 rgba(255,255,255,0.035), 0 -8px 32px rgba(0,0,0,0.4)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="flex items-end w-full" style={{ height: "68px" }}>
          {MOBILE_MAIN.map((item, idx) => {
            const isHome = item.home === true;
            const active = item.url ? isActive(item.url) : mobileMoreActive;
            const isMore = item.url === null;

            if (isHome) {
              return (
                <Link key={item.title} href={item.url!} className="flex-1">
                  <span
                    className="flex flex-col items-center justify-end pb-2 h-full w-full cursor-pointer select-none"
                    style={{ WebkitTapHighlightColor: "transparent" }}
                  >
                    {/* Center home button — elevated pill */}
                    <span
                      className="flex flex-col items-center justify-center gap-[3px] transition-all duration-200 active:scale-90"
                      style={{
                        width: "60px",
                        height: "52px",
                        borderRadius: "18px",
                        marginBottom: "2px",
                        ...(active ? {
                          background: "linear-gradient(145deg, rgba(59,130,246,0.28), rgba(59,130,246,0.16))",
                          boxShadow: "0 0 0 1px rgba(59,130,246,0.4), 0 0 20px rgba(59,130,246,0.22), 0 -4px 16px rgba(59,130,246,0.15)",
                        } : {
                          background: "rgba(59,130,246,0.08)",
                          boxShadow: "0 0 0 1px rgba(59,130,246,0.14)",
                        }),
                      }}
                    >
                      <item.icon
                        style={{
                          height: "20px",
                          width: "20px",
                          transition: "all 0.2s",
                          ...(active ? {
                            color: accentColor,
                            filter: "drop-shadow(0 0 5px rgba(59,130,246,0.7))",
                          } : { color: "hsl(218,12%,50%)" }),
                        }}
                      />
                      <span
                        className="text-[9px] font-semibold tracking-wide"
                        style={{ color: active ? accentColor : "hsl(218,12%,46%)", transition: "color 0.18s" }}
                      >
                        {item.title}
                      </span>
                    </span>
                  </span>
                </Link>
              );
            }

            if (isMore) {
              return (
                <button
                  key="more"
                  onClick={() => setSheetOpen(true)}
                  className="flex-1 flex flex-col items-center justify-center gap-[3px] h-full cursor-pointer select-none transition-all duration-150 active:scale-[0.88]"
                  style={{ WebkitTapHighlightColor: "transparent", paddingBottom: "8px" }}
                >
                  <span
                    className="flex items-center justify-center w-9 h-[24px] rounded-[10px] transition-all duration-200"
                    style={active ? {
                      background: "rgba(59,130,246,0.13)",
                      boxShadow: "0 0 10px rgba(59,130,246,0.2)",
                    } : {}}
                  >
                    <item.icon
                      style={{
                        height: "16px", width: "16px",
                        color: active ? accentColor : dim,
                      }}
                    />
                  </span>
                  <span className="text-[9.5px] font-medium" style={{ color: active ? accentColor : dim }}>
                    More
                  </span>
                </button>
              );
            }

            return (
              <Link key={item.title} href={item.url!} className="flex-1">
                <span
                  className="flex flex-col items-center justify-center gap-[3px] h-full w-full cursor-pointer select-none transition-all duration-150 active:scale-[0.88]"
                  style={{ WebkitTapHighlightColor: "transparent", paddingBottom: "8px" }}
                >
                  <span
                    className="flex items-center justify-center w-9 h-[24px] rounded-[10px] transition-all duration-200"
                    style={active ? {
                      background: "rgba(59,130,246,0.13)",
                      boxShadow: "0 0 10px rgba(59,130,246,0.2)",
                    } : {}}
                  >
                    <item.icon
                      style={{
                        height: "16px", width: "16px",
                        transition: "all 0.18s",
                        ...(active ? {
                          color: accentColor,
                          filter: "drop-shadow(0 0 4px rgba(59,130,246,0.55))",
                        } : { color: dim }),
                      }}
                    />
                  </span>
                  <span
                    className="text-[9.5px] font-medium tracking-wide"
                    style={{ transition: "color 0.18s", color: active ? accentColor : dim }}
                  >
                    {item.title}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── MOBILE MORE SHEET ─────────────────────────────────────── */}
      {sheetOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] md:hidden"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
            onClick={() => setSheetOpen(false)}
          />
          <div
            className="tt-slide-up fixed inset-x-0 z-[61] md:hidden"
            style={{
              bottom: 0,
              borderRadius: "20px 20px 0 0",
              background: "hsl(222, 22%, 10%)",
              borderTop: `1px solid ${navBorder}`,
              borderLeft: `1px solid ${navBorder}`,
              borderRight: `1px solid ${navBorder}`,
              boxShadow: "0 -16px 48px rgba(0,0,0,0.55)",
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
            }}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-9 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
            </div>

            <div className="flex items-center justify-between px-5 py-3">
              <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(218,12%,38%)" }}>
                More options
              </p>
              <button
                onClick={() => setSheetOpen(false)}
                className="h-7 w-7 flex items-center justify-center rounded-full transition-all active:scale-90"
                style={{ background: "rgba(255,255,255,0.06)", color: dim }}
              >
                <X style={{ height: "14px", width: "14px" }} />
              </button>
            </div>

            <div className="px-4 flex flex-col gap-2">
              {MOBILE_MORE.map(item => {
                const active = isActive(item.url);
                return (
                  <Link key={item.title} href={item.url} onClick={() => setSheetOpen(false)}>
                    <span
                      className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl cursor-pointer transition-all active:scale-[0.98]"
                      style={active ? {
                        background: "rgba(59,130,246,0.1)",
                        border: "1px solid rgba(59,130,246,0.22)",
                        color: accentColor,
                      } : {
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        color: "hsl(218,12%,68%)",
                      }}
                    >
                      <span
                        className="h-9 w-9 flex-shrink-0 rounded-xl flex items-center justify-center"
                        style={active ? {
                          background: "rgba(59,130,246,0.15)",
                        } : {
                          background: "rgba(255,255,255,0.05)",
                        }}
                      >
                        <item.icon
                          style={{
                            height: "18px", width: "18px",
                            color: active ? accentColor : dim,
                          }}
                        />
                      </span>
                      <span className="text-[15px] font-medium">{item.title}</span>
                      {active && (
                        <ChevronRight style={{ height: "15px", width: "15px", marginLeft: "auto", color: accentColor }} />
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
