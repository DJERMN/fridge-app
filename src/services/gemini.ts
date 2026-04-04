import type { FridgeItem } from '../types';

const PROMPT = `Analysiere dieses Bild meines Kühlschranks. Identifiziere alle sichtbaren Lebensmittel und Getränke. Antworte NUR mit einem JSON-Array im folgenden Format, ohne Markdown-Blöcke: [{"name": "Milch", "quantity": "1 Flasche, fast voll", "status": "ok"}]. Mögliche Status-Werte: ok (ausreichend vorhanden), low (wenig vorhanden), empty (leer oder fast nicht mehr vorhanden). Wenn du kein Lebensmittel erkennst oder kein Kühlschrank zu sehen ist, antworte mit [].`;

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
}

interface RawItem {
  name?: string;
  quantity?: string;
  status?: string;
}

export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  apiKey: string
): Promise<FridgeItem[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
          { text: PROMPT },
        ],
      },
    ],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';

  // Strip potential markdown code fences
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();

  let parsed: RawItem[];
  try {
    parsed = JSON.parse(cleaned) as RawItem[];
  } catch {
    throw new Error('Gemini returned invalid JSON: ' + cleaned);
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((item) => item && typeof item.name === 'string')
    .map((item) => ({
      id: crypto.randomUUID(),
      name: item.name as string,
      quantity: typeof item.quantity === 'string' ? item.quantity : '',
      status: (['ok', 'low', 'empty'].includes(item.status ?? '') ? item.status : 'ok') as
        | 'ok'
        | 'low'
        | 'empty',
      addedAt: Date.now(),
    }));
}
