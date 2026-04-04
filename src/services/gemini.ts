export interface DetectedItem {
  name: string;
  quantity: number;
  unit: string;
}

const MODEL = 'qwen/qwen3.6-plus:free';

const SCAN_PROMPT = `Look at this image carefully.

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
      try { parsed = JSON.parse(match[0]) as RawItem[]; }
      catch { return []; }
    } else { return []; }
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

async function callAPI(messages: object[], apiKey: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://djermn.github.io/fridge-app/',
      'X-Title': 'FridgeMate',
    },
    body: JSON.stringify({ model: MODEL, messages }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    if (response.status === 429) throw new Error('Rate limit reached. Please wait a moment and try again.');
    if (response.status === 401 || response.status === 403) throw new Error('Invalid API key. Please check Settings.');
    throw new Error(`Error ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? '[]';
}

export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  apiKey: string
): Promise<DetectedItem[]> {
  const text = await callAPI([
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        { type: 'text', text: SCAN_PROMPT },
      ],
    },
  ], apiKey);
  return parseItems(text);
}

/**
 * Second AI pass: normalizes new scan results against existing item names.
 * Prevents duplicates like "Milk" vs "Whole Milk" vs "2% Milk".
 * Only called when existing items are present.
 */
export async function normalizeItems(
  existingNames: string[],
  newItems: DetectedItem[],
  apiKey: string
): Promise<DetectedItem[]> {
  if (existingNames.length === 0 || newItems.length === 0) return newItems;

  const prompt = `You are merging a new fridge scan into an existing inventory.

Existing inventory item names:
${existingNames.map((n) => `- ${n}`).join('\n')}

New scanned items:
${JSON.stringify(newItems, null, 2)}

Task:
1. For each new item, check if it refers to the same product as an existing inventory item (e.g. "Whole Milk" = "Milk", "OJ" = "Orange Juice", "Coke" = "Cola").
2. If it matches an existing name, use the EXACT existing name.
3. If it does not match any existing item, keep the new item name as-is.
4. Do NOT merge different products. Do NOT remove items.

Reply ONLY with a JSON array using the resolved names. No markdown. Example:
[{"name": "Milk", "quantity": 2, "unit": "bottles"}, {"name": "Eggs", "quantity": 6, "unit": "pcs"}]`;

  const text = await callAPI([{ role: 'user', content: prompt }], apiKey);
  const normalized = parseItems(text);
  // Fallback: if normalization fails or returns empty, return original
  return normalized.length > 0 ? normalized : newItems;
}