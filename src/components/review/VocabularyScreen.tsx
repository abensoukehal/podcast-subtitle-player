import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { listEpisodes } from '../../lib/db/episodes';
import type { VocabEntry } from '../../lib/db/schema';
import { deleteVocab, listVocab } from '../../lib/db/vocabulary';
import { vocabularyCsv } from '../../lib/export';
import { highlightParts } from '../../lib/words';
import { downloadFile, today } from '../common/download';
import { Icon } from '../common/Icon';
import { Screen } from '../common/Screen';
import ui from '../common/ui.module.css';
import styles from '../common/screen.module.css';

async function load() {
  const [entries, episodes] = await Promise.all([listVocab(), listEpisodes()]);
  return { entries, episodeIds: new Set(episodes.map((e) => e.id)) };
}

/** REV-1, REV-2 */
export function VocabularyScreen() {
  const [data, setData] = useState<Awaited<ReturnType<typeof load>> | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    void load().then(setData);
  }, []);

  const remove = async (id: string) => {
    await deleteVocab(id);
    setData(await load());
  };

  const q = query.trim().toLowerCase();
  const shown = (data?.entries ?? []).filter(
    (e) =>
      !q ||
      e.word.includes(q) ||
      e.sentence.toLowerCase().includes(q) ||
      e.episodeTitle.toLowerCase().includes(q),
  );

  return (
    <Screen
      title="Vocabulary"
      actions={
        <button
          className={ui.button}
          disabled={!data?.entries.length}
          onClick={() =>
            downloadFile(
              `vocabulary-${today()}.csv`,
              vocabularyCsv(data?.entries ?? []),
              'text/csv;charset=utf-8',
            )
          }
        >
          Export CSV
        </button>
      }
    >
      {data?.entries.length === 0 ? (
        <p className={styles.empty}>
          No saved words yet. In an episode, open a sentence with its ⋮ button, tap a word, then tap
          Save to vocabulary.
        </p>
      ) : (
        <input
          type="search"
          className={styles.search}
          placeholder="Search words, sentences, episodes"
          aria-label="Search vocabulary"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      <ul className={styles.list}>
        {shown.map((entry) => (
          <VocabItem
            key={entry.id}
            entry={entry}
            episodeExists={data?.episodeIds.has(entry.episodeId) ?? false}
            onDelete={() => void remove(entry.id)}
          />
        ))}
      </ul>
    </Screen>
  );
}

function VocabItem({
  entry,
  episodeExists,
  onDelete,
}: {
  entry: VocabEntry;
  episodeExists: boolean;
  onDelete: () => void;
}) {
  const body = (
    <>
      <strong>{entry.word}</strong>
      <span>
        {highlightParts(entry.sentence, entry.word).map((part, i) =>
          part.match ? <mark key={i}>{part.text}</mark> : part.text,
        )}
      </span>
      <span className={styles.meta}>
        {entry.episodeTitle}
        {!episodeExists && ' (deleted)'} · {new Date(entry.createdAt).toLocaleDateString()}
      </span>
    </>
  );
  return (
    <li className={styles.item}>
      {episodeExists ? (
        <Link className={styles.itemBody} to={`/episode/${entry.episodeId}?cue=${entry.cueIndex}`}>
          {body}
        </Link>
      ) : (
        <div className={styles.itemBody}>{body}</div>
      )}
      <button className={ui.iconButton} aria-label={`Delete ${entry.word}`} onClick={onDelete}>
        <Icon name="close" size={20} />
      </button>
    </li>
  );
}
