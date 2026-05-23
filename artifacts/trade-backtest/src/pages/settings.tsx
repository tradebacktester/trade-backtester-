import {
  Bell,
  Moon,
  Globe,
  Shield,
  Palette,
  Monitor,
  Volume2,
  Keyboard,
  ChevronRight,
} from "lucide-react";

const SECTIONS = [
  {
    label: "Appearance",
    items: [
      { icon: Moon, title: "Theme", desc: "Dark mode always active", value: "Dark" },
      { icon: Palette, title: "Accent color", desc: "Interface highlight color", value: "Blue" },
      { icon: Monitor, title: "Chart layout", desc: "Default panel configuration", value: "Standard" },
    ],
  },
  {
    label: "Notifications",
    items: [
      { icon: Bell, title: "Price alerts", desc: "Get notified on price targets", value: "Off" },
      { icon: Volume2, title: "Sound effects", desc: "Audio cues for trades", value: "Off" },
    ],
  },
  {
    label: "Data & Privacy",
    items: [
      { icon: Globe, title: "Data source", desc: "Market data provider", value: "Binance" },
      { icon: Shield, title: "Privacy mode", desc: "Hide sensitive values", value: "Off" },
    ],
  },
  {
    label: "Shortcuts",
    items: [
      { icon: Keyboard, title: "Keyboard shortcuts", desc: "B buy · S sell · H h-line · T trend · F fib · E erase · ← → step replay · Space play/pause", value: null },
    ],
  },
];

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div
        className="rounded-xl px-6 py-5 border"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
          borderColor: "rgba(255,255,255,0.07)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{
            background: "linear-gradient(135deg, hsl(217,91%,72%), hsl(210,80%,80%))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Settings
        </h1>
        <p className="text-sm mt-1" style={{ color: "hsl(220,14%,45%)" }}>
          Customize your trading workspace
        </p>
      </div>

      {/* Sections */}
      {SECTIONS.map((section) => (
        <div key={section.label} className="flex flex-col gap-1.5">
          <p
            className="text-[10px] font-mono uppercase tracking-widest px-1 mb-1"
            style={{ color: "hsl(220,14%,38%)" }}
          >
            {section.label}
          </p>
          <div
            className="rounded-xl overflow-hidden border"
            style={{
              borderColor: "rgba(255,255,255,0.07)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            {section.items.map((item, i) => (
              <div
                key={item.title}
                className="flex items-center gap-4 px-4 py-3.5 transition-all duration-150 group cursor-default"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
              >
                {/* Icon */}
                <span
                  className="h-8 w-8 flex items-center justify-center rounded-lg shrink-0"
                  style={{
                    background: "rgba(59,130,246,0.1)",
                    border: "1px solid rgba(59,130,246,0.15)",
                  }}
                >
                  <item.icon className="h-3.5 w-3.5" style={{ color: "hsl(217,91%,65%)" }} />
                </span>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: "hsl(220,14%,82%)" }}>
                    {item.title}
                  </p>
                  <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "hsl(220,14%,42%)" }}>
                    {item.desc}
                  </p>
                </div>

                {/* Value */}
                {item.value !== null && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className="text-xs font-mono px-2 py-0.5 rounded-md"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        color: "hsl(220,14%,50%)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      {item.value}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5" style={{ color: "hsl(220,14%,30%)" }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Version */}
      <p className="text-center text-[11px] font-mono pb-2" style={{ color: "hsl(220,14%,28%)" }}>
        TradeTest v1.0 · Built on Binance data · lightweight-charts v5
      </p>
    </div>
  );
}
