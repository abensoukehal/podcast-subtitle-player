import { useEffect, useRef } from 'react';
import {
  closeImport,
  runImport,
  setImportItems,
  useLibrary,
  type ImportStatus,
} from '../../stores/libraryStore';
import ui from '../common/ui.module.css';
import styles from './library.module.css';

const STATUS_TEXT: Record<ImportStatus, string> = {
  waiting: 'Waiting',
  importing: 'Importing…',
  done: 'Added',
  error: 'Not added',
};

/** LIB-3, LIB-4: lets the user pair or remove files, then shows progress per file. */
export function ImportDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const state = useLibrary((s) => s.importing);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  if (!state) return null;
  const { phase, items, spare, ignored } = state;
  const chosen = new Set(items.map((i) => i.subtitle));
  const update = (index: number, subtitle: File | null) =>
    setImportItems(items.map((item, i) => (i === index ? { ...item, subtitle } : item)));

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="import-title"
      onCancel={(e) => (phase === 'importing' ? e.preventDefault() : closeImport())}
    >
      <h2 id="import-title" className={styles.dialogTitle}>
        Import episodes
      </h2>
      {items.length === 0 && (
        <p>No audio files to import. Add an audio file together with its subtitles.</p>
      )}
      <ul className={styles.importList}>
        {items.map((item, i) => (
          <li key={item.audio.name + i} className={styles.importItem}>
            <div className={styles.importHead}>
              <strong className={styles.fileName}>{item.audio.name}</strong>
              {phase === 'pairing' ? (
                <button
                  className={ui.chip}
                  onClick={() => setImportItems(items.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              ) : (
                <span className={styles[item.status]}>{STATUS_TEXT[item.status]}</span>
              )}
            </div>
            {phase === 'pairing' && (!item.subtitle || spare.includes(item.subtitle)) ? (
              <select
                className={styles.select}
                aria-label={`Subtitles for ${item.audio.name}`}
                value={item.subtitle ? spare.indexOf(item.subtitle) : ''}
                onChange={(e) => update(i, spare[Number(e.target.value)] ?? null)}
              >
                <option value="">Choose subtitles…</option>
                {spare.map((s, j) =>
                  s === item.subtitle || !chosen.has(s) ? (
                    <option key={s.name + j} value={j}>
                      {s.name}
                    </option>
                  ) : null,
                )}
              </select>
            ) : (
              <span className={styles.fileName}>{item.subtitle?.name}</span>
            )}
            {item.messages.map((m) => (
              <p key={m} className={item.status === 'error' ? styles.error : styles.warning}>
                {m}
              </p>
            ))}
          </li>
        ))}
      </ul>
      {ignored > 0 && (
        <p className={ui.hint}>
          Skipped {ignored} file{ignored === 1 ? '' : 's'} that {ignored === 1 ? 'is' : 'are'} not
          audio or subtitles.
        </p>
      )}
      <div className={styles.dialogActions}>
        {phase === 'pairing' && (
          <>
            <button className={ui.chip} onClick={closeImport}>
              Cancel
            </button>
            <button
              className={ui.button}
              disabled={!items.length || items.some((i) => !i.subtitle)}
              onClick={() => void runImport()}
            >
              Import
            </button>
          </>
        )}
        {phase === 'finished' && (
          <button className={ui.button} onClick={closeImport} autoFocus>
            Done
          </button>
        )}
      </div>
    </dialog>
  );
}
