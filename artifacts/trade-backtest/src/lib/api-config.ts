/**
 * Central API configuration.
 *
 * In development (Replit): VITE_API_BASE_URL is not set → API_BASE = "" → all
 * fetch calls resolve relative to the same origin (Express serves both).
 *
 * In production (Vercel + Railway): set VITE_API_BASE_URL to your Railway
 * backend URL (e.g. https://my-app.up.railway.app) in Vercel env vars.
 */
export const API_BASE =
  ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "").replace(/\/$/, "");

/** Fully-qualified /api prefix — use this for all fetch calls */
export const API = `${API_BASE}/api`;
