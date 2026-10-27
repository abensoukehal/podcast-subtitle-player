import { closeEpisode, engine, toggleView, usePlayer } from '../../stores/playerStore';
import { Icon } from '../common/Icon';
import { CaptionView } from './CaptionView';
import { Controls } from './Controls';
import { TranscriptView } from './TranscriptView';
import styles from './player.module.css';

export function PlayerScreen() {
  const title = usePlayer((s) => s.title);
  const view = usePlayer((s) => s.view);
  const warnings = usePlayer((s) => s.warnings);
  const error = usePlayer((s) => s.error);
  const notice = error ?? warnings.join(' ');

  return (
    <div className={styles.screen}>
      <header className={styles.topBar}>
        <button className={styles.iconButton} aria-label="Close episode" onClick={closeEpisode}>
          <Icon name="back" />
        </button>
        <h1 className={styles.title}>{title}</h1>
        <button
          className={styles.iconButton}
          aria-label={view === 'caption' ? 'Show transcript' : 'Show caption view'}
          onClick={toggleView}
        >
          <Icon name={view === 'caption' ? 'transcript' : 'caption'} />
        </button>
        <SyncMenu />
      </header>
      {notice && (
        <div className={styles.notice} role={error ? 'alert' : 'status'}>
          <span>{notice}</span>
          <button
            className={styles.chip}
            onClick={() => usePlayer.setState({ warnings: [], error: null })}
          >
            Dismiss
          </button>
        </div>
      )}
      <main className={styles.main}>
        {view === 'caption' ? <CaptionView /> : <TranscriptView />}
      </main>
      <Controls />
    </div>
  );
}

// Reads the engine, not the render, so fast repeated clicks all count.
const shiftOffset = (ms: number) => engine.setOffset(engine.getState().offsetMs + ms);

/** PLY-4: subtitle sync in the overflow menu. */
function SyncMenu() {
  const offsetMs = usePlayer((s) => s.offsetMs);

  return (
    <>
      <button className={styles.iconButton} aria-label="More options" popoverTarget="player-menu">
        <Icon name="more" />
      </button>
      <div id="player-menu" popover="auto" className={styles.popover}>
        <h2 className={styles.popoverTitle}>Subtitle sync</h2>
        <div className={styles.popoverRow}>
          <button className={styles.chip} onClick={() => shiftOffset(-100)}>
            −100 ms
          </button>
          <output aria-live="polite">
            {offsetMs > 0 ? '+' : ''}
            {offsetMs} ms
          </output>
          <button className={styles.chip} onClick={() => shiftOffset(100)}>
            +100 ms
          </button>
        </div>
        <p className={styles.hint}>A positive value shows subtitles later.</p>
        <button className={styles.chip} disabled={!offsetMs} onClick={() => engine.setOffset(0)}>
          Reset
        </button>
      </div>
    </>
  );
}
