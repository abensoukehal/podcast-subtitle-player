import { engine, usePlayer } from '../../stores/playerStore';
import styles from './player.module.css';

/** TRN-1: the current sentence large, the previous and next ones smaller and dimmed. */
export function CaptionView() {
  const cues = usePlayer((s) => s.cues);
  const index = usePlayer((s) => s.index);

  return (
    <div className={styles.caption}>
      {[index - 1, index, index + 1].map((i, slot) => {
        const cue = cues[i];
        const className = slot === 1 ? styles.captionCurrent : styles.captionSide;
        if (!cue) return <div key={slot} className={className} />;
        return (
          <button
            key={slot}
            className={className}
            aria-current={slot === 1 || undefined}
            onClick={() => engine.seekToCue(i, { play: true })}
          >
            {cue.speaker && <span className={styles.speaker}>{cue.speaker}</span>}
            {cue.text}
          </button>
        );
      })}
    </div>
  );
}
