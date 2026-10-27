import { describe, expect, it } from 'vitest';
import type { VocabEntry } from '../../src/lib/db/schema';
import { csvField, newerRecords, parseBackup, vocabularyCsv } from '../../src/lib/export';

const entry = (word: string, sentence: string): VocabEntry => ({
  id: word,
  word,
  sentence,
  episodeId: 'e',
  episodeTitle: 'Episode, "one"',
  cueIndex: 0,
  timeSec: 75,
  createdAt: Date.UTC(2026, 9, 27, 12),
});

describe('CSV export (TST-4)', () => {
  it('quotes fields with commas, quotes and line breaks', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('a, b')).toBe('"a, b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('two\nlines')).toBe('"two\nlines"');
    expect(csvField('cr\rhere')).toBe('"cr\rhere"');
  });

  it('starts with a BOM and has a header row and CRLF rows', () => {
    const csv = vocabularyCsv([entry('give up', 'Never, ever "give up".')]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.slice(1).split('\r\n')).toEqual([
      'word,sentence,episode,time,date',
      'give up,"Never, ever ""give up"".","Episode, ""one""",1:15,2026-10-27',
      '',
    ]);
  });
});

describe('backup', () => {
  const backup = {
    app: 'subtitle-player',
    version: 1,
    exportedAt: 1,
    episodes: [
      {
        id: 'e',
        title: 'E',
        cues: [],
        durationSec: 10,
        lastPositionSec: 0,
        updatedAt: 1,
      },
    ],
    vocabulary: [entry('word', 'A word.')],
    bookmarks: [{ id: 'b', episodeId: 'e', cueIndex: 0, createdAt: 1 }],
    settings: null,
  };

  it('parses a valid backup', () => {
    expect(parseBackup(JSON.stringify(backup)).episodes).toHaveLength(1);
  });

  it.each([
    ['not JSON', '{oops'],
    ['another app', JSON.stringify({ ...backup, app: 'other' })],
    ['an episode without cues', JSON.stringify({ ...backup, episodes: [{ id: 'e', title: 'E' }] })],
    ['a record without id', JSON.stringify({ ...backup, bookmarks: [{ episodeId: 'e' }] })],
    ['null', 'null'],
  ])('rejects %s', (_, text) => {
    expect(() => parseBackup(text)).toThrow('This is not a valid backup file.');
  });

  it('keeps only new or newer records', () => {
    const current = [
      { id: 'a', t: 5 },
      { id: 'b', t: 5 },
    ];
    const incoming = [
      { id: 'a', t: 4 }, // older: keep current
      { id: 'b', t: 6 }, // newer: take
      { id: 'c', t: 1 }, // new: take
    ];
    expect(newerRecords(current, incoming, (r) => r.t).map((r) => r.id)).toEqual(['b', 'c']);
  });
});
