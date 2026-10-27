import { useEffect, useRef, useState } from 'react';
import { formatTime } from '../../lib/time';
import {
  dictionaryUrl,
  normalizeWord,
  selectedText,
  selectWord,
  splitWords,
  type WordSelection,
} from '../../lib/words';
import {
  closeSheet,
  engine,
  saveToVocabulary,
  setLoopEnd,
  setSentenceLoop,
  toggleBookmark,
  usePlayer,
} from '../../stores/playerStore';
import { useSettings } from '../../stores/settingsStore';
import { Icon } from '../common/Icon';
import ui from '../common/ui.module.css';
import styles from './player.module.css';

/**
 * SEN-1 to SEN-4: a modal dialog, shown as a bottom sheet on phones. Playback was paused
 * when it opened. Mount it with key={index} so the word selection resets per sentence.
 */
export function SentenceSheet({ index }: { index: number }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cue = usePlayer((s) => s.cues[index]);
  const bookmarked = usePlayer((s) => s.bookmarks.has(index));
  const template = useSettings((s) => s.dictionaryUrlTemplate);
  const [selection, setSelection] = useState<WordSelection>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  if (!cue) return null;
  const tokens = splitWords(cue.text);
  const selected = selectedText(tokens, selection);
  const isPhrase = selection !== null && selection.to > selection.from;

  /** Closes the sheet, then runs a playback action. */
  const thenClose = (action: () => void) => () => {
    closeSheet();
    action();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cue.text);
      setMessage('Copied');
    } catch {
      setMessage('Could not copy');
    }
  };

  return (
    <dialog
      ref={dialog}
      className={styles.sheet}
      aria-labelledby="sheet-title"
      onClose={closeSheet}
      onClick={(e) => e.target === dialog.current && closeSheet()} // backdrop
    >
      <header className={styles.sheetHeader}>
        <h2 id="sheet-title" className={styles.sheetTitle}>
          {formatTime(cue.startSec)}
          {cue.speaker && ` · ${cue.speaker}`}
        </h2>
        <button className={ui.iconButton} aria-label="Close" onClick={closeSheet}>
          <Icon name="close" />
        </button>
      </header>

      <p className={styles.words} aria-label="Words: tap to select, tap neighbours for a phrase">
        {tokens.map((token, i) => {
          const inSelection = selection !== null && i >= selection.from && i <= selection.to;
          return normalizeWord(token) ? (
            <button
              key={i}
              className={inSelection ? `${styles.word} ${styles.wordSelected}` : styles.word}
              aria-pressed={inSelection}
              onClick={() => {
                setSelection(selectWord(selection, i));
                setMessage('');
              }}
            >
              {token}
            </button>
          ) : (
            <span key={i}>{token}</span>
          );
        })}
      </p>

      {selected && (
        <div className={styles.wordActions}>
          <strong>{selected}</strong>
          <button
            className={ui.button}
            onClick={async () => setMessage(await saveToVocabulary(selected, index))}
          >
            {isPhrase ? 'Save phrase' : 'Save to vocabulary'}
          </button>
          {!isPhrase && (
            <a
              className={ui.chip}
              href={dictionaryUrl(template, selected)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Look up
            </a>
          )}
        </div>
      )}
      <p className={styles.sheetMessage} role="status">
        {message}
      </p>

      <div className={styles.sheetActions}>
        <button className={ui.chip} onClick={thenClose(() => engine.replayCue(index))}>
          Replay
        </button>
        <button className={ui.chip} onClick={thenClose(() => engine.replayCueSlowly(index))}>
          Replay slowly
        </button>
        <button
          className={ui.chip}
          onClick={thenClose(() => {
            setSentenceLoop(3, index);
            engine.seekToCue(index, { play: true });
          })}
        >
          Loop ×3
        </button>
        <button className={ui.chip} aria-pressed={bookmarked} onClick={() => toggleBookmark(index)}>
          {bookmarked ? 'Remove bookmark' : 'Bookmark'}
        </button>
        <button className={ui.chip} onClick={copy}>
          Copy sentence
        </button>
        <button className={ui.chip} onClick={thenClose(() => setLoopEnd('from', index))}>
          Loop from here
        </button>
        <button className={ui.chip} onClick={thenClose(() => setLoopEnd('to', index))}>
          Loop to here
        </button>
      </div>
    </dialog>
  );
}
