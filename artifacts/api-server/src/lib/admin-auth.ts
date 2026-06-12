import { createHmac, timingSafeEqual } from "crypto";

function hourWindow(): number {
  return Math.floor(Date.now() / 3_600_000);
}

export function makeAdminToken(): string {
  const ADMIN_ID = process.env.ADMIN_ID ?? "";
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
  const ADMIN_ID_2 = process.env.ADMIN_ID_2 ?? "";
  const ADMIN_PASSWORD_2 = process.env.ADMIN_PASSWORD_2 ?? "";
  const HMAC_SECRET = `${ADMIN_ID}:${ADMIN_PASSWORD}:${ADMIN_ID_2}:${ADMIN_PASSWORD_2}`;
  const hw = hourWindow();
  return createHmac("sha256", HMAC_SECRET).update(`admin-session-v1:${hw}`).digest("hex");
}

export function verifyAdminToken(token: string): boolean {
  const ADMIN_ID = process.env.ADMIN_ID ?? "";
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
  const ADMIN_ID_2 = process.env.ADMIN_ID_2 ?? "";
  const ADMIN_PASSWORD_2 = process.env.ADMIN_PASSWORD_2 ?? "";
  if (!ADMIN_ID || !ADMIN_PASSWORD) return false;
  const HMAC_SECRET = `${ADMIN_ID}:${ADMIN_PASSWORD}:${ADMIN_ID_2}:${ADMIN_PASSWORD_2}`;
  const hw = hourWindow();
  for (const window of [hw, hw - 1]) {
    const expected = createHmac("sha256", HMAC_SECRET)
      .update(`admin-session-v1:${window}`)
      .digest("hex");
    try {
      if (
        token.length === expected.length &&
        timingSafeEqual(Buffer.from(token), Buffer.from(expected))
      ) {
        return true;
      }
    } catch {
      // continue to next window
    }
  }
  return false;
}
