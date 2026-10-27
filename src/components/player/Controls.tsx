import { useState } from 'react';
import { formatTime } from '../../lib/time';
import { MAX_RATE, MIN_RATE } from '../../player/PlayerEngine';
import { engine, usePlayer } from '../../stores/playerStore';
import { Icon } from '../common/Icon';
import styles from './player.module.css';

const SKIP_SEC = 5; // ponytail: fixed until Settings.skipSec exists (M5)
const SPEED_PRESETS = [0.75, 0.9, 1, 1.25];

const formatRate = (rate: number) => `${rate.toFixed(2).replace(/0$/, '')}×`;
const skip = (sec: number) => engine.seek(engine.getState().currentTime + sec);

export function Controls() {
  const playing = usePlayer((s) => s.playing);

  return (
    <footer className={styles.controls}>
      <SeekBar />
      <div className={styles.mainRow}>
        <button
          className={styles.iconButton}
          aria-label="Previous sentence"
          onClick={() => engine.prevCue()}
        >
          <Icon name="prev" />
        </button>
        <button
          className={styles.iconButton}
          aria-label={`Back ${SKIP_SEC} seconds`}
          onClick={() => skip(-SKIP_SEC)}
        >
          <Icon name="rewind" />
        </button>
        <button
          className={styles.playButton}
          aria-label={playing ? 'Pause' : 'Play'}
          onClick={() => engine.toggle()}
        >
          <Icon name={playing ? 'pause' : 'play'} />
        </button>
        <button
          className={styles.iconButton}
          aria-label={`Forward ${SKIP_SEC} seconds`}
          onClick={() => skip(SKIP_SEC)}
        >
          <Icon name="forward" />
        </button>
        <button
          className={styles.iconButton}
          aria-label="Next sentence"
          onClick={() => engine.nextCue()}
        >
          <Icon name="next" />
        </button>
      </div>
      <div className={styles.chipRow}>
        <SpeedMenu />
        <button className={styles.chip} onClick={() => engine.replayCue()}>
          Replay sentence
        </button>
      </div>
    </footer>
  );
}

/** PLY-2: seek bar with drag support, a time tooltip while dragging, elapsed and remaining time. */
function SeekBar() {
  const currentTime = usePlayer((s) => s.currentTime);
  const duration = usePlayer((s) => s.duration);
  const [dragging, setDragging] = useState(false);
  const percent = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className={styles.seek}>
      <span className={styles.seekTime}>{formatTime(currentTime)}</span>
      <div className={styles.track}>
        <input
          type="range"
          className={styles.range}
          min={0}
          max={duration}
          step={1}
          value={currentTime}
          aria-label="Seek"
          aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
          onChange={(e) => engine.seek(Number(e.target.value))}
          onPointerDown={() => setDragging(true)}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
        />
        {dragging && (
          <span className={styles.tooltip} style={{ left: `${percent}%` }}>
            {formatTime(currentTime)}
          </span>
        )}
      </div>
      <span className={styles.seekTime}>-{formatTime(duration - currentTime)}</span>
    </div>
  );
}

/** PLY-3: 0.5x to 1.5x in 0.05 steps, with presets. */
function SpeedMenu() {
  const rate = usePlayer((s) => s.rate);

  return (
    <>
      <button
        className={styles.chip}
        popoverTarget="speed-menu"
        aria-label={`Speed ${formatRate(rate)}`}
      >
        {formatRate(rate)}
      </button>
      <div id="speed-menu" popover="auto" className={styles.popover}>
        <h2 className={styles.popoverTitle}>Speed {formatRate(rate)}</h2>
        <input
          type="range"
          className={styles.range}
          min={MIN_RATE}
          max={MAX_RATE}
          step={0.05}
          value={rate}
          aria-label="Speed"
          aria-valuetext={formatRate(rate)}
          onChange={(e) => engine.setRate(Number(e.target.value))}
        />
        <div className={styles.popoverRow}>
          {SPEED_PRESETS.map((p) => (
            <button
              key={p}
              className={styles.chip}
              aria-pressed={rate === p}
              onClick={() => engine.setRate(p)}
            >
              {formatRate(p)}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
