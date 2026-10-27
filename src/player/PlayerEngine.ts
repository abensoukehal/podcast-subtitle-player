import {
  cueSeekTime,
  cueTime,
  currentSentenceIndex,
  nextCueIndex,
  prevCueIndex,
} from '../lib/cues';
import type { AutoPauseMode } from '../lib/db/schema';
import type { Cue } from '../lib/subtitles/types';

/** CUE-6: a cue counts as ended this early, so a stop lands before the next syllable. */
const END_EARLY_SEC = 0.03;
const TICK_MS = 100;
const LOOP_GAP_MS = 500; // LRN-4
export const SLOW_RATE = 0.75; // LRN-6
export const MIN_RATE = 0.5;
export const MAX_RATE = 1.5;
export const MAX_OFFSET_MS = 5000;

export type LoopMode =
  | { kind: 'off' }
  | { kind: 'cue'; index: number; times: number | 'infinite' }
  | { kind: 'range'; startSec: number; endSec: number };

/** Why playback is paused by the engine itself; 'gap' is the pause between loop repeats. */
export type WaitState =
  { kind: 'manual' } | { kind: 'timed'; ms: number } | { kind: 'gap'; ms: number };

export interface PlayerState {
  playing: boolean;
  currentTime: number;
  duration: number;
  rate: number;
  offsetMs: number;
}

interface Events {
  tick: number; // currentTime, at most every TICK_MS while playing
  cuechange: number; // current sentence index (CUE-2), -1 without cues
  cueend: number; // index of the cue that just ended (CUE-6)
  statechange: PlayerState;
  loopchange: LoopMode;
  wait: WaitState | null;
  ended: undefined;
  error: MediaError | null;
}

type Listeners = { [K in keyof Events]: Set<(payload: Events[K]) => void> };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Owns the single audio element. Cue tracking runs in an animation-frame loop while playing,
 * and on timeupdate, which keeps loop and auto-pause working when frames stop in the
 * background (MOB-3).
 */
export class PlayerEngine {
  private readonly audio: HTMLAudioElement;
  private cues: Cue[] = [];
  private offsetMs = 0;
  private url = '';
  private index = -1;
  private holdIndex = -1; // seekToCue target, kept current during the pre-roll
  private armedFrom = 0; // CUE-6: first cue whose end may still fire in this pass
  private frame = 0;
  private lastTick = -Infinity;
  private loop: LoopMode = { kind: 'off' };
  private loopPlays = 0;
  private range: { from: number; to: number } | null = null; // cue indices of an A-B loop
  private autoPause: AutoPauseMode = { kind: 'off' };
  private slow: { index: number; rate: number } | null = null; // replay slowly, rate to restore
  private waiting: WaitState | null = null;
  private resume: (() => void) | null = null; // what Play does while waiting
  private waitTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly removeAudioListeners: () => void;
  private readonly listeners: Listeners = {
    tick: new Set(),
    cuechange: new Set(),
    cueend: new Set(),
    statechange: new Set(),
    loopchange: new Set(),
    wait: new Set(),
    ended: new Set(),
    error: new Set(),
  };

  constructor(audio: HTMLAudioElement = new Audio()) {
    this.audio = audio;
    audio.preservesPitch = true;
    const handlers: [string, () => void][] = [
      [
        'play',
        () => {
          this.startLoop();
          this.emitState();
        },
      ],
      [
        'pause',
        () => {
          cancelAnimationFrame(this.frame);
          this.sync();
          this.emitState();
        },
      ],
      ['timeupdate', () => this.update()],
      ['seeked', () => this.sync()],
      ['ratechange', () => this.emitState()],
      ['durationchange', () => this.emitState()],
      ['ended', () => this.emit('ended', undefined)],
      ['error', () => this.emit('error', audio.error)],
    ];
    for (const [type, fn] of handlers) audio.addEventListener(type, fn);
    this.removeAudioListeners = () =>
      handlers.forEach(([type, fn]) => audio.removeEventListener(type, fn));
  }

  async load(audio: Blob, cues: Cue[], offsetMs: number): Promise<void> {
    this.pause();
    this.slow = null;
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = URL.createObjectURL(audio);
    this.cues = cues;
    this.offsetMs = offsetMs;
    this.index = -1;
    this.holdIndex = -1;
    this.armedFrom = 0;
    const loaded = new Promise<void>((resolve, reject) => {
      const done = (ok: boolean) => () => {
        this.audio.removeEventListener('loadedmetadata', onLoad);
        this.audio.removeEventListener('error', onError);
        if (ok) resolve();
        else reject(this.audio.error ?? new Error('Audio failed to load'));
      };
      const onLoad = done(true);
      const onError = done(false);
      this.audio.addEventListener('loadedmetadata', onLoad);
      this.audio.addEventListener('error', onError);
    });
    this.audio.src = this.url;
    await loaded;
    this.sync();
    this.emitState();
  }

  /** Continues after an auto-pause or loop gap. Never throws (rejected play() stays paused). */
  async play(): Promise<void> {
    const resume = this.resume;
    this.clearWait();
    if (resume) resume();
    else await this.playAudio();
  }

  pause(): void {
    this.clearWait();
    this.audio.pause();
  }

  toggle(): void {
    if (this.audio.paused) void this.play();
    else this.pause();
  }

  seek(timeSec: number): void {
    this.clearWait();
    this.restoreSlow();
    const d = this.audio.duration;
    this.audio.currentTime = clamp(timeSec, 0, Number.isFinite(d) ? d : Infinity);
    this.holdIndex = -1;
    this.rearm();
    this.sync();
  }

  /** A sentence loop follows the user to the sentence they pick. */
  seekToCue(index: number, opts: { play?: boolean } = {}): void {
    if (!this.cues[index]) return;
    this.clearWait();
    this.restoreSlow();
    if (this.loop.kind === 'cue' && this.loop.index !== index) {
      this.setLoop({ ...this.loop, index });
    }
    this.jumpTo(index);
    if (opts.play) void this.playAudio();
  }

  prevCue(): void {
    this.seekToCue(prevCueIndex(this.cues, this.cueTime()));
  }

  nextCue(): void {
    this.seekToCue(nextCueIndex(this.cues, this.cueTime()));
  }

  replayCue(index = this.index): void {
    this.seekToCue(index, { play: true });
  }

  /** LRN-6: plays one sentence at 0.75x, then restores the speed. */
  replayCueSlowly(index = this.index): void {
    if (!this.cues[index]) return;
    const rate = this.slow?.rate ?? this.audio.playbackRate;
    this.seekToCue(index);
    this.slow = { index, rate };
    this.audio.playbackRate = SLOW_RATE;
    void this.playAudio();
  }

  /** PLY-3: 0.5x to 1.5x in 0.05 steps, pitch preserved. */
  setRate(rate: number): void {
    const r = Math.round(clamp(rate, MIN_RATE, MAX_RATE) * 20) / 20;
    this.slow = null;
    this.audio.playbackRate = r;
    this.audio.defaultPlaybackRate = r; // survives a src change
  }

  setOffset(offsetMs: number): void {
    this.offsetMs = clamp(Math.round(offsetMs), -MAX_OFFSET_MS, MAX_OFFSET_MS);
    this.holdIndex = -1;
    this.rearm();
    this.sync();
    this.emitState();
  }

  /** LRN-4, LRN-5. A range must start and end on cue boundaries; otherwise the loop is off. */
  setLoop(mode: LoopMode): void {
    this.loop = mode;
    this.loopPlays = 0;
    this.range = null;
    if (mode.kind === 'range') {
      const from = this.cues.findIndex((c) => Math.abs(c.startSec - mode.startSec) < 1e-3);
      const to = this.cues.findIndex((c) => Math.abs(c.endSec - mode.endSec) < 1e-3);
      if (from >= 0 && to >= from) this.range = { from, to };
      else this.loop = { kind: 'off' };
    }
    this.emit('loopchange', this.loop);
  }

  /** LRN-3 */
  setAutoPause(mode: AutoPauseMode): void {
    this.autoPause = mode;
  }

  on<K extends keyof Events>(event: K, cb: (payload: Events[K]) => void): () => void {
    const set = this.listeners[event];
    set.add(cb);
    return () => set.delete(cb);
  }

  getState(): PlayerState {
    const d = this.audio.duration;
    return {
      playing: !this.audio.paused,
      currentTime: this.audio.currentTime,
      duration: Number.isFinite(d) ? d : 0,
      rate: this.audio.playbackRate,
      offsetMs: this.offsetMs,
    };
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    this.clearWait();
    this.audio.pause();
    this.removeAudioListeners();
    Object.values(this.listeners).forEach((set) => set.clear());
    this.audio.removeAttribute('src');
    this.audio.load();
    if (this.url) URL.revokeObjectURL(this.url);
  }

  private async playAudio(): Promise<void> {
    try {
      await this.audio.play();
    } catch {
      this.emitState(); // MOB-2: show the paused state
    }
  }

  private cueTime(): number {
    return cueTime(this.audio.currentTime, this.offsetMs);
  }

  private jumpTo(index: number): void {
    this.audio.currentTime = cueSeekTime(this.cues[index]!, this.offsetMs);
    this.holdIndex = index;
    this.armedFrom = index; // the pre-roll is inside cue index - 1: never fire its end
    this.sync();
  }

  /** After a seek, arm only cues that have not ended yet at the new position. */
  private rearm(): void {
    const t = this.cueTime();
    const i = this.cues.findIndex((c) => c.endSec - END_EARLY_SEC > t);
    this.armedFrom = i < 0 ? this.cues.length : i;
  }

  private restoreSlow(): void {
    if (!this.slow) return;
    this.audio.playbackRate = this.slow.rate;
    this.slow = null;
  }

  /** Pauses on the engine's behalf; Play, or the timer for timed waits, runs resume. */
  private wait(state: WaitState, resume?: () => void): void {
    this.audio.pause();
    this.clearWait();
    this.waiting = state;
    this.resume = resume ?? null;
    if (state.kind !== 'manual') {
      this.waitTimer = setTimeout(() => void this.play(), state.ms);
    }
    this.emit('wait', state);
  }

  private clearWait(): void {
    clearTimeout(this.waitTimer);
    this.resume = null;
    if (this.waiting) {
      this.waiting = null;
      this.emit('wait', null);
    }
  }

  /** Loop, A-B loop and auto-pause decisions at the end of a cue. */
  private onCueEnd(index: number): void {
    if (this.slow?.index === index) this.restoreSlow();
    const loop = this.loop;
    if (loop.kind === 'cue' && loop.index === index) {
      this.loopPlays++;
      if (loop.times === 'infinite' || this.loopPlays < loop.times) {
        this.wait({ kind: 'gap', ms: LOOP_GAP_MS }, () => {
          this.jumpTo(index);
          void this.playAudio();
        });
        return;
      }
      this.setLoop({ kind: 'off' }); // LRN-4: then play on, and auto-pause applies once
    }
    if (this.range && index === this.range.to) {
      this.jumpTo(this.range.from);
      return;
    }
    const cue = this.cues[index]!;
    if (this.autoPause.kind === 'manual') {
      this.wait({ kind: 'manual' });
    } else if (this.autoPause.kind === 'timed') {
      const ms = (cue.endSec - cue.startSec) * this.autoPause.factor * 1000;
      this.wait({ kind: 'timed', ms }, () => void this.playAudio());
    }
  }

  private startLoop(): void {
    cancelAnimationFrame(this.frame);
    const step = (now: number) => {
      this.update();
      if (now - this.lastTick >= TICK_MS) {
        this.lastTick = now;
        this.emit('tick', this.audio.currentTime);
      }
      this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }

  /** Update outside the frame loop (seek, pause, load): always report the time. */
  private sync(): void {
    this.update();
    this.emit('tick', this.audio.currentTime);
  }

  private update(): void {
    const t = this.cueTime();
    const current = currentSentenceIndex(this.cues, t);
    let index = current;
    if (this.holdIndex >= 0) {
      if (t < this.cues[this.holdIndex]!.startSec) index = this.holdIndex;
      else this.holdIndex = -1;
    }
    if (index !== this.index) {
      this.index = index;
      this.emit('cuechange', index);
    }

    const cue = this.cues[current];
    if (!this.audio.paused && cue && current >= this.armedFrom && t >= cue.endSec - END_EARLY_SEC) {
      this.armedFrom = current + 1;
      this.emit('cueend', current);
      this.onCueEnd(current);
    }
  }

  private emitState(): void {
    this.emit('statechange', this.getState());
  }

  private emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    this.listeners[event].forEach((cb) => cb(payload));
  }
}
