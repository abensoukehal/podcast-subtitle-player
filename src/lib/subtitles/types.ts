export interface Cue {
  index: number; // 0-based, in time order
  startSec: number;
  endSec: number;
  text: string; // plain text, tags removed, lines joined with a space
  speaker?: string; // from VTT <v Name> tags if present
}

export interface ParseResult {
  format: 'srt' | 'vtt';
  cues: Cue[];
  warnings: string[];
}

/** A cue as read from the file, before cleaning and normalization. */
export interface RawCue {
  startSec: number;
  endSec: number;
  text: string;
}

export interface RawParse {
  cues: RawCue[];
  skipped: number; // malformed blocks
}

/** Thrown only when a file yields no usable cues (PAR-14). */
export class SubtitleParseError extends Error {
  name = 'SubtitleParseError';
}
