import { Router, type IRouter, type Request, type Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { db, usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { signJwt } from "../lib/jwt";

const APPLE_CLIENT_ID  = process.env["APPLE_CLIENT_ID"]  ?? "";
const APPLE_TEAM_ID    = process.env["APPLE_TEAM_ID"]    ?? "";
const APPLE_KEY_ID     = process.env["APPLE_KEY_ID"]     ?? "";
const APPLE_PRIVATE_KEY = process.env["APPLE_PRIVATE_KEY"] ?? "";
const JWT_SECRET       = process.env["JWT_SECRET"] ?? "";

const APPLE_JWKS_URL = new URL("https://appleid.apple.com/auth/keys");
const appleJWKS = createRemoteJWKSet(APPLE_JWKS_URL);

function isConfigured(): boolean {
  return !!(APPLE_CLIENT_ID && APPLE_TEAM_ID && APPLE_KEY_ID && APPLE_PRIVATE_KEY);
}

function getCallbackUrl(req: Request): string {
  const host = process.env["REPLIT_DEV_DOMAIN"]
    ? `https://${process.env["REPLIT_DEV_DOMAIN"]}`
    : `${req.protocol}://${req.get("host")}`;
  return `${host}/api/auth/apple/callback`;
}

function getFrontendUrl(req: Request): string {
  return process.env["REPLIT_DEV_DOMAIN"]
    ? `https://${process.env["REPLIT_DEV_DOMAIN"]}`
    : `${req.protocol}://${req.get("host")}`;
}

async function makeClientSecret(callbackUrl: string): Promise<string> {
  const { SignJWT, importPKCS8 } = await import("jose");
  const privateKey = await importPKCS8(APPLE_PRIVATE_KEY.replace(/\\n/g, "\n"), "ES256");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: APPLE_KEY_ID })
    .setIssuer(APPLE_TEAM_ID)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .setAudience("https://appleid.apple.com")
    .setSubject(APPLE_CLIENT_ID)
    .sign(privateKey);
}

const router: IRouter = Router();

router.get("/auth/apple", (req: Request, res: Response): void => {
  if (!isConfigured()) {
    res.status(503).json({ error: "Apple Sign-In is not configured. Set APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, and APPLE_PRIVATE_KEY." });
    return;
  }
  const redirectUri = getCallbackUrl(req);
  const state = Buffer.from(JSON.stringify({ ts: Date.now() })).toString("base64url");
  const params = new URLSearchParams({
    client_id: APPLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code id_token",
    response_mode: "form_post",
    scope: "name email",
    state,
  });
  res.redirect(`https://appleid.apple.com/auth/authorize?${params.toString()}`);
});

router.post("/auth/apple/callback", async (req: Request, res: Response): Promise<void> => {
  const frontendUrl = getFrontendUrl(req);

  try {
    const { code, id_token, user: userJson, error: appleError } = req.body as {
      code?: string;
      id_token?: string;
      user?: string;
      error?: string;
    };

    if (appleError || !id_token) {
      res.redirect(`${frontendUrl}/auth/signin?error=apple_cancelled`);
      return;
    }

    // Verify the id_token with Apple's public keys
    const { payload } = await jwtVerify(id_token, appleJWKS, {
      issuer: "https://appleid.apple.com",
      audience: APPLE_CLIENT_ID,
    });

    const appleId = payload["sub"] as string;
    const email   = (payload["email"] as string | undefined) ?? "";

    // Apple only sends name on the very first authorization
    let name = "Apple User";
    if (userJson) {
      try {
        const parsed = JSON.parse(userJson) as { name?: { firstName?: string; lastName?: string } };
        const fn = parsed.name?.firstName ?? "";
        const ln = parsed.name?.lastName  ?? "";
        const full = `${fn} ${ln}`.trim();
        if (full) name = full;
      } catch { /* ignore */ }
    }

    // Find or create the user
    const existing = await db.select().from(usersTable).where(
      or(eq(usersTable.appleId, appleId), ...(email ? [eq(usersTable.email, email.toLowerCase())] : []))
    );

    let user = existing[0];
    if (user) {
      // Link Apple ID if not yet linked
      if (!user.appleId) {
        const [updated] = await db.update(usersTable)
          .set({ appleId })
          .where(eq(usersTable.id, user.id))
          .returning();
        user = updated!;
      }
    } else {
      const [created] = await db.insert(usersTable).values({
        email: email.toLowerCase() || `apple_${appleId}@noemail.tradelab`,
        name,
        passwordHash: `oauth:apple`,
        appleId,
      }).returning();
      user = created!;
    }

    if (user.banned) {
      res.redirect(`${frontendUrl}/auth/apple-success?error=account_banned`);
      return;
    }

    const token = signJwt({ id: user.id, email: user.email }, JWT_SECRET);
    const userParam = encodeURIComponent(JSON.stringify({ id: user.id, email: user.email, name: user.name }));
    res.redirect(`${frontendUrl}/auth/apple-success?token=${encodeURIComponent(token)}&user=${userParam}`);
  } catch (err) {
    console.error("Apple OAuth error:", err);
    res.redirect(`${frontendUrl}/auth/signin?error=${encodeURIComponent("Apple sign-in failed. Please try again.")}`);
  }
});

export default router;
