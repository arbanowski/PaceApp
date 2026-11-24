/* Pace Anzeige: Offline-Cache.
   Strategie: sofort aus dem Cache antworten, im Hintergrund vom Server auffrischen.
   Eine neue index.html auf dem Server wird dadurch beim übernächsten Start sichtbar. */
var CACHE = 'pace-anzeige-v1';

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // Einzeln und fehlertolerant, damit ein fehlender Pfad die Installation nicht verhindert
      return Promise.all(['./', 'index.html'].map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE && key.indexOf('pace-anzeige-') === 0) return caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === new URL('sw.js', self.registration.scope).pathname) return;

  event.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req, { ignoreSearch: true }).then(function (cached) {
        var fresh = fetch(req, { cache: 'no-cache' }).then(function (res) {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        });
        if (cached) {
          event.waitUntil(fresh.catch(function () {}));
          return cached;
        }
        return fresh.catch(function () {
          // Offline und nicht im Cache: bei Seitenaufrufen die gespeicherte Startseite liefern
          if (req.mode === 'navigate') {
            return cache.match('index.html').then(function (r) { return r || cache.match('./'); });
          }
          return Response.error();
        });
      });
    })
  );
});
