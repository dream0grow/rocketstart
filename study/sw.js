// sw.js — 서비스워커 (오프라인 실행)
// 앱을 이루는 파일들을 미리 저장해 두어, 인터넷이 없어도 앱이 열리게 합니다.
// 앱 코드를 바꾸면 아래 CACHE 버전을 올려주세요(예: v1 → v2). 그래야 새 파일을 받아옵니다.

const CACHE = "study-v3";

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/store.js",
  "./js/wakelock.js",
  "./js/beep.js",
  "./js/timer.js",
  "./js/progress.js",
  "./js/calendar.js",
  "./js/settings.js",
  "./js/app.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

// 설치: 앱 파일을 캐시에 저장
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

// 활성화: 예전 버전 캐시 정리
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 요청: 캐시에 있으면 캐시로, 없으면 네트워크로 (캐시 우선)
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request))
  );
});
