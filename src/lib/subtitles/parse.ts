import { parseSrt } from './parseSrt';
import { parseVtt } from './parseVtt';
import { SubtitleParseError, type Cue, type ParseResult } from './types';

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  nbsp: ' ',
};

/** Removes tags and ASS overrides, decodes entities, joins lines (PAR-4, PAR-10). */
export function cleanCueText(raw: string): { text: string; speaker?: string } {
  const voice = /^\s*<v(?:\.[^\s>]*)?\s+([^>]+)>/.exec(raw);
  const text = raw
    .replace(/<[^>]*>/g, '') // <i>, <font …>, <c.x>, <v Name>, <00:00:01.000>, …
    .replace(/\{\\[^}]*\}/g, '') // {\an8}
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e: string) => ENTITIES[e]!)
    .replace(/\s+/g, ' ')
    .trim();
  const speaker = voice?.[1]?.trim();
  return speaker ? { text, speaker } : { text };
}

/**
 * Parses SRT or VTT text into sorted, non-overlapping cues. Malformed blocks are
 * skipped and reported as warnings; throws SubtitleParseError only if no cue is left.
 */
export function parseSubtitles(text: string, fileName: string): ParseResult {
  const src = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n'); // PAR-1
  const format = src.startsWith('WEBVTT') ? 'vtt' : 'srt'; // PAR-2
  const raw = format === 'vtt' ? parseVtt(src) : parseSrt(src);

  const warnings: string[] = [];
  if (format === 'srt' && /\.vtt$/i.test(fileName)) {
    warnings.push('This .vtt file has no WEBVTT header, so it was read as SRT.');
  }
  if (raw.skipped) {
    warnings.push(`Skipped ${raw.skipped} malformed block${raw.skipped === 1 ? '' : 's'}`);
  }

  const sorted = raw.cues
    .map((c) => ({ startSec: c.startSec, endSec: c.endSec, ...cleanCueText(c.text) }))
    .filter((c) => c.text) // PAR-5
    .sort((a, b) => a.startSec - b.startSec); // PAR-11

  const cues: Cue[] = sorted.map((c, index) => {
    const next = sorted[index + 1]?.startSec;
    let endSec = c.endSec > c.startSec ? c.endSec : (next ?? c.startSec + 2); // PAR-12
    if (next !== undefined && endSec > next) endSec = next; // PAR-13
    return { ...c, index, endSec };
  });

  if (!cues.length) throw new SubtitleParseError('No subtitles found in this file.'); // PAR-14
  return { format, cues, warnings };
}

/** PAR-15: warning text when the subtitles run more than 5 s past the audio, else null. */
export function durationMismatchWarning(cues: Cue[], durationSec: number): string | null {
  const last = cues.at(-1);
  return last && last.endSec > durationSec + 5 ? 'These subtitles may not match this audio.' : null;
}
