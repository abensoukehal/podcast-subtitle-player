import { useState } from 'react';
import { formatTime } from '../../lib/time';
import { MAX_RATE, MIN_RATE } from '../../player/PlayerEngine';
import {
  clearLoopRange,
  engine,
  setAutoPause,
  setRate,
  setSentenceLoop,
  usePlayer,
} from '../../stores/playerStore';
import { useSettings } from '../../stores/settingsStore';
import { Icon } from '../common/Icon';
import ui from '../common/ui.module.css';
import styles from './player.module.css';

const SPEED_PRESETS = [0.75, 0.9, 1, 1.25];
const LOOP_OPTIONS: [string, number | 'infinite' | null][] = [
  ['Off', null],
  ['2 times', 2],
  ['3 times', 3],
  ['5 times', 5],
  ['Until stopped', 'infinite'],
];

const formatRate = (rate: number) => `${rate.toFixed(2).replace(/0$/, '')}×`;
const skip = (sec: number) => engine.seek(engine.getState().currentTime + sec);
const hideMenu = (id: string) => document.getElementById(id)?.hidePopover();

export function Controls() {
  const playing = usePlayer((s) => s.playing);
  const waiting = usePlayer((s) => s.waiting);
  const skipSec = useSettings((s) => s.skipSec);

  return (
    <footer className={styles.controls}>
      <SeekBar />
      <div className={styles.mainRow}>
        <button
          className={ui.iconButton}
          aria-label="Previous sentence"
          onClick={() => engine.prevCue()}
        >
          <Icon name="prev" />
        </button>
        <button
          className={ui.iconButton}
          aria-label={`Back ${skipSec} seconds`}
          onClick={() => skip(-skipSec)}
        >
          <Icon name="rewind" />
        </button>
        <button
          className={styles.playButton}
          aria-label={playing ? 'Pause' : waiting ? 'Continue' : 'Play'}
          onClick={() => engine.toggle()}
        >
          {waiting?.kind === 'timed' && <CountdownRing ms={waiting.ms} />}
          <Icon name={playing ? 'pause' : 'play'} />
        </button>
        <button
          className={ui.iconButton}
          aria-label={`Forward ${skipSec} seconds`}
          onClick={() => skip(skipSec)}
        >
          <Icon name="forward" />
        </button>
        <button
          className={ui.iconButton}
          aria-label="Next sentence"
          onClick={() => engine.nextCue()}
        >
          <Icon name="next" />
        </button>
      </div>
      <div className={styles.chipRow}>
        <SpeedMenu />
        <LoopMenu />
        <AutoPauseMenu />
        <button className={ui.chip} aria-label="Replay sentence" onClick={() => engine.replayCue()}>
          Replay
        </button>
        <RangeChip />
      </div>
    </footer>
  );
}

/** LRN-3: a ring on the play button that empties while a timed auto-pause runs. */
function CountdownRing({ ms }: { ms: number }) {
  return (
    <svg className={styles.ring} viewBox="0 0 60 60" aria-hidden="true">
      <circle cx="30" cy="30" r="28" pathLength="100" style={{ animationDuration: `${ms}ms` }} />
    </svg>
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

/** PLY-3: 0.5x to 1.5x in 0.05 steps, with presets; the speed becomes the default. */
function SpeedMenu() {
  const rate = usePlayer((s) => s.rate);

  return (
    <>
      <button
        className={ui.chip}
        popoverTarget="speed-menu"
        aria-label={`Speed ${formatRate(rate)}`}
      >
        {formatRate(rate)}
      </button>
      <div id="speed-menu" popover="auto" className={ui.popover}>
        <h2 className={ui.popoverTitle}>Speed {formatRate(rate)}</h2>
        <input
          type="range"
          className={styles.range}
          min={MIN_RATE}
          max={MAX_RATE}
          step={0.05}
          value={rate}
          aria-label="Speed"
          aria-valuetext={formatRate(rate)}
          onChange={(e) => setRate(Number(e.target.value))}
        />
        <div className={ui.popoverRow}>
          {SPEED_PRESETS.map((p) => (
            <button
              key={p}
              className={ui.chip}
              aria-pressed={rate === p}
              onClick={() => setRate(p)}
            >
              {formatRate(p)}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/** LRN-4: repeat the current sentence. */
function LoopMenu() {
  const loop = usePlayer((s) => s.loop);
  const times = loop.kind === 'cue' ? loop.times : null;
  const label = times === null ? 'Loop' : times === 'infinite' ? 'Loop ∞' : `Loop ×${times}`;

  return (
    <>
      <button className={ui.chip} popoverTarget="loop-menu" aria-pressed={times !== null}>
        {label}
      </button>
      <div id="loop-menu" popover="auto" className={ui.menu} aria-label="Loop sentence">
        {LOOP_OPTIONS.map(([text, value]) => (
          <button
            key={text}
            className={ui.menuItem}
            aria-pressed={times === value}
            onClick={() => {
              hideMenu('loop-menu');
              setSentenceLoop(value);
            }}
          >
            {text}
          </button>
        ))}
      </div>
    </>
  );
}

/** LRN-3: pause after each sentence for shadowing. */
function AutoPauseMenu() {
  const mode = useSettings((s) => s.autoPause);
  const factor = mode.kind === 'timed' ? mode.factor : 1.5;
  const label =
    mode.kind === 'off'
      ? 'Auto-pause'
      : mode.kind === 'manual'
        ? 'Auto-pause: wait'
        : `Auto-pause: ${factor}×`;

  return (
    <>
      <button
        className={ui.chip}
        popoverTarget="auto-pause-menu"
        aria-pressed={mode.kind !== 'off'}
      >
        {label}
      </button>
      <div id="auto-pause-menu" popover="auto" className={ui.popover}>
        <h2 className={ui.popoverTitle}>Pause after each sentence</h2>
        <div className={ui.popoverRow}>
          {(['off', 'manual', 'timed'] as const).map((kind) => (
            <button
              key={kind}
              className={ui.chip}
              aria-pressed={mode.kind === kind}
              onClick={() => setAutoPause(kind === 'timed' ? { kind, factor } : { kind })}
            >
              {kind === 'off' ? 'Off' : kind === 'manual' ? 'Until Play' : 'Timed'}
            </button>
          ))}
        </div>
        {mode.kind === 'timed' && (
          <label className={styles.field}>
            Pause for {factor}× the sentence length
            <input
              type="range"
              className={styles.range}
              min={1}
              max={2}
              step={0.1}
              value={factor}
              onChange={(e) => setAutoPause({ kind: 'timed', factor: Number(e.target.value) })}
            />
          </label>
        )}
      </div>
    </>
  );
}

/** LRN-5: the A-B loop as a chip with a clear button. */
function RangeChip() {
  const loop = usePlayer((s) => s.loop);
  const startCue = usePlayer((s) => (s.abStart === null ? undefined : s.cues[s.abStart]));
  if (!startCue) return null;

  const label =
    loop.kind === 'range'
      ? `Loop ${formatTime(loop.startSec)}–${formatTime(loop.endSec)}`
      : `Loop from ${formatTime(startCue.startSec)}…`;
  return (
    <span className={`${ui.chip} ${styles.rangeChip}`}>
      {label}
      <button className={styles.chipClear} aria-label="Clear A-B loop" onClick={clearLoopRange}>
        <Icon name="close" size={18} />
      </button>
    </span>
  );
}
