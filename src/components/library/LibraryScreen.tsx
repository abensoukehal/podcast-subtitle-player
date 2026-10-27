import { useEffect, useState, type DragEvent } from 'react';
import { beginImport, refreshLibrary, useLibrary } from '../../stores/libraryStore';
import ui from '../common/ui.module.css';
import { EpisodeCard } from './EpisodeCard';
import { ImportDialog } from './ImportDialog';
import styles from './library.module.css';

export function LibraryScreen() {
  const episodes = useLibrary((s) => s.episodes);
  const loaded = useLibrary((s) => s.loaded);
  const message = useLibrary((s) => s.message);
  const importing = useLibrary((s) => s.importing !== null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    void refreshLibrary();
  }, []);

  // LIB-1: files can also be dropped anywhere on the screen.
  const onDragOver = (e: DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    setDragging(true);
  };
  const onDragLeave = (e: DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) beginImport([...e.dataTransfer.files]);
  };

  return (
    <main
      className={dragging ? `${styles.library} ${styles.dragging}` : styles.library}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <header className={styles.header}>
        <h1 className={styles.heading}>Library</h1>
        <label className={ui.button}>
          Import
          <input
            type="file"
            multiple
            accept="audio/*,.srt,.vtt"
            onChange={(e) => {
              beginImport([...(e.target.files ?? [])]);
              e.target.value = '';
            }}
          />
        </label>
      </header>
      {message && (
        <div className={ui.notice} role="alert">
          <span>{message}</span>
          <button className={ui.chip} onClick={() => useLibrary.setState({ message: null })}>
            Dismiss
          </button>
        </div>
      )}
      {loaded && episodes.length === 0 && (
        <p className={styles.empty}>
          Add an episode: choose or drop an audio file together with its SRT or VTT subtitle file.
          Give them the same name, for example <code>episode-01.m4a</code> and{' '}
          <code>episode-01.srt</code>, and they are paired automatically.
        </p>
      )}
      <ul className={styles.cards}>
        {episodes.map((e) => (
          <EpisodeCard key={e.id} episode={e} />
        ))}
      </ul>
      {importing && <ImportDialog />}
    </main>
  );
}
