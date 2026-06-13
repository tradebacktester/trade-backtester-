import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/error-boundary";
import "./index.css";

(function bootstrapTheme() {
  try {
    const saved = localStorage.getItem("tt-theme") ?? "dark";
    const root = document.documentElement;
    if (saved === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  } catch {
    document.documentElement.classList.add("dark");
  }
})();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js", { scope: "/" })
      .then((reg) => {
        // Forward stored auth token so SW can do periodic sync / alert checks
        const token = localStorage.getItem("tt_token");
        if (token && reg.active) {
          reg.active.postMessage({ type: "STORE_TOKEN", token });
        }

        // Register periodic sync for market refresh (1 day) and alert checks (1 hour)
        if ("periodicSync" in reg) {
          const ps = reg.periodicSync as {
            register: (tag: string, opts: { minInterval: number }) => Promise<void>;
            getTags: () => Promise<string[]>;
          };
          ps.getTags().then((tags) => {
            if (!tags.includes("refresh-markets")) {
              ps.register("refresh-markets", { minInterval: 24 * 60 * 60 * 1000 }).catch(() => {});
            }
            if (!tags.includes("check-alerts")) {
              ps.register("check-alerts", { minInterval: 60 * 60 * 1000 }).catch(() => {});
            }
          }).catch(() => {});
        }
      })
      .catch((err) => console.warn("Service worker registration failed:", err));
  });

  // When token changes (login/logout), notify the service worker
  const origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (key: string, value: string) {
    origSetItem(key, value);
    if (key === "tt_token" && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "STORE_TOKEN", token: value });
    }
  };
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
