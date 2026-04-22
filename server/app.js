import express from 'express';
import cors from 'cors';
import { SpeechClient } from '@google-cloud/speech/build/src/v2/index.js';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { existsSync, readFileSync } from 'fs';

dotenv.config();

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

if (!admin.apps.length) {
  try {
    admin.initializeApp(getFirebaseAdminOptions());
  } catch (err) {
    console.warn('Firebase Admin init failed:', err.message);
  }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const speechClient = new SpeechClient();

app.post('/api/push/send', async (req, res) => {
  const { tokens, payload } = req.body || {};

  if (!Array.isArray(tokens) || tokens.length === 0 || !payload?.title) {
    return res.status(400).json({ error: 'Tokens and payload.title are required.' });
  }

  if (!admin.apps.length) {
    return res.status(503).json({
      error: 'Firebase Admin is not configured for push notifications.',
      details: 'Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, or GCLOUD_SERVICE_ACCOUNT_JSON / GCLOUD_SERVICE_ACCOUNT_PATH, or provide valid application default credentials.',
    });
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
    },
    tokens,
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    const failedResponses = response.responses
      .filter(item => !item.success)
      .map(item => item.error?.message)
      .filter(Boolean);

    res.json({
      success: true,
      sent: response.successCount,
      failed: response.failureCount,
      errors: failedResponses,
    });
  } catch (error) {
    console.error('FCM send error:', error);
    res.status(500).json({
      error: 'Failed to send notifications',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post('/api/transcribe', async (req, res) => {
  const { audioContent, projectId } = req.body;

  try {
    const recognizer = `projects/${projectId}/locations/global/recognizers/_`;

    const request = {
      recognizer,
      config: {
        autoDecodingConfig: {},
        model: 'chirp',
        languageCodes: ['en-US'],
        features: {
          enableWordTimeOffsets: true,
        },
      },
      content: audioContent,
    };

    const [response] = await speechClient.recognize(request);

    const fullText = response.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');

    const segments = response.results.flatMap(result =>
      result.alternatives[0].words.map(word => ({
        text: word.word,
        startTime: parseFloat(word.startOffset.seconds || 0) + (word.startOffset.nanos || 0) / 1e9,
        endTime: parseFloat(word.endOffset.seconds || 0) + (word.endOffset.nanos || 0) / 1e9,
      }))
    );

    res.json({ fullText, segments });
  } catch (error) {
    console.error('Transcription Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export { app };
