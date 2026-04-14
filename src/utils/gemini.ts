import { v4 as uuidv4 } from 'uuid';

export const GEMINI_FALLBACK_MESSAGE = "Intelligence services temporarily unavailable or quota exceeded. Switching back to basic mode (Free Agent)";

/**
 * Returns the Gemini API key from environment variables.
 * Strips surrounding quotes that can be introduced when keys are
 * saved as "AIza..." in .env files or Vercel dashboard.
 */
export const getGeminiApiKey = (): string => {
  const raw = [
    (import.meta as any).env.VITE_GEMINI_API_KEY,
    (import.meta as any).env.GEMINI_API_KEY,
    (process.env as any)?.GEMINI_API_KEY,
    (process.env as any)?.VITE_GEMINI_API_KEY,
  ].find(k => {
    if (!k || typeof k !== 'string') return false;
    const clean = k.trim().replace(/^["']|["']$/g, '');
    return clean.length > 5 && clean !== 'undefined' && clean !== 'null';
  }) || '';

  const finalKey = raw.replace(/^["']|["']$/g, '').trim();
  if (!finalKey) {
    console.warn("Gemini API Key Lookup: No valid key found in environment.");
  }
  return finalKey;
};

/**
 * Uploads a Blob to the Gemini File API for transcription/analysis.
 * Bypasses the 10MB-20MB inline payload limits of generateContent.
 */
export const uploadFileToGemini = async (blob: Blob, apiKey: string): Promise<string> => {
  // Sanitize key in case it has quotes from env config
  const sanitizedKey = apiKey.replace(/^["']|["']$/g, '').trim();

  if (!sanitizedKey) {
    throw new Error('Gemini API Key is missing. Please set VITE_GEMINI_API_KEY in your environment variables.');
  }

  const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${sanitizedKey}`;
  const metadata = {
    file: { 
      display_name: `recording-${uuidv4().slice(0, 8)}`,
      mime_type: blob.type || "audio/webm" 
    }
  };

  // 1. Initial metadata request to start resumable upload
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': blob.size.toString(),
      'X-Goog-Upload-Header-Content-Type': blob.type || "audio/webm",
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(metadata)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini File API Metadata Error: ${response.status} ${errText}`);
  }
  
  const actualUploadUrl = response.headers.get('X-Goog-Upload-URL');
  if (!actualUploadUrl) throw new Error("No upload URL returned by Gemini File API");

  // 2. Binary content upload
  const uploadResponse = await fetch(actualUploadUrl, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
      'Content-Length': blob.size.toString(),
    },
    body: blob
  });

  if (!uploadResponse.ok) {
    const errText = await uploadResponse.text();
    throw new Error(`Gemini File API Binary Error: ${uploadResponse.status} ${errText}`);
  }
  
  const fileInfo = await uploadResponse.json();
  return fileInfo.file.uri;
};

/**
 * Robustly extracts JSON from a string that might contain extra text or markdown blocks.
 */
export const extractJsonFromText = (text: string): any => {
  if (!text) return null;
  
  // 1. Try simple clean (already doing this in components, but centralizing)
  let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleanText);
  } catch (e) {
    // 2. Regex approach if simple parse fails
    try {
      // Find the first '{' and the last '}'
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const jsonCandidate = text.substring(firstBrace, lastBrace + 1);
        return JSON.parse(jsonCandidate);
      }
      
      // Try finding the first '[' and last ']' if it might be an array
      const firstBracket = text.indexOf('[');
      const lastBracket = text.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        const jsonCandidate = text.substring(firstBracket, lastBracket + 1);
        return JSON.parse(jsonCandidate);
      }
    } catch (innerE) {
      console.warn("Regex JSON Extraction failed:", innerE);
    }
  }
  
  return null;
};

