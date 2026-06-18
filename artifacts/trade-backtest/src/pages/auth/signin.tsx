import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Mail, Lock, LogIn, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";

export default function SignInPage() {
  const { setUser, user } = useAuth();
  const [, setLocation] = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong"); return; }
      setUser(data.user, data.token ?? null);
      setLocation("/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleSignIn() {
    window.location.href = `${API_BASE}/api/auth/google`;
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
        <div
          className="flex items-center gap-3 px-6 pt-5 pb-4"
          style={{ borderBottom: "1px solid hsl(var(--border))" }}
        >
          <span
            className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.2)" }}
          >
            <LogIn style={{ height: "16px", width: "16px", color: "#a78bfa" }} />
          </span>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "hsl(var(--foreground))" }}>
              Sign In
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
              Welcome back to Trade Lab
            </p>
          </div>
        </div>

        <div className="px-6 pt-5 pb-2">
          <button
            type="button"
            onClick={handleGoogleSignIn}
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
                className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none transition-[border-color]"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "hsl(var(--ring))")}
                onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>
                Password
              </label>
              <Link href="/forgot-password">
                <span className="text-[11px] transition-colors cursor-pointer" style={{ color: "hsl(var(--muted-foreground))" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "hsl(var(--foreground))")}
                  onMouseLeave={e => (e.currentTarget.style.color = "hsl(var(--muted-foreground))")}>
                  Forgot password?
                </span>
              </Link>
            </div>
            <div className="relative">
              <Lock style={{ height: "13px", width: "13px", position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "hsl(var(--muted-foreground))" }} />
              <input
                type={showPw ? "text" : "password"}
                placeholder="Your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full pl-8 pr-10 py-2.5 rounded-xl text-sm outline-none transition-[border-color]"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "hsl(var(--ring))")}
                onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")}
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "hsl(var(--muted-foreground))" }}>
                {showPw ? <EyeOff style={{ height: "13px", width: "13px" }} /> : <Eye style={{ height: "13px", width: "13px" }} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl px-3 py-2.5 text-xs"
              style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity"
            style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", opacity: loading ? 0.6 : 1, boxShadow: "var(--shadow-btn)" }}>
            {loading ? "Signing in…" : "Sign In"}
          </button>

          <p className="text-center text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
            Don't have an account?{" "}
            <Link href="/auth/signup">
              <span className="font-medium cursor-pointer" style={{ color: "hsl(var(--primary))" }}>
                Create one
              </span>
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
