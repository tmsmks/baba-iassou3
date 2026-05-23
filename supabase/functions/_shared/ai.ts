// Appel OpenAI GPT-4.1-mini en mode JSON strict (structured outputs),
// avec fallback Groq llama-3.3-70b.
// Les clés viennent des secrets de la fonction Supabase :
//   supabase secrets set OPENAI_API_KEY=... GROQ_API_KEY=...

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export interface AIResponse<T> {
  data: T;
  provider: 'openai' | 'groq';
}

export async function callAI<T>(
  systemPrompt: string,
  userMessage: string,
  responseSchema: Record<string, unknown>,
): Promise<AIResponse<T>> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  const groqKey = Deno.env.get('GROQ_API_KEY');

  if (openaiKey) {
    try {
      const data = await callOpenAI<T>(openaiKey, systemPrompt, userMessage, responseSchema);
      return { data, provider: 'openai' };
    } catch (err) {
      console.error('OpenAI failed, trying Groq:', err);
      if (!groqKey) throw err;
    }
  }
  if (!groqKey) throw new Error('No AI provider configured');
  const data = await callGroq<T>(groqKey, systemPrompt, userMessage);
  return { data, provider: 'groq' };
}

async function callOpenAI<T>(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  responseSchema: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      temperature: 0.85,
      max_tokens: 700,
      // Structured Outputs : OpenAI garantit que la réponse matche le schema.
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'response',
          strict: true,
          schema: addNoAdditionalProps(responseSchema),
        },
      },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const payload = await res.json();
  const text: string | undefined = payload?.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenAI empty response');
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

/**
 * OpenAI Structured Outputs exige `additionalProperties: false` sur chaque objet
 * et `required` listant TOUS les champs. On le rajoute défensivement au schema fourni.
 */
function addNoAdditionalProps(schema: Record<string, unknown>): Record<string, unknown> {
  if (schema?.type !== 'object' || !schema.properties) return schema;
  const props = schema.properties as Record<string, unknown>;
  return {
    ...schema,
    additionalProperties: false,
    required: Object.keys(props),
  };
}

export function ensureTrailingChoice(message: string): string {
  const phrase = 'Mais ATTENTION ! C\'est ton choix 🫵🏽';
  return message.trimEnd().endsWith(phrase)
    ? message.trim()
    : `${message.trim()} ${phrase}`;
}
