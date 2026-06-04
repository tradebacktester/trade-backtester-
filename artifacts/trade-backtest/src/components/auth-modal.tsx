import React, { useState } from "react";
import { X, Mail, Lock, User, LogIn, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

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

export function AuthModal({ open, onClose }: AuthModalProps) {
  const { setUser } = useAuth();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const pwStrength = getPasswordStrength(password);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const url = tab === "signin" ? "/api/auth/signin" : "/api/auth/signup";
      const body = tab === "signin"
        ? { email, password }
        : { email, name, password };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong"); return; }
      setUser(data.user, data.token ?? null);
      onClose();
      setEmail(""); setName(""); setPassword(""); setError("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    border: "1px solid hsl(var(--border))",
    background: "hsl(var(--input))",
    color: "hsl(var(--foreground))",
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
    >
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl scale-in"
        style={{
          background: "var(--glass-bg-strong)",
          backdropFilter: "blur(32px) saturate(180%)",
          WebkitBackdropFilter: "blur(32px) saturate(180%)",
          border: "1px solid var(--glass-border)",
          boxShadow: "var(--shadow-modal)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 pt-5 pb-4"
          style={{ borderBottom: "1px solid hsl(var(--border))" }}
        >
          <div>
            <h2 className="text-base font-semibold" style={{ color: "hsl(var(--foreground))" }}>
              {tab === "signin" ? "Sign In" : "Create Account"}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
              {tab === "signin" ? "Welcome back to Trade Lab" : "Join Trade Lab today"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-full transition-colors"
            style={{ color: "hsl(var(--muted-foreground))", background: "hsl(var(--muted))" }}
          >
            <X style={{ height: "14px", width: "14px" }} />
          </button>
        </div>

        {/* Tabs */}
        <div
          className="flex mx-6 mt-4 rounded-xl p-1"
          style={{ background: "hsl(var(--muted))" }}
        >
          {(["signin", "signup"] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(""); setPassword(""); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150"
              style={tab === t ? {
                background: "var(--card-bg)",
                color: "hsl(var(--foreground))",
                boxShadow: "var(--shadow-xs)",
              } : { color: "hsl(var(--muted-foreground))" }}
            >
              {t === "signin" ? <LogIn style={{ height: "11px", width: "11px" }} /> : <UserPlus style={{ height: "11px", width: "11px" }} />}
              {t === "signin" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pt-4 pb-6 flex flex-col gap-3">
          {tab === "signup" && (
            <div>
              <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "hsl(var(--muted-foreground))" }}>
                Full Name
              </label>
              <div className="relative">
                <User style={{ height: "13px", width: "13px", position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "hsl(var(--muted-foreground))" }} />
                <input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoComplete="name"
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none transition-[border-color,box-shadow]"
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = "hsl(var(--ring))")}
                  onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")}
                />
              </div>
            </div>
          )}
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
                className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none transition-[border-color,box-shadow]"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "hsl(var(--ring))")}
                onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")}
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "hsl(var(--muted-foreground))" }}>
              Password
            </label>
            <div className="relative">
              <Lock style={{ height: "13px", width: "13px", position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "hsl(var(--muted-foreground))" }} />
              <input
                type="password"
                placeholder={tab === "signup" ? "At least 6 characters" : "Your password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete={tab === "signup" ? "new-password" : "current-password"}
                className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none transition-[border-color,box-shadow]"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "hsl(var(--ring))")}
                onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")}
              />
            </div>
            {tab === "signup" && password.length > 0 && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      className="h-1 flex-1 rounded-full transition-colors duration-200"
                      style={{ background: pwStrength.score >= i ? pwStrength.color : "hsl(var(--border))" }}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-medium" style={{ color: pwStrength.color }}>
                  {pwStrength.label}
                </span>
              </div>
            )}
            {tab === "signup" && password.length === 0 && (
              <p className="text-[10px] mt-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                Must be at least 6 characters
              </p>
            )}
          </div>

          {error && (
            <div
              className="rounded-xl px-3 py-2.5 text-xs"
              style={{
                background: "rgba(239,68,68,0.08)",
                color: "#ef4444",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity duration-150"
            style={{
              background: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
              opacity: loading ? 0.6 : 1,
              boxShadow: "var(--shadow-btn)",
            }}
          >
            {loading ? "Please wait…" : tab === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
