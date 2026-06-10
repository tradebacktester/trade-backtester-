import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Shield, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { setAdminToken, adminToken } = useAuth();

  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (adminToken) setLocation("/admin/panel");
  }, [adminToken]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!id.trim() || !password.trim()) {
      setError("Admin ID and password are required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Authentication failed");
        return;
      }
      setAdminToken(data.token);
      setLocation("/admin/panel");
    } catch {
      setError("Network error. Please try again.");
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
            Enter your admin credentials to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-6 flex flex-col gap-4">
          <div>
            <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "hsl(var(--muted-foreground))" }}>Admin ID</label>
            <input
              type="text"
              placeholder="Enter admin ID"
              value={id}
              onChange={e => setId(e.target.value)}
              required
              autoFocus
              autoComplete="username"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ border: "1px solid var(--glass-border)", background: "var(--glass-bg)", color: "hsl(var(--foreground))" }}
              onFocus={e => (e.target.style.borderColor = "var(--accent-cyan-border)")}
              onBlur={e => (e.target.style.borderColor = "var(--glass-border)")}
            />
          </div>
          <div>
            <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "hsl(var(--muted-foreground))" }}>Password</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                placeholder="Enter password"
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
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity"
            style={{ background: "#FFFFFF", color: "#050505", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Verifying…" : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
