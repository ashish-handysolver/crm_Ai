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
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    
    const token = await getToken(messaging, {
      // NOTE: Replace this with your actual VAPID key from Firebase Console
      vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY || 'YOUR_PUBLIC_VAPID_KEY',
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

  await fetch(SEND_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tokens,
      payload,
    }),
  });
};
