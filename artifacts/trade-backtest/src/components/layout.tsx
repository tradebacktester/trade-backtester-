import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, CandlestickChart, FlaskConical,
  BarChart2, Settings, Zap, Brain,
  MoreHorizontal, X, ChevronRight, BookOpen,
  Shield, LogIn, LogOut, User, Users, Crown, CreditCard, Wrench, Store,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";

const DESKTOP_ITEMS = [
  { title: "Charts",    url: "/chart",      icon: CandlestickChart },
  { title: "Demo",      url: "/demo",       icon: Zap },
  { title: "Home",      url: "/dashboard",  icon: LayoutDashboard, home: true },
  { title: "Community", url: "/community",  icon: Users },
  { title: "AI",        url: "/ai",         icon: Brain },
] as const;

const MOBILE_MAIN = [
  { title: "Charts",    url: "/chart",      icon: CandlestickChart },
  { title: "Home",      url: "/dashboard",  icon: LayoutDashboard, home: true },
  { title: "Community", url: "/community",  icon: Users },
  { title: "AI",        url: "/ai",         icon: Brain },
  { title: "More",      url: null,          icon: MoreHorizontal },
] as const;

const DESKTOP_MORE = [
  { title: "Marketplace",    url: "/marketplace",  icon: Store },
  { title: "Psych Match",    url: "/psych-match",  icon: Brain },
  { title: "Tools",          url: "/tools",        icon: Wrench },
  { title: "Stress Test",    url: "/stress-test",  icon: Zap },
  { title: "Strategy DNA",   url: "/strategy-dna", icon: BarChart2 },
  { title: "Analytics",      url: "/strategies",   icon: BarChart2 },
  { title: "Pricing",        url: "/pricing",      icon: Crown },
  { title: "Billing",        url: "/billing",      icon: CreditCard },
  { title: "Settings",       url: "/settings",     icon: Settings },
  { title: "Admin",          url: "/admin",        icon: Shield },
] as const;

const MOBILE_MORE = [
  { title: "Marketplace",    url: "/marketplace",  icon: Store },
  { title: "Psych Match",    url: "/psych-match",  icon: Brain },
  { title: "Tools",          url: "/tools",        icon: Wrench },
  { title: "Stress Test",    url: "/stress-test",  icon: Zap },
  { title: "Strategy DNA",   url: "/strategy-dna", icon: BarChart2 },
  { title: "Journal",        url: "/backtests",    icon: BookOpen },
  { title: "Analytics",      url: "/strategies",   icon: BarChart2 },
  { title: "Pricing",        url: "/pricing",      icon: Crown },
  { title: "Billing",        url: "/billing",      icon: CreditCard },
  { title: "Settings",       url: "/settings",     icon: Settings },
  { title: "Admin",          url: "/admin",        icon: Shield },
] as const;

const T = {
  navBg:     "rgba(255,255,255,0.96)",
  navBorder: "rgba(0,0,0,0.08)",
  mobileBg:  "rgba(255,255,255,0.99)",
  dim:       "#888888",
  active:    "#111111",
  activeBg:  "rgba(0,0,0,0.06)",
  activeBdr: "rgba(0,0,0,0.12)",
  sheetBg:   "#ffffff",
};

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const { user, signout } = useAuth();

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

      {/* ── DESKTOP TOP NAV ──────────────────────────────────────── */}
      <header
        className="tt-desktop-nav fixed top-0 inset-x-0 z-50 hidden md:flex items-center h-[52px]"
        style={{
          background: T.navBg,
          borderBottom: `1px solid ${T.navBorder}`,
          boxShadow: "var(--shadow-nav)",
        }}
      >
        {/* Logo */}
        <Link href="/dashboard">
          <span className="flex items-center gap-2 px-5 cursor-pointer select-none group">
            <img src="/logo.png" className="h-7 w-7 rounded-xl object-cover" alt="Trade Lab logo" />
            <span className="text-sm font-semibold tracking-tight" style={{ color: "#111" }}>
              Trade Lab
            </span>
          </span>
        </Link>

        <div className="w-px h-4 mx-2 flex-shrink-0" style={{ background: T.navBorder }} />

        {/* Nav items */}
        <nav className="flex-1 flex items-center justify-center gap-0.5 px-3">
          {DESKTOP_ITEMS.map((item) => {
            const active = isActive(item.url);
            return (
              <Link key={item.title} href={item.url}>
                <span
                  className="flex items-center gap-1.5 cursor-pointer select-none"
                  style={('home' in item && item.home) ? {
                    padding: "5px 14px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: 600,
                    background: active ? T.activeBg : "#f5f5f5",
                    color: active ? T.active : T.dim,
                    border: `1px solid ${active ? T.activeBdr : "rgba(0,0,0,0.08)"}`,
                    boxShadow: active ? "var(--shadow-tab-active)" : "var(--shadow-2xs)",
                    transition: "box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease",
                  } : {
                    padding: "5px 10px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 500,
                    border: `1px solid ${active ? T.activeBdr : "transparent"}`,
                    background: active ? T.activeBg : "transparent",
                    color: active ? T.active : T.dim,
                    boxShadow: active ? "var(--shadow-tab-active)" : "none",
                    transition: "box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease",
                  }}
                >
                  <item.icon style={{ height: "13px", width: "13px", flexShrink: 0 }} />
                  {item.title}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Right — sign in + more dropdown + status */}
        <div className="flex items-center gap-2 pr-4 flex-shrink-0">

          {/* Sign In / User */}
          {user ? (
            <div className="flex items-center gap-1">
              <span
                className="flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 rounded-lg"
                style={{ color: "#555" }}
              >
                <User style={{ height: "12px", width: "12px" }} />
                {user.name.split(" ")[0]}
              </span>
              <button
                onClick={signout}
                className="flex items-center gap-1 text-[11px] px-2 py-1.5 rounded-lg transition-colors"
                style={{ color: "#888", border: "1px solid rgba(0,0,0,0.08)" }}
                title="Sign out"
              >
                <LogOut style={{ height: "11px", width: "11px" }} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-1.5 cursor-pointer select-none transition-colors duration-150"
              style={{
                padding: "5px 12px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 500,
                border: "1px solid rgba(0,0,0,0.12)",
                background: "#f5f5f5",
                color: "#444",
              }}
            >
              <LogIn style={{ height: "12px", width: "12px" }} />
              Sign In
            </button>
          )}

          {/* More dropdown */}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setMoreOpen(v => !v)}
              className="flex items-center gap-1.5 cursor-pointer select-none transition-colors duration-150"
              style={{
                padding: "5px 10px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 500,
                border: `1px solid ${moreOpen || moreActive ? T.activeBdr : "transparent"}`,
                background: moreOpen || moreActive ? T.activeBg : "transparent",
                color: moreOpen || moreActive ? T.active : T.dim,
              }}
            >
              <MoreHorizontal style={{ height: "13px", width: "13px" }} />
              More
            </button>

            {moreOpen && (
              <div
                className="absolute right-0 top-[calc(100%+6px)] w-44 rounded-2xl p-1.5 flex flex-col gap-0.5"
                style={{
                  background: "#fff",
                  border: "1px solid rgba(0,0,0,0.09)",
                  boxShadow: "var(--shadow-dropdown)",
                  zIndex: 200,
                }}
              >
                {DESKTOP_MORE.map(item => {
                  const active = isActive(item.url);
                  return (
                    <Link key={item.title} href={item.url} onClick={() => setMoreOpen(false)}>
                      <span
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm cursor-pointer transition-colors duration-150"
                        style={{
                          background: active ? T.activeBg : "transparent",
                          color: active ? T.active : "#555",
                        }}
                        onMouseEnter={e => {
                          if (!active) (e.currentTarget as HTMLElement).style.background = "#f5f5f5";
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

          <span className="flex items-center gap-1.5 text-[11px] font-mono" style={{ color: "#aaa" }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#16a34a" }} />
            LIVE
          </span>
        </div>
      </header>

      {/* ── MAIN CONTENT ─────────────────────────────────────────── */}
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
          boxShadow: "0 -1px 0 rgba(0,0,0,0.05), 0 -4px 16px rgba(0,0,0,0.06)",
        }}
      >
        <div className="flex items-end w-full" style={{ height: "64px" }}>
          {MOBILE_MAIN.map((item) => {
            const isHome = 'home' in item && item.home === true;
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
                        background: active ? T.activeBg : "#f5f5f5",
                        border: `1px solid ${active ? T.activeBdr : "rgba(0,0,0,0.08)"}`,
                      }}
                    >
                      <item.icon style={{ height: "18px", width: "18px", color: active ? "#111" : "#888" }} />
                      <span className="text-[9px] font-medium tracking-wide"
                        style={{ color: active ? "#111" : "#888" }}>
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
                  <span className="flex items-center justify-center w-8 h-5 rounded-lg"
                    style={active ? { background: T.activeBg } : {}}>
                    <item.icon style={{ height: "15px", width: "15px", color: active ? "#111" : T.dim }} />
                  </span>
                  <span className="text-[9px] font-medium" style={{ color: active ? "#111" : T.dim }}>More</span>
                </button>
              );
            }

            return (
              <Link key={item.title} href={item.url!} className="flex-1">
                <span
                  className="flex flex-col items-center justify-center gap-[3px] h-full w-full cursor-pointer select-none active:opacity-60"
                  style={{ WebkitTapHighlightColor: "transparent", paddingBottom: "8px" }}
                >
                  <span className="flex items-center justify-center w-8 h-5 rounded-lg"
                    style={active ? { background: T.activeBg } : {}}>
                    <item.icon style={{ height: "15px", width: "15px", color: active ? "#111" : T.dim }} />
                  </span>
                  <span className="text-[9px] font-medium tracking-wide"
                    style={{ color: active ? "#111" : T.dim }}>
                    {item.title}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── MOBILE MORE SHEET ────────────────────────────────────── */}
      {sheetOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] md:hidden"
            style={{ background: "rgba(0,0,0,0.25)" }}
            onClick={() => setSheetOpen(false)}
          />
          <div
            className="tt-slide-up fixed inset-x-0 z-[61] md:hidden"
            style={{
              bottom: 0,
              borderRadius: "20px 20px 0 0",
              background: T.sheetBg,
              borderTop: "1px solid rgba(0,0,0,0.08)",
              borderLeft: "1px solid rgba(0,0,0,0.08)",
              borderRight: "1px solid rgba(0,0,0,0.08)",
              boxShadow: "var(--shadow-sheet)",
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
            }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-8 rounded-full" style={{ background: "rgba(0,0,0,0.12)" }} />
            </div>

            <div className="flex items-center justify-between px-5 py-3">
              <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "#aaa" }}>More</p>
              <button
                onClick={() => setSheetOpen(false)}
                className="h-7 w-7 flex items-center justify-center rounded-full active:opacity-60"
                style={{ background: "#f0f0f0", color: "#666" }}
              >
                <X style={{ height: "13px", width: "13px" }} />
              </button>
            </div>

            {/* Sign in row in sheet */}
            <div className="px-4 mb-2">
              {user ? (
                <div
                  className="flex items-center justify-between px-4 py-3 rounded-2xl"
                  style={{ background: "#f7f7f7", border: "1px solid rgba(0,0,0,0.07)" }}
                >
                  <div className="flex items-center gap-3">
                    <span className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: "#e0e0e0", color: "#555" }}>
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-[13px] font-medium" style={{ color: "#111" }}>{user.name}</p>
                      <p className="text-[10px]" style={{ color: "#aaa" }}>{user.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { signout(); setSheetOpen(false); }}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl"
                    style={{ background: "#f0f0f0", color: "#666", border: "1px solid rgba(0,0,0,0.08)" }}
                  >
                    <LogOut style={{ height: "11px", width: "11px" }} />
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setShowAuthModal(true); setSheetOpen(false); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl"
                  style={{ background: "#111", color: "#fff" }}
                >
                  <LogIn style={{ height: "14px", width: "14px" }} />
                  <span className="text-[14px] font-medium">Sign In / Create Account</span>
                </button>
              )}
            </div>

            <div className="px-4 flex flex-col gap-1.5">
              {MOBILE_MORE.map(item => {
                const active = isActive(item.url);
                return (
                  <Link key={item.title} href={item.url} onClick={() => setSheetOpen(false)}>
                    <span
                      className="flex items-center gap-3.5 px-4 py-3 rounded-2xl cursor-pointer transition-colors duration-150 active:opacity-70"
                      style={active ? {
                        background: T.activeBg,
                        border: `1px solid ${T.activeBdr}`,
                        color: T.active,
                      } : {
                        background: "#f7f7f7",
                        border: "1px solid rgba(0,0,0,0.07)",
                        color: "#555",
                      }}
                    >
                      <span
                        className="h-9 w-9 flex-shrink-0 rounded-xl flex items-center justify-center"
                        style={{ background: active ? T.activeBg : "#efefef" }}
                      >
                        <item.icon style={{ height: "17px", width: "17px", color: active ? "#111" : "#666" }} />
                      </span>
                      <span className="text-[15px] font-medium">{item.title}</span>
                      {active && <ChevronRight style={{ height: "14px", width: "14px", marginLeft: "auto", color: "#999" }} />}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Auth Modal */}
      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
