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

  function accept() {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    setShow(false);
  }

  return (
    <>
      <style>{`
        @keyframes tlSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .tl-policy-card { animation: tlSlideUp 0.32s cubic-bezier(0.22, 1, 0.36, 1) both; }
      `}</style>

      <div
        className="fixed inset-0 z-[500] flex items-end justify-center pb-6 px-4 sm:pb-8"
        style={{
          backdropFilter: "blur(10px) saturate(0.6)",
          WebkitBackdropFilter: "blur(10px) saturate(0.6)",
          background: "rgba(0,0,0,0.38)",
        }}
      >
        <div
          className="tl-policy-card w-full max-w-lg rounded-2xl overflow-hidden"
          style={{
            background: "var(--glass-bg-strong, rgba(18,18,18,0.97))",
            border: "1px solid var(--glass-border, rgba(255,255,255,0.1))",
            boxShadow: "0 -4px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
          }}
        >
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center gap-2.5 mb-3">
              <span
                className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <Shield style={{ height: 13, width: 13, color: "hsl(var(--muted-foreground))" }} />
              </span>
              <p className="text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>
                Before you dive in
              </p>
            </div>

            <p className="text-[13px] leading-relaxed mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>
              Trade Lab is an{" "}
              <span style={{ color: "hsl(var(--foreground))", fontWeight: 600 }}>educational backtesting platform</span>.
              {" "}Results are simulated and do not constitute financial advice.{" "}
              <span style={{ color: "hsl(var(--foreground))" }}>Trading involves significant risk of loss.</span>
            </p>

            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1.5 text-[11px] mb-3 transition-colors"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              {expanded
                ? <><ChevronUp style={{ height: 11, width: 11 }} />Hide policies</>
                : <><ChevronDown style={{ height: 11, width: 11 }} />View 9 policies (Privacy, T&C, Risk Disclosure…)</>
              }
            </button>

            {expanded && (
              <ul className="mb-3 grid grid-cols-2 gap-1">
                {POLICY_LINKS.map(name => (
                  <li key={name} className="flex items-center gap-1.5 text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                    <ExternalLink style={{ height: 9, width: 9, flexShrink: 0 }} />
                    {name}
                  </li>
                ))}
              </ul>
            )}

            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <div
                onClick={() => setAgreed(v => !v)}
                className="mt-0.5 h-4 w-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
                style={{
                  background: agreed ? "hsl(var(--primary))" : "hsl(var(--muted))",
                  border: agreed ? "2px solid hsl(var(--primary))" : "2px solid hsl(var(--border))",
                }}
              >
                {agreed && (
                  <svg viewBox="0 0 12 10" fill="none" style={{ height: 8, width: 10 }}>
                    <path d="M1 5l3.5 3.5L11 1" stroke="hsl(var(--primary-foreground))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className="text-[12px] leading-5" style={{ color: "hsl(var(--foreground))" }}>
                I agree to the{" "}
                <strong>Terms &amp; Conditions</strong>,{" "}
                <strong>Risk Disclosure</strong>, and all platform policies.
              </span>
            </label>
          </div>

          <div className="px-5 pb-5 pt-2 flex gap-2.5">
            <button
              onClick={accept}
              className="flex-1 py-2.5 rounded-xl text-[12px] font-medium transition-all"
              style={{
                background: "hsl(var(--muted))",
                color: "hsl(var(--muted-foreground))",
                border: "1px solid hsl(var(--border))",
              }}
              title="Browse without an account — you acknowledge the risk disclosure by continuing"
            >
              Guest Preview
            </button>
            <button
              onClick={() => { if (agreed) accept(); }}
              disabled={!agreed}
              className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold transition-all duration-200"
              style={agreed
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
                    opacity: 0.7,
                  }
              }
            >
              Enter Trade Lab →
            </button>
          </div>

          <p className="text-center text-[10px] pb-3" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>
            You only need to accept this once · Guest Preview also acknowledges risk disclosure
          </p>
        </div>
      </div>
    </>
  );
}
