import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Bootstrap saved theme/accent before React renders — prevents flash
(function bootstrapTheme() {
  try {
    const raw = localStorage.getItem("tradetest_settings");
    const s = raw ? JSON.parse(raw) : {};
    const theme = s.theme ?? "dark";

    let isDark: boolean;
    if (theme === "dark") isDark = true;
    else if (theme === "light") isDark = false;
    else isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
      const lv: [string, string][] = [
        ["--background", "220 20% 97%"], ["--foreground", "222 47% 12%"],
        ["--card", "0 0% 100%"], ["--card-foreground", "222 47% 12%"],
        ["--popover", "0 0% 100%"], ["--popover-foreground", "222 47% 12%"],
        ["--secondary", "210 20% 93%"], ["--secondary-foreground", "222 47% 12%"],
        ["--muted", "210 20% 95%"], ["--muted-foreground", "215 16% 47%"],
        ["--border", "214 32% 87%"], ["--input", "214 32% 90%"],
      ];
      lv.forEach(([k, v]) => root.style.setProperty(k, v));
    }

    const accentMap: Record<string, string> = {
      cyan: "190 90% 50%", blue: "217 91% 60%", purple: "260 80% 65%",
      green: "150 80% 50%", amber: "38 100% 55%", rose: "0 85% 62%",
    };
    const hsl = accentMap[s.accentColor ?? "cyan"] ?? accentMap.cyan;
    ["--primary", "--accent", "--ring", "--sidebar-primary", "--sidebar-ring"]
      .forEach(k => root.style.setProperty(k, hsl));
  } catch {
    document.documentElement.classList.add("dark");
  }
})();

createRoot(document.getElementById("root")!).render(<App />);
