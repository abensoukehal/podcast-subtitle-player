import { openSheet, tapSentence, usePlayer } from '../../stores/playerStore';
import { useSettings } from '../../stores/settingsStore';
import { useLongPress } from '../common/useLongPress';
import { SentenceText } from './SentenceText';
import styles from './player.module.css';

const AROUND = [-2, -1, 0, 1, 2]; // sentences shown before and after the current one

/**
 * TRN-1: the current sentence large, the two before and after it smaller and dimmed,
 * fading out toward the edges (the mask is in player.module.css `.caption`).
 */
export function CaptionView() {
  const index = usePlayer((s) => s.index);
  return (
    <div className={styles.caption}>
      {AROUND.map((offset) => (
        <CaptionLine key={offset} index={index + offset} current={offset === 0} />
      ))}
    </div>
  );
}

function CaptionLine({ index, current }: { index: number; current: boolean }) {
  const cue = usePlayer((s) => s.cues[index]);
  const revealed = usePlayer((s) => s.revealed.has(index));
  const visibility = useSettings((s) => s.subtitleVisibility);
  const longPress = useLongPress(() => openSheet(index));
  const className = current ? styles.captionCurrent : styles.captionSide;

  if (!cue) return <div className={className} />;
  return (
    <button
      className={className}
      aria-current={current || undefined}
      onClick={() => tapSentence(index)}
      {...longPress}
    >
      <SentenceText cue={cue} visibility={visibility} revealed={revealed} />
    </button>
  );
}
