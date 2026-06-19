import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { LogIn, Mail, Lock, Eye, EyeOff, KeyRound, RefreshCw, ArrowLeft, HelpCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";

type Step = "signin" | "forgotEmail" | "forgotQA" | "forgotReset";

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the name of your elementary school?",
  "What was your childhood nickname?",
  "What is the name of your favorite teacher?",
  "What was the make and model of your first car?",
  "What street did you grow up on?",
  "What is the name of your best friend growing up?",
  "What was the name of your first stuffed animal or toy?",
  "What is your oldest sibling's middle name?",
  "What was the name of the hospital where you were born?",
];

async function safeJson(res: globalThis.Response): Promise<Record<string, unknown>> {
  try { return await res.json() as Record<string, unknown>; }
  catch { return {}; }
}

export default function SignInPage() {
  const { user, setUser } = useAuth();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<Step>("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState("");

  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotQuestions, setForgotQuestions] = useState<string[]>(["", "", ""]);
  const [forgotAnswers, setForgotAnswers] = useState(["", "", ""]);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);

  useEffect(() => {
    if (user) setLocation("/dashboard");
  }, [user, setLocation]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err === "oauth_not_configured") setError("Google sign-in is not configured. Please use email and password.");
    else if (err) setError(err);
  }, []);

  const inputStyle: React.CSSProperties = {
    border: "1px solid hsl(var(--border))",
    background: "hsl(var(--input))",
    color: "hsl(var(--foreground))",
  };

  async function handleSignin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const body = useBackupCode ? { email, backupCode } : { email, password };
      const res = await fetch(`${API_BASE}/api/auth/signin`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await safeJson(res);
      if (!res.ok) { setError(String(data["error"] ?? "Sign in failed")); return; }
      setUser(data["user"] as Parameters<typeof setUser>[0], (data["token"] as string) ?? null);
      setLocation("/dashboard");
    } catch { setError("Cannot reach the server. Check your connection and try again."); }
    finally { setLoading(false); }
  }

  async function handleForgotEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/security-questions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await safeJson(res);
      if (!res.ok) { setError(String(data["error"] ?? "Failed to load questions")); return; }
      const qs = (data["questions"] as string[]) ?? ["", "", ""];
      setForgotQuestions(qs);
      setForgotAnswers(["", "", ""]);
      if (!qs.some(q => q)) { setError("No security questions found for this account. Contact support."); return; }
      setStep("forgotQA");
    } catch { setError("Cannot reach the server. Try again."); }
    finally { setLoading(false); }
  }

  async function handleForgotQA(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-security`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail, answers: forgotAnswers }),
      });
      const data = await safeJson(res);
      if (!res.ok) { setError(String(data["error"] ?? "Incorrect answers")); return; }
      setResetToken(data["resetToken"] as string);
      setStep("forgotReset");
    } catch { setError("Cannot reach the server. Try again."); }
    finally { setLoading(false); }
  }

  async function handleForgotReset(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, password: newPassword }),
      });
      const data = await safeJson(res);
      if (!res.ok) { setError(String(data["error"] ?? "Reset failed")); return; }
      setUser(data["user"] as Parameters<typeof setUser>[0], (data["token"] as string) ?? null);
      setLocation("/dashboard");
    } catch { setError("Cannot reach the server. Try again."); }
    finally { setLoading(false); }
  }

  const canGoBack: Partial<Record<Step, Step>> = {
    forgotEmail: "signin",
    forgotQA: "forgotEmail",
    forgotReset: "forgotQA",
  };
  const backTarget = canGoBack[step];

  const TITLES: Record<Step, { title: string; sub: string }> = {
    signin:      { title: "Sign In",          sub: "Welcome back to Trade Lab" },
    forgotEmail: { title: "Reset Password",   sub: "Enter your email to continue" },
    forgotQA:    { title: "Security Check",   sub: "Answer your security questions" },
    forgotReset: { title: "New Password",     sub: "Set a new password for your account" },
  };
  const { title, sub } = TITLES[step];

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
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-5 pb-4" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
          {backTarget && (
            <button
              onClick={() => { setStep(backTarget); setError(""); }}
              className="h-7 w-7 flex items-center justify-center rounded-full transition-colors flex-shrink-0"
              style={{ color: "hsl(var(--muted-foreground))", background: "hsl(var(--muted))" }}
            >
              <ArrowLeft style={{ height: 13, width: 13 }} />
            </button>
          )}
          <span
            className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.2)" }}
          >
            <LogIn style={{ height: "16px", width: "16px", color: "#C9A84C" }} />
          </span>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "hsl(var(--foreground))" }}>{title}</h2>
            <p className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{sub}</p>
          </div>
        </div>

        <div className="px-6 pt-5 pb-6 flex flex-col gap-3">
          {error && (
            <div className="rounded-xl px-3 py-2.5 text-xs"
              style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
              {error}
            </div>
          )}

          {/* ── Sign In Form ── */}
          {step === "signin" && (
            <form onSubmit={handleSignin} className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "hsl(var(--muted-foreground))", pointerEvents: "none" }}>
                    <Mail style={{ height: 13, width: 13 }} />
                  </span>
                  <input
                    type="email" placeholder="you@example.com" value={email}
                    onChange={e => setEmail(e.target.value)} required autoComplete="email"
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none transition-[border-color]"
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = "hsl(var(--ring))")}
                    onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")}
                  />
                </div>
              </div>

              {!useBackupCode ? (
                <div>
                  <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Password
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "hsl(var(--muted-foreground))", pointerEvents: "none" }}>
                      <Lock style={{ height: 13, width: 13 }} />
                    </span>
                    <input
                      type={showPw ? "text" : "password"} placeholder="Your password" value={password}
                      onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
                      className="w-full pl-8 pr-10 py-2.5 rounded-xl text-sm outline-none transition-[border-color]"
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = "hsl(var(--ring))")}
                      onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")}
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "hsl(var(--muted-foreground))" }}>
                      {showPw ? <EyeOff style={{ height: 13, width: 13 }} /> : <Eye style={{ height: 13, width: 13 }} />}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Backup Code
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "hsl(var(--muted-foreground))", pointerEvents: "none" }}>
                      <KeyRound style={{ height: 13, width: 13 }} />
                    </span>
                    <input
                      type="text" placeholder="XXXX-XXXX" value={backupCode}
                      onChange={e => setBackupCode(e.target.value.toUpperCase())} required maxLength={9}
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none font-mono transition-[border-color]"
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = "hsl(var(--ring))")}
                      onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-[11px]">
                <button type="button" onClick={() => { setUseBackupCode(v => !v); setError(""); }}
                  className="flex items-center gap-1 transition-colors"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "hsl(var(--foreground))")}
                  onMouseLeave={e => (e.currentTarget.style.color = "hsl(var(--muted-foreground))")}>
                  <KeyRound style={{ height: 10, width: 10 }} />
                  {useBackupCode ? "Use password instead" : "Use backup code"}
                </button>
                <button type="button"
                  onClick={() => { setStep("forgotEmail"); setForgotEmail(email); setError(""); }}
                  className="transition-colors"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "hsl(var(--foreground))")}
                  onMouseLeave={e => (e.currentTarget.style.color = "hsl(var(--muted-foreground))")}>
                  Forgot password?
                </button>
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity duration-150"
                style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", opacity: loading ? 0.6 : 1, boxShadow: "var(--shadow-btn)" }}>
                {loading
                  ? <span className="flex items-center justify-center gap-2"><RefreshCw style={{ height: 13, width: 13 }} className="animate-spin" /> Please wait…</span>
                  : "Sign In"}
              </button>

              <p className="text-center text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                New here?{" "}
                <Link href="/auth/signup">
                  <span className="font-medium cursor-pointer" style={{ color: "hsl(var(--primary))" }}>
                    Create account
                  </span>
                </Link>
              </p>
            </form>
          )}

          {/* ── Forgot: Enter Email ── */}
          {step === "forgotEmail" && (
            <form onSubmit={handleForgotEmail} className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "hsl(var(--muted-foreground))", pointerEvents: "none" }}>
                    <Mail style={{ height: 13, width: 13 }} />
                  </span>
                  <input
                    type="email" placeholder="you@example.com" value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)} required autoComplete="email"
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none transition-[border-color]"
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = "hsl(var(--ring))")}
                    onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")}
                  />
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity"
                style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", opacity: loading ? 0.6 : 1, boxShadow: "var(--shadow-btn)" }}>
                {loading
                  ? <span className="flex items-center justify-center gap-2"><RefreshCw style={{ height: 13, width: 13 }} className="animate-spin" /> Please wait…</span>
                  : "Load Security Questions →"}
              </button>
            </form>
          )}

          {/* ── Forgot: Answer Security Questions ── */}
          {step === "forgotQA" && (
            <form onSubmit={handleForgotQA} className="flex flex-col gap-3">
              {forgotQuestions.map((q, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-medium leading-snug" style={{ color: "hsl(var(--muted-foreground))" }}>
                    <HelpCircle style={{ height: 10, width: 10, display: "inline", marginRight: 4 }} />
                    {q}
                  </label>
                  <input
                    type="text" placeholder="Your answer" value={forgotAnswers[i]}
                    onChange={e => setForgotAnswers(prev => prev.map((a, ai) => ai === i ? e.target.value : a))}
                    required
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none transition-[border-color]"
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = "hsl(var(--ring))")}
                    onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")}
                  />
                </div>
              ))}
              <button type="submit" disabled={loading}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity"
                style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", opacity: loading ? 0.6 : 1, boxShadow: "var(--shadow-btn)" }}>
                {loading
                  ? <span className="flex items-center justify-center gap-2"><RefreshCw style={{ height: 13, width: 13 }} className="animate-spin" /> Please wait…</span>
                  : "Verify Answers →"}
              </button>
            </form>
          )}

          {/* ── Forgot: Set New Password ── */}
          {step === "forgotReset" && (
            <form onSubmit={handleForgotReset} className="flex flex-col gap-3">
              <div className="rounded-xl px-3 py-2.5 flex items-center gap-2"
                style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)" }}>
                <span className="text-[11px]" style={{ color: "#22c55e" }}>Identity verified — set your new password below.</span>
              </div>
              <div>
                <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "hsl(var(--muted-foreground))" }}>
                  New Password
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "hsl(var(--muted-foreground))", pointerEvents: "none" }}>
                    <Lock style={{ height: 13, width: 13 }} />
                  </span>
                  <input
                    type={showNewPw ? "text" : "password"} placeholder="At least 6 characters" value={newPassword}
                    onChange={e => setNewPassword(e.target.value)} required autoComplete="new-password" minLength={6}
                    className="w-full pl-8 pr-10 py-2.5 rounded-xl text-sm outline-none transition-[border-color]"
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = "hsl(var(--ring))")}
                    onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")}
                  />
                  <button type="button" onClick={() => setShowNewPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {showNewPw ? <EyeOff style={{ height: 13, width: 13 }} /> : <Eye style={{ height: 13, width: 13 }} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity"
                style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", opacity: loading ? 0.6 : 1, boxShadow: "var(--shadow-btn)" }}>
                {loading
                  ? <span className="flex items-center justify-center gap-2"><RefreshCw style={{ height: 13, width: 13 }} className="animate-spin" /> Please wait…</span>
                  : "Reset Password & Sign In"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
