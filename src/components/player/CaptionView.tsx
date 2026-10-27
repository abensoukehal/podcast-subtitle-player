import { openSheet, tapSentence, usePlayer } from '../../stores/playerStore';
import { useSettings } from '../../stores/settingsStore';
import { useLongPress } from '../common/useLongPress';
import { SentenceText } from './SentenceText';
import styles from './player.module.css';

/** TRN-1: the current sentence large, the previous and next ones smaller and dimmed. */
export function CaptionView() {
  const index = usePlayer((s) => s.index);
  return (
    <div className={styles.caption}>
      {[index - 1, index, index + 1].map((i, slot) => (
        <CaptionLine key={slot} index={i} current={slot === 1} />
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
