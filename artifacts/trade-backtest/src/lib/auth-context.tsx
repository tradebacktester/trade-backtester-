import React, { createContext, useContext, useState } from "react";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  banned: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  adminToken: string | null;
  setUser: (user: AuthUser | null, token?: string | null) => void;
  signout: () => void;
  setAdminToken: (token: string | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(() => {
    try { return JSON.parse(localStorage.getItem("tt_user") || "null"); } catch { return null; }
  });
  const [token, setTokenState] = useState<string | null>(() =>
    localStorage.getItem("tt_token") || null
  );
  const [adminToken, setAdminTokenState] = useState<string | null>(() =>
    localStorage.getItem("tt_admin_token") || null
  );

  function setUser(u: AuthUser | null, tok?: string | null) {
    setUserState(u);
    if (u) localStorage.setItem("tt_user", JSON.stringify(u));
    else localStorage.removeItem("tt_user");

    if (tok !== undefined) {
      setTokenState(tok);
      if (tok) localStorage.setItem("tt_token", tok);
      else localStorage.removeItem("tt_token");
    }
  }

  function signout() {
    setUserState(null);
    setTokenState(null);
    localStorage.removeItem("tt_user");
    localStorage.removeItem("tt_token");
  }

  function setAdminToken(tok: string | null) {
    setAdminTokenState(tok);
    if (tok) localStorage.setItem("tt_admin_token", tok);
    else localStorage.removeItem("tt_admin_token");
  }

  return (
    <AuthContext.Provider value={{ user, token, adminToken, setUser, signout, setAdminToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
