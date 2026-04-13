/**
 * Frontend utility for Groq Whisper transcription
 */
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

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
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
