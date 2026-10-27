import { create } from 'zustand';
import {
  addEpisode,
  deleteEpisode,
  listEpisodes,
  replaceSubtitles,
  updateEpisode,
} from '../lib/db/episodes';
import type { Episode } from '../lib/db/schema';
import { describeWriteError, persistStorage } from '../lib/db/storage';
import { isSubtitleFile, pairFiles } from '../lib/pairing';
import { durationMismatchWarning, parseSubtitles } from '../lib/subtitles/parse';
import { UNSUPPORTED_AUDIO } from './playerStore';

export type ImportStatus = 'waiting' | 'importing' | 'done' | 'error';

export interface ImportItem {
  audio: File;
  subtitle: File | null;
  status: ImportStatus;
  messages: string[];
}

interface ImportState {
  phase: 'pairing' | 'importing' | 'finished';
  items: ImportItem[];
  spare: File[]; // unpaired subtitles, offered for unpaired audio (LIB-3)
  ignored: number; // dropped files that are neither audio nor subtitles
}

interface LibraryStore {
  episodes: Episode[];
  loaded: boolean;
  message: string | null;
  importing: ImportState | null;
}

export const useLibrary = create<LibraryStore>(() => ({
  episodes: [],
  loaded: false,
  message: null,
  importing: null,
}));

function patchImport(patch: Partial<ImportState>): void {
  const current = useLibrary.getState().importing;
  if (current) useLibrary.setState({ importing: { ...current, ...patch } });
}

function patchItem(index: number, patch: Partial<ImportItem>): void {
  const items = useLibrary.getState().importing?.items ?? [];
  patchImport({ items: items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
}

// Dropped files can be anything; the file picker already limits them.
const isUsable = (f: File) =>
  isSubtitleFile(f.name) || !f.type || f.type.startsWith('audio/') || f.type.startsWith('video/');

/** LIB-1 to LIB-3: pairs the files; imports at once if nothing is left to pair. */
export function beginImport(files: File[]): void {
  const usable = files.filter(isUsable);
  const { pairs, unpairedAudio, unpairedSubtitles } = pairFiles(usable);
  const items: ImportItem[] = [
    ...pairs.map((p) => ({ audio: p.audio, subtitle: p.subtitle as File | null })),
    ...unpairedAudio.map((audio) => ({ audio, subtitle: null })),
  ].map((p) => ({ ...p, status: 'waiting', messages: [] }));
  useLibrary.setState({
    importing: {
      phase: 'pairing',
      items,
      spare: unpairedSubtitles,
      ignored: files.length - usable.length,
    },
  });
  if (items.length && unpairedAudio.length === 0) void runImport();
}

export function setImportItems(items: ImportItem[]): void {
  patchImport({ items });
}

/** LIB-4: imports the pairs one by one, with progress and warnings per file. */
export async function runImport(): Promise<void> {
  const items = useLibrary.getState().importing?.items ?? [];
  patchImport({ phase: 'importing' });
  for (const [i, item] of items.entries()) {
    if (!item.subtitle) continue;
    patchItem(i, { status: 'importing' });
    try {
      patchItem(i, { status: 'done', messages: await importPair(item.audio, item.subtitle) });
    } catch (e) {
      patchItem(i, { status: 'error', messages: [e instanceof Error ? e.message : String(e)] });
    }
  }
  await refreshLibrary();
  patchImport({ phase: 'finished' });
}

export function closeImport(): void {
  useLibrary.setState({ importing: null });
}

export async function refreshLibrary(): Promise<void> {
  useLibrary.setState({ episodes: await listEpisodes(), loaded: true });
}

/** Runs a library write, shows a failure (STO-5), then reloads the list. */
async function run(write: () => Promise<void>): Promise<void> {
  try {
    await write();
  } catch (e) {
    useLibrary.setState({ message: await describeWriteError(e) });
  }
  await refreshLibrary();
}

/** LIB-4: reads the duration with a temporary audio element. Rejects if it cannot play. */
export function readDuration(audio: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const el = new Audio();
    const url = URL.createObjectURL(audio);
    const done = () => {
      URL.revokeObjectURL(url);
      el.removeAttribute('src');
      el.load();
    };
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      const d = el.duration;
      done();
      resolve(Number.isFinite(d) ? d : 0);
    };
    el.onerror = () => {
      done();
      reject(new Error(UNSUPPORTED_AUDIO));
    };
    el.src = url;
  });
}

/**
 * LIB-4: parses, checks the audio plays, then saves one pair. Returns parser warnings;
 * throws an Error whose message is ready to show.
 */
export async function importPair(audio: File, subtitles: File): Promise<string[]> {
  const parsed = parseSubtitles(await subtitles.text(), subtitles.name);
  const durationSec = await readDuration(audio);
  const now = Date.now();
  const episode: Episode = {
    id: crypto.randomUUID(),
    title: audio.name.replace(/\.[^.]*$/, ''),
    audioFileName: audio.name,
    audioMimeType: audio.type,
    subtitleFileName: subtitles.name,
    durationSec,
    cues: parsed.cues,
    offsetMs: 0,
    lastPositionSec: 0,
    finished: false,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await addEpisode(episode, audio);
  } catch (e) {
    throw new Error(await describeWriteError(e), { cause: e });
  }
  void persistStorage(); // STO-1
  const mismatch = durationMismatchWarning(parsed.cues, durationSec);
  return mismatch ? [...parsed.warnings, mismatch] : parsed.warnings;
}

export const renameEpisode = (id: string, title: string) => run(() => updateEpisode(id, { title }));

export const setFinished = (id: string, finished: boolean) =>
  run(() => updateEpisode(id, { finished }));

export const removeEpisode = (id: string) => run(() => deleteEpisode(id));

export const SUBTITLE_RESET_WARNING =
  'These subtitles have a different number of sentences. The position and bookmarks of this episode will be removed. Continue?';

/**
 * LIB-6: parses the new subtitles; if the sentence count changed, asks before position and
 * bookmarks are reset. Used from the library card and the player menu (UI-2).
 */
export async function replaceEpisodeSubtitles(
  episode: Episode,
  file: File,
  confirmReset: () => boolean,
): Promise<{ replaced: boolean; error?: string }> {
  let cues;
  try {
    cues = parseSubtitles(await file.text(), file.name).cues;
  } catch (e) {
    return { replaced: false, error: e instanceof Error ? e.message : String(e) };
  }
  if (cues.length !== episode.cues.length && !confirmReset()) return { replaced: false };
  try {
    await replaceSubtitles(episode.id, cues, file.name);
  } catch (e) {
    return { replaced: false, error: await describeWriteError(e) };
  }
  await refreshLibrary();
  return { replaced: true };
}
