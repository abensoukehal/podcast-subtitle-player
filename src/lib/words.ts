/** Splits a sentence into the tokens shown as word chips (SEN-1). */
export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/** Lowercased, trimmed, outer punctuation stripped; inner apostrophes and hyphens stay. */
export function normalizeWord(token: string): string {
  return token
    .trim()
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

/** An inclusive range of chip indices, or null. */
export type WordSelection = { from: number; to: number } | null;

/**
 * SEN-3: tapping a chip selects it; tapping a neighbour of the selection extends it into a
 * phrase; tapping the only selected chip clears it; any other tap starts over.
 */
export function selectWord(selection: WordSelection, index: number): WordSelection {
  if (!selection) return { from: index, to: index };
  const { from, to } = selection;
  if (index === from - 1) return { from: index, to };
  if (index === to + 1) return { from, to: index };
  if (from === to && index === from) return null;
  return { from: index, to: index };
}

/** The normalized word or phrase for a selection. */
export function selectedText(tokens: string[], selection: WordSelection): string {
  if (!selection) return '';
  return tokens
    .slice(selection.from, selection.to + 1)
    .map(normalizeWord)
    .filter(Boolean)
    .join(' ');
}

/** SEN-4: the dictionary page for a word. */
export function dictionaryUrl(template: string, word: string): string {
  return template.replaceAll('{word}', encodeURIComponent(word));
}
