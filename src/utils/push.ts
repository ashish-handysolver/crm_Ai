import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { requestNotificationPermission } from './notifications';

type PushSubscriptionRecord = {
  endpoint: string;
  expirationTime: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
  userAgent?: string;
  companyId?: string;
  updatedAt?: string;
};

type PushPayload = {
  title: string;
  body: string;
  tag?: string;
  url?: string;
};

const PUBLIC_KEY_ENDPOINT = '/api/push/public-key';
const SEND_ENDPOINT = '/api/push/send';

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

const getPushPublicKey = async () => {
  const response = await fetch(PUBLIC_KEY_ENDPOINT);
  if (!response.ok) {
    throw new Error('Failed to load push public key');
  }

  const data = await response.json();
  if (!data?.publicKey) {
    throw new Error('Push public key missing from server response');
  }

  return data.publicKey as string;
};

const savePushSubscription = async (userId: string, companyId: string | null, subscription: PushSubscription) => {
  const subscriptionJson = subscription.toJSON();
  if (!subscriptionJson.endpoint) return;

  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  const existing = (snap.data()?.pushSubscriptions || []) as PushSubscriptionRecord[];
  const filtered = existing.filter((item) => item.endpoint !== subscriptionJson.endpoint);

  const nextRecord: PushSubscriptionRecord = {
    endpoint: subscriptionJson.endpoint,
    expirationTime: subscriptionJson.expirationTime ?? null,
    keys: subscriptionJson.keys,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    companyId: companyId || undefined,
    updatedAt: new Date().toISOString(),
  };

  await setDoc(userRef, {
    pushSubscriptions: [...filtered, nextRecord],
    pushSubscriptionsUpdatedAt: Timestamp.now(),
  }, { merge: true });
};

export const registerDeviceForPush = async (userId: string, companyId: string | null) => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    return false;
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    const publicKey = await getPushPublicKey();
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  await savePushSubscription(userId, companyId, subscription);
  return true;
};

export const sendPushToUser = async (userId: string, payload: PushPayload) => {
  const userSnap = await getDoc(doc(db, 'users', userId));
  if (!userSnap.exists()) return;

  const subscriptions = (userSnap.data()?.pushSubscriptions || []) as PushSubscriptionRecord[];
  if (!subscriptions.length) return;

  await fetch(SEND_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subscriptions,
      payload,
    }),
  });
};
