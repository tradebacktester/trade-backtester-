import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// ── Types ──────────────────────────────────────────────────────────

export type Theme = "dark" | "light" | "system";
export type AccentColor = "cyan" | "blue" | "purple" | "green" | "amber" | "rose";
export type ChartLayout = "standard" | "advanced" | "minimal";
export type DataSource = "binance" | "simulated";

export interface AppSettings {
  theme: Theme;
  accentColor: AccentColor;
  chartLayout: ChartLayout;
  priceAlerts: boolean;
  soundEffects: boolean;
  dataSource: DataSource;
  privacyMode: boolean;
}

interface SettingsContextValue {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  resolvedTheme: "dark" | "light";
  playSound: (type: "toggle" | "buy" | "sell" | "alert") => void;
  triggerAlert: (title: string, body: string) => void;
}

// ── Defaults ───────────────────────────────────────────────────────

const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  accentColor: "cyan",
  chartLayout: "standard",
  priceAlerts: false,
  soundEffects: false,
  dataSource: "binance",
  privacyMode: false,
};

const STORAGE_KEY = "tradetest_settings";

// ── Accent CSS vars ────────────────────────────────────────────────

const ACCENT_HSL: Record<AccentColor, string> = {
  cyan:   "190 90% 50%",
  blue:   "217 91% 60%",
  purple: "260 80% 65%",
  green:  "150 80% 50%",
  amber:  "38 100% 55%",
  rose:   "0 85% 62%",
};

// ── Dark theme vars ────────────────────────────────────────────────

const DARK_VARS: Record<string, string> = {
  "--background":           "230 15% 10%",
  "--foreground":           "220 14% 90%",
  "--card":                 "230 15% 14%",
  "--card-foreground":      "220 14% 90%",
  "--popover":              "230 15% 14%",
  "--popover-foreground":   "220 14% 90%",
  "--secondary":            "230 15% 20%",
  "--secondary-foreground": "220 14% 90%",
  "--muted":                "230 15% 18%",
  "--muted-foreground":     "220 14% 60%",
  "--border":               "230 15% 20%",
  "--input":                "230 15% 25%",
};

// ── Light theme vars ───────────────────────────────────────────────

const LIGHT_VARS: Record<string, string> = {
  "--background":           "220 20% 97%",
  "--foreground":           "222 47% 12%",
  "--card":                 "0 0% 100%",
  "--card-foreground":      "222 47% 12%",
  "--popover":              "0 0% 100%",
  "--popover-foreground":   "222 47% 12%",
  "--secondary":            "210 20% 93%",
  "--secondary-foreground": "222 47% 12%",
  "--muted":                "210 20% 95%",
  "--muted-foreground":     "215 16% 47%",
  "--border":               "214 32% 87%",
  "--input":                "214 32% 90%",
};

// ── Apply helpers ──────────────────────────────────────────────────

function applyThemeVars(isDark: boolean) {
  const root = document.documentElement;
  const vars = isDark ? DARK_VARS : LIGHT_VARS;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  // dark class for shadcn components
  isDark ? root.classList.add("dark") : root.classList.remove("dark");
}

function applyAccent(accent: AccentColor) {
  const hsl = ACCENT_HSL[accent];
  const root = document.documentElement;
  root.style.setProperty("--primary", hsl);
  root.style.setProperty("--accent", hsl);
  root.style.setProperty("--ring", hsl);
  root.style.setProperty("--sidebar-primary", hsl);
  root.style.setProperty("--sidebar-ring", hsl);
}

function getSystemIsDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveIsDark(theme: Theme): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return getSystemIsDark();
}

// ── Web Audio ──────────────────────────────────────────────────────

function createAudioCtx() {
  try {
    return new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  } catch {
    return null;
  }
}

function playTone(ctx: AudioContext, freq: number, type: OscillatorType, duration: number, gainVal = 0.08) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = freq;
  osc.type = type;
  gain.gain.setValueAtTime(gainVal, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

// ── Load / save ────────────────────────────────────────────────────

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}

function saveSettings(s: AppSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch { /* ignore */ }
}

// ── Context ────────────────────────────────────────────────────────

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const systemMqRef = useRef<MediaQueryList | null>(null);

  const resolvedTheme: "dark" | "light" = resolveIsDark(settings.theme) ? "dark" : "light";

  // Apply theme + accent on mount and changes
  useEffect(() => {
    const isDark = resolveIsDark(settings.theme);
    applyThemeVars(isDark);
    applyAccent(settings.accentColor);
  }, [settings.theme, settings.accentColor]);

  // Watch system preference when theme === "system"
  useEffect(() => {
    if (settings.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyThemeVars(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [settings.theme]);

  // Persist on every change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  // Sound
  const playSound = (type: "toggle" | "buy" | "sell" | "alert") => {
    if (!settings.soundEffects) return;
    if (!audioCtxRef.current) audioCtxRef.current = createAudioCtx();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    switch (type) {
      case "toggle":
        playTone(ctx, 880, "sine", 0.1, 0.05);
        break;
      case "buy":
        playTone(ctx, 523, "triangle", 0.15, 0.08);
        setTimeout(() => playTone(ctx, 659, "triangle", 0.15, 0.08), 80);
        setTimeout(() => playTone(ctx, 784, "triangle", 0.2, 0.08), 160);
        break;
      case "sell":
        playTone(ctx, 784, "triangle", 0.15, 0.08);
        setTimeout(() => playTone(ctx, 523, "triangle", 0.2, 0.08), 100);
        break;
      case "alert":
        playTone(ctx, 1047, "sine", 0.12, 0.1);
        setTimeout(() => playTone(ctx, 1047, "sine", 0.12, 0.1), 200);
        break;
    }
  };

  // Notification
  const triggerAlert = (title: string, body: string) => {
    if (!settings.priceAlerts) return;
    if (Notification.permission === "granted") {
      new Notification(title, { body, icon: "/favicon.ico" });
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, resolvedTheme, playSound, triggerAlert }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
