import React, { useState, useEffect } from "react";
import { X, Mail, Lock, User, LogIn, UserPlus, Shield, Eye, EyeOff, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: "signin" | "signup" | "admin";
}

const ADMIN_ID = import.meta.env.VITE_ADMIN_HINT ?? "";

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

export function AuthModal({ open, onClose, defaultTab = "signin" }: AuthModalProps) {
  const { setUser, setAdminToken } = useAuth();
  const [tab, setTab] = useState<"signin" | "signup" | "admin">(defaultTab);

  // Regular auth state
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Admin auth state
  const [adminId, setAdminId] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminPw, setShowAdminPw] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setTab(defaultTab);
      setError("");
      setAdminError("");
      setEmail("");
      setName("");
      setPassword("");
      setAdminId("");
      setAdminPassword("");
      setShowPw(false);
      setShowAdminPw(false);
    }
  }, [open, defaultTab]);

  if (!open) return null;

  const pwStrength = getPasswordStrength(password);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const url = tab === "signin" ? `${API_BASE}/api/auth/signin` : `${API_BASE}/api/auth/signup`;
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
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAdminError("");
    setAdminLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: adminId, password: adminPassword, id2: adminId, password2: adminPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAdminError(data.error || "Authentication failed");
        return;
      }
      setAdminToken(data.token);
      onClose();
      window.location.href = "/admin/panel";
    } catch {
      setAdminError("Network error. Please try again.");
    } finally {
      setAdminLoading(false);
    }
  }

  const inputStyle = {
    border: "1px solid hsl(var(--border))",
    background: "hsl(var(--input))",
    color: "hsl(var(--foreground))",
  };

  const tabs = [
    { id: "signin" as const, label: "Sign In", icon: LogIn },
    { id: "signup" as const, label: "Sign Up", icon: UserPlus },
    { id: "admin" as const, label: "Admin", icon: Shield },
  ];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl scale-in"
        style={{
          background: "var(--glass-bg-strong)",
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
              {tab === "signin" ? "Sign In" : tab === "signup" ? "Create Account" : "Admin Login"}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
              {tab === "signin" ? "Welcome back to Trade Lab" : tab === "signup" ? "Join Trade Lab today" : "Restricted access"}
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
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setError(""); setAdminError(""); setPassword(""); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150"
              style={tab === t.id ? {
                background: "var(--card-bg)",
                color: t.id === "admin" ? "#f87171" : "hsl(var(--foreground))",
                boxShadow: "var(--shadow-xs)",
              } : { color: "hsl(var(--muted-foreground))" }}
            >
              <t.icon style={{ height: "11px", width: "11px" }} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Regular Sign In / Sign Up form */}
        {(tab === "signin" || tab === "signup") && (
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
                  type={showPw ? "text" : "password"}
                  placeholder={tab === "signup" ? "At least 6 characters" : "Your password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete={tab === "signup" ? "new-password" : "current-password"}
                  className="w-full pl-8 pr-10 py-2.5 rounded-xl text-sm outline-none transition-[border-color,box-shadow]"
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
        )}

        {/* Admin login form */}
        {tab === "admin" && (
          <form onSubmit={handleAdminSubmit} className="px-6 pt-4 pb-6 flex flex-col gap-3">
            <div className="rounded-xl px-3 py-2.5 flex items-center gap-2" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}>
              <Shield style={{ height: "12px", width: "12px", color: "#f87171", flexShrink: 0 }} />
              <span className="text-[11px]" style={{ color: "#f87171" }}>Restricted — authorised personnel only</span>
            </div>

            <div>
              <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "hsl(var(--muted-foreground))" }}>
                Admin ID
              </label>
              <div className="relative">
                <Mail style={{ height: "13px", width: "13px", position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "hsl(var(--muted-foreground))" }} />
                <input
                  type="text"
                  placeholder="Enter your admin ID"
                  value={adminId}
                  onChange={e => setAdminId(e.target.value)}
                  required
                  autoComplete="username"
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none"
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = "#f87171")}
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
                  type={showAdminPw ? "text" : "password"}
                  placeholder="Enter your password"
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full pl-8 pr-10 py-2.5 rounded-xl text-sm outline-none"
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = "#f87171")}
                  onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")}
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  {showAdminPw ? <EyeOff style={{ height: "13px", width: "13px" }} /> : <Eye style={{ height: "13px", width: "13px" }} />}
                </button>
              </div>
            </div>

            {adminError && (
              <div
                className="rounded-xl px-3 py-2.5 text-xs"
                style={{
                  background: "rgba(248,113,113,0.08)",
                  color: "#f87171",
                  border: "1px solid rgba(248,113,113,0.2)",
                }}
              >
                {adminError}
              </div>
            )}

            <button
              type="submit"
              disabled={adminLoading}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity flex items-center justify-center gap-2"
              style={{
                background: adminLoading ? "rgba(248,113,113,0.3)" : "rgba(248,113,113,0.15)",
                color: "#f87171",
                border: "1px solid rgba(248,113,113,0.3)",
                opacity: adminLoading ? 0.6 : 1,
              }}
            >
              {adminLoading ? "Verifying…" : (<><Shield style={{ height: "13px", width: "13px" }} /> Access Admin Panel <ChevronRight style={{ height: "13px", width: "13px" }} /></>)}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
