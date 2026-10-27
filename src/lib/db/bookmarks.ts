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
