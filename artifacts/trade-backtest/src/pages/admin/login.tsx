import React, { useState } from "react";
import { useLocation } from "wouter";
import { Shield, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { setAdminToken, adminToken } = useAuth();
  const [id, setId] = useState("");

  React.useEffect(() => {
    if (adminToken) setLocation("/admin/panel");
  }, [adminToken]);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Login failed"); return; }
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
        style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.1)", boxShadow: "0 8px 32px rgba(0,0,0,0.1)" }}
      >
        <div className="px-8 pt-8 pb-6 flex flex-col items-center" style={{ borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
          <span className="h-12 w-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: "#f0f0f0" }}>
            <Shield style={{ height: "22px", width: "22px", color: "#111" }} />
          </span>
          <h1 className="text-base font-semibold" style={{ color: "#111" }}>Admin Login</h1>
          <p className="text-xs mt-1 text-center" style={{ color: "#888" }}>Restricted access — authorised personnel only</p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-6 flex flex-col gap-4">
          <div>
            <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "#666" }}>Admin ID</label>
            <input
              type="text"
              placeholder="Enter your admin ID"
              value={id}
              onChange={e => setId(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ border: "1px solid rgba(0,0,0,0.12)", background: "#fafafa", color: "#111" }}
              onFocus={e => (e.target.style.borderColor = "rgba(0,0,0,0.3)")}
              onBlur={e => (e.target.style.borderColor = "rgba(0,0,0,0.12)")}
            />
          </div>
          <div>
            <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "#666" }}>Password</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full pl-3 pr-10 py-2.5 rounded-xl text-sm outline-none"
                style={{ border: "1px solid rgba(0,0,0,0.12)", background: "#fafafa", color: "#111" }}
                onFocus={e => (e.target.style.borderColor = "rgba(0,0,0,0.3)")}
                onBlur={e => (e.target.style.borderColor = "rgba(0,0,0,0.12)")}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "#aaa" }}
              >
                {showPw ? <EyeOff style={{ height: "13px", width: "13px" }} /> : <Eye style={{ height: "13px", width: "13px" }} />}
              </button>
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
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity"
            style={{ background: "#111", color: "#fff", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Verifying…" : "Login as Admin"}
          </button>
        </form>
      </div>
    </div>
  );
}
