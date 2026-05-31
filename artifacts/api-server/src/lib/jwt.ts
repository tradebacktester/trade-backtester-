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

export function signJwt(
  payload: { id: number; email: string },
  secret: string,
  expiresInSeconds = 30 * 24 * 3600,
): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const body = b64url(
    JSON.stringify({ ...payload, iat: now, exp: now + expiresInSeconds }),
  );
  const data = `${header}.${body}`;
  const sig = b64url(createHmac("sha256", secret).update(data).digest());
  return `${data}.${sig}`;
}

export function verifyJwt(token: string, secret: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts as [string, string, string];
    const expected = b64url(
      createHmac("sha256", secret).update(`${header}.${body}`).digest(),
    );
    if (
      sig.length !== expected.length ||
      !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      return null;
    }
    const decoded = JSON.parse(
      Buffer.from(body, "base64url").toString(),
    ) as JwtPayload;
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}
