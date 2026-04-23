import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { app, db } from '../firebase';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { requestNotificationPermission } from './notifications';

type PushPayload = {
  title: string;
  body: string;
  tag?: string;
  url?: string;
};

const FCM_SW_URL = '/sw.js';
const FCM_SW_SCOPE = '/';

let messagingSupportPromise: Promise<boolean> | null = null;

const isIos = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
};

const isStandaloneDisplay = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia?.('(display-mode: standalone)')?.matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
};

const getApiBaseUrl = () => {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, '');
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:3001';
  }

  const { hostname, origin, protocol } = window.location;
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';

  if (isLocalHost) {
    return `${protocol}//${hostname}:3001`;
  }

  return origin;
};

const SEND_ENDPOINT = `${getApiBaseUrl()}/api/push/send`;

const toAbsoluteUrl = (url?: string) => {
  if (!url) {
    return typeof window !== 'undefined' ? window.location.origin : undefined;
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (typeof window === 'undefined') {
    return url;
  }

  return new URL(url, window.location.origin).toString();
};

const getMessagingIfSupported = async () => {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!messagingSupportPromise) {
    messagingSupportPromise = isSupported().catch(() => false);
  }

  const supported = await messagingSupportPromise;
  if (!supported) {
    return null;
  }

  return getMessaging(app);
};

const savePushSubscription = async (userId: string, token: string) => {
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  const existing = (snap.data()?.fcmTokens || []) as string[];
  
  if (!existing.includes(token)) {
    await setDoc(userRef, {
      fcmTokens: [...existing, token],
      pushSubscriptionsUpdatedAt: Timestamp.now(),
    }, { merge: true });
  }
};

export const registerDeviceForPush = async (userId: string, companyId: string | null) => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  // On iOS, web push is intended for Home Screen web apps.
  if (isIos() && !isStandaloneDisplay()) {
    console.info('Push registration skipped on iOS until the app is opened from the Home Screen.');
    return false;
  }

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    return false;
  }

  try {
    const messaging = await getMessagingIfSupported();
    if (!messaging) {
      return false;
    }

    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidKey || vapidKey === 'YOUR_PUBLIC_VAPID_KEY') {
      console.warn('Push registration skipped: missing VITE_VAPID_PUBLIC_KEY.');
      return false;
    }

    const registration = await navigator.serviceWorker.register(FCM_SW_URL, {
      scope: FCM_SW_SCOPE,
    });
    await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration
    });

    if (token) {
      await savePushSubscription(userId, token);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to get FCM token:', error);
    return false;
  }
};

export const sendPushToUser = async (userId: string, payload: PushPayload) => {
  const userSnap = await getDoc(doc(db, 'users', userId));
  if (!userSnap.exists()) return;

  const tokens = (userSnap.data()?.fcmTokens || []) as string[];
  if (!tokens.length) return;

  const response = await fetch(SEND_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId,
      tokens,
      payload: {
        ...payload,
        url: toAbsoluteUrl(payload.url),
      },
    }),
  });

  const responseBody = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`Push send failed: ${JSON.stringify(responseBody) || 'Unknown push error'}`);
  }

  if (!responseBody?.success || responseBody.sent === 0) {
    throw new Error(`Push send failed: ${JSON.stringify(responseBody) || 'No devices accepted the notification.'}`);
  }

  return responseBody;
};
