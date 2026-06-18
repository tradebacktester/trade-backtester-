import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { signJwt } from "../lib/jwt";

const GOOGLE_CLIENT_ID = process.env["GOOGLE_CLIENT_ID"] ?? "";
const GOOGLE_CLIENT_SECRET = process.env["GOOGLE_CLIENT_SECRET"] ?? "";
const JWT_SECRET = process.env["JWT_SECRET"] ?? "";

function getCallbackUrl(req: Request): string {
  const host = process.env["REPLIT_DEV_DOMAIN"]
    ? `https://${process.env["REPLIT_DEV_DOMAIN"]}`
    : `${req.protocol}://${req.get("host")}`;
  return `${host}/api/auth/google/callback`;
}

function getFrontendUrl(req: Request): string {
  return process.env["REPLIT_DEV_DOMAIN"]
    ? `https://${process.env["REPLIT_DEV_DOMAIN"]}`
    : `${req.protocol}://${req.get("host")}`;
}

const router: IRouter = Router();

router.get("/auth/google", (req: Request, res: Response): void => {
  if (!GOOGLE_CLIENT_ID) {
    res.status(503).json({ error: "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." });
    return;
  }
  const redirectUri = getCallbackUrl(req);
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get("/auth/google/callback", async (req: Request, res: Response): Promise<void> => {
  const frontendUrl = getFrontendUrl(req);

  try {
    const { code, error: oauthError } = req.query as { code?: string; error?: string };

    if (oauthError || !code) {
      res.redirect(`${frontendUrl}/auth/signin?error=google_cancelled`);
      return;
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      res.redirect(`${frontendUrl}/auth/signin?error=oauth_not_configured`);
      return;
    }

    const redirectUri = getCallbackUrl(req);

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      res.redirect(`${frontendUrl}/auth/signin?error=google_token_failed`);
      return;
    }

    const tokenData = await tokenRes.json() as { access_token?: string; id_token?: string };

    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userInfoRes.ok) {
      res.redirect(`${frontendUrl}/auth/signin?error=google_userinfo_failed`);
      return;
    }

    const googleUser = await userInfoRes.json() as { id: string; email: string; name: string };
    const { id: googleId, email, name } = googleUser;

    if (!email) {
      res.redirect(`${frontendUrl}/auth/signin?error=google_no_email`);
      return;
    }

    let [existingUser] = await db
      .select()
      .from(usersTable)
      .where(or(eq(usersTable.googleId, googleId), eq(usersTable.email, email)));

    if (existingUser) {
      if (existingUser.banned) {
        res.redirect(`${frontendUrl}/auth/signin?error=account_banned`);
        return;
      }
      if (!existingUser.googleId) {
        await db.update(usersTable)
          .set({ googleId })
          .where(eq(usersTable.id, existingUser.id));
      }
    } else {
      const [newUser] = await db
        .insert(usersTable)
        .values({ email, name: name || email.split("@")[0] || "User", passwordHash: "oauth:google", googleId })
        .returning();
      existingUser = newUser;
    }

    if (!existingUser) {
      res.redirect(`${frontendUrl}/auth/signin?error=db_error`);
      return;
    }

    const token = signJwt({ id: existingUser.id, email: existingUser.email }, JWT_SECRET);
    const user = { id: existingUser.id, email: existingUser.email, name: existingUser.name };

    const redirectParams = new URLSearchParams({
      token,
      user: JSON.stringify(user),
    });
    res.redirect(`${frontendUrl}/auth/google-success?${redirectParams.toString()}`);
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    res.redirect(`${frontendUrl}/auth/signin?error=server_error`);
  }
});

export default router;
