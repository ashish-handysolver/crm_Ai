import admin from 'firebase-admin';
import { existsSync, readFileSync } from 'fs';

const firebaseProjectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GCLOUD_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID;
const serviceAccountPath = process.env.GCLOUD_SERVICE_ACCOUNT_PATH || './service-account.json';
const serviceAccountJson = process.env.GCLOUD_SERVICE_ACCOUNT_JSON;
const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const firebasePrivateKeyId = process.env.FIREBASE_PRIVATE_KEY_ID;

const getFirebaseAdminOptions = () => {
  if (firebaseProjectId && firebaseClientEmail && firebasePrivateKey) {
    return {
      credential: admin.credential.cert({
        projectId: firebaseProjectId,
        clientEmail: firebaseClientEmail,
        privateKey: firebasePrivateKey,
        privateKeyId: firebasePrivateKeyId,
      }),
      projectId: firebaseProjectId,
    };
  }

  if (serviceAccountJson) {
    const credentials = JSON.parse(serviceAccountJson);
    return {
      credential: admin.credential.cert(credentials),
      projectId: firebaseProjectId || credentials.project_id,
    };
  }

  if (existsSync(serviceAccountPath)) {
    const credentials = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    return {
      credential: admin.credential.cert(credentials),
      projectId: firebaseProjectId || credentials.project_id,
    };
  }

  if (firebaseProjectId) {
    return { projectId: firebaseProjectId };
  }

  return undefined;
};

export const getFirebaseAdminApp = () => {
  if (admin.apps.length) {
    return admin.app();
  }

  const options = getFirebaseAdminOptions();
  if (!options) {
    return null;
  }

  try {
    return admin.initializeApp(options);
  } catch (error) {
    console.warn('Firebase Admin init failed:', error instanceof Error ? error.message : String(error));
    return admin.apps.length ? admin.app() : null;
  }
};

export const getFirebaseMessaging = () => {
  const app = getFirebaseAdminApp();
  return app ? admin.messaging(app) : null;
};
