import { GROQ_MAX_AUDIO_BYTES, prepareAudioForGroq } from './audio-compression';

export interface DocumentTranscriptionResult {
  fullText: string;
  segments: any[];
}

const GROQ_DOCUMENT_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const GROQ_ANALYTICS_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const GROQ_DOCUMENT_CHUNK_CHARS = 3000;
const GROQ_DOCUMENT_MERGE_GROUP_SIZE = 6;
const GROQ_DOCUMENT_MAX_RETRIES = 4;

/**
 * Interface for AI Insights structure
 */
export interface AIInsights {
  painPoints: string[];
  requirements: string[];
  nextActions: string[];
  improvements: string[];
  meetingMinutes: string[];
  overview: string;
  sentiment: string;
  tasks: Array<{
    title: string;
    assignee: string;
    dueDate: string;
    completed: boolean;
  }>;
  recommendedPhase: string;
  leadScore: number;
}

/**
 * Call Groq API for lightning fast analytics
 */
export async function analyzeWithGroq(transcript: string): Promise<AIInsights> {
  const apiKey = (import.meta as any).env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Groq API Key (VITE_GROQ_API_KEY) is missing.');
  }

  const prompt = `
    Analyze this meeting transcript and extract high-fidelity Minutes of Meeting (MOM) and actionable intelligence. 
    Respond ONLY in strict JSON format. 
    
    Transcript: "${transcript}"
    
    Required JSON Structure:
    {
      "painPoints": ["specific issues mentioned"],
      "requirements": ["technical or business needs identified"],
      "nextActions": ["immediate next steps"],
      "improvements": ["areas where the process or relationship could be better"],
      "meetingMinutes": [
        "EXECUTIVE SUMMARY: ...",
        "DISCUSSION POINT: ...",
        "DECISION: ...",
        "FOLLOW-UP: ..."
      ],
      "overview": "A concise executive summary of the meeting.",
      "sentiment": "Positive/Neutral/Negative",
      "tasks": [
        { "title": "...", "assignee": "Name", "dueDate": "YYYY-MM-DD", "completed": false }
      ],
      "recommendedPhase": "DISCOVERY",
      "leadScore": 75
    }
  `;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: 'You are a high-performance sales intelligence agent. Output ONLY valid JSON.' },
        { role: 'user', content: prompt }
      ],
      model: GROQ_ANALYTICS_MODEL,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API Error: ${response.status} ${err}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

/**
 * Fallback to Gemini if Groq fails or is unavailable
 * @deprecated Switching to Groq as primary
 */
export async function analyzeWithGemini(transcript: string): Promise<AIInsights> {
  // We now use Groq primarily, so this is just a wrapper for analyzeWithGroq
  return analyzeWithGroq(transcript);
}

/**
 * Extract lead information from a business card image using Groq Vision
 */
export async function extractLeadFromCard(base64Image: string): Promise<any> {
  const apiKey = (import.meta as any).env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Groq API Key (VITE_GROQ_API_KEY) is missing.');
  }

  const prompt = `
    Extract contact information from this business card image. 
    Return ONLY a JSON object with these exact keys: 
    "name", "company", "email", "phone", "address". 
    If a value is not found, use an empty string. 
    Provide ONLY the raw JSON string.
  `;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Groq Vision Error: ${response.status} ${err}`);
    }

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error("AI Extraction Error:", error);
    return null;
  }
}

export async function transcribeWithGroq(audioBlob: Blob): Promise<{ fullText: string, segments: any[] }> {
  const apiKey = (import.meta as any).env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Groq API Key (VITE_GROQ_API_KEY) is missing.');
  }

  const preparedChunks = await prepareAudioForGroq(audioBlob, GROQ_MAX_AUDIO_BYTES);
  if (!preparedChunks.length) {
    throw new Error('No audio data was available for Groq transcription.');
  }

  const combinedSegments: Array<{ text: string; startTime: number; endTime: number }> = [];
  const combinedTexts: string[] = [];
  let timeOffset = 0;

  for (let index = 0; index < preparedChunks.length; index++) {
    const chunk = preparedChunks[index];
    const data = await transcribeGroqChunk(chunk.blob, apiKey, index + 1, preparedChunks.length);
    const chunkSegments = (data.segments || []).map((seg: any) => ({
      text: seg.text,
      startTime: seg.start + timeOffset,
      endTime: seg.end + timeOffset
    }));

    combinedSegments.push(...chunkSegments);
    if (data.text?.trim()) {
      combinedTexts.push(data.text.trim());
    }

    timeOffset += chunk.durationSeconds;
  }

  return {
    fullText: combinedTexts.join('\n\n').trim(),
    segments: combinedSegments
  };
}

export async function transcribeDocumentWithGroq(file: File): Promise<DocumentTranscriptionResult> {
  const extractedText = await extractDocumentText(file);
  if (!extractedText.trim()) {
    throw new Error('No readable text was found in the uploaded document.');
  }

  return {
    fullText: normalizeExtractedDocumentText(extractedText),
    segments: []
  };
}

async function extractDocumentText(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();
  const mimeType = file.type || '';

  if (mimeType === 'text/plain' || fileName.endsWith('.txt')) {
    return file.text();
  }

  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
    return extractPdfText(file);
  }

  if (
    mimeType.includes('word') ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileName.endsWith('.docx')
  ) {
    return extractDocxText(file);
  }

  if (fileName.endsWith('.doc')) {
    throw new Error('Legacy .doc files are not supported for Groq document transcription. Please upload .docx, .pdf, or .txt.');
  }

  throw new Error('Unsupported document format. Please upload .pdf, .docx, or .txt.');
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (text) {
      pages.push(text);
    }
  }

  return pages.join('\n\n');
}

async function extractDocxText(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return (result.value || '').replace(/\s+\n/g, '\n').trim();
}

function normalizeExtractedDocumentText(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function transcribeGroqChunk(
  audioBlob: Blob,
  apiKey: string,
  chunkNumber: number,
  chunkCount: number
): Promise<any> {
  const formData = new FormData();
  const fileName = chunkCount > 1 ? `audio-part-${chunkNumber}.wav` : 'audio.wav';
  const audioFile = new File([audioBlob], fileName, { type: audioBlob.type || 'audio/wav' });
  formData.append('file', audioFile);
  formData.append('model', 'whisper-large-v3');
  formData.append('response_format', 'verbose_json');
  formData.append('language', 'en');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq Whisper API Error (chunk ${chunkNumber}/${chunkCount}): ${response.status} ${err}`);
  }

  return response.json();
}
