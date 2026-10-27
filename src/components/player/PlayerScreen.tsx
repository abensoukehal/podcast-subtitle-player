import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  closeEpisode,
  engine,
  openEpisode,
  reimportAudio,
  replay,
  setOffset,
  toggleView,
  usePlayer,
} from '../../stores/playerStore';
import { Icon } from '../common/Icon';
import ui from '../common/ui.module.css';
import { CaptionView } from './CaptionView';
import { Controls } from './Controls';
import { TranscriptView } from './TranscriptView';
import styles from './player.module.css';

export function PlayerScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const title = usePlayer((s) => s.title);
  const view = usePlayer((s) => s.view);
  const status = usePlayer((s) => s.status);

  useEffect(() => {
    void openEpisode(id);
    return closeEpisode;
  }, [id]);

  return (
    <div className={styles.screen}>
      <header className={styles.topBar}>
        <button
          className={ui.iconButton}
          aria-label="Back to library"
          onClick={() => navigate('/')}
        >
          <Icon name="back" />
        </button>
        <h1 className={styles.title}>{title}</h1>
        {status === 'ready' && (
          <>
            <button
              className={ui.iconButton}
              aria-label={view === 'caption' ? 'Show transcript' : 'Show caption view'}
              onClick={toggleView}
            >
              <Icon name={view === 'caption' ? 'transcript' : 'caption'} />
            </button>
            <SyncMenu />
          </>
        )}
      </header>
      {status === 'ready' && <Ready />}
      {status === 'loading' && <p className={styles.message}>Loading…</p>}
      {status === 'missing' && (
        <div className={styles.message}>
          <p>This episode no longer exists.</p>
          <Link to="/">Back to library</Link>
        </div>
      )}
      {status === 'audioError' && <AudioError />}
    </div>
  );
}

function Ready() {
  const view = usePlayer((s) => s.view);
  const warnings = usePlayer((s) => s.warnings);
  const error = usePlayer((s) => s.error);
  const ended = usePlayer((s) => s.ended);
  const navigate = useNavigate();
  const notice = error ?? warnings.join(' ');

  return (
    <>
      {ended && (
        <div className={ui.notice} role="status">
          <strong>Episode finished</strong>
          <span className={styles.actions}>
            <button className={ui.chip} onClick={replay}>
              Replay
            </button>
            <button className={ui.chip} onClick={() => navigate('/')}>
              Back to library
            </button>
          </span>
        </div>
      )}
      {notice && (
        <div className={ui.notice} role={error ? 'alert' : 'status'}>
          <span>{notice}</span>
          <button
            className={ui.chip}
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
    </>
  );
}

/** PLY-6: missing or undecodable audio; re-importing keeps subtitles, progress and bookmarks. */
function AudioError() {
  const error = usePlayer((s) => s.error);
  return (
    <div className={styles.message} role="alert">
      <p>{error}</p>
      <p>Your subtitles, progress and bookmarks are kept.</p>
      <label className={ui.button}>
        Re-import audio
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void reimportAudio(file);
          }}
        />
      </label>
    </div>
  );
}

// Reads the engine, not the render, so fast repeated clicks all count.
const shiftOffset = (ms: number) => setOffset(engine.getState().offsetMs + ms);

/** PLY-4: subtitle sync in the overflow menu, saved per episode. */
function SyncMenu() {
  const offsetMs = usePlayer((s) => s.offsetMs);

  return (
    <>
      <button className={ui.iconButton} aria-label="More options" popoverTarget="player-menu">
        <Icon name="more" />
      </button>
      <div id="player-menu" popover="auto" className={ui.popover}>
        <h2 className={ui.popoverTitle}>Subtitle sync</h2>
        <div className={ui.popoverRow}>
          <button className={ui.chip} onClick={() => shiftOffset(-100)}>
            −100 ms
          </button>
          <output aria-live="polite">
            {offsetMs > 0 ? '+' : ''}
            {offsetMs} ms
          </output>
          <button className={ui.chip} onClick={() => shiftOffset(100)}>
            +100 ms
          </button>
        </div>
        <p className={ui.hint}>A positive value shows subtitles later.</p>
        <button className={ui.chip} disabled={!offsetMs} onClick={() => setOffset(0)}>
          Reset
        </button>
      </div>
    </>
  );
}
