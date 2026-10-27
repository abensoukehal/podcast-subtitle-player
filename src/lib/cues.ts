import type { Cue } from './subtitles/types';

/** CUE-3: seeks land this far before a cue start so the first syllable is not cut. */
export const PRE_ROLL_SEC = 0.15;

/**
 * Navigation treats a position this close before a cue start as inside that cue,
 * so Next right after a pre-rolled seek moves on instead of re-targeting the same cue.
 */
const NAV_LEAD_SEC = 0.2;

/** Cue time for a media time: a positive offset makes subtitles appear later. */
export function cueTime(currentTimeSec: number, offsetMs: number): number {
  return currentTimeSec - offsetMs / 1000;
}

/** Media time to seek to for a cue, with pre-roll, clamped at 0 (CUE-3). */
export function cueSeekTime(cue: Cue, offsetMs: number): number {
  return Math.max(0, cue.startSec + offsetMs / 1000 - PRE_ROLL_SEC);
}

/** Binary search: index of the last cue with startSec <= t, or -1. */
function lastStartedAt(cues: readonly Cue[], t: number): number {
  let lo = 0;
  let hi = cues.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid]!.startSec <= t) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/** CUE-1: index of the cue with start <= t < end, or -1 in a gap. Cues must not overlap. */
export function findCueIndexAt(cues: readonly Cue[], t: number): number {
  const i = lastStartedAt(cues, t);
  return i >= 0 && t < cues[i]!.endSec ? i : -1;
}

/** CUE-2: last cue with start <= t, 0 before the first cue, -1 if there are no cues. */
export function currentSentenceIndex(cues: readonly Cue[], t: number): number {
  return cues.length ? Math.max(0, lastStartedAt(cues, t)) : -1;
}

/** CUE-4: restart the current cue if more than 1 s of it has played, else the previous cue. */
export function prevCueIndex(cues: readonly Cue[], t: number): number {
  if (!cues.length) return -1;
  const i = Math.max(0, lastStartedAt(cues, t + NAV_LEAD_SEC));
  return t - cues[i]!.startSec > 1 ? i : Math.max(0, i - 1);
}

/** CUE-5: the next cue, or -1 on the last cue. */
export function nextCueIndex(cues: readonly Cue[], t: number): number {
  const i = lastStartedAt(cues, t + NAV_LEAD_SEC) + 1;
  return i < cues.length ? i : -1;
}
