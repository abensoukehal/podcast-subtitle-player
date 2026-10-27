import { memo, useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Settings } from '../../lib/db/schema';
import type { Cue } from '../../lib/subtitles/types';
import { formatTime } from '../../lib/time';
import { openSheet, tapSentence, usePlayer } from '../../stores/playerStore';
import { useSettings } from '../../stores/settingsStore';
import { Icon } from '../common/Icon';
import ui from '../common/ui.module.css';
import { useLongPress } from '../common/useLongPress';
import { SentenceText } from './SentenceText';
import styles from './player.module.css';

const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End']);

interface RowProps {
  cue: Cue;
  active: boolean;
  visibility: Settings['subtitleVisibility'];
  revealed: boolean;
  bookmarked: boolean;
  onTap: (index: number) => void;
}

/** TRN-5, TRN-6: memoized, so a sentence change re-renders only the old and new current rows. */
const Row = memo(function Row({ cue, active, visibility, revealed, bookmarked, onTap }: RowProps) {
  const longPress = useLongPress(() => openSheet(cue.index));
  const time = formatTime(cue.startSec);
  return (
    <li
      className={active ? `${styles.row} ${styles.active}` : styles.row}
      aria-current={active || undefined}
    >
      <button className={styles.rowButton} onClick={() => onTap(cue.index)} {...longPress}>
        <span className={styles.rowTime}>
          <time>{time}</time>
          {bookmarked && (
            <span className={styles.bookmarkMark} title="Bookmarked">
              <Icon name="bookmark" size={14} />
              <span className={styles.srOnly}>Bookmarked</span>
            </span>
          )}
        </span>
        <SentenceText cue={cue} visibility={visibility} revealed={revealed} />
      </button>
      <button
        className={`${ui.iconButton} ${styles.rowActions}`}
        aria-label={`Actions for sentence at ${time}`}
        onClick={() => openSheet(cue.index)}
      >
        <Icon name="more" size={20} />
      </button>
    </li>
  );
});

export function TranscriptView() {
  const cues = usePlayer((s) => s.cues);
  const index = usePlayer((s) => s.index);
  const revealed = usePlayer((s) => s.revealed);
  const bookmarks = usePlayer((s) => s.bookmarks);
  const visibility = useSettings((s) => s.subtitleVisibility);
  const autoScroll = useSettings((s) => s.autoScroll);
  const listRef = useRef<HTMLOListElement>(null);
  const [follow, setFollow] = useState(true);

  // TRN-3, TRN-4: tapping a sentence seeks (or reveals, LRN-1) and turns auto-scroll back on.
  const tap = useCallback((i: number) => {
    setFollow(true);
    tapSentence(i);
  }, []);

  // TRN-4: scroll-padding-top in CSS puts the row 35% from the top; CSS decides smooth or not
  // (UI-7). Long jumps (seek bar) are instant: smooth-scrolling hundreds of rows takes seconds.
  useEffect(() => {
    const list = listRef.current;
    const row = list?.children[index] as HTMLElement | undefined;
    if (!autoScroll || !follow || !list || !row) return;
    const far = Math.abs(row.offsetTop - list.scrollTop) > list.clientHeight * 2;
    row.scrollIntoView({ block: 'start', behavior: far ? 'instant' : undefined });
  }, [index, follow, autoScroll]);

  const stopFollowing = () => setFollow(false);

  return (
    <>
      <ol
        ref={listRef}
        className={styles.transcript}
        aria-label="Transcript"
        onWheel={stopFollowing}
        onTouchMove={stopFollowing}
        onKeyDown={(e: KeyboardEvent) => SCROLL_KEYS.has(e.key) && stopFollowing()}
      >
        {cues.map((cue) => (
          <Row
            key={cue.index}
            cue={cue}
            active={cue.index === index}
            visibility={visibility}
            revealed={revealed.has(cue.index)}
            bookmarked={bookmarks.has(cue.index)}
            onTap={tap}
          />
        ))}
      </ol>
      {autoScroll && !follow && (
        <button className={styles.backToCurrent} onClick={() => setFollow(true)}>
          Back to current
        </button>
      )}
    </>
  );
}
