import type { Settings } from '../../lib/db/schema';
import type { Cue } from '../../lib/subtitles/types';
import styles from './player.module.css';

interface Props {
  cue: Cue;
  visibility: Settings['subtitleVisibility'];
  revealed: boolean; // LRN-1: revealed in Blurred mode
}

export function SentenceText({ cue, visibility, revealed }: Props) {
  return (
    <span>
      {cue.speaker && <span className={styles.speaker}>{cue.speaker}</span>}
      {visibility === 'hidden' ? (
        <span className={styles.hiddenText}>Hidden sentence</span>
      ) : (
        <span className={visibility === 'blurred' && !revealed ? styles.blurred : undefined}>
          {cue.text}
        </span>
      )}
    </span>
  );
}
