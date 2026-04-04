import type { FridgeItem } from '../types';

const PROMPT = `Analysiere dieses Bild meines Kuehlschranks. Identifiziere alle sichtbaren Lebensmittel und Getraenke. Antworte NUR mit einem JSON-Array ohne Markdown-Bloecke: [{"name": "Milch", "quantity": "1 Flasche, fast voll", "status": "ok"}]. Status-Werte: ok, low, empty. Antworte mit [] wenn kein Kuehlschrank erkennbar.`;

const MODELS = [
  'meta-llama/llama-4-scout:free',
  'google/gemini-2.0-flash-exp:free',
  'qwen/qwen2.5-vl-72b-instruct:free',
];

interface RawItem {
  name?: string;
  quantity?: string;
  status?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseItems(text: string): FridgeItem[] {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  let parsed: RawItem[];
  try {
    parsed = JSON.parse(cleaned) as RawItem[];
  } catch {
    throw new Error('Ungueltige Antwort von der KI: ' + cleaned.slice(0, 100));
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((item) => item && typeof item.name === 'string')
    .map((item) => ({
      id: crypto.randomUUID(),
      name: item.name as string,
      quantity: typeof item.quantity === 'string' ? item.quantity : '',
      status: (['ok', 'low', 'empty'].includes(item.status ?? '')
        ? item.status
        : 'ok') as 'ok' | 'low' | 'empty',
      addedAt: Date.now(),
    }));
}

export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  apiKey: string,
  onRetry?: (secondsLeft: number) => void
): Promise<FridgeItem[]> {
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://djermn.github.io/fridge-app/',
          'X-Title': 'FridgeMate',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
                { type: 'text', text: PROMPT },
              ],
            },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text: string = data?.choices?.[0]?.message?.content ?? '[]';
        return parseItems(text);
      }

      if (response.status === 429 && attempt === 0) {
        const wait = 65;
        for (let s = wait; s > 0; s--) { onRetry?.(s); await sleep(1000); }
        onRetry?.(0);
        continue;
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error('API Key ungueltig. Bitte prüfe den Key in den Einstellungen.');
      }

      break;
    }
  }

  throw new Error('Alle Modelle haben Rate Limit erreicht. Bitte warte ein paar Minuten.');
}
