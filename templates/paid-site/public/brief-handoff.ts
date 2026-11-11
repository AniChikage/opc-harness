/** One-use, per-project handoff. Viewing a preview never replaces a saved draft. */
export interface BriefInput { idea: string; audience: string; outcome: string }
export type HandoffStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export function handoffKey(href: string): string {
  return 'opc.brief-handoff:' + new URL('.', href).pathname;
}
export function parseBriefInput(value: unknown): BriefInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const limits = { idea: 3000, audience: 300, outcome: 500 } as const;
  const result: BriefInput = { idea: '', audience: '', outcome: '' };
  for (const field of ['idea', 'audience', 'outcome'] as const) {
    const text = record[field];
    if (typeof text !== 'string' || !text.trim() || text.length > limits[field]) return null;
    result[field] = text.trim();
  }
  return result;
}
export function stageBrief(storage: HandoffStorage, href: string, value: unknown): boolean {
  const brief = parseBriefInput(value);
  if (!brief) return false;
  try { storage.setItem(handoffKey(href), JSON.stringify(brief)); return true; }
  catch { return false; }
}
export function consumeBrief(storage: HandoffStorage, href: string): BriefInput | null {
  try {
    const key = handoffKey(href), raw = storage.getItem(key);
    storage.removeItem(key);
    if (!raw || raw.length > 32000) return null;
    return parseBriefInput(JSON.parse(raw));
  } catch { return null; }
}
