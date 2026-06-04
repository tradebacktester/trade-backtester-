import React, { useState, useEffect } from "react";
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
  // Initialise synchronously from localStorage so re-mounting on navigation
  // never causes the popup to flash for users who have already agreed.
  // Dev-only escape hatch: ?skip_policy=1 bypasses the modal (for automated tests / embeds).
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
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl flex flex-col"
        style={{
          background: "#fff",
          border: "1px solid rgba(0,0,0,0.1)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.22)",
          maxHeight: "90vh",
        }}
      >
        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 min-h-0 px-6 pt-6 pb-2">
          <div className="flex items-center gap-3 mb-4">
            <span
              className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "#f0f0f0" }}
            >
              <Shield style={{ height: "18px", width: "18px", color: "#111" }} />
            </span>
            <div>
              <h2 className="text-base font-semibold" style={{ color: "#111" }}>
                Welcome to Trade Lab
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "#888" }}>
                A few quick things before you begin
              </p>
            </div>
          </div>

          {/* Risk summary card */}
          <div
            className="rounded-xl p-4 mb-4 text-sm leading-relaxed"
            style={{ background: "#fafafa", border: "1px solid rgba(0,0,0,0.07)", color: "#444" }}
          >
            Trade Lab is an <strong>educational backtesting platform</strong>. All results are for
            informational purposes only and do not constitute financial advice. Past performance
            does not guarantee future results. Trading involves significant risk of loss.
          </div>

          {/* Expandable full policy list */}
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1.5 text-xs mb-4"
            style={{ color: "#666" }}
          >
            {expanded
              ? <><ChevronUp style={{ height: "13px", width: "13px" }} />Hide full policy list</>
              : <><ChevronDown style={{ height: "13px", width: "13px" }} />View all 9 policies</>}
          </button>

          {expanded && (
            <ul className="mb-4 flex flex-col gap-1">
              {POLICY_LINKS.map(name => (
                <li key={name} className="flex items-center gap-2 text-xs" style={{ color: "#555" }}>
                  <ExternalLink style={{ height: "11px", width: "11px", flexShrink: 0 }} />
                  {name}
                </li>
              ))}
            </ul>
          )}

          {/* Single agree checkbox */}
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
                  background: agreed ? "#111" : "#fff",
                  border: agreed ? "2px solid #111" : "2px solid #d1d5db",
                }}
              >
                {agreed && (
                  <svg viewBox="0 0 12 10" fill="none" style={{ height: "10px", width: "12px" }}>
                    <path d="M1 5l3.5 3.5L11 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-sm" style={{ color: "#333", lineHeight: "1.5" }}>
              I have read and agree to the{" "}
              <span style={{ color: "#111", fontWeight: 600 }}>Terms & Conditions</span>,{" "}
              <span style={{ color: "#111", fontWeight: 600 }}>Risk Disclosure</span>, and all
              other platform policies. I understand this platform is for educational use only.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={handleAgree}
            disabled={!agreed}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200"
            style={
              agreed
                ? { background: "#111", color: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.18)", cursor: "pointer" }
                : { background: "#e5e5e5", color: "#aaa", cursor: "not-allowed" }
            }
          >
            Enter Trade Lab
          </button>
          <p className="text-[10px] text-center mt-2" style={{ color: "#bbb" }}>
            You only need to accept this once.
          </p>
        </div>
      </div>
    </div>
  );
}
