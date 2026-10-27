import { parseCueBlock, splitBlocks } from './parseSrt';
import type { RawCue, RawParse } from './types';

export function parseVtt(text: string): RawParse {
  const cues: RawCue[] = [];
  let skipped = 0;
  // The first block is the WEBVTT header.
  for (const block of splitBlocks(text).slice(1)) {
    if (/^(NOTE|STYLE|REGION)(\s|$)/.test(block)) continue; // PAR-8
    const cue = parseCueBlock(block);
    if (cue) cues.push(cue);
    else skipped++;
  }
  return { cues, skipped };
}
