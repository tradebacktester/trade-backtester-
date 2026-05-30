import React, { useState, useEffect } from "react";
import { Shield, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";

const POLICY_SLUGS = [
  "privacy_policy",
  "terms_and_conditions",
  "financial_disclaimer",
  "risk_disclosure",
  "no_broker_relationship",
  "data_accuracy_disclaimer",
  "no_refund_policy",
  "account_deletion_policy",
  "ai_disclosure",
];

interface PolicyItem {
  id: number;
  slug: string;
  title: string;
  content: string;
}

const STORAGE_KEY = "tt_policies_acked";

export function PolicyPopup() {
  const [show, setShow] = useState(false);
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const acked = localStorage.getItem(STORAGE_KEY);
    if (!acked) {
      setShow(true);
      fetch("/api/policies")
        .then(r => r.json())
        .then((data: PolicyItem[]) => {
          setPolicies(data);
          const init: Record<string, boolean> = {};
          data.forEach(p => { init[p.slug] = false; });
          setChecked(init);
        })
        .catch(() => {
          const fallback = POLICY_SLUGS.map((slug, i) => ({
            id: i + 1, slug,
            title: slug.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
            content: "Policy content is being loaded. Please refresh and try again.",
          }));
          setPolicies(fallback);
          const init: Record<string, boolean> = {};
          fallback.forEach(p => { init[p.slug] = false; });
          setChecked(init);
        })
        .finally(() => setLoading(false));
    }
  }, []);

  if (!show) return null;

  const allChecked = policies.length > 0 && policies.every(p => checked[p.slug]);

  function toggleExpand(slug: string) {
    setExpanded(v => v === slug ? null : slug);
  }

  function handleCheckAll() {
    const all: Record<string, boolean> = {};
    policies.forEach(p => { all[p.slug] = true; });
    setChecked(all);
  }

  function handleAgree() {
    if (!allChecked) return;
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    setShow(false);
  }

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl flex flex-col"
        style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.1)", boxShadow: "0 24px 80px rgba(0,0,0,0.22)", maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex-shrink-0" style={{ borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
          <div className="flex items-center gap-3 mb-1">
            <span className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#f0f0f0" }}>
              <Shield style={{ height: "18px", width: "18px", color: "#111" }} />
            </span>
            <div>
              <h2 className="text-base font-semibold" style={{ color: "#111" }}>Before You Continue</h2>
              <p className="text-xs mt-0.5" style={{ color: "#888" }}>Please read and acknowledge our policies to use TradeTest</p>
            </div>
          </div>
        </div>

        {/* Policy list - scrollable */}
        <div className="overflow-y-auto flex-1 px-5 py-3" style={{ minHeight: 0 }}>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="text-sm" style={{ color: "#aaa" }}>Loading policies…</div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {policies.map(policy => (
                <div
                  key={policy.slug}
                  className="rounded-xl overflow-hidden"
                  style={{ border: `1px solid ${checked[policy.slug] ? "rgba(22,163,74,0.3)" : "rgba(0,0,0,0.09)"}`, background: checked[policy.slug] ? "#f0fdf4" : "#fafafa" }}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => setChecked(c => ({ ...c, [policy.slug]: !c[policy.slug] }))}
                      className="flex-shrink-0 transition-colors duration-150"
                    >
                      {checked[policy.slug]
                        ? <CheckCircle2 style={{ height: "18px", width: "18px", color: "#16a34a" }} />
                        : <div style={{ height: "18px", width: "18px", borderRadius: "50%", border: "2px solid #d1d5db", background: "#fff" }} />
                      }
                    </button>
                    {/* Title */}
                    <span className="flex-1 text-sm font-medium" style={{ color: "#111" }}>{policy.title}</span>
                    {/* Read/collapse */}
                    <button
                      onClick={() => toggleExpand(policy.slug)}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors duration-150"
                      style={{ color: "#555", background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.08)" }}
                    >
                      {expanded === policy.slug ? (
                        <><ChevronUp style={{ height: "11px", width: "11px" }} />Hide</>
                      ) : (
                        <><ChevronDown style={{ height: "11px", width: "11px" }} />Read</>
                      )}
                    </button>
                  </div>
                  {/* Expanded content */}
                  {expanded === policy.slug && (
                    <div className="px-4 pb-4">
                      <div
                        className="text-xs leading-relaxed rounded-xl p-3"
                        style={{ background: "rgba(0,0,0,0.04)", color: "#444", border: "1px solid rgba(0,0,0,0.06)", whiteSpace: "pre-wrap" }}
                      >
                        {policy.content}
                      </div>
                      <button
                        className="mt-2 w-full py-1.5 rounded-xl text-xs font-medium transition-colors duration-150"
                        style={{ background: "#16a34a", color: "#fff" }}
                        onClick={() => { setChecked(c => ({ ...c, [policy.slug]: true })); setExpanded(null); }}
                      >
                        I've read this — Mark as acknowledged
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex-shrink-0" style={{ borderTop: "1px solid rgba(0,0,0,0.07)" }}>
          <div className="flex gap-3 mb-3">
            <button
              onClick={handleCheckAll}
              className="flex-1 py-2 rounded-xl text-xs font-medium transition-colors duration-150"
              style={{ border: "1px solid rgba(0,0,0,0.12)", color: "#555", background: "#f5f5f5" }}
            >
              Select all
            </button>
          </div>
          <button
            onClick={handleAgree}
            disabled={!allChecked}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200"
            style={allChecked
              ? { background: "#111", color: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.18)" }
              : { background: "#e5e5e5", color: "#aaa", cursor: "not-allowed" }
            }
          >
            {allChecked ? "I Acknowledge All Policies — Enter TradeTest" : `Acknowledge all ${policies.length} policies to continue`}
          </button>
          <p className="text-[10px] text-center mt-2" style={{ color: "#bbb" }}>
            By continuing, you confirm you have read and understood all the above policies.
          </p>
        </div>
      </div>
    </div>
  );
}
