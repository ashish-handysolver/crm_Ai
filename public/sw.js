self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});

importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyCDMYbu604E083IyEBE__U6KX4I2YaovQA",
  authDomain: "handydash-75858.firebaseapp.com",
  databaseURL: "https://handydash-75858.firebaseio.com",
  projectId: "handydash-75858",
  storageBucket: "handydash-75858.appspot.com",
  messagingSenderId: "18967278229",
  appId: "1:18967278229:web:eedb13d46173cf05b4619c"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[sw.js] Received background message ', payload);
  
  if (payload.notification) {
    console.log('[sw.js] Notification handled automatically by Firebase.');
    return;
  }

  const notificationTitle = payload.data?.title || 'HandyCRM';
  const notificationOptions = {
    body: payload.data?.body || 'You have a new update.',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: payload.data?.tag,
    data: {
      url: payload.data?.url || '/',
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

const CACHE_NAME = 'handycrm-v2'; // Increment version for fresh start

// Assets that must be available offline for the shell to load
const IMMUTABLE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/outage.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Pre-caching critical assets');
      return cache.addAll(IMMUTABLE_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('SW: Purging old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Responding to fetches with a Network-First strategy
self.addEventListener('fetch', (event) => {
  // We only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  
  // Only handle standard HTTP and HTTPS schemes to avoid errors with extensions (chrome-extension://)
  if (!(url.protocol === 'http:' || url.protocol === 'https:')) return;

  // For navigation requests (like reloading the page or entering the URL)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html') || caches.match('/outage.html');
      })
    );
    return;
  }

  // Strategy: Network first, then fall back to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If the request was successful, clone it and put it in the cache
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // If network fails, try the cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          
          // If even cache fails and it's an image, we could return a placeholder
          // But for scripts/styles, we just fail and let the main.tsx recovery handle it
          return new Response('Offline resource unavailable', { 
            status: 503, 
            statusText: 'Service Unavailable' 
          });
        });
      })
  );
});
