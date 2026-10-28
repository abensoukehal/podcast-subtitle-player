import { useState, type CSSProperties } from 'react';
import { openSheet, tapSentence, usePlayer } from '../../stores/playerStore';
import { useSettings } from '../../stores/settingsStore';
import { useLongPress } from '../common/useLongPress';
import { SentenceText } from './SentenceText';
import styles from './player.module.css';

const AROUND = [-3, -2, -1, 0, 1, 2, 3]; // sentences drawn on the visible side of the drum
const STEP = 30; // degrees between sentences on the drum

/**
 * TRN-1: the sentences sit on a horizontal cylinder that turns to bring the current one
 * to the front, large; the ones before and after are smaller and dimmed, fading out
 * toward the edges (the mask and the turn are in player.module.css `.caption`).
 */
export function CaptionView() {
  const index = usePlayer((s) => s.index);
  // A seek further than a couple of sentences jumps instead of spinning the drum.
  const [prev, setPrev] = useState(index);
  const [jump, setJump] = useState(false);
  if (index !== prev) {
    setPrev(index);
    setJump(Math.abs(index - prev) > 2);
  }
  return (
    <div className={styles.caption}>
      <div
        className={styles.drum}
        style={
          { '--turn': `${index * STEP}deg`, transition: jump ? 'none' : undefined } as CSSProperties
        }
      >
        {AROUND.map((offset) => (
          <CaptionLine key={index + offset} index={index + offset} current={offset === 0} />
        ))}
      </div>
    </div>
  );
}

function CaptionLine({ index, current }: { index: number; current: boolean }) {
  const cue = usePlayer((s) => s.cues[index]);
  const revealed = usePlayer((s) => s.revealed.has(index));
  const visibility = useSettings((s) => s.subtitleVisibility);
  const longPress = useLongPress(() => openSheet(index));

  if (!cue) return null;
  return (
    <div className={styles.drumFace} style={{ '--angle': `${-index * STEP}deg` } as CSSProperties}>
      <button
        className={current ? styles.captionCurrent : styles.captionSide}
        aria-current={current || undefined}
        onClick={() => tapSentence(index)}
        {...longPress}
      >
        <SentenceText cue={cue} visibility={visibility} revealed={revealed} />
      </button>
    </div>
  );
}
