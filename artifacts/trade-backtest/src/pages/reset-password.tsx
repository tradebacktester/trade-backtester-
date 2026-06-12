import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { Lock, Eye, EyeOff, KeyRound, CheckCircle2, AlertCircle } from "lucide-react";
import { API_BASE } from "@/lib/api-config";
import { useAuth } from "@/lib/auth-context";

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

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const { setUser } = useAuth();

  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const pwStrength = getPasswordStrength(password);

  const inputStyle = {
    border: "1px solid hsl(var(--border))",
    background: "hsl(var(--input))",
    color: "hsl(var(--foreground))",
  };

  if (!token) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div
          className="w-full max-w-sm rounded-2xl px-6 py-8 flex flex-col items-center gap-4 text-center"
          style={{ background: "var(--glass-bg-strong)", border: "1px solid var(--glass-border)" }}
        >
          <AlertCircle style={{ height: "32px", width: "32px", color: "#f87171" }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>Invalid Reset Link</p>
            <p className="text-xs mt-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
              This link is missing a reset token. Please use the exact link shared by the admin.
            </p>
          </div>
          <Link href="/forgot-password">
            <button
              className="px-5 py-2 rounded-xl text-sm font-semibold"
              style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
            >
              Request a new link
            </button>
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong"); return; }
      if (data.user && data.token) {
        setUser(data.user, data.token);
      }
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div
        className="w-full max-w-sm rounded-2xl"
        style={{
          background: "var(--glass-bg-strong)",
          border: "1px solid var(--glass-border)",
          boxShadow: "var(--shadow-modal)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 pt-5 pb-4"
          style={{ borderBottom: "1px solid hsl(var(--border))" }}
        >
          <span
            className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)" }}
          >
            <KeyRound style={{ height: "16px", width: "16px", color: "#818cf8" }} />
          </span>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "hsl(var(--foreground))" }}>
              Set New Password
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
              Choose a strong password for your account
            </p>
          </div>
        </div>

        {done ? (
          <div className="px-6 pt-5 pb-6 flex flex-col items-center gap-4 text-center">
            <span
              className="h-12 w-12 rounded-full flex items-center justify-center"
              style={{ background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.2)" }}
            >
              <CheckCircle2 style={{ height: "24px", width: "24px", color: "#4ade80" }} />
            </span>
            <div>
              <p className="text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>
                Password updated!
              </p>
              <p className="text-xs mt-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                Your password has been reset and you are now signed in.
              </p>
            </div>
            <button
              onClick={() => setLocation("/dashboard")}
              className="w-full py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 pt-4 pb-6 flex flex-col gap-4">
            {/* New password */}
            <div>
              <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "hsl(var(--muted-foreground))" }}>
                New Password
              </label>
              <div className="relative">
                <Lock style={{ height: "13px", width: "13px", position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "hsl(var(--muted-foreground))" }} />
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  autoFocus
                  className="w-full pl-8 pr-10 py-2.5 rounded-xl text-sm outline-none transition-[border-color]"
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = "hsl(var(--ring))")}
                  onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")}
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
              {password.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="h-1 flex-1 rounded-full transition-all duration-200"
                        style={{ background: pwStrength.score >= i ? pwStrength.color : "hsl(var(--border))" }} />
                    ))}
                  </div>
                  <span className="text-[10px] font-medium" style={{ color: pwStrength.color }}>
                    {pwStrength.label}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "hsl(var(--muted-foreground))" }}>
                Confirm Password
              </label>
              <div className="relative">
                <Lock style={{ height: "13px", width: "13px", position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "hsl(var(--muted-foreground))" }} />
                <input
                  type={showConfirm ? "text" : "password"}
                  placeholder="Repeat your password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full pl-8 pr-10 py-2.5 rounded-xl text-sm outline-none transition-[border-color]"
                  style={{
                    ...inputStyle,
                    borderColor: confirm.length > 0 && confirm !== password ? "#ef4444" : "hsl(var(--border))",
                  }}
                  onFocus={e => (e.target.style.borderColor = confirm !== password && confirm.length > 0 ? "#ef4444" : "hsl(var(--ring))")}
                  onBlur={e => (e.target.style.borderColor = confirm.length > 0 && confirm !== password ? "#ef4444" : "hsl(var(--border))")}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  {showConfirm ? <EyeOff style={{ height: "13px", width: "13px" }} /> : <Eye style={{ height: "13px", width: "13px" }} />}
                </button>
              </div>
              {confirm.length > 0 && confirm !== password && (
                <p className="text-[10px] mt-1" style={{ color: "#ef4444" }}>Passwords do not match</p>
              )}
            </div>

            {error && (
              <div
                className="rounded-xl px-3 py-2.5 text-xs"
                style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity"
              style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "Updating…" : "Set New Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
