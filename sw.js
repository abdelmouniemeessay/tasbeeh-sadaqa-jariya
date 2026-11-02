/* =========================================================
   تسبيح — صدقة جارية
   Service worker: app shell + offline fallback
   ========================================================= */
"use strict";

const VERSION = "2.0.0";
const CACHE_NAME = "tasbeeh-static-v" + VERSION;

const PRECACHE = [
  "./",
  "./index.html",
  "./404.html",
  "./offline.html",
  "./manifest.webmanifest",

  "./pages/duas.html",
  "./pages/quran.html",
  "./pages/tasbeeh.html",
  "./pages/adhkar.html",
  "./pages/charity.html",
  "./pages/sadaqa.html",
  "./pages/help.html",
  "./pages/editor.html",
  "./pages/about.html",

  "./assets/css/base.css",
  "./assets/css/components.css",
  "./assets/css/pages.css",
  "./assets/css/tools.css",
  "./assets/css/responsive.css",
  "./assets/css/v2.css",

  "./assets/js/app.js",
  "./assets/js/share.js",
  "./assets/js/home.js",
  "./assets/js/tasbeeh.js",
  "./assets/js/duas.js",
  "./assets/js/quran.js",
  "./assets/js/adhkar.js",
  "./assets/js/charity.js",
  "./assets/js/sadaqa.js",
  "./assets/js/help.js",
  "./assets/js/editor.js",
  "./assets/js/vendor/qrcode.js",

  "./data/duas.json",
  "./data/quran.json",
  "./data/adhkar.json",
  "./data/charity.json",
  "./data/tasbeeh.json",
  "./data/site.json",

  "./assets/fonts/amiri-arabic-400.woff2",
  "./assets/fonts/amiri-arabic-700.woff2",
  "./assets/fonts/ibm-plex-sans-arabic-300.woff2",
  "./assets/fonts/ibm-plex-sans-arabic-400.woff2",
  "./assets/fonts/ibm-plex-sans-arabic-500.woff2",
  "./assets/fonts/ibm-plex-sans-arabic-600.woff2",
  "./assets/fonts/ibm-plex-sans-arabic-700.woff2",
  "./assets/fonts/ibm-plex-sans-arabic-latin-300.woff2",
  "./assets/fonts/ibm-plex-sans-arabic-latin-400.woff2",
  "./assets/fonts/ibm-plex-sans-arabic-latin-500.woff2",
  "./assets/fonts/ibm-plex-sans-arabic-latin-600.woff2",
  "./assets/fonts/ibm-plex-sans-arabic-latin-700.woff2",
  "./assets/fonts/noto-naskh-arabic-400.woff2",
  "./assets/fonts/noto-naskh-arabic-600.woff2",
  "./assets/fonts/noto-naskh-arabic-700.woff2",

  "./assets/icons.svg",
  "./assets/images/favicon.svg",
  "./assets/images/pattern-star.svg",
  "./assets/images/mihrab.svg",
  "./assets/images/og-cover.png",
  "./assets/images/icon-192.png",
  "./assets/images/icon-512.png",
  "./assets/images/icon-maskable-512.png",
  "./assets/images/apple-touch-icon.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(PRECACHE); })
      .catch(function () {
        /* Do not block installation if one optional asset is missing. */
      })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE_NAME && key.indexOf("tasbeeh-static-") === 0) return caches.delete(key);
        return null;
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

function cachePut(request, response) {
  if (!response || !response.ok || response.type === "opaque") return response;
  const copy = response.clone();
  caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
  return response;
}

self.addEventListener("fetch", function (event) {
  const request = event.request;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch (error) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          cachePut(request, response);
          return response;
        })
        .catch(function () {
          return caches.match(request, { ignoreSearch: true })
            .then(function (cached) {
              if (cached) return cached;
              return caches.match("./offline.html");
            });
        })
    );
    return;
  }

  if (/\.json$/i.test(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then(function (response) { return cachePut(request, response); })
        .catch(function () { return caches.match(request, { ignoreSearch: true }); })
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) { return cachePut(request, response); });
    })
  );
});
