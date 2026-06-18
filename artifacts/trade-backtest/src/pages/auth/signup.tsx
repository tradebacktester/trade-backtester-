import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { UserPlus, ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";

const STORAGE_KEY = "tt_policies_acked";

const POLICY_LINKS = [
  "Privacy Policy", "Terms & Conditions", "Financial Disclaimer", "Risk Disclosure",
  "No Broker Relationship Statement", "Data Accuracy Disclaimer", "No Refund Policy",
  "Account Deletion Policy", "AI Disclosure",
];

export default function SignUpPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const [agreed, setAgreed] = useState(false);
  const [showPolicies, setShowPolicies] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) setLocation("/dashboard");
  }, [user, setLocation]);

  function handleGoogleSignUp() {
    if (!agreed) { setError("You must agree to the platform policies to create an account."); return; }
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    window.location.href = `${API_BASE}/api/auth/google`;
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div
        className="w-full max-w-sm rounded-2xl"
        style={{
          background: "var(--glass-bg-strong)",
          border: "1px solid var(--glass-border)",
          boxShadow: "var(--shadow-modal)",
        }}
      >
        <div
          className="flex items-center gap-3 px-6 pt-5 pb-4"
          style={{ borderBottom: "1px solid hsl(var(--border))" }}
        >
          <span
            className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.2)" }}
          >
            <UserPlus style={{ height: "16px", width: "16px", color: "#C9A84C" }} />
          </span>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "hsl(var(--foreground))" }}>
              Create Account
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
              Join Trade Lab today — no password required
            </p>
          </div>
        </div>

        <div className="px-6 pt-5 pb-6 flex flex-col gap-3">
          {/* Policies agreement */}
          <div className="rounded-xl p-3" style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}>
            <p className="text-[11px] mb-2" style={{ color: "hsl(var(--foreground))" }}>
              Trade Lab is an <strong>educational platform only</strong>. Results are for informational
              purposes and do not constitute financial advice.
            </p>
            <button type="button" onClick={() => setShowPolicies(v => !v)}
              className="text-[11px] mb-2 flex items-center gap-1"
              style={{ color: "hsl(var(--muted-foreground))" }}>
              <ExternalLink style={{ height: "10px", width: "10px" }} />
              {showPolicies ? "Hide" : "View all"} 9 platform policies
            </button>
            {showPolicies && (
              <ul className="mb-2 flex flex-col gap-0.5">
                {POLICY_LINKS.map(name => (
                  <li key={name} className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>• {name}</li>
                ))}
              </ul>
            )}
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <div
                onClick={() => setAgreed(v => !v)}
                className="mt-0.5 h-4 w-4 rounded flex-shrink-0 flex items-center justify-center transition-all"
                style={{
                  background: agreed ? "hsl(var(--primary))" : "hsl(var(--background))",
                  border: agreed ? "2px solid hsl(var(--primary))" : "2px solid hsl(var(--border))",
                }}
              >
                {agreed && (
                  <svg viewBox="0 0 12 10" fill="none" style={{ height: "8px", width: "10px" }}>
                    <path d="M1 5l3.5 3.5L11 1" stroke="hsl(var(--primary-foreground))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className="text-[11px] leading-relaxed" style={{ color: "hsl(var(--foreground))" }}>
                I have read and agree to the <strong>Terms & Conditions</strong>, <strong>Risk Disclosure</strong>, and all other platform policies.
              </span>
            </label>
          </div>

          {error && (
            <div className="rounded-xl px-3 py-2.5 text-xs"
              style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignUp}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
            style={{
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--muted))",
              color: agreed ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
              cursor: agreed ? "pointer" : "not-allowed",
              opacity: agreed ? 1 : 0.6,
            }}
            onMouseEnter={e => { if (agreed) e.currentTarget.style.borderColor = "hsl(var(--ring))"; }}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "hsl(var(--border))")}
          >
            <svg viewBox="0 0 24 24" style={{ height: "16px", width: "16px", flexShrink: 0 }}>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign up with Google
          </button>

          <p className="text-center text-[11px] pt-1" style={{ color: "hsl(var(--muted-foreground))" }}>
            Already have an account?{" "}
            <Link href="/auth/signin">
              <span className="font-medium cursor-pointer" style={{ color: "hsl(var(--primary))" }}>
                Sign in
              </span>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
