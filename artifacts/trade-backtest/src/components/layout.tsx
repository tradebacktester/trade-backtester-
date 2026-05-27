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

/* ── Color tokens — monochrome ─────────────────────────────────────── */
const T = {
  navBg:      "rgba(10,10,10,0.97)",
  navBorder:  "rgba(255,255,255,0.07)",
  mobileBg:   "rgba(10,10,10,0.99)",
  dim:        "hsl(0,0%,40%)",
  active:     "hsl(0,0%,90%)",
  activeBg:   "rgba(255,255,255,0.08)",
  activeBdr:  "rgba(255,255,255,0.12)",
  sheetBg:    "hsl(0,0%,10%)",
};

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

  return (
    <div className="tt-root">

      {/* ── DESKTOP TOP NAV ─────────────────────────────────────── */}
      <header
        className="tt-desktop-nav fixed top-0 inset-x-0 z-50 hidden md:flex items-center h-[52px]"
        style={{
          background: T.navBg,
          borderBottom: `1px solid ${T.navBorder}`,
          boxShadow: "0 1px 0 rgba(255,255,255,0.03)",
        }}
      >
        {/* Logo */}
        <Link href="/dashboard">
          <span className="flex items-center gap-2.5 px-5 cursor-pointer select-none group">
            <span
              className="flex items-center justify-center h-6 w-6 rounded-lg transition-opacity duration-200 group-hover:opacity-80"
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.14)",
              }}
            >
              <TrendingUp className="h-3.5 w-3.5" style={{ color: "hsl(0,0%,80%)" }} />
            </span>
            <span className="text-sm font-semibold tracking-tight" style={{ color: "hsl(0,0%,82%)" }}>
              TradeTest
            </span>
          </span>
        </Link>

        <div className="w-px h-4 mx-2 flex-shrink-0" style={{ background: T.navBorder }} />

        {/* Centered nav */}
        <nav className="flex-1 flex items-center justify-center gap-0.5 px-3">
          {DESKTOP_ITEMS.map((item) => {
            const active = isActive(item.url);
            return (
              <Link key={item.title} href={item.url}>
                <span
                  className="relative flex items-center gap-1.5 cursor-pointer select-none transition-colors duration-150"
                  style={item.home ? {
                    padding: "5px 14px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: 600,
                    ...(active ? {
                      background: T.activeBg,
                      color: T.active,
                      border: `1px solid ${T.activeBdr}`,
                    } : {
                      background: "rgba(255,255,255,0.03)",
                      color: T.dim,
                      border: "1px solid rgba(255,255,255,0.06)",
                    }),
                  } : {
                    padding: "5px 10px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 500,
                    border: "1px solid transparent",
                    ...(active ? {
                      background: T.activeBg,
                      color: T.active,
                      borderColor: T.activeBdr,
                    } : {
                      color: T.dim,
                    }),
                  }}
                >
                  <item.icon style={{ height: "13px", width: "13px", flexShrink: 0 }} />
                  {item.title}
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
              className="flex items-center gap-1.5 cursor-pointer select-none transition-colors duration-150"
              style={{
                padding: "5px 10px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 500,
                border: "1px solid transparent",
                ...(moreOpen || moreActive ? {
                  background: T.activeBg,
                  color: T.active,
                  borderColor: T.activeBdr,
                } : {
                  color: T.dim,
                }),
              }}
            >
              <MoreHorizontal style={{ height: "13px", width: "13px", flexShrink: 0 }} />
              More
            </button>

            {moreOpen && (
              <div
                className="absolute right-0 top-[calc(100%+6px)] w-44 rounded-2xl p-1.5 flex flex-col gap-0.5"
                style={{
                  background: "hsl(0,0%,10%)",
                  border: `1px solid ${T.navBorder}`,
                  boxShadow: "0 16px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
                  zIndex: 200,
                }}
              >
                {DESKTOP_MORE.map(item => {
                  const active = isActive(item.url);
                  return (
                    <Link key={item.title} href={item.url} onClick={() => setMoreOpen(false)}>
                      <span
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm cursor-pointer transition-colors duration-150"
                        style={active ? {
                          background: T.activeBg,
                          color: T.active,
                        } : {
                          color: "hsl(0,0%,60%)",
                        }}
                        onMouseEnter={e => {
                          if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                        }}
                        onMouseLeave={e => {
                          if (!active) (e.currentTarget as HTMLElement).style.background = "";
                        }}
                      >
                        <item.icon style={{ height: "14px", width: "14px", flexShrink: 0 }} />
                        {item.title}
                        {active && <ChevronRight style={{ height: "11px", width: "11px", marginLeft: "auto" }} />}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <span className="flex items-center gap-1.5 text-[11px] font-mono" style={{ color: "hsl(0,0%,28%)" }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#34d399" }} />
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

      {/* ── MOBILE BOTTOM NAV ────────────────────────────────────── */}
      <nav
        className="tt-bottom-nav fixed bottom-0 inset-x-0 z-50 flex md:hidden"
        style={{
          background: T.mobileBg,
          borderTop: `1px solid ${T.navBorder}`,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="flex items-end w-full" style={{ height: "64px" }}>
          {MOBILE_MAIN.map((item) => {
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
                    <span
                      className="flex flex-col items-center justify-center gap-[3px] transition-colors duration-150 active:opacity-60"
                      style={{
                        width: "56px",
                        height: "48px",
                        borderRadius: "16px",
                        marginBottom: "2px",
                        ...(active ? {
                          background: "rgba(255,255,255,0.09)",
                          border: "1px solid rgba(255,255,255,0.12)",
                        } : {
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }),
                      }}
                    >
                      <item.icon
                        style={{
                          height: "18px",
                          width: "18px",
                          color: active ? "hsl(0,0%,88%)" : "hsl(0,0%,40%)",
                        }}
                      />
                      <span
                        className="text-[9px] font-medium tracking-wide"
                        style={{ color: active ? "hsl(0,0%,80%)" : "hsl(0,0%,36%)" }}
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
                  className="flex-1 flex flex-col items-center justify-center gap-[3px] h-full cursor-pointer select-none active:opacity-60"
                  style={{ WebkitTapHighlightColor: "transparent", paddingBottom: "8px" }}
                >
                  <span
                    className="flex items-center justify-center w-8 h-5 rounded-lg transition-colors duration-150"
                    style={active ? { background: "rgba(255,255,255,0.08)" } : {}}
                  >
                    <item.icon style={{ height: "15px", width: "15px", color: active ? "hsl(0,0%,82%)" : T.dim }} />
                  </span>
                  <span className="text-[9px] font-medium" style={{ color: active ? "hsl(0,0%,78%)" : T.dim }}>
                    More
                  </span>
                </button>
              );
            }

            return (
              <Link key={item.title} href={item.url!} className="flex-1">
                <span
                  className="flex flex-col items-center justify-center gap-[3px] h-full w-full cursor-pointer select-none active:opacity-60"
                  style={{ WebkitTapHighlightColor: "transparent", paddingBottom: "8px" }}
                >
                  <span
                    className="flex items-center justify-center w-8 h-5 rounded-lg transition-colors duration-150"
                    style={active ? { background: "rgba(255,255,255,0.08)" } : {}}
                  >
                    <item.icon
                      style={{
                        height: "15px",
                        width: "15px",
                        color: active ? "hsl(0,0%,82%)" : T.dim,
                      }}
                    />
                  </span>
                  <span
                    className="text-[9px] font-medium tracking-wide"
                    style={{ color: active ? "hsl(0,0%,78%)" : T.dim }}
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
            style={{ background: "rgba(0,0,0,0.7)" }}
            onClick={() => setSheetOpen(false)}
          />
          <div
            className="tt-slide-up fixed inset-x-0 z-[61] md:hidden"
            style={{
              bottom: 0,
              borderRadius: "20px 20px 0 0",
              background: T.sheetBg,
              borderTop: `1px solid ${T.navBorder}`,
              borderLeft: `1px solid ${T.navBorder}`,
              borderRight: `1px solid ${T.navBorder}`,
              boxShadow: "0 -12px 40px rgba(0,0,0,0.5)",
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
            }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-8 rounded-full" style={{ background: "rgba(255,255,255,0.12)" }} />
            </div>

            <div className="flex items-center justify-between px-5 py-3">
              <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(0,0%,32%)" }}>
                More
              </p>
              <button
                onClick={() => setSheetOpen(false)}
                className="h-7 w-7 flex items-center justify-center rounded-full transition-opacity active:opacity-60"
                style={{ background: "rgba(255,255,255,0.06)", color: T.dim }}
              >
                <X style={{ height: "13px", width: "13px" }} />
              </button>
            </div>

            <div className="px-4 flex flex-col gap-1.5">
              {MOBILE_MORE.map(item => {
                const active = isActive(item.url);
                return (
                  <Link key={item.title} href={item.url} onClick={() => setSheetOpen(false)}>
                    <span
                      className="flex items-center gap-3.5 px-4 py-3 rounded-2xl cursor-pointer transition-colors duration-150 active:opacity-70"
                      style={active ? {
                        background: "rgba(255,255,255,0.07)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "hsl(0,0%,88%)",
                      } : {
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.05)",
                        color: "hsl(0,0%,62%)",
                      }}
                    >
                      <span
                        className="h-9 w-9 flex-shrink-0 rounded-xl flex items-center justify-center"
                        style={{
                          background: active ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
                        }}
                      >
                        <item.icon
                          style={{
                            height: "17px", width: "17px",
                            color: active ? "hsl(0,0%,82%)" : "hsl(0,0%,46%)",
                          }}
                        />
                      </span>
                      <span className="text-[15px] font-medium">{item.title}</span>
                      {active && (
                        <ChevronRight style={{ height: "14px", width: "14px", marginLeft: "auto", color: "hsl(0,0%,60%)" }} />
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
