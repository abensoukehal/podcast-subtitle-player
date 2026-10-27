import { newerRecords, type Backup } from '../export';
import { getDb } from './schema';

/** STO-6: everything except audio. */
export async function exportBackup(): Promise<Backup> {
  const db = await getDb();
  const [episodes, vocabulary, bookmarks, settings] = await Promise.all([
    db.getAll('episodes'),
    db.getAll('vocabulary'),
    db.getAll('bookmarks'),
    db.get('settings', 'app'),
  ]);
  return {
    app: 'subtitle-player',
    version: 1,
    exportedAt: Date.now(),
    episodes,
    vocabulary,
    bookmarks,
    settings: settings ?? null,
  };
}

/**
 * STO-6: merges by id; the newer updatedAt (episodes) or createdAt wins. Settings from the
 * backup replace the current ones. Restored episodes have no audio until it is re-imported.
 */
export async function importBackup(
  backup: Backup,
): Promise<{ episodes: number; vocabulary: number; bookmarks: number }> {
  const tx = (await getDb()).transaction(
    ['episodes', 'vocabulary', 'bookmarks', 'settings'],
    'readwrite',
  );
  const [episodes, vocabulary, bookmarks] = await Promise.all([
    tx.objectStore('episodes').getAll(),
    tx.objectStore('vocabulary').getAll(),
    tx.objectStore('bookmarks').getAll(),
  ]);
  const newEpisodes = newerRecords(episodes, backup.episodes, (e) => e.updatedAt);
  const newVocabulary = newerRecords(vocabulary, backup.vocabulary, (v) => v.createdAt);
  const newBookmarks = newerRecords(bookmarks, backup.bookmarks, (b) => b.createdAt);
  await Promise.all([
    ...newEpisodes.map((e) => tx.objectStore('episodes').put(e)),
    ...newVocabulary.map((v) => tx.objectStore('vocabulary').put(v)),
    ...newBookmarks.map((b) => tx.objectStore('bookmarks').put(b)),
    backup.settings && tx.objectStore('settings').put(backup.settings, 'app'),
  ]);
  await tx.done;
  return {
    episodes: newEpisodes.length,
    vocabulary: newVocabulary.length,
    bookmarks: newBookmarks.length,
  };
}

/** SET-2: empties every store. */
export async function deleteAllData(): Promise<void> {
  const stores = ['episodes', 'audio', 'vocabulary', 'bookmarks', 'settings'] as const;
  const tx = (await getDb()).transaction([...stores], 'readwrite');
  await Promise.all([...stores.map((s) => tx.objectStore(s).clear()), tx.done]);
}
