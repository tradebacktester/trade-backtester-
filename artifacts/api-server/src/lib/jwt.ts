import { createHmac, timingSafeEqual } from "crypto";

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export interface JwtPayload {
  id: number;
  email: string;
  iat: number;
  exp: number;
  [key: string]: unknown;
}

// ── JWT key versioning (S-18) ────────────────────────────────────────────────
// Supports zero-downtime secret rotation:
//   1. Set JWT_SECRET_V2 to the new secret — new tokens are signed with v2.
//   2. Keep JWT_SECRET (v1) set — old tokens continue to verify until they expire.
//   3. Once all v1 tokens have expired (30 days), remove JWT_SECRET.
//
// Key selection:
//   Signing  : JWT_SECRET_V2 if set, else JWT_SECRET
//   Verifying: tries the kid embedded in the token header; falls back to both.

function getSigningSecret(): { secret: string; kid: string } {
  const v2 = process.env["JWT_SECRET_V2"];
  if (v2) return { secret: v2, kid: "v2" };
  return { secret: process.env["JWT_SECRET"] ?? "", kid: "v1" };
}

function getVerifySecrets(): Map<string, string> {
  const m = new Map<string, string>();
  if (process.env["JWT_SECRET"])    m.set("v1", process.env["JWT_SECRET"]);
  if (process.env["JWT_SECRET_V2"]) m.set("v2", process.env["JWT_SECRET_V2"]);
  return m;
}

export function signJwt(
  payload: { id: number; email: string },
  _secret: string,
  expiresInSeconds = 30 * 24 * 3600,
): string {
  const { secret, kid } = getSigningSecret();
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT", kid }));
  const now = Math.floor(Date.now() / 1000);
  const body = b64url(
    JSON.stringify({ ...payload, iat: now, exp: now + expiresInSeconds }),
  );
  const data = `${header}.${body}`;
  const sig = b64url(createHmac("sha256", secret).update(data).digest());
  return `${data}.${sig}`;
}

export function verifyJwt(token: string, _secret: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts as [string, string, string];

    // Decode header to find kid; fall back to trying all known keys
    let kid: string | undefined;
    try {
      const h = JSON.parse(Buffer.from(header, "base64url").toString()) as Record<string, unknown>;
      if (typeof h["kid"] === "string") kid = h["kid"];
    } catch { /* ignore */ }

    const secrets = getVerifySecrets();
    // If kid is known, only try that secret; otherwise try all
    const candidates = kid && secrets.has(kid)
      ? [[kid, secrets.get(kid)!] as [string, string]]
      : [...secrets.entries()];

    let verified = false;
    for (const [, secret] of candidates) {
      if (!secret) continue;
      const expected = b64url(
        createHmac("sha256", secret).update(`${header}.${body}`).digest(),
      );
      try {
        if (
          sig.length === expected.length &&
          timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
        ) {
          verified = true;
          break;
        }
      } catch { /* continue */ }
    }

    if (!verified) return null;

    const decoded = JSON.parse(
      Buffer.from(body, "base64url").toString(),
    ) as JwtPayload;
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}
