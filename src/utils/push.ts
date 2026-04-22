import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db, messaging } from '../firebase';
import { getToken } from 'firebase/messaging';
import { requestNotificationPermission } from './notifications';

type PushPayload = {
  title: string;
  body: string;
  tag?: string;
  url?: string;
};

const SEND_ENDPOINT = '/api/push/send';
const FCM_SW_URL = '/firebase-messaging-sw.js';
const FCM_SW_SCOPE = '/firebase-cloud-messaging-push-scope';

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
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !messaging) {
    return false;
  }

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    return false;
  }

  try {
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidKey || vapidKey === 'YOUR_PUBLIC_VAPID_KEY') {
      console.warn('Push registration skipped: missing VITE_VAPID_PUBLIC_KEY.');
      return false;
    }

    const registration = await navigator.serviceWorker.register(FCM_SW_URL, {
      scope: FCM_SW_SCOPE,
    });

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

  try {
    const response = await fetch(SEND_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tokens,
        payload,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown push error');
      console.warn(`Push send skipped: ${errorText}`);
      return false;
    }

    return true;
  } catch (error) {
    console.warn('Push send request failed:', error);
    return false;
  }
};
