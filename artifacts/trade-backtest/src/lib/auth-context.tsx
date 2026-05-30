import React, { createContext, useContext, useState } from "react";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  banned: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  adminToken: string | null;
  setUser: (user: AuthUser | null) => void;
  signout: () => void;
  setAdminToken: (token: string | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(() => {
    try { return JSON.parse(localStorage.getItem("tt_user") || "null"); } catch { return null; }
  });
  const [adminToken, setAdminTokenState] = useState<string | null>(() =>
    localStorage.getItem("tt_admin_token") || null
  );

  function setUser(u: AuthUser | null) {
    setUserState(u);
    if (u) localStorage.setItem("tt_user", JSON.stringify(u));
    else localStorage.removeItem("tt_user");
  }

  function signout() {
    setUserState(null);
    localStorage.removeItem("tt_user");
  }

  function setAdminToken(token: string | null) {
    setAdminTokenState(token);
    if (token) localStorage.setItem("tt_admin_token", token);
    else localStorage.removeItem("tt_admin_token");
  }

  return (
    <AuthContext.Provider value={{ user, adminToken, setUser, signout, setAdminToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
