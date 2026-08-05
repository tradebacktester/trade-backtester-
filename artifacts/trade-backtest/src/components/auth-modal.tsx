import React, { useState, useEffect } from "react";
import {
  X, Mail, Lock, User, LogIn, UserPlus, Shield, Eye, EyeOff,
  ChevronRight, Copy, Check, ArrowLeft, KeyRound, RefreshCw, Fingerprint,
  Smartphone, AlertCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: "signin" | "signup" | "admin";
}

function getPasswordStrength(pw: string) {
  if (pw.length === 0) return { score: 0, label: "", color: "hsl(var(--border))" };
  if (pw.length < 6) return { score: 1, label: "Too short", color: "#ef4444" };
  const v = [true, /[A-Z]/.test(pw), /[0-9]/.test(pw), /[^a-zA-Z0-9]/.test(pw)].filter(Boolean).length;
  if (pw.length >= 12 && v >= 3) return { score: 4, label: "Strong", color: "#22c55e" };
  if (pw.length >= 8 && v >= 2) return { score: 3, label: "Good", color: "#eab308" };
  return { score: 2, label: "Weak", color: "#f97316" };
}

// ── WebAuthn helpers ──────────────────────────────────────────────────────────
function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function fromB64url(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - b64.length % 4) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

function isWebAuthnSupported(): boolean {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}

type ModalStep =
  | "signin" | "signup" | "admin"
  | "biometric"     // step 2 signup: register fingerprint/face id
  | "backupCodes"   // step 3 signup: save backup codes
  | "forgotEmail"   // forgot pw: enter email
  | "forgotBiometric" // forgot pw: verify with biometric
  | "forgotQA"      // forgot pw: answer questions (fallback)
  | "forgotReset";  // forgot pw: set new password

export function AuthModal({ open, onClose, defaultTab = "signin" }: AuthModalProps) {
  const { setUser, setAdminToken } = useAuth();

  const [step, setStep] = useState<ModalStep>(defaultTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Signup step 1 ─────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  // ── Biometric state ────────────────────────────────────────────────────────
  const [biometricStatus, setBiometricStatus] = useState<"idle" | "registering" | "success" | "error" | "unsupported">("idle");
  const [biometricError, setBiometricError] = useState("");
  const [forgotHasWebauthn, setForgotHasWebauthn] = useState(false);
  const [forgotHasQuestions, setForgotHasQuestions] = useState(false);
  const [forgotBiometricChallengeId, setForgotBiometricChallengeId] = useState("");
  const [forgotBiometricOptions, setForgotBiometricOptions] = useState<Record<string, unknown> | null>(null);

  // ── Signup step 3: backup codes ────────────────────────────────────────────
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedAll, setCopiedAll] = useState(false);
  const [savedToken, setSavedToken] = useState<string | null>(null);
  const [savedUser, setSavedUser] = useState<{ id: number; email: string; name: string; banned: boolean } | null>(null);

  // ── Signin extras ──────────────────────────────────────────────────────────
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [backupCodeInput, setBackupCodeInput] = useState("");

  // ── Forgot password flow ───────────────────────────────────────────────────
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotQuestions, setForgotQuestions] = useState<string[]>(["", "", ""]);
  const [forgotAnswers, setForgotAnswers] = useState(["", "", ""]);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);

  // ── Admin ──────────────────────────────────────────────────────────────────
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
      setBackupCodes([]); setCopiedAll(false);
      setSavedToken(null); setSavedUser(null);
      setUseBackupCode(false); setBackupCodeInput("");
      setForgotEmail(""); setForgotQuestions(["", "", ""]); setForgotAnswers(["", "", ""]);
      setResetToken(""); setNewPassword(""); setShowNewPw(false);
      setAdminId(""); setAdminPassword(""); setShowAdminPw(false);
      setShowAdminTab(false);
      setBiometricStatus("idle"); setBiometricError("");
      setForgotHasWebauthn(false); setForgotHasQuestions(false);
      keyBufferRef.current = "";
    }
  }, [open, defaultTab]);

  useEffect(() => {
    if (!open) return;
    const SECRET = "devmode";
    function handleKey(e: KeyboardEvent) {
      if (!e.key || e.key.length !== 1) return;
      keyBufferRef.current = (keyBufferRef.current + e.key).slice(-SECRET.length);
      if (keyBufferRef.current === SECRET) { setShowAdminTab(true); keyBufferRef.current = ""; }
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

  async function safeJson(res: globalThis.Response): Promise<Record<string, unknown>> {
    try { return await res.json() as Record<string, unknown>; }
    catch { return {}; }
  }
  function netErrMsg(err: unknown): string {
    if (err instanceof TypeError && err.message.toLowerCase().includes("fetch"))
      return "Cannot reach the server. Check your connection and try again.";
    return "Something went wrong. Please try again.";
  }
  async function fetchWithRetry(url: string, init: RequestInit, maxRetries = 3): Promise<globalThis.Response> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 15_000);
        try { const res = await fetch(url, { ...init, signal: ctrl.signal }); clearTimeout(timeout); return res; }
        finally { clearTimeout(timeout); }
      } catch (err) {
        lastErr = err;
        if (attempt < maxRetries - 1) await new Promise(r => setTimeout(r, 500 * 2 ** attempt));
      }
    }
    throw lastErr;
  }

  // ── Signin ─────────────────────────────────────────────────────────────────
  async function handleSignin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const body = useBackupCode ? { email, backupCode: backupCodeInput } : { email, password };
      const res = await fetchWithRetry(`${API_BASE}/api/auth/signin`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await safeJson(res);
      if (!res.ok) { setError(String(data["error"] ?? "Sign in failed")); return; }
      setUser(data["user"] as Parameters<typeof setUser>[0], (data["token"] as string) ?? null);
      onClose();
    } catch (err) { setError(netErrMsg(err)); }
    finally { setLoading(false); }
  }

  // ── Signup Step 1 → creates account, then goes to biometric ───────────────
  async function handleSignupStep1(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email || !name || !password) { setError("All fields are required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      const res = await fetchWithRetry(`${API_BASE}/api/auth/signup`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password, skipSecurityQuestions: true }),
      });
      const data = await safeJson(res);
      if (!res.ok) { setError(String(data["error"] ?? "Signup failed")); return; }
      setSavedToken(data["token"] as string);
      setSavedUser(data["user"] as typeof savedUser);
      setBackupCodes((data["backupCodes"] as string[]) ?? []);
      setBiometricStatus(isWebAuthnSupported() ? "idle" : "unsupported");
      setStep("biometric");
    } catch (err) { setError(netErrMsg(err)); }
    finally { setLoading(false); }
  }

  // ── Biometric registration ─────────────────────────────────────────────────
  async function handleBiometricRegister() {
    if (!savedUser || !savedToken) return;
    setBiometricStatus("registering");
    setBiometricError("");
    try {
      // 1. Get challenge
      const chalRes = await fetch(`${API_BASE}/api/auth/webauthn/register-challenge`, {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${savedToken}` },
        body: JSON.stringify({ userId: savedUser.id, email: savedUser.email, name }),
      });
      if (!chalRes.ok) throw new Error("Failed to start biometric setup");
      const { challengeId, options } = await chalRes.json() as { challengeId: string; options: Record<string, unknown> };

      // 2. Call browser WebAuthn API
      const pubKeyOptions: PublicKeyCredentialCreationOptions = {
        ...(options as object),
        challenge: fromB64url(options["challenge"] as string),
        user: {
          ...(options["user"] as object),
          id: fromB64url((options["user"] as { id: string })["id"]),
        },
        excludeCredentials: ((options["excludeCredentials"] as Array<{ id: string; type: string }>) ?? []).map(c => ({
          ...c,
          id: fromB64url(c.id),
        })),
      };

      const credential = await navigator.credentials.create({ publicKey: pubKeyOptions }) as PublicKeyCredential;
      const response = credential.response as AuthenticatorAttestationResponse;

      const serialized = {
        id: credential.id,
        rawId: b64url(credential.rawId),
        response: {
          clientDataJSON: b64url(response.clientDataJSON),
          attestationObject: b64url(response.attestationObject),
          transports: response.getTransports?.() ?? [],
        },
        type: credential.type,
        clientExtensionResults: credential.getClientExtensionResults(),
      };

      // 3. Verify with server
      const verifyRes = await fetch(`${API_BASE}/api/auth/webauthn/register-verify`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, credential: serialized }),
      });
      if (!verifyRes.ok) throw new Error("Server verification failed");
      setBiometricStatus("success");
      setTimeout(() => setStep("backupCodes"), 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("NotAllowedError") || msg.includes("not allowed") || (err as { name?: string }).name === "NotAllowedError") {
        setBiometricError("Permission denied. Please try again or skip.");
      } else {
        setBiometricError(msg || "Biometric setup failed. Please try again or skip.");
      }
      setBiometricStatus("error");
    }
  }

  // ── Forgot password: load recovery options ─────────────────────────────────
  async function handleForgotEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/security-questions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await safeJson(res);
      if (!res.ok) { setError(String(data["error"] ?? "Failed to load recovery options")); return; }
      const hasWebauthn = !!(data["hasWebauthn"] as boolean);
      const qs = (data["questions"] as string[]) ?? [];
      const hasQuestions = qs.some(q => q);
      setForgotHasWebauthn(hasWebauthn);
      setForgotHasQuestions(hasQuestions);
      if (hasWebauthn) {
        // Pre-fetch auth challenge — only go to biometric step if a credential exists
        const chalRes = await fetch(`${API_BASE}/api/auth/webauthn/auth-challenge`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: forgotEmail }),
        });
        const chalData = await chalRes.json() as { hasCredential: boolean; challengeId?: string; options?: Record<string, unknown> };
        if (chalData.hasCredential && chalData.challengeId) {
          setForgotBiometricChallengeId(chalData.challengeId);
          setForgotBiometricOptions(chalData.options ?? null);
          setStep("forgotBiometric");
        } else if (hasQuestions) {
          // Biometric record exists in DB but no credential on this device — fall back to security questions
          setForgotQuestions(qs);
          setForgotAnswers(["", "", ""]);
          setStep("forgotQA");
        } else {
          setError("No biometric credential found on this device. Please use a different browser or contact support.");
        }
      } else if (hasQuestions) {
        setForgotQuestions(qs);
        setForgotAnswers(["", "", ""]);
        setStep("forgotQA");
      } else {
        setError("No recovery method found for this account. Contact support.");
      }
    } catch (err) { setError(netErrMsg(err)); }
    finally { setLoading(false); }
  }

  // ── Forgot password: verify with biometric ────────────────────────────────
  async function handleForgotBiometric() {
    setBiometricStatus("registering");
    setBiometricError("");
    try {
      let challengeId = forgotBiometricChallengeId;
      let options = forgotBiometricOptions;

      // Refresh challenge if expired
      if (!challengeId || !options) {
        const chalRes = await fetch(`${API_BASE}/api/auth/webauthn/auth-challenge`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: forgotEmail }),
        });
        const chalData = await chalRes.json() as { hasCredential: boolean; challengeId?: string; options?: Record<string, unknown> };
        if (!chalData.hasCredential || !chalData.challengeId) throw new Error("Biometric not available");
        challengeId = chalData.challengeId;
        options = chalData.options ?? null;
      }

      const pubKeyOptions: PublicKeyCredentialRequestOptions = {
        ...(options as object),
        challenge: fromB64url((options!["challenge"] as string)),
        allowCredentials: ((options!["allowCredentials"] as Array<{ id: string; type: string; transports?: string[] }>) ?? []).map(c => ({
          ...c,
          id: fromB64url(c.id),
        })),
      };

      const credential = await navigator.credentials.get({ publicKey: pubKeyOptions }) as PublicKeyCredential;
      const response = credential.response as AuthenticatorAssertionResponse;

      const serialized = {
        id: credential.id,
        rawId: b64url(credential.rawId),
        response: {
          clientDataJSON: b64url(response.clientDataJSON),
          authenticatorData: b64url(response.authenticatorData),
          signature: b64url(response.signature),
          userHandle: response.userHandle ? b64url(response.userHandle) : null,
        },
        type: credential.type,
        clientExtensionResults: credential.getClientExtensionResults(),
      };

      const verifyRes = await fetch(`${API_BASE}/api/auth/webauthn/auth-verify`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, credential: serialized }),
      });
      const data = await verifyRes.json() as { resetToken?: string; error?: string };
      if (!verifyRes.ok || !data.resetToken) throw new Error(data.error ?? "Verification failed");

      setResetToken(data.resetToken);
      setBiometricStatus("success");
      setTimeout(() => setStep("forgotReset"), 800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Verification failed";
      setBiometricError(msg);
      setBiometricStatus("error");
    }
  }

  // ── Forgot password: security questions ───────────────────────────────────
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

  function handleDoneBackupCodes() {
    if (savedUser && savedToken) setUser(savedUser, savedToken);
    onClose();
  }
  function copyAllCodes() {
    navigator.clipboard.writeText(backupCodes.join("\n")).then(() => {
      setCopiedAll(true); setTimeout(() => setCopiedAll(false), 2500);
    });
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

  const STEP_TITLES: Record<ModalStep, { title: string; sub: string }> = {
    signin:           { title: "Sign In",              sub: "Welcome back to Trade Lab" },
    signup:           { title: "Create Account",       sub: "Join Trade Lab today" },
    admin:            { title: "Admin Login",          sub: "Restricted access" },
    biometric:        { title: "Secure Your Account",  sub: "Step 2 of 3 — set up biometric recovery" },
    backupCodes:      { title: "Save Backup Codes",    sub: "Step 3 of 3 — keep these safe" },
    forgotEmail:      { title: "Reset Password",       sub: "Enter your email to continue" },
    forgotBiometric:  { title: "Biometric Verification", sub: "Verify your identity with your device" },
    forgotQA:         { title: "Security Check",       sub: "Answer your security questions" },
    forgotReset:      { title: "New Password",         sub: "Set a new password for your account" },
  };

  const { title, sub } = STEP_TITLES[step];
  const canGoBack: Partial<Record<ModalStep, ModalStep>> = {
    forgotEmail: "signin",
    forgotBiometric: "forgotEmail",
    forgotQA: "forgotEmail",
    forgotReset: forgotHasWebauthn ? "forgotBiometric" : "forgotQA",
  };
  const backTarget = canGoBack[step];

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
              <button onClick={() => { setStep(backTarget); setError(""); setBiometricStatus("idle"); setBiometricError(""); }}
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

        {/* Tab bar */}
        {(step === "signin" || step === "signup" || step === "admin") && (
          <div className="flex mx-6 mt-4 rounded-xl p-1" style={{ background: "hsl(var(--muted))" }}>
            {(["signin", "signup"] as const).map(t => (
              <button key={t}
                onClick={() => { setStep(t); setError(""); setPassword(""); setUseBackupCode(false); }}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                style={step === t
                  ? { background: "var(--card-bg)", boxShadow: "var(--shadow-xs)", color: "hsl(var(--foreground))" }
                  : { color: "hsl(var(--muted-foreground))" }}>
                {t === "signin" && <LogIn style={{ height: 11, width: 11 }} />}
                {t === "signup" && <UserPlus style={{ height: 11, width: 11 }} />}
                {t === "signin" ? "Sign In" : "Sign Up"}
              </button>
            ))}
            {showAdminTab && (
              <button onClick={() => { setStep("admin"); setError(""); setPassword(""); setUseBackupCode(false); }}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                style={step === "admin"
                  ? { background: "var(--card-bg)", boxShadow: "var(--shadow-xs)", color: "#f87171" }
                  : { color: "hsl(var(--muted-foreground))" }}>
                <Shield style={{ height: 11, width: 11 }} />Admin
              </button>
            )}
          </div>
        )}

        {/* ── SIGN IN ── */}
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
                  onChange={e => setBackupCodeInput(e.target.value.toUpperCase())} required maxLength={9}
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none font-mono transition-[border-color]"
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = "hsl(var(--ring))")}
                  onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")} />
              </Field>
            )}
            <div className="flex items-center justify-between text-[11px]">
              <button type="button" onClick={() => { setUseBackupCode(v => !v); setError(""); }}
                className="flex items-center gap-1 transition-colors" style={{ color: "hsl(var(--muted-foreground))" }}
                onMouseEnter={e => (e.currentTarget.style.color = "hsl(var(--foreground))")}
                onMouseLeave={e => (e.currentTarget.style.color = "hsl(var(--muted-foreground))")}>
                <KeyRound style={{ height: 10, width: 10 }} />
                {useBackupCode ? "Use password instead" : "Use backup code"}
              </button>
              <button type="button" onClick={() => { setStep("forgotEmail"); setForgotEmail(email); setError(""); }}
                className="transition-colors" style={{ color: "hsl(var(--muted-foreground))" }}
                onMouseEnter={e => (e.currentTarget.style.color = "hsl(var(--foreground))")}
                onMouseLeave={e => (e.currentTarget.style.color = "hsl(var(--muted-foreground))")}>
                Forgot password?
              </button>
            </div>
            <ErrorBox error={error} />
            <SubmitBtn loading={loading} label="Sign In" />
          </form>
        )}

        {/* ── SIGN UP ── */}
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
            <SubmitBtn loading={loading} label="Create Account →" />
            <p className="text-center text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>
              Next: set up biometric recovery (fingerprint / Face ID)
            </p>
          </form>
        )}

        {/* ── BIOMETRIC SETUP ── */}
        {step === "biometric" && (
          <div className="px-6 pt-5 pb-6 flex flex-col gap-5">
            {/* Icon */}
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="relative">
                <div className="h-20 w-20 rounded-2xl flex items-center justify-center"
                  style={{
                    background: biometricStatus === "success"
                      ? "rgba(34,197,94,0.12)"
                      : biometricStatus === "error"
                        ? "rgba(239,68,68,0.10)"
                        : "rgba(99,102,241,0.12)",
                    border: `2px solid ${biometricStatus === "success" ? "#22c55e" : biometricStatus === "error" ? "#ef4444" : "rgba(99,102,241,0.35)"}`,
                    transition: "all 0.3s",
                  }}>
                  {biometricStatus === "success" ? (
                    <Check style={{ height: 36, width: 36, color: "#22c55e" }} />
                  ) : biometricStatus === "error" ? (
                    <AlertCircle style={{ height: 36, width: 36, color: "#ef4444" }} />
                  ) : biometricStatus === "unsupported" ? (
                    <Smartphone style={{ height: 36, width: 36, color: "hsl(var(--muted-foreground))" }} />
                  ) : (
                    <Fingerprint style={{
                      height: 36, width: 36,
                      color: biometricStatus === "registering" ? "#a5b4fc" : "#6366f1",
                      animation: biometricStatus === "registering" ? "pulse 1s infinite" : "none",
                    }} />
                  )}
                </div>
              </div>

              {biometricStatus === "idle" && (
                <>
                  <p className="text-sm font-semibold text-center" style={{ color: "hsl(var(--foreground))" }}>
                    Enable Fingerprint / Face ID
                  </p>
                  <p className="text-xs text-center leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Register your device's biometric sensor to reset your password without answering security questions.
                  </p>
                </>
              )}
              {biometricStatus === "registering" && (
                <p className="text-sm font-medium text-center" style={{ color: "#a5b4fc" }}>
                  Waiting for biometric…
                </p>
              )}
              {biometricStatus === "success" && (
                <p className="text-sm font-semibold text-center" style={{ color: "#22c55e" }}>
                  Biometric registered! ✓
                </p>
              )}
              {biometricStatus === "error" && (
                <>
                  <p className="text-sm font-semibold text-center" style={{ color: "#ef4444" }}>Registration failed</p>
                  {biometricError && (
                    <p className="text-xs text-center" style={{ color: "hsl(var(--muted-foreground))" }}>{biometricError}</p>
                  )}
                </>
              )}
              {biometricStatus === "unsupported" && (
                <>
                  <p className="text-sm font-semibold text-center" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Not available on this device
                  </p>
                  <p className="text-xs text-center" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Biometric authentication is not supported in this browser. You can still sign in with your backup codes.
                  </p>
                </>
              )}
            </div>

            {(biometricStatus === "idle" || biometricStatus === "error") && biometricStatus !== "unsupported" && (
              <button
                onClick={handleBiometricRegister}
                className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                style={{ background: "#6366f1", color: "#fff", boxShadow: "0 0 20px rgba(99,102,241,0.3)" }}>
                <Fingerprint style={{ height: 15, width: 15 }} />
                {biometricStatus === "error" ? "Try Again" : "Register Fingerprint / Face ID"}
              </button>
            )}

            <button
              onClick={() => setStep("backupCodes")}
              className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", border: "1px solid var(--glass-border)" }}>
              {biometricStatus === "unsupported" ? "Continue without biometric" : "Skip for now"}
            </button>
          </div>
        )}

        {/* ── BACKUP CODES ── */}
        {step === "backupCodes" && (
          <div className="px-6 pt-4 pb-6 flex flex-col gap-4">
            <div className="rounded-xl px-3 py-2.5 flex items-start gap-2"
              style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)" }}>
              <Shield style={{ height: 12, width: 12, color: "#eab308", flexShrink: 0, marginTop: 1 }} />
              <span className="text-[11px]" style={{ color: "#eab308" }}>
                Save these 6 backup codes somewhere safe. Each can be used <strong>once</strong> to sign in if you lose access.
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
              className="w-full py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", boxShadow: "var(--shadow-btn)" }}>
              I've saved my codes — Enter Trade Lab
            </button>
          </div>
        )}

        {/* ── FORGOT: Email ── */}
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
            <SubmitBtn loading={loading} label="Continue →" />
          </form>
        )}

        {/* ── FORGOT: Biometric Verify ── */}
        {step === "forgotBiometric" && (
          <div className="px-6 pt-5 pb-6 flex flex-col gap-4">
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="h-20 w-20 rounded-2xl flex items-center justify-center"
                style={{
                  background: biometricStatus === "success" ? "rgba(34,197,94,0.12)" : biometricStatus === "error" ? "rgba(239,68,68,0.10)" : "rgba(99,102,241,0.12)",
                  border: `2px solid ${biometricStatus === "success" ? "#22c55e" : biometricStatus === "error" ? "#ef4444" : "rgba(99,102,241,0.35)"}`,
                }}>
                {biometricStatus === "success" ? (
                  <Check style={{ height: 36, width: 36, color: "#22c55e" }} />
                ) : biometricStatus === "error" ? (
                  <AlertCircle style={{ height: 36, width: 36, color: "#ef4444" }} />
                ) : (
                  <Fingerprint style={{ height: 36, width: 36, color: biometricStatus === "registering" ? "#a5b4fc" : "#6366f1" }} />
                )}
              </div>
              {biometricStatus !== "success" && (
                <p className="text-sm text-center leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {biometricStatus === "error" ? biometricError : "Verify your identity using the fingerprint or Face ID registered on this device."}
                </p>
              )}
              {biometricStatus === "success" && (
                <p className="text-sm font-semibold" style={{ color: "#22c55e" }}>Identity verified!</p>
              )}
            </div>

            {(biometricStatus === "idle" || biometricStatus === "error") && (
              <button onClick={handleForgotBiometric}
                className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                style={{ background: "#6366f1", color: "#fff" }}>
                <Fingerprint style={{ height: 15, width: 15 }} />
                {biometricStatus === "error" ? "Try Again" : "Verify with Fingerprint / Face ID"}
              </button>
            )}
            {biometricStatus === "registering" && (
              <div className="flex items-center justify-center gap-2 py-2" style={{ color: "#a5b4fc" }}>
                <RefreshCw style={{ height: 14, width: 14 }} className="animate-spin" />
                <span className="text-sm">Waiting for biometric…</span>
              </div>
            )}

            {forgotHasQuestions && biometricStatus !== "success" && (
              <button type="button"
                onClick={() => { setBiometricStatus("idle"); setBiometricError(""); setStep("forgotQA"); }}
                className="text-[11px] text-center transition-colors"
                style={{ color: "hsl(var(--muted-foreground))" }}
                onMouseEnter={e => (e.currentTarget.style.color = "hsl(var(--foreground))")}
                onMouseLeave={e => (e.currentTarget.style.color = "hsl(var(--muted-foreground))")}>
                Use security questions instead
              </button>
            )}
          </div>
        )}

        {/* ── FORGOT: Security Questions ── */}
        {step === "forgotQA" && (
          <form onSubmit={handleForgotQASubmit} className="px-6 pt-4 pb-6 flex flex-col gap-4">
            {forgotQuestions.map((q, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium leading-snug" style={{ color: "hsl(var(--muted-foreground))" }}>
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
            <SubmitBtn loading={loading} label="Verify →" />
          </form>
        )}

        {/* ── FORGOT: New Password ── */}
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

        {/* ── ADMIN ── */}
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
