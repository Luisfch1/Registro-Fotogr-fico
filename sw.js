// sw.js
// IMPORTANTE: cada vez que quieras forzar que el celular actualice SÍ o SÍ,
// cambia esta versión (v3, v4, etc.)
const CACHE_VERSION = "v5";
const CACHE = `rf-cache-${CACHE_VERSION}`;

// Archivos propios que sí vale la pena cachear "app shell"
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",

  "./favicon.png",
  "./apple-touch-icon.png",

  "./icon-192.png",
  "./icon-512.png",
  "./icon-192-maskable.png",
  "./icon-512-maskable.png"
];

// Permite que el botón "Actualizar app" haga efecto
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Borra caches viejos
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith("rf-cache-") && k !== CACHE)
        .map((k) => caches.delete(k))
    );

    // Toma control del cliente
    await self.clients.claim();
  })());
});

// Estrategia:
// - Para navegación (index): network-first (así siempre intenta traer lo nuevo)
// - Para assets del mismo origen: cache-first con fallback a red
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo manejamos lo del mismo origen
  if (url.origin !== self.location.origin) return;

  // Navegación (abrir la app / rutas)
  const isNav = req.mode === "navigate";

  if (isNav) {
    event.respondWith((async () => {
      try {
        // Intenta traer la versión nueva
        const fresh = await fetch(req);
        // Actualiza cache con lo que llegó
        const cache = await caches.open(CACHE);
        cache.put("./index.html", fresh.clone());
        return fresh;
      } catch (e) {
        // Si no hay red, usa cache
        const cached = await caches.match("./index.html");
        return cached || caches.match("./") || Response.error();
      }
    })());
    return;
  }

  // Assets (css/js/icons/manifest, etc.)
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const fresh = await fetch(req);
      const cache = await caches.open(CACHE);
      cache.put(req, fresh.clone());
      return fresh;
    } catch (e) {
      // Sin red y sin cache
      return Response.error();
    }
  })());
});

