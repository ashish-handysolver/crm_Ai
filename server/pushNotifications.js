import { getFirebaseMessaging } from './firebaseAdmin.js';

export const getPushConfigurationError = () => ({
  error: 'Firebase Admin is not configured for push notifications.',
  details: 'Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, or GCLOUD_SERVICE_ACCOUNT_JSON / GCLOUD_SERVICE_ACCOUNT_PATH, or provide valid application default credentials.',
});

export const sendPushNotifications = async ({ tokens, payload }) => {
  if (!Array.isArray(tokens) || tokens.length === 0 || !payload?.title) {
    return {
      status: 400,
      body: { error: 'Tokens and payload.title are required.' },
    };
  }

  const messaging = getFirebaseMessaging();
  if (!messaging) {
    return {
      status: 503,
      body: getPushConfigurationError(),
    };
  }

  const message = {
    notification: {
      title: payload.title,
      body: payload.body,
    },
    webpush: {
      notification: {
        icon: '/logo.png',
        badge: '/logo.png',
      },
      fcmOptions: {
        link: payload.url || '/',
      },
    },
    data: {
      url: payload.url || '/',
      tag: payload.tag || '',
      title: payload.title,
      body: payload.body || '',
    },
    tokens,
  };

  try {
    const response = await messaging.sendEachForMulticast(message);
    const failedResponses = response.responses
      .filter((item) => !item.success)
      .map((item) => item.error?.message)
      .filter(Boolean);

    return {
      status: 200,
      body: {
        success: true,
        sent: response.successCount,
        failed: response.failureCount,
        errors: failedResponses,
      },
    };
  } catch (error) {
    console.error('FCM send error:', error);
    return {
      status: 500,
      body: {
        error: 'Failed to send notifications',
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
};
