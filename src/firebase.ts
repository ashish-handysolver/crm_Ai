import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyCDMYbu604E083IyEBE__U6KX4I2YaovQA",
  authDomain: "handydash-75858.firebaseapp.com",
  databaseURL: "https://handydash-75858.firebaseio.com",
  projectId: "handydash-75858",
  storageBucket: "handydash-75858.appspot.com",
  messagingSenderId: "18967278229",
  appId: "1:18967278229:web:eedb13d46173cf05b4619c"
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

