const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.sendNotificationOnCreate = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snap, context) => {
    const notificationData = snap.data();
    
    // Only send push if there's a target user
    if (!notificationData.userId) {
      console.log('No userId provided in notification, skipping push.');
      return null;
    }

    try {
      // Get the target user's document to find their FCM tokens
      const userRef = admin.firestore().doc(`users/${notificationData.userId}`);
      const userSnap = await userRef.get();
      
      if (!userSnap.exists) {
        console.log('User does not exist, skipping push.');
        return null;
      }

      const userData = userSnap.data();
      const tokens = userData.fcmTokens || [];

      if (!tokens || tokens.length === 0) {
        console.log('User has no registered FCM tokens, skipping push.');
        return null;
      }

      // Build the standard push payload
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
          }
        },
        data: {
          url: notificationData.link || '/',
          tag: notificationData.id || context.params.notificationId,
        },
        tokens: tokens,
      };

      // Send the payload
      const response = await admin.messaging().sendEachForMulticast(payload);
      console.log(`Successfully sent message to ${response.successCount} devices`);
      if (response.failureCount > 0) {
        console.log(`Failed to send to ${response.failureCount} devices`);
      }

      return null;
    } catch (error) {
      console.error('Error sending push notification:', error);
      return null;
    }
  });
