import express from 'express';
import cors from 'cors';
import { SpeechClient } from '@google-cloud/speech/build/src/v2/index.js';
import dotenv from 'dotenv';
import admin from 'firebase-admin';

dotenv.config();

if (!admin.apps.length) {
  try {
    admin.initializeApp();
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
    });
  } catch (error) {
    console.error('FCM send error:', error);
    res.status(500).json({ error: 'Failed to send notifications' });
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`STT Proxy active on port ${PORT}`);
});
