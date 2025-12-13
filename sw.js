// sw.js (PWA) — actualizado para evitar quedarse pegado en versiones viejas

const CACHE = "rf-cache-v3"; // <-- súbele el número cuando quieras forzar update
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./favicon.png",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png"
];

// 1) Instalación: precache de assets + listo para tomar control rápido
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// 2) Activación: borrar caches viejos + tomar control
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : Promise.resolve())));
    await self.clients.claim();
  })());
});

// 3) Mensajes desde la app (para el botón "Actualizar app")
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// 4) Fetch strategy:
//    - HTML: NETWORK FIRST (si hay internet, trae lo nuevo; si no, usa cache)
//    - assets: CACHE FIRST (rápido)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo cacheamos lo propio
  if (url.origin !== self.location.origin) return;

  const isHTML =
    req.mode === "navigate" ||
    url.pathname.endsWith("/index.html") ||
    (req.headers.get("accept") || "").includes("text/html");

  // ✅ HTML: network-first
  if (isHTML) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(req) || await caches.match("./index.html");
        return cached || Response.error();
      }
    })());
    return;
  }

  // ✅ Assets: cache-first (con fallback a red y guardado)
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    const fresh = await fetch(req);
    const cache = await caches.open(CACHE);
    cache.put(req, fresh.clone());
    return fresh;
  })());
});

