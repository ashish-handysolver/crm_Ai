import express from 'express';
import cors from 'cors';
import { SpeechClient } from '@google-cloud/speech/build/src/v2/index.js';
import dotenv from 'dotenv';
import webpush from 'web-push';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const speechClient = new SpeechClient();
const vapidKeys = process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
  ? {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    }
  : webpush.generateVAPIDKeys();

if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  console.warn('PUSH_WARNING: Using ephemeral VAPID keys. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in env for stable mobile push.');
}

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:support@handycrm.ai',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

app.get('/api/push/public-key', (_req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

app.post('/api/push/send', async (req, res) => {
  const { subscriptions, payload } = req.body || {};

  if (!Array.isArray(subscriptions) || subscriptions.length === 0 || !payload?.title) {
    return res.status(400).json({ error: 'Subscriptions and payload.title are required.' });
  }

  const results = await Promise.allSettled(
    subscriptions.map((subscription) =>
      webpush.sendNotification(subscription, JSON.stringify({
        title: payload.title,
        body: payload.body,
        tag: payload.tag,
        url: payload.url,
        icon: '/logo.png',
        badge: '/logo.png',
      }))
    )
  );

  const failed = results.filter((result) => result.status === 'rejected');
  if (failed.length) {
    console.warn(`PUSH_DELIVERY_PARTIAL: ${failed.length} subscription(s) failed.`);
  }

  res.json({
    success: true,
    sent: results.length - failed.length,
    failed: failed.length,
  });
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
