const CACHE_NAME = "sprint-wrapped-v2";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./script.js",
  "./assets/bass-persuades.mp3",
  "./assets/little-things-gypsy-woman.mp3",
  "./assets/last-train-home.mp3",
  "./assets/we-are-the-people.mp3",
  "./assets/cover-bass-persuades.jpg",
  "./assets/cover-little-things.jpg",
  "./assets/cover-last-train-home.jpg",
  "./assets/cover-we-are-the-people.jpg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(CORE_ASSETS.map((asset) => cache.add(asset))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function rangeResponse(request) {
  const range = request.headers.get("range");
  const match = /bytes=(\d+)-(\d*)/.exec(range || "");
  if (!match) return fetch(request);

  const cache = await caches.open(CACHE_NAME);
  const plainRequest = new Request(request.url, { method: "GET" });
  let response = await cache.match(plainRequest);
  if (!response) {
    response = await fetch(plainRequest);
    if (response.ok) await cache.put(plainRequest, response.clone());
  }
  if (!response || !response.ok) return fetch(request);

  const buffer = await response.arrayBuffer();
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : buffer.byteLength - 1;
  const end = Math.min(requestedEnd, buffer.byteLength - 1);
  const chunk = buffer.slice(start, end + 1);

  return new Response(chunk, {
    status: 206,
    statusText: "Partial Content",
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Length": String(chunk.byteLength),
      "Content-Range": `bytes ${start}-${end}/${buffer.byteLength}`,
      "Content-Type": response.headers.get("Content-Type") || "audio/mpeg"
    }
  });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  if (request.headers.has("range")) {
    event.respondWith(rangeResponse(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    }))
  );
});
