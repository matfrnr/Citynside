const SHELL_CACHE = "citynside-pwa-shell-v1";
const ASSET_CACHE = "citynside-pwa-assets-v1";
const APP_SHELL = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/logo-citynside.svg",
  "/apple-touch-icon.png",
  "/pwa-192.png",
  "/pwa-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith("citynside-pwa-") && ![SHELL_CACHE, ASSET_CACHE].includes(key))
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  const url = new URL(request.url);
  // Ne jamais mettre en cache les API ou les routes de données/authentification.
  if (/^\/(api|auth|rest|storage|functions)(\/|$)/.test(url.pathname)) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        void caches.open(SHELL_CACHE).then((cache) => cache.put("/index.html", copy));
      }
      return response;
    }).catch(async () => (await caches.match("/index.html")) || (await caches.match("/offline.html"))));
    return;
  }

  if (!/\.(?:js|css|png|svg|webmanifest|woff2?)$/i.test(url.pathname)) return;
  event.respondWith(caches.open(ASSET_CACHE).then(async (cache) => {
    const cached = await cache.match(request);
    const network = fetch(request).then((response) => {
      if (response.ok) void cache.put(request, response.clone());
      return response;
    }).catch((error) => {
      if (cached) return cached;
      throw error;
    });
    return cached || network;
  }));
});
