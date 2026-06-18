import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Mail, Lock, User, UserPlus, Eye, EyeOff, ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";

const STORAGE_KEY = "tt_policies_acked";

const POLICY_LINKS = [
  "Privacy Policy", "Terms & Conditions", "Financial Disclaimer", "Risk Disclosure",
  "No Broker Relationship Statement", "Data Accuracy Disclaimer", "No Refund Policy",
  "Account Deletion Policy", "AI Disclosure",
];

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (pw.length === 0) return { score: 0, label: "", color: "hsl(var(--border))" };
  if (pw.length < 6) return { score: 1, label: "Too short", color: "#ef4444" };
  const hasUpper = /[A-Z]/.test(pw);
  const hasDigit = /[0-9]/.test(pw);
  const hasSymbol = /[^a-zA-Z0-9]/.test(pw);
  const variety = [true, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
  if (pw.length >= 12 && variety >= 3) return { score: 4, label: "Strong", color: "#22c55e" };
  if (pw.length >= 8 && variety >= 2) return { score: 3, label: "Good", color: "#eab308" };
  return { score: 2, label: "Weak", color: "#f97316" };
}

export default function SignUpPage() {
  const { setUser, user } = useAuth();
  const [, setLocation] = useLocation();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [showPolicies, setShowPolicies] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) setLocation("/dashboard");
  }, [user, setLocation]);

  const inputStyle = {
    border: "1px solid hsl(var(--border))",
    background: "hsl(var(--input))",
    color: "hsl(var(--foreground))",
  };

  const pwStrength = getPasswordStrength(password);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) { setError("You must agree to the platform policies to create an account."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong"); return; }
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
      setUser(data.user, data.token ?? null);
      setLocation("/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleSignUp() {
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
            style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.2)" }}
          >
            <UserPlus style={{ height: "16px", width: "16px", color: "#a78bfa" }} />
          </span>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "hsl(var(--foreground))" }}>
              Create Account
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
              Join Trade Lab today
            </p>
          </div>
        </div>

        <div className="px-6 pt-5 pb-2">
          <button
            type="button"
            onClick={handleGoogleSignUp}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
            style={{
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--muted))",
              color: "hsl(var(--foreground))",
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "hsl(var(--ring))")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "hsl(var(--border))")}
          >
            <svg viewBox="0 0 24 24" style={{ height: "16px", width: "16px" }}>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px" style={{ background: "hsl(var(--border))" }} />
            <span className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>or</span>
            <div className="flex-1 h-px" style={{ background: "hsl(var(--border))" }} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 flex flex-col gap-3">
          <div>
            <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "hsl(var(--muted-foreground))" }}>
              Full Name
            </label>
            <div className="relative">
              <User style={{ height: "13px", width: "13px", position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "hsl(var(--muted-foreground))" }} />
              <input type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)}
                required autoComplete="name"
                className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none transition-[border-color]"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "hsl(var(--ring))")}
                onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")} />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "hsl(var(--muted-foreground))" }}>
              Email Address
            </label>
            <div className="relative">
              <Mail style={{ height: "13px", width: "13px", position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "hsl(var(--muted-foreground))" }} />
              <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email"
                className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none transition-[border-color]"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "hsl(var(--ring))")}
                onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")} />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "hsl(var(--muted-foreground))" }}>
              Password
            </label>
            <div className="relative">
              <Lock style={{ height: "13px", width: "13px", position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "hsl(var(--muted-foreground))" }} />
              <input type={showPw ? "text" : "password"} placeholder="At least 6 characters" value={password}
                onChange={e => setPassword(e.target.value)} required autoComplete="new-password"
                className="w-full pl-8 pr-10 py-2.5 rounded-xl text-sm outline-none transition-[border-color]"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "hsl(var(--ring))")}
                onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")} />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "hsl(var(--muted-foreground))" }}>
                {showPw ? <EyeOff style={{ height: "13px", width: "13px" }} /> : <Eye style={{ height: "13px", width: "13px" }} />}
              </button>
            </div>
            <div className="mt-2 space-y-1.5">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-1 flex-1 rounded-full transition-all duration-200"
                    style={{ background: password.length > 0 && pwStrength.score >= i ? pwStrength.color : "hsl(var(--border))" }} />
                ))}
              </div>
              {password.length > 0 && (
                <span className="text-[10px] font-medium" style={{ color: pwStrength.color }}>{pwStrength.label}</span>
              )}
            </div>
          </div>

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

          <button type="submit" disabled={loading || !agreed}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity"
            style={{
              background: agreed ? "hsl(var(--primary))" : "hsl(var(--muted))",
              color: agreed ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
              opacity: loading ? 0.6 : 1,
              boxShadow: agreed ? "var(--shadow-btn)" : "none",
              cursor: agreed ? "pointer" : "not-allowed",
            }}>
            {loading ? "Creating account…" : "Create Account"}
          </button>

          <p className="text-center text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
            Already have an account?{" "}
            <Link href="/auth/signin">
              <span className="font-medium cursor-pointer" style={{ color: "hsl(var(--primary))" }}>
                Sign in
              </span>
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
