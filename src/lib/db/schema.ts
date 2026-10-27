import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Cue } from '../subtitles/types';

export type AutoPauseMode =
  { kind: 'off' } | { kind: 'manual' } | { kind: 'timed'; factor: number };

export interface Episode {
  id: string;
  title: string;
  audioFileName: string;
  audioMimeType: string;
  subtitleFileName: string;
  durationSec: number;
  cues: Cue[];
  offsetMs: number; // -5000..5000
  lastPositionSec: number;
  finished: boolean;
  createdAt: number;
  updatedAt: number;
  lastPlayedAt?: number;
}

export interface VocabEntry {
  id: string;
  word: string;
  sentence: string;
  episodeId: string;
  episodeTitle: string; // copied, so export still works after the episode is deleted
  cueIndex: number;
  timeSec: number;
  createdAt: number;
}

export interface Bookmark {
  id: string;
  episodeId: string;
  cueIndex: number;
  text: string;
  startSec: number;
  note?: string;
  createdAt: number;
}

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  fontSize: 'S' | 'M' | 'L' | 'XL';
  defaultRate: number;
  skipSec: 5 | 10 | 15;
  autoScroll: boolean;
  subtitleVisibility: 'visible' | 'blurred' | 'hidden';
  revealAfterCue: boolean;
  autoPause: AutoPauseMode;
  dictionaryUrlTemplate: string;
  keepScreenOn: boolean; // MOB-4: while playing in Caption view
}

/** A Blob, or its bytes where the browser cannot store Blobs (see toStored in episodes.ts). */
export type StoredAudio = Blob | { data: ArrayBuffer; type: string };

export interface PlayerDB extends DBSchema {
  episodes: { key: string; value: Episode; indexes: { lastPlayedAt: number; createdAt: number } };
  audio: { key: string; value: StoredAudio };
  vocabulary: {
    key: string;
    value: VocabEntry;
    indexes: { episodeId: string; createdAt: number; word: string };
  };
  bookmarks: { key: string; value: Bookmark; indexes: { episodeId: string; createdAt: number } };
  settings: { key: string; value: Settings };
}

let db: Promise<IDBPDatabase<PlayerDB>> | undefined;

/** The one database, opened once. All stores are created in version 1. */
export function getDb(): Promise<IDBPDatabase<PlayerDB>> {
  db ??= openDB<PlayerDB>('subtitle-player', 1, {
    upgrade(d) {
      const episodes = d.createObjectStore('episodes', { keyPath: 'id' });
      episodes.createIndex('lastPlayedAt', 'lastPlayedAt');
      episodes.createIndex('createdAt', 'createdAt');
      d.createObjectStore('audio');
      const vocabulary = d.createObjectStore('vocabulary', { keyPath: 'id' });
      vocabulary.createIndex('episodeId', 'episodeId');
      vocabulary.createIndex('createdAt', 'createdAt');
      vocabulary.createIndex('word', 'word');
      const bookmarks = d.createObjectStore('bookmarks', { keyPath: 'id' });
      bookmarks.createIndex('episodeId', 'episodeId');
      bookmarks.createIndex('createdAt', 'createdAt');
      d.createObjectStore('settings');
    },
  });
  return db;
}
