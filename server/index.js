import express from 'express';
import cors from 'cors';
import { SpeechClient } from '@google-cloud/speech/build/src/v2/index.js';
import dotenv from 'dotenv';
import admin from 'firebase-admin';

dotenv.config();

const fallbackFirebaseConfig = {
  apiKey: 'AIzaSyCDMYbu604E083IyEBE__U6KX4I2YaovQA',
  authDomain: 'handydash-75858.firebaseapp.com',
  databaseURL: 'https://handydash-75858.firebaseio.com',
  projectId: 'handydash-75858',
  storageBucket: 'handydash-75858.appspot.com',
  messagingSenderId: '18967278229',
  appId: '1:18967278229:web:eedb13d46173cf05b4619c',
};

const firebaseWebConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || fallbackFirebaseConfig.apiKey,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || fallbackFirebaseConfig.authDomain,
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL || fallbackFirebaseConfig.databaseURL,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || fallbackFirebaseConfig.projectId,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || fallbackFirebaseConfig.storageBucket,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || fallbackFirebaseConfig.messagingSenderId,
  appId: process.env.VITE_FIREBASE_APP_ID || fallbackFirebaseConfig.appId,
};

const getFirebaseAdminCredential = () => {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    return admin.credential.cert(JSON.parse(serviceAccountJson));
  }

  const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (serviceAccountBase64) {
    const decoded = Buffer.from(serviceAccountBase64, 'base64').toString('utf8');
    return admin.credential.cert(JSON.parse(decoded));
  }

  return null;
};

let firebaseAdminReady = false;

if (!admin.apps.length) {
  try {
    const credential = getFirebaseAdminCredential();
    if (credential) {
      admin.initializeApp({ credential });
    } else {
      admin.initializeApp();
    }
    firebaseAdminReady = true;
  } catch (err) {
    firebaseAdminReady = false;
    console.warn('Firebase Admin init failed:', err.message);
  }
} else {
  firebaseAdminReady = true;
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const speechClient = new SpeechClient();
app.get('/api/push/config', (_req, res) => {
  res.json({
    firebase: firebaseWebConfig,
    vapidPublicKey: process.env.VITE_VAPID_PUBLIC_KEY || '',
  });
});

app.get('/api/push/status', (_req, res) => {
  res.json({
    ok: true,
    firebaseAdminReady,
    vapidConfigured: Boolean(process.env.VITE_VAPID_PUBLIC_KEY),
    projectId: firebaseWebConfig.projectId,
  });
});

app.post('/api/push/send', async (req, res) => {
  const { tokens, payload } = req.body || {};

  if (!Array.isArray(tokens) || tokens.length === 0 || !payload?.title) {
    return res.status(400).json({ error: 'Tokens and payload.title are required.' });
  }

  if (!firebaseAdminReady) {
    return res.status(503).json({
      error: 'Firebase Admin messaging is not configured on the server.',
      code: 'messaging/not-configured',
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
      }
    },
    data: {
      url: payload.url || '/',
      tag: payload.tag || '',
    },
    tokens: tokens,
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    res.json({
      success: true,
      sent: response.successCount,
      failed: response.failureCount,
      errors: response.responses
        .filter((item) => !item.success)
        .map((item) => item.error?.message || 'Unknown messaging error'),
    });
  } catch (error) {
    console.error('FCM send error:', error);
    res.status(500).json({
      error: error?.message || 'Failed to send notifications',
      code: error?.code || 'messaging/unknown',
    });
  }
});

app.post('/api/transcribe', async (req, res) => {
  const { audioContent, projectId } = req.body;

  try {
    const parent = `projects/${projectId}/locations/global`;
    const recognizer = `projects/${projectId}/locations/global/recognizers/_`; // default recognizer

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
    
    // Process results into standard format
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

export default app;

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`STT Proxy active on port ${PORT}`);
});
}

