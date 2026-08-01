import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { UserPlus, Mail, Lock, User, Eye, EyeOff, RefreshCw, ArrowLeft, Shield, Copy, Check, HelpCircle, ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";

type Step = "signup" | "security" | "backupCodes";

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

const POLICY_LINKS = [
  "Privacy Policy", "Terms & Conditions", "Financial Disclaimer", "Risk Disclosure",
  "No Broker Relationship Statement", "Data Accuracy Disclaimer", "No Refund Policy",
  "Account Deletion Policy", "AI Disclosure",
];

function getPasswordStrength(pw: string) {
  if (pw.length === 0) return { score: 0, label: "", color: "hsl(var(--border))" };
  if (pw.length < 6) return { score: 1, label: "Too short", color: "#ef4444" };
  const v = [true, /[A-Z]/.test(pw), /[0-9]/.test(pw), /[^a-zA-Z0-9]/.test(pw)].filter(Boolean).length;
  if (pw.length >= 12 && v >= 3) return { score: 4, label: "Strong", color: "#22c55e" };
  if (pw.length >= 8 && v >= 2) return { score: 3, label: "Good", color: "#eab308" };
  return { score: 2, label: "Weak", color: "#f97316" };
}

async function safeJson(res: globalThis.Response): Promise<Record<string, unknown>> {
  try { return await res.json() as Record<string, unknown>; }
  catch { return {}; }
}

export default function SignUpPage() {
  const { user, setUser } = useAuth();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<Step>("signup");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1 fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [showPolicies, setShowPolicies] = useState(false);

  // Step 2: security questions
  const [sq, setSq] = useState([
    { question: "", answer: "" },
    { question: "", answer: "" },
    { question: "", answer: "" },
  ]);

  // Step 3: backup codes
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedAll, setCopiedAll] = useState(false);
  const [savedToken, setSavedToken] = useState<string | null>(null);
  const [savedUser, setSavedUser] = useState<{ id: number; email: string; name: string; banned: boolean } | null>(null);

  useEffect(() => {
    if (user) setLocation("/dashboard");
  }, [user, setLocation]);

  const inputStyle: React.CSSProperties = {
    border: "1px solid hsl(var(--border))",
    background: "hsl(var(--input))",
    color: "hsl(var(--foreground))",
  };

  const pwStrength = getPasswordStrength(password);

  function updateSq(i: number, field: "question" | "answer", value: string) {
    setSq(prev => prev.map((q, idx) => idx === i ? { ...q, [field]: value } : q));
  }

  function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!agreed) { setError("You must agree to the platform policies to create an account."); return; }
    if (!email || !name || !password) { setError("All fields are required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setStep("security");
  }

  async function handleStep2(e: React.FormEvent) {
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
    } catch { setError("Cannot reach the server. Check your connection and try again."); }
    finally { setLoading(false); }
  }

  function handleDone() {
    if (savedUser && savedToken) {
      setUser(savedUser, savedToken);
    }
    setLocation("/dashboard");
  }

  function copyAllCodes() {
    navigator.clipboard.writeText(backupCodes.join("\n")).then(() => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
    });
  }

  const TITLES: Record<Step, { title: string; sub: string }> = {
    signup:      { title: "Create Account",    sub: "Step 1 of 3 — your details" },
    security:    { title: "Security Setup",    sub: "Step 2 of 3 — choose 3 personal questions" },
    backupCodes: { title: "Save Backup Codes", sub: "Step 3 of 3 — keep these safe" },
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
          maxHeight: "92dvh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-5 pb-4 sticky top-0 z-10"
          style={{ borderBottom: "1px solid hsl(var(--border))", background: "var(--glass-bg-strong)" }}>
          {step === "security" && (
            <button
              onClick={() => { setStep("signup"); setError(""); }}
              className="h-7 w-7 flex items-center justify-center rounded-full transition-colors flex-shrink-0"
              style={{ color: "hsl(var(--muted-foreground))", background: "hsl(var(--muted))" }}
            >
              <ArrowLeft style={{ height: 13, width: 13 }} />
            </button>
          )}
          <span
            className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(192,192,192,0.12)", border: "1px solid rgba(192,192,192,0.2)" }}
          >
            <UserPlus style={{ height: "16px", width: "16px", color: "#C0C0C0" }} />
          </span>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "hsl(var(--foreground))" }}>{title}</h2>
            <p className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{sub}</p>
          </div>
        </div>

        <div className="px-6 pt-5 pb-6">
          {error && (
            <div className="rounded-xl px-3 py-2.5 text-xs mb-3"
              style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
              {error}
            </div>
          )}

          {/* ── Step 1: Details ── */}
          {step === "signup" && (
            <form onSubmit={handleStep1} className="flex flex-col gap-3">
              {/* Policies */}
              <div className="rounded-xl p-3" style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}>
                <p className="text-[11px] mb-2" style={{ color: "hsl(var(--foreground))" }}>
                  Trade Lab is an <strong>educational platform only</strong>. Results do not constitute financial advice.
                </p>
                <button type="button" onClick={() => setShowPolicies(v => !v)}
                  className="text-[11px] mb-2 flex items-center gap-1"
                  style={{ color: "hsl(var(--muted-foreground))" }}>
                  <ExternalLink style={{ height: "10px", width: "10px" }} />
                  {showPolicies ? "Hide" : "View all"} 9 platform policies
                </button>
                {showPolicies && (
                  <ul className="mb-2 flex flex-col gap-0.5">
                    {POLICY_LINKS.map(p => (
                      <li key={p} className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>• {p}</li>
                    ))}
                  </ul>
                )}
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <div
                    onClick={() => setAgreed(v => !v)}
                    className="mt-0.5 h-4 w-4 rounded flex-shrink-0 flex items-center justify-center transition-all"
                    style={{
                      background: agreed ? "hsl(var(--primary))" : "hsl(var(--background))",
                      border: agreed ? "2px solid hsl(var(--primary))" : "2px solid hsl(var(--border))",
                    }}
                  >
                    {agreed && (
                      <svg viewBox="0 0 12 10" fill="none" style={{ height: "8px", width: "10px" }}>
                        <path d="M1 5l3.5 3.5L11 1" stroke="hsl(var(--primary-foreground))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className="text-[11px] leading-relaxed" style={{ color: "hsl(var(--foreground))" }}>
                    I agree to the <strong>Terms & Conditions</strong>, <strong>Risk Disclosure</strong>, and all platform policies.
                  </span>
                </label>
              </div>

              {/* Name */}
              <div>
                <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "hsl(var(--muted-foreground))" }}>Full Name</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "hsl(var(--muted-foreground))", pointerEvents: "none" }}>
                    <User style={{ height: 13, width: 13 }} />
                  </span>
                  <input type="text" placeholder="Your name" value={name}
                    onChange={e => setName(e.target.value)} required autoComplete="name"
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none transition-[border-color]"
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = "hsl(var(--ring))")}
                    onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")} />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "hsl(var(--muted-foreground))" }}>Email Address</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "hsl(var(--muted-foreground))", pointerEvents: "none" }}>
                    <Mail style={{ height: 13, width: 13 }} />
                  </span>
                  <input type="email" placeholder="you@example.com" value={email}
                    onChange={e => setEmail(e.target.value)} required autoComplete="email"
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none transition-[border-color]"
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = "hsl(var(--ring))")}
                    onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")} />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "hsl(var(--muted-foreground))" }}>Password</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "hsl(var(--muted-foreground))", pointerEvents: "none" }}>
                    <Lock style={{ height: 13, width: 13 }} />
                  </span>
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
                </div>
                {password.length > 0 && (
                  <div className="space-y-1.5 mt-1.5">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-1 flex-1 rounded-full transition-all duration-200"
                          style={{ background: pwStrength.score >= i ? pwStrength.color : "hsl(var(--border))" }} />
                      ))}
                    </div>
                    <span className="text-[10px] font-medium" style={{ color: pwStrength.color }}>{pwStrength.label}</span>
                  </div>
                )}
              </div>

              <button type="submit"
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity"
                style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", boxShadow: "var(--shadow-btn)" }}>
                Continue →
              </button>
              <p className="text-center text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                Next: set up security questions for account recovery
              </p>
              <p className="text-center text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                Already have an account?{" "}
                <Link href="/auth/signin">
                  <span className="font-medium cursor-pointer" style={{ color: "hsl(var(--primary))" }}>Sign in</span>
                </Link>
              </p>
            </form>
          )}

          {/* ── Step 2: Security Questions ── */}
          {step === "security" && (
            <form onSubmit={handleStep2} className="flex flex-col gap-4">
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
                    style={{ ...inputStyle, appearance: "none" as const }}
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

              <button type="submit" disabled={loading}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity"
                style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", opacity: loading ? 0.6 : 1, boxShadow: "var(--shadow-btn)" }}>
                {loading
                  ? <span className="flex items-center justify-center gap-2"><RefreshCw style={{ height: 13, width: 13 }} className="animate-spin" /> Creating account…</span>
                  : "Create Account"}
              </button>
            </form>
          )}

          {/* ── Step 3: Backup Codes ── */}
          {step === "backupCodes" && (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl px-3 py-2.5 flex items-start gap-2"
                style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)" }}>
                <Shield style={{ height: 12, width: 12, color: "#eab308", flexShrink: 0, marginTop: 1 }} />
                <span className="text-[11px]" style={{ color: "#eab308" }}>
                  Save these 6 backup codes somewhere safe. Each can be used <strong>once</strong> to sign in if you forget your password. They cannot be shown again.
                </span>
              </div>

              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid hsl(var(--border))" }}>
                {backupCodes.map((code, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5"
                    style={{
                      borderBottom: i < backupCodes.length - 1 ? "1px solid hsl(var(--border))" : "none",
                      background: i % 2 === 0 ? "hsl(var(--muted)/30%)" : "transparent",
                    }}>
                    <span className="text-sm font-mono font-bold tracking-widest" style={{ color: "hsl(var(--foreground))" }}>{code}</span>
                    <span className="text-[10px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>#{i + 1}</span>
                  </div>
                ))}
              </div>

              <button type="button" onClick={copyAllCodes}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  border: "1px solid hsl(var(--border))",
                  background: copiedAll ? "rgba(34,197,94,0.1)" : "hsl(var(--muted))",
                  color: copiedAll ? "#22c55e" : "hsl(var(--foreground))",
                }}>
                {copiedAll ? <Check style={{ height: 14, width: 14 }} /> : <Copy style={{ height: 14, width: 14 }} />}
                {copiedAll ? "Copied!" : "Copy All Codes"}
              </button>

              <button type="button" onClick={handleDone}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity"
                style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", boxShadow: "var(--shadow-btn)" }}>
                I've saved my codes — Enter Trade Lab
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
