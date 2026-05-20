// Appel Gemini 2.0 Flash en mode JSON strict, avec fallback Groq llama-3.3-70b.
// Les clés viennent des secrets de la fonction Supabase :
//   supabase secrets set GEMINI_API_KEY=... GROQ_API_KEY=...

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export interface AIResponse<T> {
  data: T;
  provider: 'gemini' | 'groq';
}

export async function callAI<T>(
  systemPrompt: string,
  userMessage: string,
  responseSchema: Record<string, unknown>,
): Promise<AIResponse<T>> {
  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  const groqKey = Deno.env.get('GROQ_API_KEY');

  if (geminiKey) {
    try {
      const data = await callGemini<T>(geminiKey, systemPrompt, userMessage, responseSchema);
      return { data, provider: 'gemini' };
    } catch (err) {
      console.error('Gemini failed, trying Groq:', err);
      if (!groqKey) throw err;
    }
  }
  if (!groqKey) throw new Error('No AI provider configured');
  const data = await callGroq<T>(groqKey, systemPrompt, userMessage);
  return { data, provider: 'groq' };
}

async function callGemini<T>(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  responseSchema: Record<string, unknown>,
): Promise<T> {
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    generationConfig: {
      temperature: 0.85,
      topP: 0.95,
      maxOutputTokens: 700,
      responseMimeType: 'application/json',
      responseSchema,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);

  const payload = await res.json();
  const text: string | undefined = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini empty response: ${JSON.stringify(payload).slice(0, 400)}`);
  return JSON.parse(text) as T;
}

async function callGroq<T>(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
): Promise<T> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.85,
      max_tokens: 700,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const payload = await res.json();
  const text: string | undefined = payload?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq empty response');
  return JSON.parse(text) as T;
}

export function ensureTrailingChoice(message: string): string {
  const phrase = 'Mais c\'est TON choix.';
  return message.trimEnd().endsWith(phrase)
    ? message.trim()
    : `${message.trim()} ${phrase}`;
}
