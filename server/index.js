import express from 'express';
import cors from 'cors';
import { SpeechClient } from '@google-cloud/speech/build/src/v2/index.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const speechClient = new SpeechClient();

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
