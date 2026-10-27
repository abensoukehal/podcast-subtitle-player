import type { Settings } from '../../lib/db/schema';
import type { Cue } from '../../lib/subtitles/types';
import { highlightParts } from '../../lib/words';
import styles from './player.module.css';

interface Props {
  cue: Cue;
  visibility: Settings['subtitleVisibility'];
  revealed: boolean; // LRN-1: revealed in Blurred mode
  query?: string; // TRN-7: highlighted search text
}

export function SentenceText({ cue, visibility, revealed, query = '' }: Props) {
  return (
    <span>
      {cue.speaker && <span className={styles.speaker}>{cue.speaker}</span>}
      {visibility === 'hidden' ? (
        <span className={styles.hiddenText}>Hidden sentence</span>
      ) : (
        <span className={visibility === 'blurred' && !revealed ? styles.blurred : undefined}>
          {query
            ? highlightParts(cue.text, query).map((part, i) =>
                part.match ? <mark key={i}>{part.text}</mark> : part.text,
              )
            : cue.text}
        </span>
      )}
    </span>
  );
}
