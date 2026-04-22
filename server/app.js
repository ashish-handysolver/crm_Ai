import express from 'express';
import cors from 'cors';
import { SpeechClient } from '@google-cloud/speech/build/src/v2/index.js';
import dotenv from 'dotenv';
import { getFirebaseAdminApp } from './firebaseAdmin.js';
import { sendPushNotifications } from './pushNotifications.js';

dotenv.config();
getFirebaseAdminApp();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const speechClient = new SpeechClient();

app.post('/api/push/send', async (req, res) => {
  const result = await sendPushNotifications(req.body || {});
  res.status(result.status).json(result.body);
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
