import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Shield, Eye, EyeOff, ChevronRight, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { setAdminToken, adminToken } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);

  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [id2, setId2] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPw2, setShowPw2] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (adminToken) setLocation("/admin/panel");
  }, [adminToken]);

  function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!id.trim() || !password.trim()) {
      setError("Admin ID and password are required");
      return;
    }
    setStep(2);
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password, id2, password2 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Authentication failed");
        setStep(1);
        setId2("");
        setPassword2("");
        return;
      }
      setAdminToken(data.token);
      setLocation("/admin/panel");
    } catch {
      setError("Network error. Please try again.");
      setStep(1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div
        className="w-full max-w-sm rounded-2xl"
        style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-card)" }}
      >
        <div className="px-8 pt-8 pb-6 flex flex-col items-center" style={{ borderBottom: "1px solid var(--glass-border)" }}>
          <span className="h-12 w-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            <Shield style={{ height: "22px", width: "22px", color: "hsl(var(--foreground))" }} />
          </span>
          <h1 className="text-base font-semibold" style={{ color: "hsl(var(--foreground))" }}>Admin Login</h1>
          <p className="text-xs mt-1 text-center" style={{ color: "hsl(var(--muted-foreground))" }}>
            {step === 1 ? "Step 1 of 2 — Primary authentication" : "Step 2 of 2 — Secondary authentication"}
          </p>

          <div className="flex items-center gap-2 mt-4">
            <div className="h-1.5 rounded-full w-12 transition-all" style={{ background: step >= 1 ? "hsl(var(--foreground))" : "var(--glass-border)" }} />
            <div className="h-1.5 rounded-full w-12 transition-all" style={{ background: step >= 2 ? "hsl(var(--foreground))" : "var(--glass-border)" }} />
          </div>
        </div>

        {step === 1 ? (
          <form onSubmit={handleStep1} className="px-8 py-6 flex flex-col gap-4">
            <div>
              <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "hsl(var(--muted-foreground))" }}>Primary Admin ID</label>
              <input
                type="text"
                placeholder="Enter primary admin ID"
                value={id}
                onChange={e => setId(e.target.value)}
                required
                autoComplete="username"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ border: "1px solid var(--glass-border)", background: "var(--glass-bg)", color: "hsl(var(--foreground))" }}
                onFocus={e => (e.target.style.borderColor = "var(--accent-cyan-border)")}
                onBlur={e => (e.target.style.borderColor = "var(--glass-border)")}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "hsl(var(--muted-foreground))" }}>Primary Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="Enter primary password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full pl-3 pr-10 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: "1px solid var(--glass-border)", background: "var(--glass-bg)", color: "hsl(var(--foreground))" }}
                  onFocus={e => (e.target.style.borderColor = "var(--accent-cyan-border)")}
                  onBlur={e => (e.target.style.borderColor = "var(--glass-border)")}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  {showPw ? <EyeOff style={{ height: "13px", width: "13px" }} /> : <Eye style={{ height: "13px", width: "13px" }} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl px-3 py-2.5 text-xs" style={{ background: "rgba(220,38,38,0.1)", color: "#f87171", border: "1px solid rgba(220,38,38,0.25)" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity flex items-center justify-center gap-2"
              style={{ background: "#FFFFFF", color: "#050505" }}
            >
              Continue <ChevronRight style={{ height: "14px", width: "14px" }} />
            </button>
          </form>
        ) : (
          <form onSubmit={handleStep2} className="px-8 py-6 flex flex-col gap-4">
            <div className="rounded-xl px-3 py-2.5 flex items-center gap-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--glass-border)" }}>
              <Lock style={{ height: "12px", width: "12px", color: "hsl(var(--muted-foreground))", flexShrink: 0 }} />
              <span className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>Primary credentials verified — enter secondary</span>
            </div>

            <div>
              <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "hsl(var(--muted-foreground))" }}>Secondary Admin ID</label>
              <input
                type="text"
                placeholder="Enter secondary admin ID"
                value={id2}
                onChange={e => setId2(e.target.value)}
                required
                autoFocus
                autoComplete="off"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ border: "1px solid var(--glass-border)", background: "var(--glass-bg)", color: "hsl(var(--foreground))" }}
                onFocus={e => (e.target.style.borderColor = "var(--accent-cyan-border)")}
                onBlur={e => (e.target.style.borderColor = "var(--glass-border)")}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "hsl(var(--muted-foreground))" }}>Secondary Password</label>
              <div className="relative">
                <input
                  type={showPw2 ? "text" : "password"}
                  placeholder="Enter secondary password"
                  value={password2}
                  onChange={e => setPassword2(e.target.value)}
                  required
                  autoComplete="off"
                  className="w-full pl-3 pr-10 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: "1px solid var(--glass-border)", background: "var(--glass-bg)", color: "hsl(var(--foreground))" }}
                  onFocus={e => (e.target.style.borderColor = "var(--accent-cyan-border)")}
                  onBlur={e => (e.target.style.borderColor = "var(--glass-border)")}
                />
                <button
                  type="button"
                  onClick={() => setShowPw2(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  {showPw2 ? <EyeOff style={{ height: "13px", width: "13px" }} /> : <Eye style={{ height: "13px", width: "13px" }} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl px-3 py-2.5 text-xs" style={{ background: "rgba(220,38,38,0.1)", color: "#f87171", border: "1px solid rgba(220,38,38,0.25)" }}>
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setStep(1); setError(""); setId2(""); setPassword2(""); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity"
                style={{ background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))", border: "1px solid var(--glass-border)" }}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity"
                style={{ background: "#FFFFFF", color: "#050505", opacity: loading ? 0.6 : 1 }}
              >
                {loading ? "Verifying…" : "Login"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
