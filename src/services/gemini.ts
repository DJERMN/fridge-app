export interface DetectedItem {
  name: string;
  quantity: number;
  unit: string;
}

export interface ReconciledItem {
  name: string;
  targetQty: number;
  currentQty: number;
  unit: string;
}

const IMAGE_MODEL = 'google/gemma-3-27b-it:free'; // Best free vision model
const TEXT_MODEL = 'qwen/qwen3.6-plus:free';      // Best free text model

const SCAN_PROMPT_BASE = `Look at this image carefully.

List every food item and drink you can see.
For each item provide:
- name: product name in English
- quantity: a number (count individual pieces, bottles, packs - estimate if needed)
- unit: measurement unit (e.g. "bottles", "pcs", "packs", "kg", "l", "cans")

Reply ONLY with a JSON array. No markdown backticks. No text before or after. Example:
[
  {"name": "Milk", "quantity": 2, "unit": "bottles"},
  {"name": "Eggs", "quantity": 6, "unit": "pcs"}
]

If nothing is recognizable: []`;

function buildScanPrompt(existingNames: string[]): string {
  if (existingNames.length === 0) return SCAN_PROMPT_BASE;
  return `${SCAN_PROMPT_BASE}

IMPORTANT: We already track these items in inventory:
${existingNames.map((n) => `- ${n}`).join('\n')}

If a detected item refers to the same product as one above (e.g. "Whole Milk" = "Milk"), use the EXACT existing name. Otherwise use a clear English name.`;
}

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

async function callAPI(messages: object[], apiKey: string, model: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://djermn.github.io/fridge-app/',
      'X-Title': 'FridgeMate',
    },
    body: JSON.stringify({ model, messages }),
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
  apiKey: string,
  existingNames: string[] = []
): Promise<DetectedItem[]> {
  const text = await callAPI([
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        { type: 'text', text: buildScanPrompt(existingNames) },
      ],
    },
  ], apiKey, IMAGE_MODEL);
  return parseItems(text);
}

/**
 * @deprecated Use analyzeImage with existingNames param instead (saves one API call)
 */
export async function normalizeItems(
  existingNames: string[],
  newItems: DetectedItem[],
  apiKey: string
): Promise<DetectedItem[]> {
  if (existingNames.length === 0 || newItems.length === 0) return newItems;

  const prompt = `Match each new scanned item to an existing inventory name if they refer to the same product.

Existing inventory names:
${existingNames.map((n) => `- ${n}`).join('\n')}

New scanned items:
${JSON.stringify(newItems)}

Rules:
- If a new item matches an existing name (same product), replace its name with the EXACT existing name.
- If no match, keep the new item name as-is.
- Never merge different products. Never remove items.

Reply ONLY with a JSON array:
[{"name": "...", "quantity": N, "unit": "..."}]`;

  const text = await callAPI([{ role: 'user', content: prompt }], apiKey, TEXT_MODEL);
  const result = parseItems(text);
  return result.length > 0 ? result : newItems;
}

/**
 * Full AI reconciliation of SOLL vs IST lists.
 * Matches items across both lists by meaning, merges duplicates,
 * returns a unified inventory with correct targetQty and currentQty.
 */
export async function reconcileInventory(
  sollItems: { name: string; targetQty: number; unit: string }[],
  istItems: { name: string; currentQty: number; unit: string }[],
  apiKey: string
): Promise<ReconciledItem[]> {
  if (sollItems.length === 0 && istItems.length === 0) return [];

  const prompt = `You are reconciling two fridge inventory lists into one unified inventory.

TARGET STOCK (SOLL) - what should always be there:
${JSON.stringify(sollItems)}

CURRENT STOCK (IST) - what is currently in the fridge:
${JSON.stringify(istItems)}

Task:
1. Match items that refer to the same product across both lists (e.g. "Whole Milk" = "Milk", "OJ" = "Orange Juice").
2. Use the clearest, most common product name for matched pairs.
3. Items only in SOLL get currentQty: 0.
4. Items only in IST get targetQty: 0.
5. Never create duplicate entries for the same product.

Reply ONLY with a JSON array. No markdown. Example:
[
  {"name": "Milk", "targetQty": 2, "currentQty": 1, "unit": "bottles"},
  {"name": "Eggs", "targetQty": 12, "currentQty": 12, "unit": "pcs"},
  {"name": "Leftover Pizza", "targetQty": 0, "currentQty": 2, "unit": "slices"}
]`;

  const text = await callAPI([{ role: 'user', content: prompt }], apiKey, TEXT_MODEL);
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

  interface RawReconciled { name?: string; targetQty?: number | string; currentQty?: number | string; unit?: string; }
  let parsed: RawReconciled[];
  try {
    parsed = JSON.parse(cleaned) as RawReconciled[];
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try { parsed = JSON.parse(match[0]) as RawReconciled[]; }
      catch { throw new Error('Reconciliation failed: invalid AI response.'); }
    } else {
      throw new Error('Reconciliation failed: invalid AI response.');
    }
  }

  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((i) => i && typeof i.name === 'string' && i.name.trim().length > 0)
    .map((i) => ({
      name: i.name!.trim(),
      targetQty: typeof i.targetQty === 'number' ? i.targetQty : parseInt(String(i.targetQty ?? '0'), 10) || 0,
      currentQty: typeof i.currentQty === 'number' ? i.currentQty : parseInt(String(i.currentQty ?? '0'), 10) || 0,
      unit: typeof i.unit === 'string' ? i.unit.trim() : 'pcs',
    }));
}