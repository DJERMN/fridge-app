import type { FridgeItem } from '../types';

const PROMPT = `Look carefully at this image.

Answer these questions about what you see:
1. What food items and drinks are visible?
2. How many pieces/units of each item can you count (e.g. "3 bottles", "2 eggs", "1 pack")?
3. How full or how much is left of each item (e.g. "almost full", "half full", "almost empty")?

Reply ONLY with a JSON array. No text before or after. No markdown backticks. Example:
[
  {"name": "Milk", "quantity": "2 bottles, almost full", "status": "ok"},
  {"name": "Butter", "quantity": "1 pack, half used", "status": "low"}
]

Rules:
- "name": product name in English
- "quantity": count + unit + fill level, as precise as possible
- "status": "ok" (enough available), "low" (running low, buy soon), "empty" (gone or almost gone)
- Each visible item as a separate entry
- If nothing is recognizable: []`;

const MODEL = 'qwen/qwen3.6-plus:free';

interface RawItem {
  name?: string;
  quantity?: string;
  status?: string;
}

function parseItems(text: string): FridgeItem[] {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  let parsed: RawItem[];
  try {
    parsed = JSON.parse(cleaned) as RawItem[];
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]) as RawItem[];
      } catch {
        throw new Error('AI returned invalid JSON: ' + cleaned.slice(0, 150));
      }
    } else {
      throw new Error('AI returned invalid JSON: ' + cleaned.slice(0, 150));
    }
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((item) => item && typeof item.name === 'string' && item.name.trim().length > 0)
    .map((item) => ({
      id: crypto.randomUUID(),
      name: item.name!.trim(),
      quantity: typeof item.quantity === 'string' ? item.quantity.trim() : '',
      status: (['ok', 'low', 'empty'].includes(item.status ?? '')
        ? item.status
        : 'ok') as 'ok' | 'low' | 'empty',
      addedAt: Date.now(),
    }));
}

export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  apiKey: string
): Promise<FridgeItem[]> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://djermn.github.io/fridge-app/',
      'X-Title': 'FridgeMate',
    },
    body: JSON.stringify({
      model: MODEL,
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

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    if (response.status === 429) {
      throw new Error('Rate limit reached. Please wait 1 minute and try again.');
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('Invalid API key. Please check your key in Settings (openrouter.ai/keys).');
    }
    throw new Error(`Error ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '[]';
  return parseItems(text);
}
