import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerEngine } from '../../src/player/PlayerEngine';
import type { Cue } from '../../src/lib/subtitles/types';

class FakeAudio extends EventTarget {
  currentTime = 0;
  duration = 60;
  paused = true;
  playbackRate = 1;
  defaultPlaybackRate = 1;
  preservesPitch = false;
  error = null;
  src = '';
  rejectPlay = false;
  play() {
    if (this.rejectPlay) return Promise.reject(new Error('NotAllowedError'));
    this.paused = false;
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  }
  pause() {
    if (this.paused) return;
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  }
  removeAttribute() {}
  load() {}
}

let frames: FrameRequestCallback[] = [];
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
vi.stubGlobal('cancelAnimationFrame', () => (frames = []));
const runFrame = (now: number) => {
  const pending = frames;
  frames = [];
  pending.forEach((cb) => cb(now));
};

const cue = (index: number, startSec: number, endSec: number): Cue => ({
  index,
  startSec,
  endSec,
  text: `cue ${index}`,
});
// Contiguous cues, as PAR-13 produces for NotebookLM speech.
const cues = [cue(0, 0, 2), cue(1, 2, 4), cue(2, 4, 6)];

async function setup() {
  const audio = new FakeAudio();
  const engine = new PlayerEngine(audio as unknown as HTMLAudioElement);
  const loading = engine.load(new Blob(), cues, 0);
  audio.dispatchEvent(new Event('loadedmetadata'));
  await loading;
  const events = { cuechange: [] as number[], cueend: [] as number[], tick: [] as number[] };
  engine.on('cuechange', (i) => events.cuechange.push(i));
  engine.on('cueend', (i) => events.cueend.push(i));
  engine.on('tick', (t) => events.tick.push(t));
  /** Moves playback to t and runs one animation frame. */
  const playTo = (t: number, now = 0) => {
    audio.currentTime = t;
    runFrame(now);
  };
  return { audio, engine, events, playTo };
}

beforeEach(() => {
  frames = [];
});

describe('PlayerEngine', () => {
  it('emits cuechange only when the sentence changes', async () => {
    const { engine, events, playTo } = await setup();
    await engine.play();
    playTo(0.5);
    playTo(1.5);
    playTo(2.5);
    playTo(3);
    expect(events.cuechange).toEqual([1]);
  });

  it('throttles ticks while playing', async () => {
    const { engine, events, playTo } = await setup();
    await engine.play();
    playTo(0.1, 1000);
    playTo(0.2, 1050);
    playTo(0.3, 1100);
    expect(events.tick).toEqual([0.1, 0.3]);
  });

  it('fires the end of each cue once per pass (CUE-6)', async () => {
    const { engine, events, playTo } = await setup();
    await engine.play();
    playTo(1.9);
    playTo(1.975); // within 30 ms of the end
    playTo(1.99);
    playTo(3.98);
    expect(events.cueend).toEqual([0, 1]);
  });

  it('a seek re-arms cues that have not ended', async () => {
    const { engine, events, playTo } = await setup();
    await engine.play();
    playTo(1.98);
    engine.seek(0.5);
    playTo(1.98);
    expect(events.cueend).toEqual([0, 0]);
  });

  it('a seek past a cue end does not fire it', async () => {
    const { engine, events, playTo } = await setup();
    await engine.play();
    engine.seek(1.99);
    playTo(1.995);
    expect(events.cueend).toEqual([]);
  });

  it('the pre-roll never triggers the previous cue end, and keeps the target highlighted', async () => {
    const { audio, engine, events, playTo } = await setup();
    await engine.play();
    engine.seekToCue(2);
    expect(audio.currentTime).toBeCloseTo(3.85);
    expect(events.cuechange).toEqual([2]);
    playTo(3.9);
    playTo(3.99);
    playTo(4.1);
    expect(events.cueend).toEqual([]);
    expect(events.cuechange).toEqual([2]);
  });

  it('applies the sync offset to cue math', async () => {
    const { audio, engine, events, playTo } = await setup();
    engine.setOffset(500); // subtitles later
    await engine.play();
    playTo(2.3);
    expect(events.cuechange).toEqual([]);
    playTo(2.6);
    expect(events.cuechange).toEqual([1]);
    engine.seekToCue(2);
    expect(audio.currentTime).toBeCloseTo(4.35);
  });

  it('clamps and rounds rate and offset', async () => {
    const { engine } = await setup();
    engine.setRate(0.93);
    expect(engine.getState().rate).toBe(0.95);
    engine.setRate(3);
    expect(engine.getState().rate).toBe(1.5);
    engine.setOffset(-9000);
    expect(engine.getState().offsetMs).toBe(-5000);
  });

  it('prev and next navigate sentences', async () => {
    const { audio, engine } = await setup();
    audio.currentTime = 3.5; // 1.5 s into cue 1
    engine.prevCue();
    expect(audio.currentTime).toBeCloseTo(1.85);
    engine.prevCue(); // within the first second: previous cue
    expect(audio.currentTime).toBe(0);
    engine.nextCue();
    expect(audio.currentTime).toBeCloseTo(1.85);
    engine.nextCue();
    expect(audio.currentTime).toBeCloseTo(3.85);
    engine.nextCue(); // last cue: nothing
    expect(audio.currentTime).toBeCloseTo(3.85);
  });

  it('a rejected play() reports the paused state', async () => {
    const { audio, engine } = await setup();
    audio.rejectPlay = true;
    const states: boolean[] = [];
    engine.on('statechange', (s) => states.push(s.playing));
    await engine.play();
    expect(states).toEqual([false]);
  });
});
