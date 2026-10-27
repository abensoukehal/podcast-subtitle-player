import { parseTimestamp } from '../time';
import type { RawCue, RawParse } from './types';

// Start and end time; anything after the end time (VTT cue settings, SRT coordinates) is ignored.
const TIMING = /^(\S+?)\s*-->\s*(\S+)/;

/** Splits LF-normalized text on one or more blank or whitespace-only lines (PAR-3). */
export function splitBlocks(text: string): string[] {
  return text
    .split(/\n(?:[ \t]*\n)+/)
    .map((b) => b.trim())
    .filter(Boolean);
}

/** Parses one block: an optional index or identifier line, the timing line, then text lines. */
export function parseCueBlock(block: string): RawCue | null {
  const lines = block.split('\n');
  const t = lines.findIndex((l) => l.includes('-->'));
  if (t < 0 || t > 1) return null;
  const m = TIMING.exec(lines[t]!.trim());
  if (!m) return null;
  const startSec = parseTimestamp(m[1]!);
  const endSec = parseTimestamp(m[2]!);
  if (startSec === null || endSec === null) return null;
  return { startSec, endSec, text: lines.slice(t + 1).join('\n') };
}

export function parseSrt(text: string): RawParse {
  const cues: RawCue[] = [];
  let skipped = 0;
  for (const block of splitBlocks(text)) {
    const cue = parseCueBlock(block);
    if (cue) cues.push(cue);
    else skipped++;
  }
  return { cues, skipped };
}
