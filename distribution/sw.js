// Maintainer map: update CORE_ASSETS when a new file must be available offline.
// build.ps1 replaces CACHE_NAME with a fresh build timestamp on each build.
const CACHE_NAME = "sentinel-planner-v1-20261126-182518";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./JTF_Sentinel_Planner_v1.html",
  "./pay-data.js",
  "./assets/DOCCS_SAD_Leave_Request_Form.pdf",
  "./manifest.json",
  "./sw.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const reqUrl = new URL(event.request.url);
  if (reqUrl.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const networkResponse = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkResponse;
    })
  );
});
