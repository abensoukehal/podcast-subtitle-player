import { describe, expect, it } from 'vitest';
import {
  dictionaryUrl,
  normalizeWord,
  selectedText,
  selectWord,
  splitWords,
} from '../../src/lib/words';

describe('words', () => {
  it('normalizes words', () => {
    expect(normalizeWord(' "Hello,"  ')).toBe('hello');
    expect(normalizeWord("Don't")).toBe("don't");
    expect(normalizeWord('well-known.')).toBe('well-known');
    expect(normalizeWord('Café!')).toBe('café');
    expect(normalizeWord('—')).toBe('');
  });

  it('selects words and phrases', () => {
    let s = selectWord(null, 2);
    expect(s).toEqual({ from: 2, to: 2 });
    s = selectWord(s, 3);
    expect(s).toEqual({ from: 2, to: 3 });
    s = selectWord(s, 1);
    expect(s).toEqual({ from: 1, to: 3 });
    expect(selectWord(s, 5)).toEqual({ from: 5, to: 5 }); // not adjacent: start over
    expect(selectWord(s, 2)).toEqual({ from: 2, to: 2 }); // inside a phrase: start over
    expect(selectWord({ from: 4, to: 4 }, 4)).toBe(null); // same single word: clear
  });

  it('builds the selected phrase', () => {
    const tokens = splitWords('Let’s  give up, — okay?');
    expect(tokens).toEqual(['Let’s', 'give', 'up,', '—', 'okay?']);
    expect(selectedText(tokens, { from: 1, to: 2 })).toBe('give up');
    expect(selectedText(tokens, { from: 2, to: 4 })).toBe('up okay');
    expect(selectedText(tokens, null)).toBe('');
  });

  it('fills the dictionary template', () => {
    expect(dictionaryUrl('https://d.example/{word}?q={word}', 'give up')).toBe(
      'https://d.example/give%20up?q=give%20up',
    );
  });
});
