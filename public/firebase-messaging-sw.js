importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

let initializedMessaging = false;

const fallbackFirebaseConfig = {
  apiKey: 'AIzaSyCDMYbu604E083IyEBE__U6KX4I2YaovQA',
  authDomain: 'handydash-75858.firebaseapp.com',
  databaseURL: 'https://handydash-75858.firebaseio.com',
  projectId: 'handydash-75858',
  storageBucket: 'handydash-75858.appspot.com',
  messagingSenderId: '18967278229',
  appId: '1:18967278229:web:eedb13d46173cf05b4619c'
};

const ensureMessaging = async () => {
  if (initializedMessaging) return;

  let firebaseConfig = fallbackFirebaseConfig;

  try {
    const response = await fetch('/api/push/config', { cache: 'no-store' });
    if (response.ok) {
      const config = await response.json();
      if (config?.firebase?.projectId) {
        firebaseConfig = config.firebase;
      }
    }
  } catch (error) {
    console.warn('[firebase-messaging-sw.js] Falling back to embedded Firebase config.', error);
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification?.title || payload.data?.title || 'HandyCRM';
    const notificationOptions = {
      body: payload.notification?.body || payload.data?.body || 'You have a new update.',
      icon: '/logo.png',
      badge: '/logo.png',
      tag: payload.data?.tag,
      data: {
        url: payload.data?.url || '/',
      }
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });

  initializedMessaging = true;
};

void ensureMessaging();

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
