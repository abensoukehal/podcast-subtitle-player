import { useRef } from 'react';
import { Link } from 'react-router';
import type { Episode } from '../../lib/db/schema';
import { formatTime } from '../../lib/time';
import {
  removeEpisode,
  renameEpisode,
  replaceEpisodeSubtitles,
  setFinished,
  SUBTITLE_RESET_WARNING,
  useLibrary,
} from '../../stores/libraryStore';
import { Icon } from '../common/Icon';
import ui from '../common/ui.module.css';
import styles from './library.module.css';

/** LIB-5 card with the LIB-6 actions menu. */
export function EpisodeCard({ episode }: { episode: Episode }) {
  const { id, title, durationSec, cues, finished } = episode;
  const subtitleInput = useRef<HTMLInputElement>(null);
  const menuId = `menu-${id}`;
  const position = finished ? durationSec : Math.min(episode.lastPositionSec, durationSec);
  const closeMenu = () => document.getElementById(menuId)?.hidePopover();

  const rename = () => {
    closeMenu();
    const name = prompt('Episode title', title)?.trim();
    if (name && name !== title) void renameEpisode(id, name);
  };

  const remove = () => {
    closeMenu();
    if (confirm(`Delete "${title}"? Its audio and bookmarks are removed; saved words are kept.`)) {
      void removeEpisode(id);
    }
  };

  return (
    <li className={styles.card}>
      <Link to={`/episode/${id}`} className={styles.cardLink}>
        <h2 className={styles.cardTitle}>{title}</h2>
        <p className={styles.meta}>
          {formatTime(durationSec)} · {cues.length} sentence{cues.length === 1 ? '' : 's'}
          {finished && <span className={styles.badge}>Finished</span>}
        </p>
        <progress
          className={styles.progress}
          max={durationSec || 1}
          value={position}
          aria-label={`Progress: ${formatTime(position)} of ${formatTime(durationSec)}`}
        />
      </Link>
      <button className={ui.iconButton} aria-label={`Actions for ${title}`} popoverTarget={menuId}>
        <Icon name="more" />
      </button>
      <div id={menuId} popover="auto" className={ui.menu}>
        <button className={ui.menuItem} onClick={rename}>
          Rename
        </button>
        <button
          className={ui.menuItem}
          onClick={() => {
            closeMenu();
            subtitleInput.current?.click();
          }}
        >
          Replace subtitles
        </button>
        <button
          className={ui.menuItem}
          onClick={() => {
            closeMenu();
            void setFinished(id, !finished);
          }}
        >
          {finished ? 'Mark as unfinished' : 'Mark as finished'}
        </button>
        <button className={`${ui.menuItem} ${ui.danger}`} onClick={remove}>
          Delete
        </button>
      </div>
      <input
        ref={subtitleInput}
        type="file"
        accept=".srt,.vtt"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          void replaceEpisodeSubtitles(episode, file, () => confirm(SUBTITLE_RESET_WARNING)).then(
            ({ error }) => error && useLibrary.setState({ message: error }),
          );
        }}
      />
    </li>
  );
}
