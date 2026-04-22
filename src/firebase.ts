import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCDMYbu604E083IyEBE__U6KX4I2YaovQA",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "handydash-75858.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://handydash-75858.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "handydash-75858",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "handydash-75858.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "18967278229",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:18967278229:web:eedb13d46173cf05b4619c"
};

const app = initializeApp(firebaseConfig);
const isLocalDev =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// Firestore persistent IndexedDB cache can become unstable in local multi-tab dev.
// Use memory cache on localhost to avoid internal assertion loops, and keep
// persistent cache for deployed environments.
export const db = initializeFirestore(app, {
  localCache: isLocalDev
    ? memoryLocalCache()
    : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  experimentalForceLongPolling: true
}, 'handydash-firestore');


export const auth = getAuth();
export const storage = getStorage(app);
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

