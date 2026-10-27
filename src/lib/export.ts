import type { Bookmark, Episode, Settings, VocabEntry } from './db/schema';
import { formatTime } from './time';

/** RFC 4180: quote a field that holds a comma, quote or line break; double inner quotes. */
export function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** REV-2: UTF-8 with BOM and CRLF rows, so Excel and Anki read it as is. */
export function vocabularyCsv(entries: VocabEntry[]): string {
  const rows = [
    ['word', 'sentence', 'episode', 'time', 'date'],
    ...entries.map((e) => [
      e.word,
      e.sentence,
      e.episodeTitle,
      formatTime(e.timeSec),
      new Date(e.createdAt).toISOString().slice(0, 10),
    ]),
  ];
  return '\uFEFF' + rows.map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n';
}

/** STO-6: episode metadata (no audio), vocabulary, bookmarks and settings. */
export interface Backup {
  app: 'subtitle-player';
  version: 1;
  exportedAt: number;
  episodes: Episode[];
  vocabulary: VocabEntry[];
  bookmarks: Bookmark[];
  settings: Settings | null;
}

const INVALID = 'This is not a valid backup file.';

type Check = (r: Record<string, unknown>) => boolean;
const isRecordList = (v: unknown, check: Check): boolean =>
  Array.isArray(v) &&
  v.every((r) => typeof r === 'object' && r !== null && typeof r.id === 'string' && check(r));

const isEpisode: Check = (r) =>
  typeof r.title === 'string' &&
  Array.isArray(r.cues) &&
  typeof r.durationSec === 'number' &&
  typeof r.lastPositionSec === 'number' &&
  typeof r.updatedAt === 'number';
const isVocab: Check = (r) =>
  typeof r.word === 'string' && typeof r.sentence === 'string' && typeof r.createdAt === 'number';
const isBookmark: Check = (r) =>
  typeof r.episodeId === 'string' &&
  typeof r.cueIndex === 'number' &&
  typeof r.createdAt === 'number';

/** Parses and checks a backup file at the trust boundary; throws with a message to show. */
export function parseBackup(text: string): Backup {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(INVALID);
  }
  const valid =
    typeof data === 'object' &&
    data !== null &&
    data.app === 'subtitle-player' &&
    data.version === 1 &&
    isRecordList(data.episodes, isEpisode) &&
    isRecordList(data.vocabulary, isVocab) &&
    isRecordList(data.bookmarks, isBookmark) &&
    (data.settings === null || typeof data.settings === 'object');
  if (!valid) throw new Error(INVALID);
  return data as unknown as Backup;
}

/** STO-6: the incoming records that are new, or newer than the stored record with that id. */
export function newerRecords<T extends { id: string }>(
  current: T[],
  incoming: T[],
  stamp: (record: T) => number,
): T[] {
  const byId = new Map(current.map((r) => [r.id, r]));
  return incoming.filter((r) => {
    const existing = byId.get(r.id);
    return !existing || stamp(r) > stamp(existing);
  });
}
