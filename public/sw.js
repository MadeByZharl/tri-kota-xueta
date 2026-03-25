const CACHE_NAME = 'hockey-game-v2';

// Мы не можем точно знать имена файлов в /assets/ из-за хешей Vite,
// поэтому будем кэшировать их динамически при первом запросе.
const STATIC_ASSETS = [
  '/',
  '/index.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Кэшируем все запросы к HockeyAssets и assets (Vite)
  const isAsset = event.request.url.includes('HockeyAssets') || 
                  event.request.url.includes('/assets/') ||
                  event.request.url.endsWith('.js') ||
                  event.request.url.endsWith('.css');

  if (isAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((response) => {
          // Проверяем, что ответ корректный
          if (!response || response.status !== 200 || response.type !== 'basic') {
            // Для внешних ресурсов или ошибок просто возвращаем ответ
            if (event.request.url.includes('HockeyAssets')) {
               // Но HockeyAssets мы все равно хотим закэшировать, если это возможно
               const responseToCache = response.clone();
               caches.open(CACHE_NAME).then((cache) => {
                 cache.put(event.request, responseToCache);
               });
            }
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        });
      })
    );
  } else {
    // Для остальных запросов (API и т.д.) используем обычный fetch
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});
