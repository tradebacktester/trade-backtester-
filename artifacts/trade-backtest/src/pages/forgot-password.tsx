import React, { useState } from "react";
import { Link } from "wouter";
import { Mail, ArrowLeft, KeyRound, CheckCircle2 } from "lucide-react";
import { API_BASE } from "@/lib/api-config";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const inputStyle = {
    border: "1px solid hsl(var(--border))",
    background: "hsl(var(--input))",
    color: "hsl(var(--foreground))",
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong"); return; }
      setSubmitted(true);
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
              Forgot Password
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
              Request a password reset link
            </p>
          </div>
        </div>

        {submitted ? (
          <div className="px-6 pt-5 pb-6 flex flex-col items-center gap-4 text-center">
            <span
              className="h-12 w-12 rounded-full flex items-center justify-center"
              style={{ background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.2)" }}
            >
              <CheckCircle2 style={{ height: "24px", width: "24px", color: "#4ade80" }} />
            </span>
            <div>
              <p className="text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>
                Request received
              </p>
              <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
                If <strong style={{ color: "hsl(var(--foreground))" }}>{email}</strong> is registered, a reset link has been created. Please contact the admin to receive it.
              </p>
            </div>
            <div
              className="w-full rounded-xl px-4 py-3 text-xs text-left"
              style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", color: "hsl(var(--muted-foreground))", lineHeight: "1.6" }}
            >
              <strong style={{ color: "#818cf8" }}>What happens next?</strong><br />
              The platform admin will share your unique reset link with you. Once you have it, visit the link and choose a new password. Links expire after <strong>1 hour</strong>.
            </div>
            <Link href="/dashboard">
              <button
                className="w-full py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
              >
                Back to Home
              </button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 pt-4 pb-6 flex flex-col gap-4">
            <p className="text-xs leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
              Enter the email address you signed up with. A reset link will be generated and shared with you by the admin.
            </p>

            <div>
              <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "hsl(var(--muted-foreground))" }}>
                Email Address
              </label>
              <div className="relative">
                <Mail style={{ height: "13px", width: "13px", position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "hsl(var(--muted-foreground))" }} />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none transition-[border-color]"
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = "hsl(var(--ring))")}
                  onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")}
                />
              </div>
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
              {loading ? "Sending…" : "Request Reset Link"}
            </button>

            <Link href="/dashboard">
              <button
                type="button"
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                <ArrowLeft style={{ height: "12px", width: "12px" }} />
                Back to Sign In
              </button>
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
