/**
 * LinkPilot's service worker. It does exactly one thing: when a page can't be loaded because the
 * connection is down, it shows LinkPilot's own offline screen (/offline.html) instead of the
 * browser's.
 *
 * It deliberately caches nothing else. Every page, script, style and API call goes straight to the
 * network exactly as it would without a service worker, so a new deploy is never hidden behind an
 * old copy and no saved answer can ever be shown as if it were current. Only page loads are even
 * looked at, and only their failure is handled.
 *
 * Change OFFLINE_CACHE's version whenever offline.html changes, so installed apps pick it up.
 */

const OFFLINE_CACHE = "linkpilot-offline-v1"
const OFFLINE_URL = "/offline.html"

self.addEventListener("install", (event) => {
  // `reload` skips the HTTP cache, so the copy kept is the one on the server now
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  // An older version's cache goes, so only one offline page is ever kept
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("linkpilot-offline-") && key !== OFFLINE_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  // Page loads only. Scripts, styles, images and every API call are left to the browser untouched
  if (event.request.mode !== "navigate") return
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(OFFLINE_URL).then((cached) => cached || new Response("You're offline.", { status: 503, headers: { "Content-Type": "text/plain" } }))
    )
  )
})
