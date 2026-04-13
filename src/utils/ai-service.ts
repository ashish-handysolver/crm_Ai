import { GoogleGenAI } from '@google/genai';
import { getGeminiApiKey } from './gemini';

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
