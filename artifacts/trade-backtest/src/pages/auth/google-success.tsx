import React, { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { CandleLoader } from "@/components/candle-loader";

export default function GoogleSuccessPage() {
  const { setUser } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const userStr = params.get("user");
    const error = params.get("error");

    if (error || !token || !userStr) {
      const msg = error === "account_banned"
        ? "Your account has been suspended."
        : error === "google_cancelled"
        ? ""
        : "Google sign-in failed. Please try again.";
      setLocation(`/auth/signin${msg ? `?error=${encodeURIComponent(msg)}` : ""}`);
      return;
    }

    try {
      const user = JSON.parse(userStr) as { id: number; email: string; name: string };
      setUser(user, token);
      window.history.replaceState({}, "", window.location.pathname);
      setLocation("/dashboard");
    } catch {
      setLocation("/auth/signin");
    }
  }, [setUser, setLocation]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <CandleLoader size="md" />
        <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
          Completing sign-in…
        </p>
      </div>
    </div>
  );
}
