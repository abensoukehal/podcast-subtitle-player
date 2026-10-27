import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { deleteBookmark, listAllBookmarks, updateBookmarkNote } from '../../lib/db/bookmarks';
import { listEpisodes } from '../../lib/db/episodes';
import type { Bookmark } from '../../lib/db/schema';
import { formatTime } from '../../lib/time';
import { Icon } from '../common/Icon';
import { Screen } from '../common/Screen';
import ui from '../common/ui.module.css';
import styles from '../common/screen.module.css';

interface Group {
  episodeId: string;
  title: string | null; // null: the episode no longer exists
  bookmarks: Bookmark[];
}

/** Groups in library order, bookmarks in sentence order. */
async function load(): Promise<Group[]> {
  const [bookmarks, episodes] = await Promise.all([listAllBookmarks(), listEpisodes()]);
  const groups = new Map<string, Group>(
    episodes.map((e) => [e.id, { episodeId: e.id, title: e.title, bookmarks: [] }]),
  );
  for (const b of bookmarks) {
    if (!groups.has(b.episodeId)) {
      groups.set(b.episodeId, { episodeId: b.episodeId, title: null, bookmarks: [] });
    }
    groups.get(b.episodeId)!.bookmarks.push(b);
  }
  return [...groups.values()]
    .filter((g) => g.bookmarks.length)
    .map((g) => ({ ...g, bookmarks: g.bookmarks.sort((a, b) => a.cueIndex - b.cueIndex) }));
}

/** REV-3 */
export function BookmarksScreen() {
  const [groups, setGroups] = useState<Group[] | null>(null);

  useEffect(() => {
    void load().then(setGroups);
  }, []);

  const remove = async (id: string) => {
    await deleteBookmark(id);
    setGroups(await load());
  };

  return (
    <Screen title="Bookmarks">
      {groups?.length === 0 && (
        <p className={styles.empty}>
          No bookmarks yet. In an episode, open a sentence with its ⋮ button and tap Bookmark.
        </p>
      )}
      {groups?.map((group) => (
        <section key={group.episodeId} className={styles.group}>
          <h2 className={styles.groupTitle}>{group.title ?? 'Deleted episode'}</h2>
          <ul className={styles.list}>
            {group.bookmarks.map((b) => (
              <li key={b.id} className={styles.item}>
                <div className={styles.itemBody}>
                  {group.title === null ? (
                    <span>{b.text}</span>
                  ) : (
                    <Link to={`/episode/${b.episodeId}?cue=${b.cueIndex}&play=1`}>
                      <span className={styles.meta}>{formatTime(b.startSec)}</span> {b.text}
                    </Link>
                  )}
                  <input
                    className={styles.input}
                    aria-label={`Note for the sentence at ${formatTime(b.startSec)}`}
                    placeholder="Add a note"
                    defaultValue={b.note ?? ''}
                    onBlur={(e) => {
                      if (e.target.value.trim() !== (b.note ?? '')) {
                        void updateBookmarkNote(b.id, e.target.value);
                      }
                    }}
                  />
                </div>
                <button
                  className={ui.iconButton}
                  aria-label={`Remove bookmark at ${formatTime(b.startSec)}`}
                  onClick={() => void remove(b.id)}
                >
                  <Icon name="close" size={20} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Screen>
  );
}
