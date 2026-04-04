export interface DetectedItem {
  name: string;
  quantity: number;
  unit: string;
}

const PROMPT = `Look at this image carefully.

List every food item and drink you can see.
For each item provide:
- name: product name in English
- quantity: a number (count individual pieces, bottles, packs - estimate if needed)
- unit: measurement unit (e.g. "bottles", "pcs", "packs", "kg", "l", "cans")

Reply ONLY with a JSON array. No markdown backticks. No text before or after. Example:
[
  {"name": "Milk", "quantity": 2, "unit": "bottles"},
  {"name": "Eggs", "quantity": 6, "unit": "pcs"},
  {"name": "Butter", "quantity": 1, "unit": "pack"}
]

If nothing is recognizable: []`;

const MODEL = 'qwen/qwen3.6-plus:free';

interface RawItem {
  name?: string;
  quantity?: number | string;
  unit?: string;
}

function parseItems(text: string): DetectedItem[] {
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
      name: item.name!.trim(),
      quantity: typeof item.quantity === 'number' ? item.quantity : parseInt(String(item.quantity ?? '1'), 10) || 1,
      unit: typeof item.unit === 'string' ? item.unit.trim() : 'pcs',
    }));
}

export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  apiKey: string
): Promise<DetectedItem[]> {
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
    if (response.status === 429) throw new Error('Rate limit reached. Please wait a moment and try again.');
    if (response.status === 401 || response.status === 403) throw new Error('Invalid API key. Please check Settings.');
    throw new Error(`Error ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '[]';
  return parseItems(text);
}