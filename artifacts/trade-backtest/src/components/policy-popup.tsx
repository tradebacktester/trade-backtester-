import React, { useState } from "react";
import { Shield, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

const STORAGE_KEY = "tt_policies_acked";

const POLICY_LINKS = [
  "Privacy Policy",
  "Terms & Conditions",
  "Financial Disclaimer",
  "Risk Disclosure",
  "No Broker Relationship Statement",
  "Data Accuracy Disclaimer",
  "No Refund Policy",
  "Account Deletion Policy",
  "AI Disclosure",
];

export function PolicyPopup() {
  const [show, setShow] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("skip_policy") === "1") {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
      return false;
    }
    return !localStorage.getItem(STORAGE_KEY);
  });
  const [agreed, setAgreed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (!show) return null;

  function handleAgree() {
    if (!agreed) return;
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    setShow(false);
  }

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.65)" }}
    >
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl flex flex-col scale-in"
        style={{
          background: "var(--glass-bg-strong)",
          border: "1px solid var(--glass-border)",
          boxShadow: "var(--shadow-modal)",
          maxHeight: "90vh",
        }}
      >
        <div className="overflow-y-auto flex-1 min-h-0 px-6 pt-6 pb-2">
          <div className="flex items-center gap-3 mb-4">
            <span
              className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}
            >
              <Shield style={{ height: "18px", width: "18px", color: "hsl(var(--foreground))" }} />
            </span>
            <div>
              <h2 className="text-base font-semibold" style={{ color: "hsl(var(--foreground))" }}>
                Welcome to Trade Lab
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                A few quick things before you begin
              </p>
            </div>
          </div>

          <div
            className="rounded-xl p-4 mb-4 text-sm leading-relaxed"
            style={{
              background: "hsl(var(--muted))",
              border: "1px solid hsl(var(--border))",
              color: "hsl(var(--foreground))",
            }}
          >
            Trade Lab is an <strong>educational backtesting platform</strong>. All results are for
            informational purposes only and do not constitute financial advice. Past performance
            does not guarantee future results. Trading involves significant risk of loss.
          </div>

          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1.5 text-xs mb-4 transition-colors"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            {expanded
              ? <><ChevronUp style={{ height: "13px", width: "13px" }} />Hide full policy list</>
              : <><ChevronDown style={{ height: "13px", width: "13px" }} />View all 9 policies</>}
          </button>

          {expanded && (
            <ul className="mb-4 flex flex-col gap-1">
              {POLICY_LINKS.map(name => (
                <li key={name} className="flex items-center gap-2 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                  <ExternalLink style={{ height: "11px", width: "11px", flexShrink: 0 }} />
                  {name}
                </li>
              ))}
            </ul>
          )}

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <div className="mt-0.5 flex-shrink-0">
              <input
                type="checkbox"
                className="sr-only"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
              />
              <div
                onClick={() => setAgreed(v => !v)}
                className="h-5 w-5 rounded-md flex items-center justify-center transition-all"
                style={{
                  background: agreed ? "hsl(var(--primary))" : "hsl(var(--muted))",
                  border: agreed ? "2px solid hsl(var(--primary))" : "2px solid hsl(var(--border))",
                }}
              >
                {agreed && (
                  <svg viewBox="0 0 12 10" fill="none" style={{ height: "10px", width: "12px" }}>
                    <path d="M1 5l3.5 3.5L11 1" stroke="hsl(var(--primary-foreground))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-sm" style={{ color: "hsl(var(--foreground))", lineHeight: "1.5" }}>
              I have read and agree to the{" "}
              <strong style={{ color: "hsl(var(--foreground))" }}>Terms & Conditions</strong>,{" "}
              <strong style={{ color: "hsl(var(--foreground))" }}>Risk Disclosure</strong>, and all
              other platform policies. I understand this platform is for educational use only.
            </span>
          </label>
        </div>

        <div className="px-6 pb-6 pt-3">
          <button
            onClick={handleAgree}
            disabled={!agreed}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200"
            style={
              agreed
                ? {
                    background: "hsl(var(--primary))",
                    color: "hsl(var(--primary-foreground))",
                    boxShadow: "var(--shadow-btn)",
                    cursor: "pointer",
                  }
                : {
                    background: "hsl(var(--muted))",
                    color: "hsl(var(--muted-foreground))",
                    cursor: "not-allowed",
                  }
            }
          >
            Enter Trade Lab
          </button>
          <p className="text-[10px] text-center mt-2" style={{ color: "hsl(var(--muted-foreground))" }}>
            You only need to accept this once.
          </p>
        </div>
      </div>
    </div>
  );
}
