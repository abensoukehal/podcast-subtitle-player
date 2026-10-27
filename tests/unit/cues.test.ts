import { describe, expect, it } from 'vitest';
import {
  cueSeekTime,
  cueTime,
  currentSentenceIndex,
  findCueIndexAt,
  nextCueIndex,
  prevCueIndex,
} from '../../src/lib/cues';
import type { Cue } from '../../src/lib/subtitles/types';

const cue = (index: number, startSec: number, endSec: number): Cue => ({
  index,
  startSec,
  endSec,
  text: `cue ${index}`,
});
// Gap between 3 and 4; cues 1 and 2 touch at 6.
const cues = [cue(0, 1, 3), cue(1, 4, 6), cue(2, 6, 9)];

describe('findCueIndexAt', () => {
  it.each([
    [1, 0], // exactly start
    [2.99, 0],
    [3, -1], // exactly end, in gap
    [3.5, -1],
    [6, 2], // end of 1 is start of 2
    [0.5, -1], // before first
    [9, -1], // after last
    [100, -1],
  ])('t=%s gives %s', (t, expected) => {
    expect(findCueIndexAt(cues, t)).toBe(expected);
  });

  it('works with one cue and with none', () => {
    expect(findCueIndexAt([cue(0, 1, 2)], 1.5)).toBe(0);
    expect(findCueIndexAt([cue(0, 1, 2)], 2)).toBe(-1);
    expect(findCueIndexAt([], 1)).toBe(-1);
  });
});

describe('currentSentenceIndex', () => {
  it.each([
    [0, 0], // before first
    [2, 0],
    [3.5, 0], // gap keeps previous sentence
    [4, 1],
    [50, 2],
  ])('t=%s gives %s', (t, expected) => {
    expect(currentSentenceIndex(cues, t)).toBe(expected);
  });

  it('returns -1 with no cues', () => {
    expect(currentSentenceIndex([], 1)).toBe(-1);
  });
});

describe('sync offset', () => {
  it('positive offset makes subtitles appear later', () => {
    // Audio at 4.2 s with +500 ms offset is cue time 3.7 s: still in the gap.
    expect(findCueIndexAt(cues, cueTime(4.2, 500))).toBe(-1);
    expect(findCueIndexAt(cues, cueTime(4.5, 500))).toBe(1);
    expect(cueTime(4, -250)).toBe(4.25);
  });

  it('seek time includes offset and pre-roll, clamped at 0', () => {
    expect(cueSeekTime(cues[1]!, 0)).toBeCloseTo(3.85);
    expect(cueSeekTime(cues[1]!, 1000)).toBeCloseTo(4.85);
    expect(cueSeekTime(cue(0, 0.1, 1), 0)).toBe(0);
  });
});

describe('prevCueIndex (CUE-4)', () => {
  it('restarts the current cue after more than 1 s', () => {
    expect(prevCueIndex(cues, 5.1)).toBe(1);
    expect(prevCueIndex(cues, 3.5)).toBe(0); // in the gap, 2.5 s after cue 0 started
  });

  it('goes to the previous cue within the first second', () => {
    expect(prevCueIndex(cues, 4.5)).toBe(0);
    expect(prevCueIndex(cues, 5)).toBe(0);
  });

  it('treats a pre-rolled position as the target cue', () => {
    expect(prevCueIndex(cues, cueSeekTime(cues[2]!, 0))).toBe(1);
  });

  it('stays at 0 on the first cue and before it', () => {
    expect(prevCueIndex(cues, 1.5)).toBe(0);
    expect(prevCueIndex(cues, 0)).toBe(0);
    expect(prevCueIndex([], 0)).toBe(-1);
  });
});

describe('nextCueIndex (CUE-5)', () => {
  it('goes to the next cue', () => {
    expect(nextCueIndex(cues, 0)).toBe(0);
    expect(nextCueIndex(cues, 2)).toBe(1);
    expect(nextCueIndex(cues, 3.5)).toBe(1);
  });

  it('moves on from a pre-rolled position', () => {
    expect(nextCueIndex(cues, cueSeekTime(cues[1]!, 0))).toBe(2);
  });

  it('does nothing on the last cue', () => {
    expect(nextCueIndex(cues, 7)).toBe(-1);
    expect(nextCueIndex([], 0)).toBe(-1);
  });
});
