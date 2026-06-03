import React, { useState } from "react";
import { X, Mail, Lock, User, LogIn, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
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

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.35)" }}>
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl"
        style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.1)", boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "#111" }}>
              {tab === "signin" ? "Sign In" : "Create Account"}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "#888" }}>
              {tab === "signin" ? "Welcome back to Trade Lab" : "Join Trade Lab today"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            style={{ color: "#888" }}
          >
            <X style={{ height: "14px", width: "14px" }} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex mx-6 mt-4 rounded-xl p-1" style={{ background: "#f5f5f5" }}>
          {(["signin", "signup"] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(""); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150"
              style={tab === t ? {
                background: "#fff",
                color: "#111",
                boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
              } : { color: "#888" }}
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
              <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "#666" }}>Full Name</label>
              <div className="relative">
                <User style={{ height: "13px", width: "13px", position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#aaa" }} />
                <input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoComplete="name"
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none transition-colors"
                  style={{ border: "1px solid rgba(0,0,0,0.12)", background: "#fafafa", color: "#111" }}
                  onFocus={e => (e.target.style.borderColor = "rgba(0,0,0,0.3)")}
                  onBlur={e => (e.target.style.borderColor = "rgba(0,0,0,0.12)")}
                />
              </div>
            </div>
          )}
          <div>
            <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "#666" }}>Email Address</label>
            <div className="relative">
              <Mail style={{ height: "13px", width: "13px", position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#aaa" }} />
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none transition-colors"
                style={{ border: "1px solid rgba(0,0,0,0.12)", background: "#fafafa", color: "#111" }}
                onFocus={e => (e.target.style.borderColor = "rgba(0,0,0,0.3)")}
                onBlur={e => (e.target.style.borderColor = "rgba(0,0,0,0.12)")}
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "#666" }}>Password</label>
            <div className="relative">
              <Lock style={{ height: "13px", width: "13px", position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#aaa" }} />
              <input
                type="password"
                placeholder={tab === "signup" ? "At least 6 characters" : "Your password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete={tab === "signup" ? "new-password" : "current-password"}
                className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none transition-colors"
                style={{ border: "1px solid rgba(0,0,0,0.12)", background: "#fafafa", color: "#111" }}
                onFocus={e => (e.target.style.borderColor = "rgba(0,0,0,0.3)")}
                onBlur={e => (e.target.style.borderColor = "rgba(0,0,0,0.12)")}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl px-3 py-2.5 text-xs" style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity duration-150"
            style={{ background: "#111", color: "#fff", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Please wait…" : tab === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
