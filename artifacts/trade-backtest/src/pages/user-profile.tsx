import React, { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { ArrowLeft, BarChart2, Layers, Calendar, User2, ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";

interface PublicProfile {
  id: number;
  name: string;
  joinedAt: string;
  totalBacktests: number;
  totalStrategies: number;
  isOwnProfile: boolean;
}

function Stat({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="flex flex-col gap-2 p-5 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="flex items-center gap-2">
        <span className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: `${color}18`, border: `1px solid ${color}28` }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </span>
        <span className="text-[11px] font-mono uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
      </div>
      <span className="text-3xl font-bold" style={{ color: "rgba(255,255,255,0.92)" }}>{value}</span>
    </div>
  );
}

export default function UserProfilePage() {
  const [, params] = useRoute("/user/:id");
  const userId = params?.id ? parseInt(params.id, 10) : NaN;
  const { token } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isNaN(userId)) { setError("Invalid user ID"); setLoading(false); return; }
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    fetch(`${API_BASE}/api/users/${userId}`, { headers })
      .then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? "User not found");
        return r.json() as Promise<PublicProfile>;
      })
      .then(data => setProfile(data))
      .catch(e => setError(e.message ?? "Failed to load profile"))
      .finally(() => setLoading(false));
  }, [userId, token]);

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full animate-pulse" style={{ background: "rgba(255,255,255,0.1)" }} />
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Loading profile…</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4">
        <User2 className="h-12 w-12" style={{ color: "rgba(255,255,255,0.15)" }} />
        <p className="text-base font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>
          {error || "User not found"}
        </p>
        <Link href="/community">
          <button className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Community
          </button>
        </Link>
      </div>
    );
  }

  const joinedDate = new Date(profile.joinedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const initials = profile.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      {/* Back */}
      <div>
        <Link href="/community">
          <button className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70" style={{ color: "rgba(255,255,255,0.5)" }}>
            <ArrowLeft className="h-3.5 w-3.5" /> Community
          </button>
        </Link>
      </div>

      {/* Header card */}
      <div className="rounded-3xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
        {/* Banner */}
        <div className="h-24 w-full" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(168,85,247,0.25) 100%)" }} />

        {/* Avatar + name */}
        <div className="px-6 pb-6">
          <div className="-mt-10 mb-4 flex items-end justify-between">
            <div
              className="h-20 w-20 rounded-2xl flex items-center justify-center text-xl font-bold border-4"
              style={{
                background: "linear-gradient(135deg, #6366f1, #a855f7)",
                color: "white",
                borderColor: "rgba(13,17,28,1)",
              }}
            >
              {initials}
            </div>
            {profile.isOwnProfile && (
              <Link href="/profile">
                <button
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl transition-opacity hover:opacity-70"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <ExternalLink className="h-3 w-3" /> Edit Profile
                </button>
              </Link>
            )}
          </div>

          <h1 className="text-2xl font-bold" style={{ color: "rgba(255,255,255,0.95)" }}>{profile.name}</h1>
          <div className="flex items-center gap-1.5 mt-1">
            <Calendar className="h-3.5 w-3.5" style={{ color: "rgba(255,255,255,0.35)" }} />
            <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.4)" }}>Joined {joinedDate}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Backtests" value={profile.totalBacktests} icon={BarChart2} color="#6366f1" />
        <Stat label="Strategies" value={profile.totalStrategies} icon={Layers} color="#a855f7" />
      </div>

      {/* User ID card */}
      <div className="rounded-2xl px-5 py-4 flex items-center justify-between"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div>
          <p className="text-[11px] font-mono uppercase tracking-widest mb-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>User ID</p>
          <p className="text-sm font-mono font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>#{profile.id}</p>
        </div>
        <div className="text-[11px] font-mono px-3 py-1 rounded-lg" style={{ background: "rgba(99,102,241,0.12)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" }}>
          Trader
        </div>
      </div>
    </div>
  );
}
