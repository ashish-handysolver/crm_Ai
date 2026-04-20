/**
 * Frontend utility for Audio transcription (Groq Whisper & Google Gemini)
 */
import { uploadFileToGemini, extractJsonFromText } from './gemini';
export interface TranscriptionResult {
  fullText: string;
  segments: Array<{
    text: string;
    startTime: number;
    endTime: number;
  }>;
}

/**
 * Transcribes audio directly via Groq API using whisper-large-v3
 */
export async function transcribeWithChirp(blob: Blob): Promise<TranscriptionResult> {
  const apiKey = (import.meta as any).env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Groq API Key (VITE_GROQ_API_KEY) is missing.');
  }

  const formData = new FormData();
  // Groq expects a file with an extension to determine format
  const audioFile = new File([blob], 'recording.webm', { type: 'audio/webm' });
  formData.append('file', audioFile);
  formData.append('model', 'whisper-large-v3');
  formData.append('response_format', 'verbose_json');

  const response = await fetch('https://api.groq.com/openai/v1/audio/translations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });


  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq Transcription Error: ${response.status} ${err}`);
  }

  const data = await response.json();

  // Map Groq's verbose_json to our internal segment format
  return {
    fullText: data.text,
    segments: (data.segments || []).map((s: any) => ({
      text: s.text,
      startTime: s.start,
      endTime: s.end
    }))
  };
}

/**
 * Transcribes audio via Google Gemini 1.5 Flash (Free Tier)
 */
export async function transcribeWithGemini(blob: Blob, apiKey: string): Promise<TranscriptionResult> {
  if (!apiKey) {
    throw new Error('Gemini API Key is missing.');
  }

  // 1. Upload file to Gemini File API
  const fileUri = await uploadFileToGemini(blob, apiKey);

  const promptText = `
    Transcribe and translate this recording into English. 
    Return a JSON object with:
    - 'fullText': a string of the entire transcription translated to English.
    - 'segments': an array of objects, each with 'text' (English), 'startTime' (float), and 'endTime' (float).
    Provide ONLY JSON.
  `;

  // 2. Generate Content
  const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { text: promptText },
          { fileData: { mimeType: blob.type || 'audio/webm', fileUri } }
        ]
      }],
      generationConfig: { maxOutputTokens: 8192, responseMimeType: 'application/json' }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini Transcription Error: ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

  const parsed = extractJsonFromText(rawText);
  if (!parsed || !parsed.fullText) {
    throw new Error("Failed to extract valid transcription from Gemini response.");
  }

  return {
    fullText: parsed.fullText,
    segments: (parsed.segments || []).map((s: any) => ({
      text: s.text,
      startTime: Number(s.startTime) || 0,
      endTime: Number(s.endTime) || 0
    }))
  };
}
