import {
  cueSeekTime,
  cueTime,
  currentSentenceIndex,
  nextCueIndex,
  prevCueIndex,
} from '../lib/cues';
import type { Cue } from '../lib/subtitles/types';

/** CUE-6: a cue counts as ended this early, so a stop lands before the next syllable. */
const END_EARLY_SEC = 0.03;
const TICK_MS = 100;
export const MIN_RATE = 0.5;
export const MAX_RATE = 1.5;
export const MAX_OFFSET_MS = 5000;

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
  ended: undefined;
  error: MediaError | null;
}

type Listeners = { [K in keyof Events]: Set<(payload: Events[K]) => void> };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Owns the single audio element. Cue tracking runs in an animation-frame loop while playing. */
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
  private readonly removeAudioListeners: () => void;
  private readonly listeners: Listeners = {
    tick: new Set(),
    cuechange: new Set(),
    cueend: new Set(),
    statechange: new Set(),
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

  /** Never throws: a rejected play() (autoplay rules) just leaves the paused state. */
  async play(): Promise<void> {
    try {
      await this.audio.play();
    } catch {
      this.emitState();
    }
  }

  pause(): void {
    this.audio.pause();
  }

  toggle(): void {
    if (this.audio.paused) void this.play();
    else this.pause();
  }

  seek(timeSec: number): void {
    const d = this.audio.duration;
    this.audio.currentTime = clamp(timeSec, 0, Number.isFinite(d) ? d : Infinity);
    this.holdIndex = -1;
    this.rearm();
    this.sync();
  }

  seekToCue(index: number, opts: { play?: boolean } = {}): void {
    const cue = this.cues[index];
    if (!cue) return;
    this.audio.currentTime = cueSeekTime(cue, this.offsetMs);
    this.holdIndex = index;
    this.armedFrom = index; // the pre-roll is inside cue index - 1: never fire its end
    this.sync();
    if (opts.play) void this.play();
  }

  prevCue(): void {
    this.seekToCue(prevCueIndex(this.cues, this.cueTime()));
  }

  nextCue(): void {
    this.seekToCue(nextCueIndex(this.cues, this.cueTime()));
  }

  replayCue(): void {
    this.seekToCue(this.index, { play: true });
  }

  /** PLY-3: 0.5x to 1.5x in 0.05 steps, pitch preserved. */
  setRate(rate: number): void {
    const r = Math.round(clamp(rate, MIN_RATE, MAX_RATE) * 20) / 20;
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
    this.audio.pause();
    this.removeAudioListeners();
    Object.values(this.listeners).forEach((set) => set.clear());
    this.audio.removeAttribute('src');
    this.audio.load();
    if (this.url) URL.revokeObjectURL(this.url);
  }

  private cueTime(): number {
    return cueTime(this.audio.currentTime, this.offsetMs);
  }

  /** After a seek, arm only cues that have not ended yet at the new position. */
  private rearm(): void {
    const t = this.cueTime();
    const i = this.cues.findIndex((c) => c.endSec - END_EARLY_SEC > t);
    this.armedFrom = i < 0 ? this.cues.length : i;
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
    }
  }

  private emitState(): void {
    this.emit('statechange', this.getState());
  }

  private emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    this.listeners[event].forEach((cb) => cb(payload));
  }
}
