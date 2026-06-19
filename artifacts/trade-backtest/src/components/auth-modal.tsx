import React, { useState, useEffect } from "react";
import {
  X, Mail, Lock, User, LogIn, UserPlus, Shield, Eye, EyeOff,
  ChevronRight, Copy, Check, ArrowLeft, KeyRound, HelpCircle, RefreshCw,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: "signin" | "signup" | "admin";
}

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

function getPasswordStrength(pw: string) {
  if (pw.length === 0) return { score: 0, label: "", color: "hsl(var(--border))" };
  if (pw.length < 6) return { score: 1, label: "Too short", color: "#ef4444" };
  const v = [true, /[A-Z]/.test(pw), /[0-9]/.test(pw), /[^a-zA-Z0-9]/.test(pw)].filter(Boolean).length;
  if (pw.length >= 12 && v >= 3) return { score: 4, label: "Strong", color: "#22c55e" };
  if (pw.length >= 8 && v >= 2) return { score: 3, label: "Good", color: "#eab308" };
  return { score: 2, label: "Weak", color: "#f97316" };
}

type ModalStep =
  | "signin" | "signup" | "admin"
  | "security"      // step 2 signup: pick security questions
  | "backupCodes"   // step 3 signup: save backup codes
  | "forgotEmail"   // forgot pw: enter email
  | "forgotQA"      // forgot pw: answer questions
  | "forgotReset";  // forgot pw: set new password

export function AuthModal({ open, onClose, defaultTab = "signin" }: AuthModalProps) {
  const { setUser, setAdminToken } = useAuth();

  // ── Core state ───────────────────────────────────────────────────────────
  const [step, setStep] = useState<ModalStep>(defaultTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Signup step 1 ────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  // ── Signup step 2: security questions ───────────────────────────────────
  const [sq, setSq] = useState([
    { question: "", answer: "" },
    { question: "", answer: "" },
    { question: "", answer: "" },
  ]);

  // ── Signup step 3: backup codes ──────────────────────────────────────────
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedAll, setCopiedAll] = useState(false);
  const [savedToken, setSavedToken] = useState<string | null>(null);
  const [savedUser, setSavedUser] = useState<{ id: number; email: string; name: string; banned: boolean } | null>(null);

  // ── Signin extras ────────────────────────────────────────────────────────
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [backupCodeInput, setBackupCodeInput] = useState("");

  // ── Forgot password flow ─────────────────────────────────────────────────
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotQuestions, setForgotQuestions] = useState<string[]>(["", "", ""]);
  const [forgotAnswers, setForgotAnswers] = useState(["", "", ""]);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);

  // ── Admin ────────────────────────────────────────────────────────────────
  const [adminId, setAdminId] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminPw, setShowAdminPw] = useState(false);
  const [showAdminTab, setShowAdminTab] = useState(false);
  const keyBufferRef = React.useRef("");

  useEffect(() => {
    if (open) {
      setStep(defaultTab);
      setError("");
      setEmail(""); setName(""); setPassword(""); setShowPw(false);
      setSq([{ question: "", answer: "" }, { question: "", answer: "" }, { question: "", answer: "" }]);
      setBackupCodes([]); setCopiedAll(false);
      setSavedToken(null); setSavedUser(null);
      setUseBackupCode(false); setBackupCodeInput("");
      setForgotEmail(""); setForgotQuestions(["", "", ""]); setForgotAnswers(["", "", ""]);
      setResetToken(""); setNewPassword(""); setShowNewPw(false);
      setAdminId(""); setAdminPassword(""); setShowAdminPw(false);
      setShowAdminTab(false);
      keyBufferRef.current = "";
    }
  }, [open, defaultTab]);

  // ── Developer mode secret code listener ──────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const SECRET = "devmode";
    function handleKey(e: KeyboardEvent) {
      if (e.key.length !== 1) return;
      keyBufferRef.current = (keyBufferRef.current + e.key).slice(-SECRET.length);
      if (keyBufferRef.current === SECRET) {
        setShowAdminTab(true);
        keyBufferRef.current = "";
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  if (!open) return null;

  const inputStyle = {
    border: "1px solid hsl(var(--border))",
    background: "hsl(var(--input))",
    color: "hsl(var(--foreground))",
  };

  const pwStrength = getPasswordStrength(password);

  // ── Helpers ───────────────────────────────────────────────────────────────

  // Safe JSON parse — never throws; returns {} if body is non-JSON (e.g. HTML error page).
  async function safeJson(res: globalThis.Response): Promise<Record<string, unknown>> {
    try { return await res.json() as Record<string, unknown>; }
    catch { return {}; }
  }

  // Classify fetch() catch errors into user-friendly messages.
  function netErrMsg(err: unknown): string {
    if (err instanceof TypeError && err.message.toLowerCase().includes("fetch"))
      return "Cannot reach the server. Check your connection and try again.";
    return "Something went wrong. Please try again.";
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleSignin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const body = useBackupCode
        ? { email, backupCode: backupCodeInput }
        : { email, password };
      const res = await fetch(`${API_BASE}/api/auth/signin`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await safeJson(res);
      if (!res.ok) { setError(String(data["error"] ?? "Sign in failed")); return; }
      setUser(data["user"] as Parameters<typeof setUser>[0], (data["token"] as string) ?? null);
      onClose();
    } catch (err) { setError(netErrMsg(err)); }
    finally { setLoading(false); }
  }

  async function handleSignupStep1(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email || !name || !password) { setError("All fields are required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setStep("security");
  }

  async function handleSignupSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    for (let i = 0; i < 3; i++) {
      if (!sq[i]!.question) { setError(`Please select question ${i + 1}`); return; }
      if (!sq[i]!.answer || sq[i]!.answer.trim().length < 2) {
        setError(`Answer ${i + 1} must be at least 2 characters`); return;
      }
    }
    const qs = sq.map(q => q.question);
    if (new Set(qs).size < 3) { setError("Please choose 3 different questions"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password, securityQuestions: sq }),
      });
      const data = await safeJson(res);
      if (!res.ok) { setError(String(data["error"] ?? "Signup failed")); return; }
      setSavedToken(data["token"] as string);
      setSavedUser(data["user"] as typeof savedUser);
      setBackupCodes((data["backupCodes"] as string[]) ?? []);
      setStep("backupCodes");
    } catch (err) { setError(netErrMsg(err)); }
    finally { setLoading(false); }
  }

  function handleDoneBackupCodes() {
    if (savedUser && savedToken) {
      setUser(savedUser, savedToken);
    }
    onClose();
  }

  function copyAllCodes() {
    navigator.clipboard.writeText(backupCodes.join("\n")).then(() => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
    });
  }

  async function handleForgotEmailSubmit(e: React.FormEvent) {
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
      if (!qs.some(q => q)) {
        setError("No security questions found for this account. Contact support.");
        return;
      }
      setStep("forgotQA");
    } catch (err) { setError(netErrMsg(err)); }
    finally { setLoading(false); }
  }

  async function handleForgotQASubmit(e: React.FormEvent) {
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
    } catch (err) { setError(netErrMsg(err)); }
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
      onClose();
    } catch (err) { setError(netErrMsg(err)); }
    finally { setLoading(false); }
  }

  async function handleAdminSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: adminId, password: adminPassword, id2: adminId, password2: adminPassword }),
      });
      const data = await safeJson(res);
      if (!res.ok) { setError(String(data["error"] ?? "Authentication failed")); return; }
      setAdminToken(data["token"] as string);
      onClose();
      window.location.href = "/admin/panel";
    } catch (err) { setError(netErrMsg(err)); }
    finally { setLoading(false); }
  }

  function updateSq(i: number, field: "question" | "answer", value: string) {
    setSq(prev => prev.map((q, idx) => idx === i ? { ...q, [field]: value } : q));
  }

  // ── Step titles ───────────────────────────────────────────────────────────
  const STEP_TITLES: Record<ModalStep, { title: string; sub: string }> = {
    signin:       { title: "Sign In",          sub: "Welcome back to Trade Lab" },
    signup:       { title: "Create Account",   sub: "Join Trade Lab today" },
    admin:        { title: "Admin Login",      sub: "Restricted access" },
    security:     { title: "Security Setup",   sub: "Step 2 of 3 — choose 3 personal questions" },
    backupCodes:  { title: "Save Backup Codes", sub: "Step 3 of 3 — keep these safe" },
    forgotEmail:  { title: "Reset Password",   sub: "Enter your email to continue" },
    forgotQA:     { title: "Security Check",   sub: "Answer your security questions" },
    forgotReset:  { title: "New Password",     sub: "Set a new password for your account" },
  };

  const { title, sub } = STEP_TITLES[step];

  const canGoBack: Partial<Record<ModalStep, ModalStep>> = {
    security: "signup",
    forgotEmail: "signin",
    forgotQA: "forgotEmail",
    forgotReset: "forgotQA",
  };

  const backTarget = canGoBack[step];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={e => { if (e.target === e.currentTarget && step !== "backupCodes") onClose(); }}
    >
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl scale-in overflow-hidden"
        style={{
          background: "var(--glass-bg-strong)",
          border: "1px solid var(--glass-border)",
          boxShadow: "var(--shadow-modal)",
          maxHeight: "92dvh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 sticky top-0 z-10"
          style={{ borderBottom: "1px solid hsl(var(--border))", background: "var(--glass-bg-strong)" }}>
          <div className="flex items-center gap-2">
            {backTarget && (
              <button onClick={() => { setStep(backTarget); setError(""); }}
                className="h-7 w-7 flex items-center justify-center rounded-full mr-1 transition-colors"
                style={{ color: "hsl(var(--muted-foreground))", background: "hsl(var(--muted))" }}>
                <ArrowLeft style={{ height: 13, width: 13 }} />
              </button>
            )}
            <div>
              <h2 className="text-base font-semibold" style={{ color: "hsl(var(--foreground))" }}>{title}</h2>
              <p className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{sub}</p>
            </div>
          </div>
          {step !== "backupCodes" && (
            <button onClick={onClose}
              className="h-7 w-7 flex items-center justify-center rounded-full transition-colors"
              style={{ color: "hsl(var(--muted-foreground))", background: "hsl(var(--muted))" }}>
              <X style={{ height: 14, width: 14 }} />
            </button>
          )}
        </div>

        {/* ── Tab bar (signin / signup only) ── */}
        {(step === "signin" || step === "signup" || step === "admin") && (
          <div className="flex mx-6 mt-4 rounded-xl p-1" style={{ background: "hsl(var(--muted))" }}>
            {(["signin", "signup"] as const).map(t => (
              <button key={t}
                onClick={() => { setStep(t); setError(""); setPassword(""); setUseBackupCode(false); }}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                style={step === t ? {
                  background: "var(--card-bg)", boxShadow: "var(--shadow-xs)",
                  color: "hsl(var(--foreground))",
                } : { color: "hsl(var(--muted-foreground))" }}>
                {t === "signin" && <LogIn style={{ height: 11, width: 11 }} />}
                {t === "signup" && <UserPlus style={{ height: 11, width: 11 }} />}
                {t === "signin" ? "Sign In" : "Sign Up"}
              </button>
            ))}
            {showAdminTab && (
              <button
                onClick={() => { setStep("admin"); setError(""); setPassword(""); setUseBackupCode(false); }}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                style={step === "admin" ? {
                  background: "var(--card-bg)", boxShadow: "var(--shadow-xs)",
                  color: "#f87171",
                } : { color: "hsl(var(--muted-foreground))" }}>
                <Shield style={{ height: 11, width: 11 }} />
                Admin
              </button>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            SIGN IN
        ════════════════════════════════════════════════════════════════════ */}
        {step === "signin" && (
          <form onSubmit={handleSignin} className="px-6 pt-4 pb-6 flex flex-col gap-3">
            <Field label="Email Address" icon={<Mail style={{ height: 13, width: 13 }} />}>
              <input type="email" placeholder="you@example.com" value={email}
                onChange={e => setEmail(e.target.value)} required autoComplete="email"
                className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none transition-[border-color]"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "hsl(var(--ring))")}
                onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")} />
            </Field>

            {!useBackupCode ? (
              <Field label="Password" icon={<Lock style={{ height: 13, width: 13 }} />}>
                <input type={showPw ? "text" : "password"} placeholder="Your password" value={password}
                  onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
                  className="w-full pl-8 pr-10 py-2.5 rounded-xl text-sm outline-none transition-[border-color]"
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = "hsl(var(--ring))")}
                  onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {showPw ? <EyeOff style={{ height: 13, width: 13 }} /> : <Eye style={{ height: 13, width: 13 }} />}
                </button>
              </Field>
            ) : (
              <Field label="Backup Code" icon={<KeyRound style={{ height: 13, width: 13 }} />}>
                <input type="text" placeholder="XXXX-XXXX" value={backupCodeInput}
                  onChange={e => setBackupCodeInput(e.target.value.toUpperCase())} required
                  maxLength={9}
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none font-mono transition-[border-color]"
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = "hsl(var(--ring))")}
                  onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")} />
              </Field>
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
              <button type="button" onClick={() => { setStep("forgotEmail"); setForgotEmail(email); setError(""); }}
                className="transition-colors"
                style={{ color: "hsl(var(--muted-foreground))" }}
                onMouseEnter={e => (e.currentTarget.style.color = "hsl(var(--foreground))")}
                onMouseLeave={e => (e.currentTarget.style.color = "hsl(var(--muted-foreground))")}>
                Forgot password?
              </button>
            </div>

            <ErrorBox error={error} />
            <SubmitBtn loading={loading} label="Sign In" />
          </form>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            SIGN UP — Step 1
        ════════════════════════════════════════════════════════════════════ */}
        {step === "signup" && (
          <form onSubmit={handleSignupStep1} className="px-6 pt-4 pb-6 flex flex-col gap-3">
            <Field label="Full Name" icon={<User style={{ height: 13, width: 13 }} />}>
              <input type="text" placeholder="Your name" value={name}
                onChange={e => setName(e.target.value)} required autoComplete="name"
                className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none transition-[border-color]"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "hsl(var(--ring))")}
                onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")} />
            </Field>
            <Field label="Email Address" icon={<Mail style={{ height: 13, width: 13 }} />}>
              <input type="email" placeholder="you@example.com" value={email}
                onChange={e => setEmail(e.target.value)} required autoComplete="email"
                className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none transition-[border-color]"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "hsl(var(--ring))")}
                onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")} />
            </Field>
            <Field label="Password" icon={<Lock style={{ height: 13, width: 13 }} />}>
              <input type={showPw ? "text" : "password"} placeholder="At least 6 characters" value={password}
                onChange={e => setPassword(e.target.value)} required autoComplete="new-password"
                className="w-full pl-8 pr-10 py-2.5 rounded-xl text-sm outline-none transition-[border-color]"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "hsl(var(--ring))")}
                onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")} />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "hsl(var(--muted-foreground))" }}>
                {showPw ? <EyeOff style={{ height: 13, width: 13 }} /> : <Eye style={{ height: 13, width: 13 }} />}
              </button>
            </Field>
            {password.length > 0 && (
              <div className="space-y-1.5 -mt-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-1 flex-1 rounded-full transition-all duration-200"
                      style={{ background: pwStrength.score >= i ? pwStrength.color : "hsl(var(--border))" }} />
                  ))}
                </div>
                <span className="text-[10px] font-medium" style={{ color: pwStrength.color }}>{pwStrength.label}</span>
              </div>
            )}
            <ErrorBox error={error} />
            <SubmitBtn loading={false} label="Continue →" />
            <p className="text-center text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>
              Next: set up security questions for account recovery
            </p>
          </form>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            SIGN UP — Step 2: Security Questions
        ════════════════════════════════════════════════════════════════════ */}
        {step === "security" && (
          <form onSubmit={handleSignupSubmit} className="px-6 pt-4 pb-6 flex flex-col gap-4">
            <div className="rounded-xl px-3 py-2.5 flex items-start gap-2"
              style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <HelpCircle style={{ height: 12, width: 12, color: "#22c55e", flexShrink: 0, marginTop: 1 }} />
              <span className="text-[11px]" style={{ color: "#22c55e" }}>
                These answers will be used to verify your identity if you forget your password. Answers are not case-sensitive.
              </span>
            </div>

            {([0, 1, 2] as const).map(i => (
              <div key={i} className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Question {i + 1}
                </label>
                <select value={sq[i]!.question}
                  onChange={e => updateSq(i, "question", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none transition-[border-color]"
                  style={{ ...inputStyle, appearance: "none" }}
                  onFocus={e => (e.target.style.borderColor = "hsl(var(--ring))")}
                  onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")}>
                  <option value="">— Choose a question —</option>
                  {SECURITY_QUESTIONS.filter(q =>
                    q === sq[i]!.question || !sq.some((s, si) => si !== i && s.question === q)
                  ).map(q => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
                <input type="text" placeholder="Your answer"
                  value={sq[i]!.answer}
                  onChange={e => updateSq(i, "answer", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none transition-[border-color]"
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = "hsl(var(--ring))")}
                  onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")} />
              </div>
            ))}

            <ErrorBox error={error} />
            <SubmitBtn loading={loading} label="Create Account" />
          </form>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            SIGN UP — Step 3: Backup Codes
        ════════════════════════════════════════════════════════════════════ */}
        {step === "backupCodes" && (
          <div className="px-6 pt-4 pb-6 flex flex-col gap-4">
            <div className="rounded-xl px-3 py-2.5 flex items-start gap-2"
              style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)" }}>
              <Shield style={{ height: 12, width: 12, color: "#eab308", flexShrink: 0, marginTop: 1 }} />
              <span className="text-[11px]" style={{ color: "#eab308" }}>
                Save these 6 backup codes somewhere safe. Each code can be used <strong>once</strong> to sign in if you forget your password. They cannot be shown again.
              </span>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid hsl(var(--border))" }}>
              {backupCodes.map((code, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5"
                  style={{ borderBottom: i < backupCodes.length - 1 ? "1px solid hsl(var(--border))" : "none", background: i % 2 === 0 ? "hsl(var(--muted)/30%)" : "transparent" }}>
                  <span className="text-sm font-mono font-bold tracking-widest" style={{ color: "hsl(var(--foreground))" }}>{code}</span>
                  <span className="text-[10px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>#{i + 1}</span>
                </div>
              ))}
            </div>

            <button type="button" onClick={copyAllCodes}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ border: "1px solid hsl(var(--border))", background: copiedAll ? "rgba(34,197,94,0.1)" : "hsl(var(--muted))", color: copiedAll ? "#22c55e" : "hsl(var(--foreground))" }}>
              {copiedAll ? <Check style={{ height: 14, width: 14 }} /> : <Copy style={{ height: 14, width: 14 }} />}
              {copiedAll ? "Copied!" : "Copy All Codes"}
            </button>

            <button type="button" onClick={handleDoneBackupCodes}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity"
              style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", boxShadow: "var(--shadow-btn)" }}>
              I've saved my codes — Enter Trade Lab
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            FORGOT PASSWORD — Step 1: Email
        ════════════════════════════════════════════════════════════════════ */}
        {step === "forgotEmail" && (
          <form onSubmit={handleForgotEmailSubmit} className="px-6 pt-4 pb-6 flex flex-col gap-3">
            <Field label="Email Address" icon={<Mail style={{ height: 13, width: 13 }} />}>
              <input type="email" placeholder="you@example.com" value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)} required autoComplete="email"
                className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none transition-[border-color]"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "hsl(var(--ring))")}
                onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")} />
            </Field>
            <ErrorBox error={error} />
            <SubmitBtn loading={loading} label="Load Security Questions →" />
          </form>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            FORGOT PASSWORD — Step 2: Answer Questions
        ════════════════════════════════════════════════════════════════════ */}
        {step === "forgotQA" && (
          <form onSubmit={handleForgotQASubmit} className="px-6 pt-4 pb-6 flex flex-col gap-4">
            {forgotQuestions.map((q, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium leading-snug" style={{ color: "hsl(var(--muted-foreground))" }}>
                  <HelpCircle style={{ height: 10, width: 10, display: "inline", marginRight: 4 }} />
                  {q}
                </label>
                <input type="text" placeholder="Your answer" value={forgotAnswers[i]}
                  onChange={e => setForgotAnswers(prev => prev.map((a, ai) => ai === i ? e.target.value : a))}
                  required
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none transition-[border-color]"
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = "hsl(var(--ring))")}
                  onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")} />
              </div>
            ))}
            <ErrorBox error={error} />
            <SubmitBtn loading={loading} label="Verify Answers →" />
          </form>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            FORGOT PASSWORD — Step 3: New Password
        ════════════════════════════════════════════════════════════════════ */}
        {step === "forgotReset" && (
          <form onSubmit={handleForgotReset} className="px-6 pt-4 pb-6 flex flex-col gap-3">
            <div className="rounded-xl px-3 py-2.5 flex items-center gap-2"
              style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <Check style={{ height: 12, width: 12, color: "#22c55e" }} />
              <span className="text-[11px]" style={{ color: "#22c55e" }}>Identity verified — set your new password below.</span>
            </div>
            <Field label="New Password" icon={<Lock style={{ height: 13, width: 13 }} />}>
              <input type={showNewPw ? "text" : "password"} placeholder="At least 6 characters" value={newPassword}
                onChange={e => setNewPassword(e.target.value)} required autoComplete="new-password" minLength={6}
                className="w-full pl-8 pr-10 py-2.5 rounded-xl text-sm outline-none transition-[border-color]"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "hsl(var(--ring))")}
                onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")} />
              <button type="button" onClick={() => setShowNewPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "hsl(var(--muted-foreground))" }}>
                {showNewPw ? <EyeOff style={{ height: 13, width: 13 }} /> : <Eye style={{ height: 13, width: 13 }} />}
              </button>
            </Field>
            <ErrorBox error={error} />
            <SubmitBtn loading={loading} label="Reset Password & Sign In" />
          </form>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            ADMIN
        ════════════════════════════════════════════════════════════════════ */}
        {step === "admin" && (
          <form onSubmit={handleAdminSubmit} className="px-6 pt-4 pb-6 flex flex-col gap-3">
            <div className="rounded-xl px-3 py-2.5 flex items-center gap-2"
              style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}>
              <Shield style={{ height: 12, width: 12, color: "#f87171", flexShrink: 0 }} />
              <span className="text-[11px]" style={{ color: "#f87171" }}>Restricted — authorised personnel only</span>
            </div>
            <Field label="Admin ID" icon={<Mail style={{ height: 13, width: 13 }} />}>
              <input type="text" placeholder="Enter your admin ID" value={adminId}
                onChange={e => setAdminId(e.target.value)} required autoComplete="username"
                className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "#f87171")}
                onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")} />
            </Field>
            <Field label="Password" icon={<Lock style={{ height: 13, width: 13 }} />}>
              <input type={showAdminPw ? "text" : "password"} placeholder="Enter your password" value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)} required autoComplete="current-password"
                className="w-full pl-8 pr-10 py-2.5 rounded-xl text-sm outline-none"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "#f87171")}
                onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")} />
              <button type="button" onClick={() => setShowAdminPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "hsl(var(--muted-foreground))" }}>
                {showAdminPw ? <EyeOff style={{ height: 13, width: 13 }} /> : <Eye style={{ height: 13, width: 13 }} />}
              </button>
            </Field>
            <ErrorBox error={error} />
            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity flex items-center justify-center gap-2"
              style={{ background: loading ? "rgba(248,113,113,0.3)" : "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)", opacity: loading ? 0.6 : 1 }}>
              {loading ? "Verifying…" : (<><Shield style={{ height: 13, width: 13 }} /> Access Admin Panel <ChevronRight style={{ height: 13, width: 13 }} /></>)}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Small shared components ────────────────────────────────────────────────────
function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "hsl(var(--muted-foreground))" }}>{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "hsl(var(--muted-foreground))", pointerEvents: "none" }}>{icon}</span>
        {children}
      </div>
    </div>
  );
}

function ErrorBox({ error }: { error: string }) {
  if (!error) return null;
  return (
    <div className="rounded-xl px-3 py-2.5 text-xs"
      style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
      {error}
    </div>
  );
}

function SubmitBtn({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button type="submit" disabled={loading}
      className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity duration-150"
      style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", opacity: loading ? 0.6 : 1, boxShadow: "var(--shadow-btn)" }}>
      {loading ? <span className="flex items-center justify-center gap-2"><RefreshCw style={{ height: 13, width: 13 }} className="animate-spin" /> Please wait…</span> : label}
    </button>
  );
}
