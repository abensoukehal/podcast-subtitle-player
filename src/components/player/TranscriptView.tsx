import { memo, useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Cue } from '../../lib/subtitles/types';
import { formatTime } from '../../lib/time';
import { engine, usePlayer } from '../../stores/playerStore';
import styles from './player.module.css';

const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End']);

interface RowProps {
  cue: Cue;
  active: boolean;
  onSeek: (index: number) => void;
}

/** TRN-6: memoized, so a sentence change re-renders only the old and new current rows. */
const Row = memo(function Row({ cue, active, onSeek }: RowProps) {
  return (
    <li
      className={active ? `${styles.row} ${styles.active}` : styles.row}
      aria-current={active || undefined}
    >
      <button className={styles.rowButton} onClick={() => onSeek(cue.index)}>
        <time className={styles.rowTime}>{formatTime(cue.startSec)}</time>
        <span>
          {cue.speaker && <span className={styles.speaker}>{cue.speaker}</span>}
          {cue.text}
        </span>
      </button>
    </li>
  );
});

export function TranscriptView() {
  const cues = usePlayer((s) => s.cues);
  const index = usePlayer((s) => s.index);
  const listRef = useRef<HTMLOListElement>(null);
  const [follow, setFollow] = useState(true);

  // TRN-3, TRN-4: tapping a sentence seeks, plays and turns auto-scroll back on.
  const seek = useCallback((i: number) => {
    setFollow(true);
    engine.seekToCue(i, { play: true });
  }, []);

  // TRN-4: scroll-padding-top in CSS puts the row 35% from the top; CSS decides smooth or not
  // (UI-7). Long jumps (seek bar) are instant: smooth-scrolling hundreds of rows takes seconds.
  useEffect(() => {
    const list = listRef.current;
    const row = list?.children[index] as HTMLElement | undefined;
    if (!follow || !list || !row) return;
    const far = Math.abs(row.offsetTop - list.scrollTop) > list.clientHeight * 2;
    row.scrollIntoView({ block: 'start', behavior: far ? 'instant' : undefined });
  }, [index, follow]);

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
          <Row key={cue.index} cue={cue} active={cue.index === index} onSeek={seek} />
        ))}
      </ol>
      {!follow && (
        <button className={styles.backToCurrent} onClick={() => setFollow(true)}>
          Back to current
        </button>
      )}
    </>
  );
}
