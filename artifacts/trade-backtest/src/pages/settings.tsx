import { useState, useCallback, useEffect, useRef } from "react";
import {
  Moon, Sun, Monitor, Palette, LayoutTemplate,
  Bell, Volume2, Globe, Shield, Keyboard,
  Check, ChevronRight, AlertCircle, Wifi, WifiOff,
  Zap, Eye, EyeOff, X,
} from "lucide-react";
import {
  useSettings,
  type Theme,
  type AccentColor,
  type ChartLayout,
  type DataSource,
} from "@/lib/settings-context";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { API_BASE } from "@/lib/api-config";

// ── Toast ──────────────────────────────────────────────────────────

type ToastKind = "success" | "error" | "info";
type ToastState = { message: string; type: ToastKind; id: number } | null;

function useToast() {
  const [toast, setToast] = useState<ToastState>(null);
  const show = useCallback((message: string, type: ToastKind = "success") => {
    const id = Date.now();
    setToast({ message, type, id });
    setTimeout(() => setToast(t => (t?.id === id ? null : t)), 2500);
  }, []);
  return { toast, show };
}

// ── Toggle switch ──────────────────────────────────────────────────

function Toggle({ value, onChange, accent }: { value: boolean; onChange: (v: boolean) => void; accent?: string }) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="relative flex-shrink-0 h-6 w-11 rounded-full transition-all duration-300 focus:outline-none"
      style={{
        background: value ? `hsl(var(--primary))` : "rgba(255,255,255,0.1)",
        boxShadow: value ? `0 0 12px hsla(var(--primary),0.4)` : "none",
      }}
    >
      <span
        className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-300"
        style={{ transform: value ? "translateX(20px)" : "translateX(0)" }}
      />
    </button>
  );
}

// ── Segmented control ──────────────────────────────────────────────

interface SegmentedOption { value: string; label: string; icon?: React.ReactNode }

function Segmented({ options, value, onChange }: {
  options: SegmentedOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      className="flex items-center gap-0.5 rounded-lg p-0.5"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200"
          style={value === opt.value ? {
            background: "rgba(255,255,255,0.1)",
            color: "hsl(var(--primary))",
            boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
          } : { color: "hsl(220,14%,50%)" }}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Color swatch ───────────────────────────────────────────────────

const ACCENT_OPTIONS: { value: AccentColor; label: string; hsl: string }[] = [
  { value: "cyan",   label: "Cyan",   hsl: "hsl(190,90%,50%)" },
  { value: "blue",   label: "Blue",   hsl: "hsl(217,91%,60%)" },
  { value: "purple", label: "Purple", hsl: "hsl(260,80%,65%)" },
  { value: "green",  label: "Green",  hsl: "hsl(150,80%,50%)" },
  { value: "amber",  label: "Amber",  hsl: "hsl(38,100%,55%)" },
  { value: "rose",   label: "Rose",   hsl: "hsl(0,85%,62%)" },
];

// ── Section wrapper ────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-mono uppercase tracking-widest px-1 mb-1" style={{ color: "hsl(220,14%,35%)" }}>
        {title}
      </p>
      <div
        className="rounded-xl overflow-hidden"
        style={{
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ── Row ────────────────────────────────────────────────────────────

function Row({
  icon: Icon, iconColor = "hsl(var(--primary))", title, desc, children, last = false,
}: {
  icon: React.ElementType;
  iconColor?: string;
  title: string;
  desc: string;
  children?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-3 px-4 py-4 transition-all duration-150"
      style={{
        background: "rgba(255,255,255,0.02)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className="h-9 w-9 flex items-center justify-center rounded-xl shrink-0"
          style={{
            background: `${iconColor}18`,
            border: `1px solid ${iconColor}28`,
            boxShadow: `0 0 12px ${iconColor}12`,
          }}
        >
          <Icon className="h-4 w-4" style={{ color: iconColor }} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: "hsl(220,14%,85%)" }}>{title}</p>
          <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "hsl(220,14%,42%)" }}>{desc}</p>
        </div>
      </div>
      {children && (
        <div className="pl-12 flex items-center flex-wrap gap-2">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { settings, updateSetting, resolvedTheme, playSound } = useSettings();
  const { toast, show } = useToast();
  const [notifStatus, setNotifStatus] = useState<NotificationPermission>("default");
  const { setAdminToken } = useAuth();
  const [, setLocation] = useLocation();

  // ── Developer Mode easter egg state ────────────────────────────────
  const [showNumPad, setShowNumPad] = useState(false);
  const [sequence, setSequence] = useState<number[]>([]);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminId, setAdminId] = useState("");
  const [adminPw, setAdminPw] = useState("");
  const [showAdminPw, setShowAdminPw] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const seqRef = useRef(sequence);
  seqRef.current = sequence;

  const CORRECT_SEQ = [4, 2];

  function handleNumPress(n: number) {
    const next = [...seqRef.current, n];
    if (next.length > CORRECT_SEQ.length) {
      setSequence([n]);
      return;
    }
    setSequence(next);
    if (next.length === CORRECT_SEQ.length) {
      if (next.every((v, i) => v === CORRECT_SEQ[i])) {
        setShowNumPad(false);
        setShowAdminModal(true);
        setSequence([]);
      } else {
        setSequence([]);
      }
    }
  }

  function closeAdminModal() {
    setShowAdminModal(false);
    setAdminId("");
    setAdminPw("");
    setAdminError("");
    setSequence([]);
  }

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setAdminError("");
    if (!adminId.trim() || !adminPw.trim()) {
      setAdminError("Admin ID and password are required");
      return;
    }
    setAdminLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: adminId, password: adminPw }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAdminError(data.error || "Authentication failed");
        return;
      }
      setAdminToken(data.token);
      closeAdminModal();
      setLocation("/admin/panel");
    } catch {
      setAdminError("Network error. Please try again.");
    } finally {
      setAdminLoading(false);
    }
  }

  useEffect(() => {
    if ("Notification" in window) setNotifStatus(Notification.permission);
  }, []);

  function save<K extends keyof typeof settings>(key: K, value: typeof settings[K], msg: string) {
    updateSetting(key, value);
    playSound("toggle");
    show(msg);
  }

  async function handlePriceAlerts(on: boolean) {
    if (on) {
      if (!("Notification" in window)) {
        show("Notifications not supported in this browser", "error");
        return;
      }
      const perm = await Notification.requestPermission();
      setNotifStatus(perm);
      if (perm !== "granted") {
        show("Notification permission denied", "error");
        return;
      }
      try {
        new Notification("Trade Lab Alerts", { body: "Price alerts are now active ✓" });
      } catch {
        // Some environments (Replit preview, service-worker-only contexts) block
        // the Notification constructor even after permission is granted — ignore.
      }
    }
    save("priceAlerts", on, on ? "Price alerts enabled" : "Price alerts disabled");
  }

  const isDark = resolvedTheme === "dark";

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6 pb-6">

      {/* Toast */}
      <div
        className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] pointer-events-none transition-all duration-300"
        style={{ opacity: toast ? 1 : 0, transform: `translateX(-50%) translateY(${toast ? 0 : 8}px)` }}
      >
        {toast && (
          <div
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium shadow-xl"
            style={{
              background: toast.type === "error"
                ? "rgba(239,68,68,0.15)"
                : toast.type === "info"
                  ? "rgba(59,130,246,0.15)"
                  : "rgba(34,197,94,0.15)",
              border: `1px solid ${toast.type === "error" ? "rgba(239,68,68,0.3)" : toast.type === "info" ? "rgba(59,130,246,0.3)" : "rgba(34,197,94,0.3)"}`,
              color: toast.type === "error" ? "hsl(0,85%,65%)" : toast.type === "info" ? "hsl(217,91%,70%)" : "hsl(150,80%,60%)",
            }}
          >
            {toast.type === "error" ? <AlertCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {toast.message}
          </div>
        )}
      </div>

      {/* Header */}
      <div
        className="rounded-2xl px-4 sm:px-6 py-4 sm:py-5 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <div
          className="absolute top-0 right-0 h-24 w-24 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(var(--primary)), transparent)", opacity: 0.08, transform: "translate(30%, -30%)" }}
        />
        <div className="relative">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: `hsl(var(--primary))` }}>
            Settings
          </h1>
          <p className="text-sm mt-1" style={{ color: "hsl(220,14%,45%)" }}>
            All changes save instantly and persist across sessions
          </p>
          <div className="flex items-center gap-2 mt-3">
            <span
              className="flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full"
              style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "hsl(150,80%,55%)" }}
            >
              <Zap className="h-3 w-3" /> Auto-saved to localStorage
            </span>
            <span
              className="flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "hsl(220,14%,45%)" }}
            >
              {isDark ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
              {isDark ? "Dark" : "Light"} mode active
            </span>
          </div>
        </div>
      </div>

      {/* ── Appearance ──────────────────────────────────────────── */}
      <Section title="Appearance">
        {/* Theme */}
        <Row icon={isDark ? Moon : Sun} title="Theme" desc="Controls the colour palette of the entire app">
          <Segmented
            value={settings.theme}
            onChange={v => save("theme", v as Theme, `Switched to ${v} theme`)}
            options={[
              { value: "dark",   label: "Dark",   icon: <Moon className="h-3.5 w-3.5" /> },
              { value: "light",  label: "Light",  icon: <Sun className="h-3.5 w-3.5" /> },
              { value: "system", label: "System", icon: <Monitor className="h-3.5 w-3.5" /> },
            ]}
          />
        </Row>

        {/* Accent colour */}
        <Row icon={Palette} title="Accent color" desc="Highlights, active states, and neon glows">
          <div className="flex items-center gap-2">
            {ACCENT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => save("accentColor", opt.value, `Accent set to ${opt.label}`)}
                title={opt.label}
                className="h-6 w-6 rounded-full transition-all duration-200"
                style={{
                  background: opt.hsl,
                  transform: settings.accentColor === opt.value ? "scale(1.25)" : "scale(1)",
                  boxShadow: settings.accentColor === opt.value
                    ? `0 0 12px ${opt.hsl}, 0 0 24px ${opt.hsl}60`
                    : "none",
                  outline: settings.accentColor === opt.value ? `2px solid ${opt.hsl}` : "none",
                  outlineOffset: "3px",
                }}
              />
            ))}
          </div>
        </Row>

        {/* Chart layout */}
        <Row icon={LayoutTemplate} title="Chart layout" desc="Default panel arrangement when opening the chart">
          <Segmented
            value={settings.chartLayout}
            onChange={v => save("chartLayout", v as ChartLayout, `Layout set to ${v}`)}
            options={[
              { value: "minimal",  label: "Minimal" },
              { value: "standard", label: "Standard" },
              { value: "advanced", label: "Advanced" },
            ]}
          />
        </Row>
      </Section>

      {/* ── Notifications ────────────────────────────────────────── */}
      <Section title="Notifications">
        {/* Price alerts */}
        <Row
          icon={Bell}
          iconColor="hsl(38,100%,55%)"
          title="Price alerts"
          desc={
            notifStatus === "denied"
              ? "Browser notifications blocked — enable in browser settings"
              : notifStatus === "granted"
                ? "Browser notifications granted"
                : "Requires browser notification permission"
          }
        >
          <div className="flex items-center gap-2.5">
            {notifStatus === "denied" && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.1)", color: "hsl(0,85%,60%)" }}>
                Blocked
              </span>
            )}
            {notifStatus === "granted" && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.1)", color: "hsl(150,80%,55%)" }}>
                Granted
              </span>
            )}
            <Toggle
              value={settings.priceAlerts}
              onChange={handlePriceAlerts}
            />
          </div>
        </Row>

        {/* Sound effects */}
        <Row
          icon={Volume2}
          iconColor="hsl(260,80%,65%)"
          title="Sound effects"
          desc="Audio cues on buy, sell, and toggle actions"
        >
          <div className="flex items-center gap-2.5">
            {settings.soundEffects && (
              <button
                onClick={() => playSound("buy")}
                className="text-[10px] font-mono px-2 py-0.5 rounded transition-all"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "hsl(220,14%,50%)" }}
              >
                Test ▶
              </button>
            )}
            <Toggle
              value={settings.soundEffects}
              onChange={v => save("soundEffects", v, v ? "Sound effects on" : "Sound effects off")}
            />
          </div>
        </Row>
      </Section>

      {/* ── Data & Privacy ───────────────────────────────────────── */}
      <Section title="Data & Privacy">
        {/* Data source */}
        <Row
          icon={settings.dataSource === "binance" ? Wifi : WifiOff}
          iconColor="hsl(190,90%,50%)"
          title="Market data source"
          desc={
            settings.dataSource === "binance"
              ? "Live candle data fetched from Binance REST API"
              : "Deterministic simulated OHLCV data (no network)"
          }
        >
          <Segmented
            value={settings.dataSource}
            onChange={v => save("dataSource", v as DataSource, `Source set to ${v}`)}
            options={[
              { value: "binance",   label: "Binance",   icon: <Wifi className="h-3 w-3" /> },
              { value: "simulated", label: "Simulated", icon: <WifiOff className="h-3 w-3" /> },
            ]}
          />
        </Row>

        {/* Privacy mode */}
        <Row
          icon={Shield}
          iconColor="hsl(0,85%,62%)"
          title="Privacy mode"
          desc="Blur portfolio values, P&L, and account numbers"
        >
          <Toggle
            value={settings.privacyMode}
            onChange={v => save("privacyMode", v, v ? "Privacy mode on — values hidden" : "Privacy mode off")}
          />
        </Row>
      </Section>

      {/* ── Keyboard shortcuts ────────────────────────────────────── */}
      <Section title="Keyboard Shortcuts">
        <Row icon={Keyboard} iconColor="hsl(220,14%,55%)" title="Global shortcuts" desc="Work on any page">
          <span />
        </Row>
        <div className="px-4 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {[
              ["H", "Horizontal line"],
              ["T", "Trend line"],
              ["F", "Fibonacci retracement"],
              ["E", "Eraser"],
              ["Esc", "Cancel drawing / exit replay"],
              ["← →", "Step candle (replay)"],
              ["Space", "Play / pause replay"],
              ["B", "Buy at market (replay)"],
              ["S", "Sell at market (replay)"],
            ].map(([key, desc]) => (
              <div key={key} className="flex items-center gap-3">
                <kbd
                  className="flex-shrink-0 text-[11px] font-mono px-2 py-0.5 rounded-md min-w-[32px] text-center"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: `hsl(var(--primary))`,
                    boxShadow: "0 2px 0 rgba(0,0,0,0.3)",
                  }}
                >
                  {key}
                </kbd>
                <span className="text-[12px]" style={{ color: "hsl(220,14%,50%)" }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── About ─────────────────────────────────────────────────── */}
      <Section title="About">
        <div className="px-4 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: "Version", value: "1.0.0" },
              { label: "Data", value: "Binance API" },
              { label: "Charts", value: "lightweight-charts v5" },
              { label: "Framework", value: "React + Vite" },
              { label: "Database", value: "PostgreSQL" },
              { label: "Theme", value: resolvedTheme === "dark" ? "Dark" : "Light" },
            ].map(item => (
              <div key={item.label}>
                <p className="text-[10px] font-mono uppercase tracking-wider mb-0.5" style={{ color: "hsl(220,14%,35%)" }}>{item.label}</p>
                <p className="text-xs font-mono" style={{ color: "hsl(220,14%,60%)" }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Reset */}
      <div className="flex justify-end pb-2">
        <button
          onClick={() => {
            if (!confirm("Reset all settings to defaults?")) return;
            (Object.entries({
              theme: "dark",
              accentColor: "cyan",
              chartLayout: "standard",
              priceAlerts: false,
              soundEffects: false,
              dataSource: "binance",
              privacyMode: false,
            }) as Array<[keyof typeof settings, unknown]>).forEach(([k, v]) => updateSetting(k, v as never));
            show("Settings reset to defaults", "info");
          }}
          className="text-xs font-mono px-4 py-2 rounded-lg transition-all"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "hsl(220,14%,38%)",
          }}
        >
          Reset to defaults
        </button>
      </div>

      {/* ── Developer Mode (easter egg) ──────────────────────────── */}
      <div className="flex flex-col items-center gap-3 pb-4">
        <button
          onClick={() => { setShowNumPad(v => !v); setSequence([]); }}
          className="text-[10px] font-mono transition-all"
          style={{ color: "hsl(220,14%,22%)", letterSpacing: "0.08em" }}
        >
          Developer Mode
        </button>

        {showNumPad && (
          <div
            className="grid grid-cols-2 gap-2 p-3 rounded-xl"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {[1, 2, 3, 4].map(n => (
              <button
                key={n}
                onClick={() => handleNumPress(n)}
                className="h-10 w-10 rounded-lg text-sm font-mono font-semibold transition-all duration-150 active:scale-95"
                style={{
                  background: sequence.includes(n) && sequence[sequence.length - 1] === n
                    ? "rgba(255,255,255,0.12)"
                    : "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  color: "hsl(220,14%,45%)",
                }}
              >
                {n}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Admin login modal ─────────────────────────────────────── */}
      {showAdminModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) closeAdminModal(); }}
        >
          <div
            className="w-full max-w-sm mx-4 rounded-2xl relative"
            style={{
              background: "var(--card-bg, rgba(13,17,28,0.98))",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
            }}
          >
            {/* Close */}
            <button
              onClick={closeAdminModal}
              className="absolute top-3 right-3 h-7 w-7 flex items-center justify-center rounded-lg transition-all"
              style={{ background: "rgba(255,255,255,0.05)", color: "hsl(220,14%,45%)" }}
            >
              <X className="h-3.5 w-3.5" />
            </button>

            {/* Header */}
            <div className="px-8 pt-8 pb-5 flex flex-col items-center" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <span
                className="h-12 w-12 rounded-2xl flex items-center justify-center mb-3"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <Shield className="h-5 w-5" style={{ color: "hsl(220,14%,60%)" }} />
              </span>
              <h2 className="text-base font-semibold" style={{ color: "hsl(220,14%,85%)" }}>Admin Login</h2>
              <p className="text-xs mt-1 text-center" style={{ color: "hsl(220,14%,42%)" }}>
                Enter your admin credentials to continue
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleAdminLogin} className="px-8 py-6 flex flex-col gap-4">
              <div>
                <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "hsl(220,14%,45%)" }}>Admin ID</label>
                <input
                  type="text"
                  placeholder="Enter admin ID"
                  value={adminId}
                  onChange={e => setAdminId(e.target.value)}
                  autoFocus
                  autoComplete="username"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.05)",
                    color: "hsl(220,14%,85%)",
                  }}
                />
              </div>
              <div>
                <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "hsl(220,14%,45%)" }}>Password</label>
                <div className="relative">
                  <input
                    type={showAdminPw ? "text" : "password"}
                    placeholder="Enter password"
                    value={adminPw}
                    onChange={e => setAdminPw(e.target.value)}
                    autoComplete="current-password"
                    className="w-full pl-3 pr-10 py-2.5 rounded-xl text-sm outline-none"
                    style={{
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.05)",
                      color: "hsl(220,14%,85%)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "hsl(220,14%,40%)" }}
                  >
                    {showAdminPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {adminError && (
                <div
                  className="rounded-xl px-3 py-2.5 text-xs"
                  style={{ background: "rgba(220,38,38,0.1)", color: "#f87171", border: "1px solid rgba(220,38,38,0.25)" }}
                >
                  {adminError}
                </div>
              )}

              <button
                type="submit"
                disabled={adminLoading}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity"
                style={{ background: "#FFFFFF", color: "#050505", opacity: adminLoading ? 0.6 : 1 }}
              >
                {adminLoading ? "Verifying…" : "Login"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
