import { getDb, type Bookmark } from './schema';

export async function listBookmarks(episodeId: string): Promise<Bookmark[]> {
  return (await getDb()).getAllFromIndex('bookmarks', 'episodeId', episodeId);
}

export async function addBookmark(fields: Omit<Bookmark, 'id' | 'createdAt'>): Promise<Bookmark> {
  const bookmark = { ...fields, id: crypto.randomUUID(), createdAt: Date.now() };
  await (await getDb()).add('bookmarks', bookmark);
  return bookmark;
}

export async function deleteBookmark(id: string): Promise<void> {
  await (await getDb()).delete('bookmarks', id);
}

export async function listAllBookmarks(): Promise<Bookmark[]> {
  return (await getDb()).getAll('bookmarks');
}

/** REV-3: an empty note removes it. */
export async function updateBookmarkNote(id: string, note: string): Promise<void> {
  const tx = (await getDb()).transaction('bookmarks', 'readwrite');
  const bookmark = await tx.store.get(id);
  if (bookmark) await tx.store.put({ ...bookmark, note: note.trim() || undefined });
  await tx.done;
}
