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

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
