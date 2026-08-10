const CACHE_NAME = "field-atlas-shell-v2";
const OFFLINE_ASSETS = ["/", "/my-maps", "/offline.html", "/icon.svg"];

async function cacheSuccessfulResponse(request, response) {
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => cacheSuccessfulResponse(event.request, response))
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match(event.request)) ?? (await cache.match("/offline.html"));
        }),
    );
    return;
  }

  if (["font", "image", "manifest", "script", "style"].includes(event.request.destination)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const network = fetch(event.request)
          .then((response) => cacheSuccessfulResponse(event.request, response))
          .catch((error) => {
            if (cached) {
              return cached;
            }
            throw error;
          });
        return cached ?? network;
      }),
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_ROUTE" || typeof event.data.path !== "string") {
    return;
  }

  const routeUrl = new URL(event.data.path, self.location.origin);
  if (routeUrl.origin !== self.location.origin) {
    return;
  }

  event.waitUntil(
    fetch(routeUrl, { credentials: "same-origin" })
      .then((response) => cacheSuccessfulResponse(routeUrl.pathname, response))
      .catch(() => undefined),
  );
});
