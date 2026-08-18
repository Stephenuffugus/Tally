/* Tally service worker — installability. NETWORK-FIRST (Sky Wolf house rule). */
var CACHE = "tally-v1";
/* Only ever delete caches that belong to THIS app. `caches` is shared by the
   whole origin, so an unfiltered sweep deletes every sibling app's cache too. */
var OWNED = /^tally\-/;
self.addEventListener("install", function (e) { e.waitUntil(self.skipWaiting()); });
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return (k === CACHE || !OWNED.test(k)) ? null : caches["delete"](k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request; if (req.method !== "GET") return;
  if (req.url.indexOf(self.location.origin) !== 0) return;   // never intercept the streamed soundtrack
  e.respondWith(fetch(req).then(function (res) {
    if (res && res.status === 200 && res.type === "basic") {
      var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); });
    }
    return res;
  })["catch"](function () { return caches.match(req, { ignoreSearch: true }); }));
});
