import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  addEpisode,
  deleteEpisode,
  getAudio,
  getEpisode,
  listEpisodes,
  replaceAudio,
  replaceSubtitles,
  sortEpisodes,
  updateEpisode,
} from '../../src/lib/db/episodes';
import { deleteAllData, exportBackup, importBackup } from '../../src/lib/db/backup';
import {
  addBookmark,
  deleteBookmark,
  listAllBookmarks,
  listBookmarks,
  updateBookmarkNote,
} from '../../src/lib/db/bookmarks';
import { getDb, type Episode } from '../../src/lib/db/schema';
import { DEFAULT_SETTINGS, getSettings, saveSettings } from '../../src/lib/db/settings';
import { addVocab, deleteVocab, listVocab } from '../../src/lib/db/vocabulary';
import { parseBackup } from '../../src/lib/export';
import type { Cue } from '../../src/lib/subtitles/types';

const cues = (n: number): Cue[] =>
  Array.from({ length: n }, (_, i) => ({ index: i, startSec: i, endSec: i + 1, text: `s${i}` }));

const episode = (id: string, extra: Partial<Episode> = {}): Episode => ({
  id,
  title: id,
  audioFileName: `${id}.wav`,
  audioMimeType: 'audio/wav',
  subtitleFileName: `${id}.srt`,
  durationSec: 20,
  cues: cues(3),
  offsetMs: 0,
  lastPositionSec: 0,
  finished: false,
  createdAt: 1,
  updatedAt: 1,
  ...extra,
});

async function addBookmarkAndWord(episodeId: string) {
  const db = await getDb();
  await db.put('bookmarks', {
    id: `b-${episodeId}`,
    episodeId,
    cueIndex: 1,
    text: 's1',
    startSec: 1,
    createdAt: 1,
  });
  await db.put('vocabulary', {
    id: `v-${episodeId}`,
    word: 'word',
    sentence: 's1',
    episodeId,
    episodeTitle: episodeId,
    cueIndex: 1,
    timeSec: 1,
    createdAt: 1,
  });
}

describe('episodes store', () => {
  it('creates and reads an episode with its audio', async () => {
    await addEpisode(episode('read'), new Blob(['abc'], { type: 'audio/wav' }));
    expect(await getEpisode('read')).toMatchObject({ title: 'read', cues: cues(3) });
    const audio = await getAudio('read');
    expect(await audio?.text()).toBe('abc');
  });

  it('updates fields and bumps updatedAt', async () => {
    await addEpisode(episode('update'), new Blob());
    await updateEpisode('update', { lastPositionSec: 12.5, offsetMs: 300 });
    const e = await getEpisode('update');
    expect(e).toMatchObject({ lastPositionSec: 12.5, offsetMs: 300 });
    expect(e!.updatedAt).toBeGreaterThan(1);
    await updateEpisode('missing', { title: 'x' }); // no-op, no throw
    expect(await getEpisode('missing')).toBeUndefined();
  });

  it('deletes metadata, audio and bookmarks, and keeps vocabulary (STO-3)', async () => {
    await addEpisode(episode('del'), new Blob(['x']));
    await addBookmarkAndWord('del');
    await deleteEpisode('del');
    const db = await getDb();
    expect(await getEpisode('del')).toBeUndefined();
    expect(await getAudio('del')).toBeUndefined();
    expect(await db.getAllFromIndex('bookmarks', 'episodeId', 'del')).toEqual([]);
    expect(await db.getAllFromIndex('vocabulary', 'episodeId', 'del')).toHaveLength(1);
  });

  it('replacing subtitles with the same cue count keeps position and bookmarks', async () => {
    await addEpisode(episode('same', { lastPositionSec: 2 }), new Blob());
    await addBookmarkAndWord('same');
    await replaceSubtitles('same', cues(3), 'new.srt');
    expect(await getEpisode('same')).toMatchObject({
      lastPositionSec: 2,
      subtitleFileName: 'new.srt',
    });
    expect(await (await getDb()).getAllFromIndex('bookmarks', 'episodeId', 'same')).toHaveLength(1);
  });

  it('replacing subtitles with a different cue count resets position and bookmarks', async () => {
    await addEpisode(episode('diff', { lastPositionSec: 2 }), new Blob());
    await addBookmarkAndWord('diff');
    await replaceSubtitles('diff', cues(5), 'new.srt');
    const e = await getEpisode('diff');
    expect(e?.cues).toHaveLength(5);
    expect(e?.lastPositionSec).toBe(0);
    expect(await (await getDb()).getAllFromIndex('bookmarks', 'episodeId', 'diff')).toEqual([]);
  });

  it('replaces audio and keeps progress (PLY-6)', async () => {
    await addEpisode(episode('audio', { lastPositionSec: 7 }), new Blob(['old']));
    await replaceAudio('audio', new Blob(['new']), {
      audioFileName: 'a.mp3',
      audioMimeType: 'audio/mpeg',
      durationSec: 21,
    });
    expect(await (await getAudio('audio'))?.text()).toBe('new');
    expect(await getEpisode('audio')).toMatchObject({ lastPositionSec: 7, durationSec: 21 });
  });

  it('reads audio stored as bytes, for browsers that cannot store Blobs', async () => {
    await (
      await getDb()
    ).put('audio', { data: new TextEncoder().encode('pcm').buffer, type: 'audio/wav' }, 'bytes');
    const audio = await getAudio('bytes');
    expect(audio?.type).toBe('audio/wav');
    expect(await audio?.text()).toBe('pcm');
  });

  it('lists episodes in library order', async () => {
    const ids = (await listEpisodes()).map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining(['read', 'update']));
  });
});

describe('sortEpisodes (LIB-5)', () => {
  it('sorts by last played, then by date added', () => {
    const sorted = sortEpisodes([
      episode('old-new', { createdAt: 1 }),
      episode('played-early', { createdAt: 5, lastPlayedAt: 10 }),
      episode('new-new', { createdAt: 9 }),
      episode('played-late', { createdAt: 2, lastPlayedAt: 20 }),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(['played-late', 'played-early', 'new-new', 'old-new']);
  });
});

describe('vocabulary, bookmarks, settings', () => {
  const word = {
    word: 'shadowing',
    sentence: 'This is called shadowing.',
    episodeId: 'e',
    episodeTitle: 'E',
    cueIndex: 3,
    timeSec: 9,
  };

  it('saves a word once per sentence (STO-4)', async () => {
    expect(await addVocab(word)).toBe('saved');
    expect(await addVocab(word)).toBe('exists');
    expect(await addVocab({ ...word, sentence: 'Shadowing helps.' })).toBe('saved');
  });

  it('adds, lists and deletes bookmarks', async () => {
    const b = await addBookmark({ episodeId: 'bm', cueIndex: 2, text: 's2', startSec: 2 });
    expect((await listBookmarks('bm')).map((x) => x.cueIndex)).toEqual([2]);
    await deleteBookmark(b.id);
    expect(await listBookmarks('bm')).toEqual([]);
  });

  it('returns defaults until settings are saved', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
    await saveSettings({ ...DEFAULT_SETTINGS, skipSec: 10 });
    expect((await getSettings()).skipSec).toBe(10);
  });
});

describe('review data and backup (TST-6)', () => {
  it('lists vocabulary newest first and deletes entries', async () => {
    const base = { sentence: 's', episodeId: 'e', episodeTitle: 'E', cueIndex: 0, timeSec: 0 };
    await addVocab({ ...base, word: 'first' });
    await new Promise((r) => setTimeout(r, 2));
    await addVocab({ ...base, word: 'second' });
    const list = await listVocab();
    expect(list.map((v) => v.word).slice(0, 2)).toEqual(['second', 'first']);
    await deleteVocab(list[0]!.id);
    expect((await listVocab()).map((v) => v.word)).not.toContain('second');
  });

  it('edits and clears a bookmark note', async () => {
    const b = await addBookmark({ episodeId: 'note', cueIndex: 0, text: 't', startSec: 0 });
    await updateBookmarkNote(b.id, '  phrasal verb ');
    expect((await listAllBookmarks()).find((x) => x.id === b.id)?.note).toBe('phrasal verb');
    await updateBookmarkNote(b.id, '');
    expect((await listAllBookmarks()).find((x) => x.id === b.id)?.note).toBeUndefined();
  });

  it('round-trips a backup: delete everything, import, same data back', async () => {
    await addEpisode(episode('backup', { lastPositionSec: 4 }), new Blob(['audio']));
    await addBookmarkAndWord('backup');
    const saved = await exportBackup();
    const text = JSON.stringify(saved);

    await deleteAllData();
    expect(await listEpisodes()).toEqual([]);

    const counts = await importBackup(parseBackup(text));
    expect(counts.episodes).toBe(saved.episodes.length);
    expect(await getEpisode('backup')).toMatchObject({ lastPositionSec: 4 });
    expect(await getAudio('backup')).toBeUndefined(); // audio is never in a backup
    const again = await exportBackup();
    expect({ ...again, exportedAt: 0 }).toEqual({ ...saved, exportedAt: 0 });

    // A second import changes nothing: nothing is newer.
    expect(await importBackup(parseBackup(text))).toEqual({
      episodes: 0,
      vocabulary: 0,
      bookmarks: 0,
    });
  });

  it('a newer record in the backup wins, an older one does not', async () => {
    await addEpisode(episode('merge', { title: 'local', updatedAt: 10 }), new Blob());
    const backup = await exportBackup();
    const newer = {
      ...backup,
      episodes: [{ ...episode('merge'), title: 'remote', updatedAt: 9e15 }],
    };
    await importBackup(newer);
    expect((await getEpisode('merge'))?.title).toBe('remote');
    const older = { ...backup, episodes: [{ ...episode('merge'), title: 'old', updatedAt: 1 }] };
    await importBackup(older);
    expect((await getEpisode('merge'))?.title).toBe('remote');
  });
});
