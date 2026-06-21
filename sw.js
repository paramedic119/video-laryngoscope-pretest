/*
 * sw.js — Service Worker（オフライン対応・ホーム画面アプリ化）
 * 方式: stale-while-revalidate
 *   表示は即キャッシュから（速い・オフラインOK）、裏で最新を取得して次回に反映。
 * アプリを更新したら下の CACHE のバージョン（v1, v2 …）を上げると確実に入れ替わる。
 */
const CACHE = "vlr-pretest-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./questions.js",
  "./srs.js",
  "./storage.js",
  "./app.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./favicon-32.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req).then(function (cached) {
        var network = fetch(req).then(function (res) {
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        }).catch(function () {
          return cached || cache.match("./index.html");
        });
        return cached || network;
      });
    })
  );
});
