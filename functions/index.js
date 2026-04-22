const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

const DATABASE_ID = 'handydash-firestore';
const db = getFirestore(undefined, DATABASE_ID);
const messaging = getMessaging();

exports.sendNotificationOnCreate = onDocumentCreated(
  {
    document: 'notifications/{notificationId}',
    database: DATABASE_ID,
    region: 'us-central1',
  },
  async (event) => {
    const notificationData = event.data?.data();

    if (!notificationData) {
      console.log('Notification snapshot was empty, skipping push.');
      return;
    }

    if (!notificationData.userId) {
      console.log('No userId provided in notification, skipping push.');
      return;
    }

    try {
      const userRef = db.doc(`users/${notificationData.userId}`);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        console.log('User does not exist, skipping push.');
        return;
      }

      const userData = userSnap.data() || {};
      const tokens = Array.isArray(userData.fcmTokens) ? userData.fcmTokens : [];

      if (tokens.length === 0) {
        console.log('User has no registered FCM tokens, skipping push.');
        return;
      }

      const payload = {
        notification: {
          title: notificationData.title || 'New Notification',
          body: notificationData.message || 'You have a new update.',
        },
        webpush: {
          notification: {
            icon: '/logo.png',
            badge: '/logo.png',
          },
          fcmOptions: {
            link: notificationData.link || '/',
          },
        },
        data: {
          url: notificationData.link || '/',
          tag: notificationData.id || event.params.notificationId,
        },
        tokens,
      };

      const response = await messaging.sendEachForMulticast(payload);
      console.log(`Successfully sent message to ${response.successCount} devices`);
      if (response.failureCount > 0) {
        console.log(`Failed to send to ${response.failureCount} devices`);
      }
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }
);
