import React from "react";
import { Link } from "wouter";
import { LogIn, ShieldCheck } from "lucide-react";

export default function ForgotPasswordPage() {
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
            style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.2)" }}
          >
            <ShieldCheck style={{ height: "16px", width: "16px", color: "#22d3ee" }} />
          </span>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "hsl(var(--foreground))" }}>
              No Password Needed
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
              Trade Lab uses passwordless sign-in
            </p>
          </div>
        </div>

        <div className="px-6 pt-5 pb-6 flex flex-col gap-4 text-center">
          <p className="text-sm leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
            Trade Lab doesn't use passwords. Sign in securely with your{" "}
            <strong style={{ color: "hsl(var(--foreground))" }}>Google</strong> or{" "}
            <strong style={{ color: "hsl(var(--foreground))" }}>Apple</strong> account — no password to forget or reset.
          </p>

          <Link href="/auth/signin">
            <button
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", boxShadow: "var(--shadow-btn)" }}
            >
              <LogIn style={{ height: "14px", width: "14px" }} />
              Go to Sign In
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
