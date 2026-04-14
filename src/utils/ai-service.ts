import { getGeminiApiKey, uploadFileToGemini, extractJsonFromText } from './gemini';

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
      model: 'llama-3.3-70b-versatile',
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

/**
 * Transcribe audio using Groq's Whisper API
 */
export async function transcribeWithGroq(audioBlob: Blob): Promise<{ fullText: string, segments: any[] }> {
  const apiKey = (import.meta as any).env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Groq API Key (VITE_GROQ_API_KEY) is missing.');
  }

  // Groq has a strict 25MB limit. Browser-based audio chunking breaks WebM headers,
  // so we seamlessly fallback to Gemini's File API which supports up to 2GB audio files.
  if (audioBlob.size > 25 * 1024 * 1024) {
    console.warn('Audio exceeds Groq 25MB limit (100MB+). Falling back to Gemini 1.5 Flash...');
    const geminiKey = getGeminiApiKey();
    if (!geminiKey) {
      throw new Error('Audio file exceeds 25MB, and VITE_GEMINI_API_KEY is missing for the large-file fallback.');
    }

    const fileUri = await uploadFileToGemini(audioBlob, geminiKey);

    const promptText = `Transcribe and translate this recording into English. Return a JSON object with a 'fullText' string and a 'segments' array. Each segment must be an object with 'text', 'startTime' (float), and 'endTime' (float). Provide ONLY JSON.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: promptText },
            { fileData: { mimeType: audioBlob.type || 'audio/webm', fileUri } }
          ]
        }],
        generationConfig: { maxOutputTokens: 8192, responseMimeType: 'application/json' }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini Fallback Error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = extractJsonFromText(rawText);
    return {
      fullText: parsed?.fullText || "Transcription extraction failed.",
      segments: parsed?.segments || []
    };
  }

  const formData = new FormData();
  const audioFile = new File([audioBlob], 'audio.webm', { type: audioBlob.type || 'audio/webm' });
  formData.append('file', audioFile);
  formData.append('model', 'whisper-large-v3');
  formData.append('response_format', 'verbose_json');
  formData.append('language', 'en'); // Explicit language prevents timeouts on long silence

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq Whisper API Error: ${response.status} ${err}`);
  }

  const data = await response.json();

  // Map Groq's verbose_json output to our expected segments format
  const segments = (data.segments || []).map((seg: any) => ({
    text: seg.text,
    startTime: seg.start,
    endTime: seg.end
  }));

  return {
    fullText: data.text,
    segments
  };
}
