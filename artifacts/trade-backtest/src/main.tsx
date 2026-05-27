import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

(function bootstrapTheme() {
  try {
    const root = document.documentElement;
    root.classList.remove("dark");
    root.style.setProperty("--background", "0 0% 100%");
    root.style.setProperty("--foreground", "0 0% 6%");
    root.style.setProperty("--card", "0 0% 97%");
    root.style.setProperty("--card-foreground", "0 0% 8%");
    root.style.setProperty("--popover", "0 0% 100%");
    root.style.setProperty("--popover-foreground", "0 0% 8%");
    root.style.setProperty("--secondary", "0 0% 94%");
    root.style.setProperty("--secondary-foreground", "0 0% 12%");
    root.style.setProperty("--muted", "0 0% 95%");
    root.style.setProperty("--muted-foreground", "0 0% 44%");
    root.style.setProperty("--border", "0 0% 87%");
    root.style.setProperty("--input", "0 0% 90%");
    root.style.setProperty("--primary", "0 0% 9%");
    root.style.setProperty("--primary-foreground", "0 0% 100%");
    root.style.setProperty("--accent", "0 0% 93%");
    root.style.setProperty("--ring", "0 0% 60%");
  } catch {
    /* ignore */
  }
})();

createRoot(document.getElementById("root")!).render(<App />);
