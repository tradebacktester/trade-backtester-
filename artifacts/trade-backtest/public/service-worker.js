const CACHE_NAME = "trade-lab-v3";
const API_CACHE_NAME = "trade-lab-api-v3";

const PRECACHE_ASSETS = [
  "/",
  "/manifest.json",
  "/favicon.svg",
  "/logo.png",
  "/icon-192.png",
  "/icon-512.png",
  "/opengraph.jpg",
];

// ── Install — pre-cache the app shell ────────────────────────────────────────
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

  // Hashed Vite assets (/assets/index-abc123.js) — cache first forever
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

  // Everything else (HTML, icons, manifest) — stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
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
    return new Response(
      JSON.stringify({ error: "You are offline. Cached data unavailable." }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  // Return cached immediately if available, otherwise wait for network
  if (cached) {
    fetchPromise; // revalidate in background
    return cached;
  }

  const networkResponse = await fetchPromise;
  if (networkResponse) return networkResponse;

  // Final fallback — return the cached root index.html for SPA navigation
  return cache.match("/") ?? new Response("Offline", { status: 503 });
}
