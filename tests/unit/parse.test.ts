import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { durationMismatchWarning, parseSubtitles } from '../../src/lib/subtitles/parse';
import { SubtitleParseError } from '../../src/lib/subtitles/types';

const parseFixture = (name: string) =>
  parseSubtitles(readFileSync(join(import.meta.dirname, '../fixtures', name), 'utf8'), name);

const summary = (name: string) =>
  parseFixture(name).cues.map(({ startSec, endSec, text }) => [startSec, endSec, text]);

describe('SRT', () => {
  it('parses a basic file', () => {
    const r = parseFixture('srt/basic.srt');
    expect(r.format).toBe('srt');
    expect(r.warnings).toEqual([]);
    expect(r.cues[1]).toEqual({
      index: 1,
      startSec: 4,
      endSec: 6.25,
      text: 'Today we talk about learning English.',
    });
    expect(r.cues).toHaveLength(3);
  });

  it('handles CRLF and a BOM', () => {
    expect(summary('srt/crlf-bom.srt')).toEqual([
      [1, 2, 'First line.'],
      [2.5, 4, 'Second line continues here.'],
    ]);
  });

  it('accepts dot separator, 1-digit hours and short fractions, ignores trailing data', () => {
    const cues = parseFixture('srt/loose-timestamps.srt').cues;
    expect(cues[0]).toMatchObject({ startSec: 1.5, endSec: 2.75 });
    expect(cues[1]!.startSec).toBeCloseTo(3723.05);
    expect(cues[1]!.endSec).toBeCloseTo(3724.123);
  });

  it('strips tags and ASS overrides, decodes entities, joins lines', () => {
    expect(parseFixture('srt/tags-entities.srt').cues.map((c) => c.text)).toEqual([
      'Rock & roll is "not" dead <yet>',
      "It's fine.",
    ]);
  });

  it('skips malformed blocks with a warning', () => {
    const r = parseFixture('srt/malformed.srt');
    expect(r.cues.map((c) => c.text)).toEqual(['Good one.', 'Good two.']);
    expect(r.warnings).toEqual(['Skipped 2 malformed blocks']);
  });

  it('treats whitespace-only lines as blank', () => {
    expect(parseFixture('srt/whitespace-blank.srt').cues).toHaveLength(2);
  });

  it('sorts, re-indexes and clamps overlapping cues', () => {
    const r = parseFixture('srt/unsorted-overlap.srt');
    expect(r.cues.map((c) => c.index)).toEqual([0, 1, 2]);
    expect(summary('srt/unsorted-overlap.srt')).toEqual([
      [1, 3, 'First, overlaps second.'],
      [3, 5, 'Second, overlaps third.'],
      [5, 7, 'Third by time.'],
    ]);
  });

  it('fixes zero-length and inverted cues, drops empty text', () => {
    expect(summary('srt/zero-length.srt')).toEqual([
      [1, 3, 'Zero length, next starts at 3.'],
      [3, 5, 'Ends before it starts, last cue.'],
    ]);
  });
});

describe('VTT', () => {
  it('parses a basic file', () => {
    const r = parseFixture('vtt/basic.vtt');
    expect(r.format).toBe('vtt');
    expect(summary('vtt/basic.vtt')).toEqual([
      [1, 3, 'Hello there.'],
      [3.5, 5, 'General Kenobi.'],
    ]);
  });

  it('skips header, NOTE, STYLE and REGION blocks; allows cue identifiers', () => {
    const r = parseFixture('vtt/blocks.vtt');
    expect(r.warnings).toEqual([]);
    expect(r.cues.map((c) => c.text)).toEqual(['Cue with an identifier.', 'Cue without one.']);
  });

  it('accepts MM:SS.mmm timestamps', () => {
    const cues = parseFixture('vtt/short-timestamps.vtt').cues;
    expect(cues[0]).toMatchObject({ startSec: 1, endSec: 2.5 });
    expect(cues[1]!.startSec).toBeCloseTo(3599.999);
    expect(cues[1]!.endSec).toBe(3601);
  });

  it('ignores cue settings', () => {
    expect(summary('vtt/settings.vtt')).toEqual([[1, 2, 'Settings are ignored.']]);
  });

  it('reads <v Speaker> tags', () => {
    expect(parseFixture('vtt/speakers.vtt').cues.map((c) => [c.speaker, c.text])).toEqual([
      ['Alice', "Hi, I'm Alice."],
      ['Bob Smith', "And I'm Bob."],
      [undefined, 'No speaker here.'],
    ]);
  });

  it('removes inline timestamps, <c> and <lang> tags', () => {
    expect(parseFixture('vtt/inline-tags.vtt').cues[0]!.text).toBe('Karaoke style words colour');
  });

  it('detects format by content, not extension', () => {
    expect(parseSubtitles('WEBVTT\n\n00:01.000 --> 00:02.000\nHi', 'x.srt').format).toBe('vtt');
    expect(parseSubtitles('00:00:01,000 --> 00:00:02,000\nHi', 'x.vtt').warnings).toHaveLength(1);
  });
});

describe('no subtitles', () => {
  it.each(['empty.srt', 'random.txt'])('%s throws "No subtitles found"', (name) => {
    expect(() => parseFixture(name)).toThrow(SubtitleParseError);
    expect(() => parseFixture(name)).toThrow('No subtitles found in this file.');
  });
});

describe('durationMismatchWarning', () => {
  const cues = parseFixture('srt/basic.srt').cues; // last cue ends at 9 s
  it('warns only when subtitles run more than 5 s past the audio', () => {
    expect(durationMismatchWarning(cues, 4)).toBe(null);
    expect(durationMismatchWarning(cues, 3.9)).toBe('These subtitles may not match this audio.');
  });
});
