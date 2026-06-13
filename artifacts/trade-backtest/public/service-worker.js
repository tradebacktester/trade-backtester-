const CACHE_NAME = "trade-lab-v5";
const API_CACHE_NAME = "trade-lab-api-v5";
const OFFLINE_URL = "/offline.html";

const PRECACHE_ASSETS = [
  "/manifest.json",
  "/favicon.svg",
  "/logo.png",
  "/icon-192.png",
  "/icon-512.png",
  "/opengraph.jpg",
  "/offline.html",
];

// ── Install — pre-cache static assets including offline page ──────────────────
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

  // Hashed Vite assets — cache first forever (content-hashed filenames)
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

  // HTML navigation — network first, offline page fallback
  if (request.mode === "navigate") {
    event.respondWith(navigateWithOfflineFallback(request));
    return;
  }

  // Everything else — network first, then cache
  event.respondWith(networkFirstThenCache(request, CACHE_NAME));
});

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {
    title: "Trade Lab",
    body: "You have a new notification.",
    icon: "/icon-192.png",
    badge: "/icon-96.png",
    url: "/",
    tag: "trade-lab-notification",
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      data: { url: data.url },
      vibrate: [200, 100, 200],
      actions: [
        { action: "open", title: "Open Trade Lab" },
        { action: "dismiss", title: "Dismiss" },
      ],
    }),
  );
});

// ── Notification Click ────────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const targetUrl = event.notification.data?.url ?? "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) return clients.openWindow(targetUrl);
      }),
  );
});

// ── Notification Close ────────────────────────────────────────────────────────
self.addEventListener("notificationclose", (_event) => {
  // Analytics hook — extend here if needed
});

// ── Background Sync ───────────────────────────────────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-trades") {
    event.waitUntil(syncPendingTrades());
  }
  if (event.tag === "sync-journal") {
    event.waitUntil(syncPendingJournal());
  }
});

async function syncPendingTrades() {
  try {
    const db = await openSyncDb();
    const pending = await getAllPending(db, "pendingTrades");
    for (const item of pending) {
      const res = await fetch("/api/paper/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${item.token}` },
        body: JSON.stringify(item.payload),
      });
      if (res.ok) await deletePending(db, "pendingTrades", item.id);
    }
  } catch {
    // Will retry on next sync opportunity
  }
}

async function syncPendingJournal() {
  try {
    const db = await openSyncDb();
    const pending = await getAllPending(db, "pendingJournal");
    for (const item of pending) {
      const res = await fetch(item.url, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${item.token}` },
        body: JSON.stringify(item.payload),
      });
      if (res.ok) await deletePending(db, "pendingJournal", item.id);
    }
  } catch {
    // Will retry on next sync opportunity
  }
}

// ── Periodic Background Sync ──────────────────────────────────────────────────
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "refresh-markets") {
    event.waitUntil(refreshMarketCache());
  }
  if (event.tag === "check-alerts") {
    event.waitUntil(checkAndNotifyAlerts());
  }
});

async function refreshMarketCache() {
  try {
    const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
    const cache = await caches.open(API_CACHE_NAME);
    await Promise.all(
      symbols.map((s) =>
        fetch(`/api/klines?symbol=${s}&interval=1d&limit=1`)
          .then((r) => r.ok && cache.put(`/api/klines?symbol=${s}&interval=1d&limit=1`, r))
          .catch(() => {}),
      ),
    );
  } catch {
    // Silent fail — periodic sync will retry
  }
}

async function checkAndNotifyAlerts() {
  try {
    const token = await getStoredToken();
    if (!token) return;
    const res = await fetch("/api/alerts/triggered", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const { alerts } = await res.json().catch(() => ({ alerts: [] }));
    for (const alert of (alerts ?? []).slice(0, 3)) {
      await self.registration.showNotification("Trade Lab Alert", {
        body: alert.message ?? `Alert triggered for ${alert.symbol}`,
        icon: "/icon-192.png",
        badge: "/icon-96.png",
        tag: `alert-${alert.id}`,
        data: { url: "/chart" },
      });
    }
  } catch {
    // Silent fail
  }
}

// ── Message from app ──────────────────────────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data?.type === "STORE_TOKEN") {
    storeToken(event.data.token).catch(() => {});
  }
  if (event.data?.type === "CLEAR_API_CACHE") {
    caches.delete(API_CACHE_NAME).catch(() => {});
  }
});

// ── Cache Strategies ──────────────────────────────────────────────────────────

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

async function navigateWithOfflineFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
      return response;
    }
    return response;
  } catch {
    // Try cached version of the exact page
    const cached = await caches.match(request);
    if (cached) return cached;
    // Try cached index.html (SPA shell)
    const shell = await caches.match("/");
    if (shell) return shell;
    // Last resort: offline page
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response("<h1>Offline</h1>", {
      status: 503,
      headers: { "Content-Type": "text/html" },
    });
  }
}

// ── IndexedDB helpers for sync queue & token storage ─────────────────────────

function openSyncDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("trade-lab-sync", 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("pendingTrades"))
        db.createObjectStore("pendingTrades", { keyPath: "id", autoIncrement: true });
      if (!db.objectStoreNames.contains("pendingJournal"))
        db.createObjectStore("pendingJournal", { keyPath: "id", autoIncrement: true });
      if (!db.objectStoreNames.contains("meta"))
        db.createObjectStore("meta", { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllPending(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

function deletePending(db, storeName, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const req = tx.objectStore(storeName).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function storeToken(token) {
  const db = await openSyncDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("meta", "readwrite");
    const req = tx.objectStore("meta").put({ key: "authToken", value: token });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getStoredToken() {
  try {
    const db = await openSyncDb();
    return new Promise((resolve) => {
      const tx = db.transaction("meta", "readonly");
      const req = tx.objectStore("meta").get("authToken");
      req.onsuccess = () => resolve(req.result?.value ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}
