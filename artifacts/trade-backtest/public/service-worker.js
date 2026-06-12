const CACHE_NAME = "trade-lab-v4";
const API_CACHE_NAME = "trade-lab-api-v4";

// Do NOT pre-cache "/" — the HTML shell changes on every deployment.
// Pre-caching it causes stale HTML to be served which references old
// asset filenames, breaking the app after updates.
const PRECACHE_ASSETS = [
  "/manifest.json",
  "/favicon.svg",
  "/logo.png",
  "/icon-192.png",
  "/icon-512.png",
  "/opengraph.jpg",
];

// ── Install — pre-cache static assets (not HTML) ──────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

// ── Activate — delete old caches ─────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME && k !== API_CACHE_NAME)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests on our own origin
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // API routes — network first, fall back to cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstThenCache(request, API_CACHE_NAME));
    return;
  }

  // Hashed Vite assets (/assets/index-abc123.js) — cache first forever.
  // These are safe to cache forever because Vite content-hashes the filenames:
  // any change produces a NEW filename, so stale cache entries are harmless.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }

  // Google Fonts — cache first
  if (
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com"
  ) {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }

  // HTML navigation and everything else — network first, fall back to cache.
  // Using network-first (not stale-while-revalidate) for HTML ensures users
  // always load the latest index.html with correct asset filename references.
  // Stale HTML would cause the app to load old JS bundles indefinitely.
  event.respondWith(networkFirstThenCache(request, CACHE_NAME));
});

// ── Strategies ────────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstThenCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // SPA fallback: for navigation requests return the cached HTML shell
    const isSpaNav = request.mode === "navigate";
    if (isSpaNav) {
      const shell = await caches.match("/");
      if (shell) return shell;
    }
    return new Response(
      JSON.stringify({ error: "You are offline. Cached data unavailable." }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }
}
