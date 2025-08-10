// File: sw.js
// Phiên bản: 5.2

const CACHE_NAME = 'ttp-ai-glass-interface-v1.0'; // Đổi tên cache

const APP_SHELL_URLS = [
  '/dashboard',
  '/script.js',
  '/particles.js', // Cache file cục bộ
  '/ttp-ai.js', // Loại bỏ file này
  '/style.css',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Share+Tech+Mono&display=swap' // Cập nhật font
];

self.addEventListener('install', event => {
  console.log('[Service Worker] Đang cài đặt...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[Service Worker] Đang lưu cache cho bộ vỏ ứng dụng...');
      return cache.addAll(APP_SHELL_URLS);
    })
  );
});

self.addEventListener('activate', event => {
  console.log('[Service Worker] Đang kích hoạt...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Đang xóa cache cũ:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});