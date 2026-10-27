import { deleteDB, openDB } from 'idb';
import type { Cue } from '../subtitles/types';
import { getDb, type Episode, type StoredAudio } from './schema';

/** LIB-5: last played first, then never-played episodes by date added, newest first. */
export function sortEpisodes(episodes: Episode[]): Episode[] {
  return [...episodes].sort(
    (a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0) || b.createdAt - a.createdAt,
  );
}

export async function listEpisodes(): Promise<Episode[]> {
  return sortEpisodes(await (await getDb()).getAll('episodes'));
}

export async function getEpisode(id: string): Promise<Episode | undefined> {
  return (await getDb()).get('episodes', id);
}

export async function getAudio(id: string): Promise<Blob | undefined> {
  const audio = await (await getDb()).get('audio', id);
  return audio instanceof Blob || !audio ? audio : new Blob([audio.data], { type: audio.type });
}

let blobSupport: Promise<boolean> | undefined;

/**
 * WebKit refuses Blobs in IndexedDB in some sessions (private browsing, test browsers), and
 * a refused write stalls later transactions on the same stores. So support is probed once,
 * in a throwaway database.
 */
function canStoreBlobs(): Promise<boolean> {
  blobSupport ??= (async () => {
    try {
      const probe = await openDB('blob-probe', 1, { upgrade: (d) => d.createObjectStore('p') });
      try {
        await probe.put('p', new Blob(['x']), 'x');
        return true;
      } finally {
        probe.close();
        void deleteDB('blob-probe');
      }
    } catch {
      return false;
    }
  })();
  return blobSupport;
}

/** Audio is stored as a Blob, or as its bytes where Blobs are refused. */
async function toStored(audio: Blob): Promise<StoredAudio> {
  return (await canStoreBlobs()) ? audio : { data: await audio.arrayBuffer(), type: audio.type };
}

export async function addEpisode(episode: Episode, audio: Blob): Promise<void> {
  const stored = await toStored(audio);
  const tx = (await getDb()).transaction(['episodes', 'audio'], 'readwrite');
  await Promise.all([
    tx.objectStore('episodes').add(episode),
    tx.objectStore('audio').put(stored, episode.id),
    tx.done,
  ]);
}

/** Merges a patch and bumps updatedAt. Does nothing if the episode was deleted. */
export async function updateEpisode(
  id: string,
  patch: Partial<Omit<Episode, 'id' | 'createdAt'>>,
): Promise<void> {
  const tx = (await getDb()).transaction('episodes', 'readwrite');
  const episode = await tx.store.get(id);
  if (episode) await tx.store.put({ ...episode, ...patch, updatedAt: Date.now() });
  await tx.done;
}

/** PLY-6: new audio for an existing episode; subtitles, progress and bookmarks are kept. */
export async function replaceAudio(
  id: string,
  audio: Blob,
  info: Pick<Episode, 'audioFileName' | 'audioMimeType' | 'durationSec'>,
): Promise<void> {
  const stored = await toStored(audio);
  const tx = (await getDb()).transaction(['episodes', 'audio'], 'readwrite');
  const episode = await tx.objectStore('episodes').get(id);
  if (episode) {
    await tx.objectStore('episodes').put({ ...episode, ...info, updatedAt: Date.now() });
    await tx.objectStore('audio').put(stored, id);
  }
  await tx.done;
}

/**
 * LIB-6: new subtitles keep the position and bookmarks only if the cue count is unchanged;
 * otherwise the position is reset and the bookmarks are removed.
 */
export async function replaceSubtitles(
  id: string,
  cues: Cue[],
  subtitleFileName: string,
): Promise<void> {
  const tx = (await getDb()).transaction(['episodes', 'bookmarks'], 'readwrite');
  const episode = await tx.objectStore('episodes').get(id);
  if (episode) {
    const keep = episode.cues.length === cues.length;
    await tx.objectStore('episodes').put({
      ...episode,
      cues,
      subtitleFileName,
      lastPositionSec: keep ? episode.lastPositionSec : 0,
      updatedAt: Date.now(),
    });
    if (!keep) {
      const keys = await tx.objectStore('bookmarks').index('episodeId').getAllKeys(id);
      await Promise.all(keys.map((k) => tx.objectStore('bookmarks').delete(k)));
    }
  }
  await tx.done;
}

/** STO-3: metadata, audio and bookmarks go in one transaction; vocabulary is kept. */
export async function deleteEpisode(id: string): Promise<void> {
  const tx = (await getDb()).transaction(['episodes', 'audio', 'bookmarks'], 'readwrite');
  const bookmarks = tx.objectStore('bookmarks');
  const keys = await bookmarks.index('episodeId').getAllKeys(id);
  await Promise.all([
    tx.objectStore('episodes').delete(id),
    tx.objectStore('audio').delete(id),
    ...keys.map((k) => bookmarks.delete(k)),
  ]);
  await tx.done;
}
