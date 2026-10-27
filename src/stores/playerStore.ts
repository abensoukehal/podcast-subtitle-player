import { create } from 'zustand';
import { addBookmark, deleteBookmark, listBookmarks } from '../lib/db/bookmarks';
import { getAudio, getEpisode, replaceAudio, updateEpisode } from '../lib/db/episodes';
import type { AutoPauseMode, Bookmark, Episode, Settings } from '../lib/db/schema';
import { describeWriteError } from '../lib/db/storage';
import { addVocab } from '../lib/db/vocabulary';
import { durationMismatchWarning } from '../lib/subtitles/parse';
import type { Cue } from '../lib/subtitles/types';
import { bindMediaSession } from '../player/mediaSession';
import {
  PlayerEngine,
  type LoopMode,
  type PlayerState,
  type WaitState,
} from '../player/PlayerEngine';
import { settingsReady, updateSettings, useSettings } from './settingsStore';

export type View = 'transcript' | 'caption';
type Status = 'idle' | 'loading' | 'ready' | 'missing' | 'audioError';

const VIEW_KEY = 'player-view';
const SAVE_EVERY_MS = 5000; // STO-2
export const UNSUPPORTED_AUDIO = 'This audio format is not supported by your browser';

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'caption' ? 'caption' : 'transcript';
  } catch {
    return 'transcript';
  }
}

interface EpisodeState {
  title: string;
  cues: Cue[];
  index: number;
  warnings: string[];
  error: string | null;
  ended: boolean;
  revealed: ReadonlySet<number>; // LRN-1: stays revealed until the episode is closed
  bookmarks: ReadonlyMap<number, Bookmark>; // by cue index
  abStart: number | null; // LRN-5: "Loop from here" cue index
  abEnd: number | null; // LRN-5: "Loop to here" cue index
  sheet: number | null; // cue index of the open Sentence sheet
  searching: boolean; // TRN-7: the transcript search bar is open
}

interface PlayerStore extends PlayerState, EpisodeState {
  status: Status;
  episodeId: string | null;
  loop: LoopMode;
  waiting: WaitState | null;
  view: View;
}

const emptyEpisode = (): EpisodeState => ({
  title: '',
  cues: [],
  index: -1,
  warnings: [],
  error: null,
  ended: false,
  revealed: new Set(),
  bookmarks: new Map(),
  abStart: null,
  abEnd: null,
  sheet: null,
  searching: false,
});

export const engine = new PlayerEngine();

export const usePlayer = create<PlayerStore>(() => ({
  ...engine.getState(),
  ...emptyEpisode(),
  status: 'idle',
  episodeId: null,
  loop: { kind: 'off' },
  waiting: null,
  view: readView(),
}));

let lastSave = 0;
let openToken = 0; // the latest open wins when loads overlap
let unbindMediaSession: () => void = () => undefined;

/** Writes to an episode; a failure is shown, never thrown (STO-5). */
async function saveEpisode(id: string, patch: Parameters<typeof updateEpisode>[1]): Promise<void> {
  try {
    await updateEpisode(id, patch);
  } catch (e) {
    usePlayer.setState({ error: await describeWriteError(e) });
  }
}

/** STO-2: saves the current position of the open episode. */
export async function savePosition(): Promise<void> {
  const { episodeId, status } = usePlayer.getState();
  if (!episodeId || status !== 'ready') return;
  lastSave = Date.now();
  await saveEpisode(episodeId, { lastPositionSec: engine.getState().currentTime });
}

engine.on('cuechange', (index) => usePlayer.setState({ index }));
engine.on('tick', (currentTime) => {
  usePlayer.setState({ currentTime });
  if (usePlayer.getState().playing && Date.now() - lastSave >= SAVE_EVERY_MS) void savePosition();
});
engine.on('statechange', (state) => {
  const wasPlaying = usePlayer.getState().playing;
  usePlayer.setState(state.playing ? { ...state, ended: false } : state);
  if (wasPlaying && !state.playing) void savePosition();
});
engine.on('loopchange', (loop) => usePlayer.setState({ loop }));
engine.on('wait', (waiting) => usePlayer.setState({ waiting }));
engine.on('cueend', (index) => {
  // LRN-2: listen first, then check.
  const { subtitleVisibility, revealAfterCue } = useSettings.getState();
  if (subtitleVisibility === 'blurred' && revealAfterCue) reveal(index);
});
engine.on('ended', () => {
  const { episodeId } = usePlayer.getState();
  if (!episodeId) return;
  usePlayer.setState({ ended: true });
  void saveEpisode(episodeId, { finished: true }); // PLY-5
});
engine.on('error', () => {
  if (usePlayer.getState().status === 'ready') {
    usePlayer.setState({ error: 'This audio could not be played.' });
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void savePosition();
});
window.addEventListener('pagehide', () => void savePosition());

/** TRN-7 */
export function toggleSearch(): void {
  usePlayer.setState({ searching: !usePlayer.getState().searching });
}

/** TRN-1: the chosen view is remembered. */
export function toggleView(): void {
  const view: View = usePlayer.getState().view === 'caption' ? 'transcript' : 'caption';
  usePlayer.setState({ view });
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Private mode: the view is still switched for this session.
  }
}

/** Loads audio into the engine and restores the position (PLY-1). False if it cannot play. */
async function startPlayback(episode: Episode, audio: Blob, token: number): Promise<boolean> {
  try {
    await engine.load(audio, episode.cues, episode.offsetMs);
  } catch {
    if (token === openToken) {
      usePlayer.setState({ status: 'audioError', error: 'This audio could not be decoded.' });
    }
    return false;
  }
  if (token !== openToken) return false;
  const { defaultRate, autoPause } = useSettings.getState();
  engine.setRate(defaultRate);
  engine.setAutoPause(autoPause);
  engine.setLoop({ kind: 'off' });
  engine.seek(episode.finished ? 0 : episode.lastPositionSec);
  const mismatch = durationMismatchWarning(episode.cues, engine.getState().duration);
  usePlayer.setState({ status: 'ready', error: null, warnings: mismatch ? [mismatch] : [] });
  lastSave = Date.now();
  unbindMediaSession();
  unbindMediaSession = bindMediaSession(
    engine,
    episode.title,
    () => useSettings.getState().skipSec,
  );
  return true;
}

/**
 * Opens a stored episode. Never autoplays (PLY-1), except when asked to start at a sentence
 * from Bookmarks, which is itself a tap (REV-3).
 */
export async function openEpisode(
  id: string,
  start?: { cue: number; play: boolean },
): Promise<void> {
  const token = ++openToken;
  engine.pause();
  usePlayer.setState({ ...emptyEpisode(), status: 'loading', episodeId: id });
  const [episode, audio, bookmarks] = await Promise.all([
    getEpisode(id),
    getAudio(id),
    listBookmarks(id),
    settingsReady,
  ]);
  if (token !== openToken) return;
  if (!episode) {
    usePlayer.setState({ status: 'missing' });
    return;
  }
  usePlayer.setState({
    title: episode.title,
    cues: episode.cues,
    bookmarks: new Map(bookmarks.map((b) => [b.cueIndex, b])),
  });
  if (!audio) {
    usePlayer.setState({ status: 'audioError', error: 'The audio for this episode is missing.' });
    return;
  }
  if (await startPlayback(episode, audio, token)) {
    if (start) engine.seekToCue(start.cue, { play: start.play });
    void saveEpisode(id, { lastPlayedAt: Date.now() });
  }
}

/** PLY-6: new audio for the open episode; subtitles, progress and bookmarks are kept. */
export async function reimportAudio(file: File): Promise<void> {
  const { episodeId } = usePlayer.getState();
  const episode = episodeId && (await getEpisode(episodeId));
  if (!episode) return;
  const token = ++openToken;
  usePlayer.setState({ status: 'loading', error: null });
  if (!(await startPlayback(episode, file, token))) {
    usePlayer.setState({ error: UNSUPPORTED_AUDIO });
    return;
  }
  try {
    await replaceAudio(episode.id, file, {
      audioFileName: file.name,
      audioMimeType: file.type,
      durationSec: engine.getState().duration,
    });
    await updateEpisode(episode.id, { lastPlayedAt: Date.now() });
  } catch (e) {
    usePlayer.setState({ error: await describeWriteError(e) });
  }
}

export function closeEpisode(): void {
  void savePosition();
  openToken++;
  engine.pause();
  unbindMediaSession();
  usePlayer.setState({ ...emptyEpisode(), status: 'idle', episodeId: null });
}

/** PLY-4: the sync offset is saved per episode. */
export function setOffset(offsetMs: number): void {
  engine.setOffset(offsetMs);
  const { episodeId } = usePlayer.getState();
  if (episodeId) void saveEpisode(episodeId, { offsetMs: engine.getState().offsetMs });
}

/** PLY-3: a speed change applies at once and becomes the default. */
export function setRate(rate: number): void {
  engine.setRate(rate);
  updateSettings({ defaultRate: engine.getState().rate });
}

/** PLY-5: play the finished episode again from the start. */
export function replay(): void {
  engine.seek(0);
  void engine.play();
}

// Learning tools (LRN)

const VISIBILITY: Settings['subtitleVisibility'][] = ['visible', 'blurred', 'hidden'];

/** LRN-1: Visible, Blurred, Hidden. */
export function cycleVisibility(): void {
  const current = VISIBILITY.indexOf(useSettings.getState().subtitleVisibility);
  updateSettings({ subtitleVisibility: VISIBILITY[(current + 1) % VISIBILITY.length]! });
}

export function reveal(index: number): void {
  const { revealed } = usePlayer.getState();
  if (!revealed.has(index)) usePlayer.setState({ revealed: new Set(revealed).add(index) });
}

/** TRN-3, LRN-1: in Blurred mode the first tap reveals a sentence, the next one seeks. */
export function tapSentence(index: number): void {
  const blurred = useSettings.getState().subtitleVisibility === 'blurred';
  if (blurred && !usePlayer.getState().revealed.has(index)) reveal(index);
  else engine.seekToCue(index, { play: true });
}

/** LRN-3 */
export function setAutoPause(mode: AutoPauseMode): void {
  engine.setAutoPause(mode);
  updateSettings({ autoPause: mode });
}

/** LRN-4: loop a sentence (the current one by default), or stop looping with null. */
export function setSentenceLoop(times: number | 'infinite' | null, index?: number): void {
  usePlayer.setState({ abStart: null, abEnd: null });
  const i = index ?? Math.max(0, usePlayer.getState().index);
  engine.setLoop(times === null ? { kind: 'off' } : { kind: 'cue', index: i, times });
}

/** LRN-5: "Loop from here" and "Loop to here"; the loop starts once both ends are set. */
export function setLoopEnd(end: 'from' | 'to', index: number): void {
  const state = usePlayer.getState();
  const abStart = end === 'from' ? index : (state.abStart ?? index);
  const abEnd = end === 'to' ? index : state.abEnd;
  usePlayer.setState({ abStart, abEnd });
  if (abEnd === null) return;
  const from = state.cues[Math.min(abStart, abEnd)]!;
  const to = state.cues[Math.max(abStart, abEnd)]!;
  engine.setLoop({ kind: 'range', startSec: from.startSec, endSec: to.endSec });
}

export function clearLoopRange(): void {
  usePlayer.setState({ abStart: null, abEnd: null });
  if (usePlayer.getState().loop.kind === 'range') engine.setLoop({ kind: 'off' });
}

// Sentence sheet (SEN)

export function openSheet(index: number): void {
  engine.pause();
  usePlayer.setState({ sheet: index });
}

export function closeSheet(): void {
  usePlayer.setState({ sheet: null });
}

export async function toggleBookmark(index: number): Promise<void> {
  const { episodeId, bookmarks, cues } = usePlayer.getState();
  const cue = cues[index];
  if (!episodeId || !cue) return;
  try {
    const existing = bookmarks.get(index);
    const next = new Map(usePlayer.getState().bookmarks);
    if (existing) {
      await deleteBookmark(existing.id);
      next.delete(index);
    } else {
      const bookmark = await addBookmark({
        episodeId,
        cueIndex: index,
        text: cue.text,
        startSec: cue.startSec,
      });
      next.set(index, bookmark);
    }
    usePlayer.setState({ bookmarks: next });
  } catch (e) {
    usePlayer.setState({ error: await describeWriteError(e) });
  }
}

/** SEN-3: saves a word or phrase with its sentence. Returns the message to show. */
export async function saveToVocabulary(word: string, index: number): Promise<string> {
  const { episodeId, title, cues } = usePlayer.getState();
  const cue = cues[index];
  if (!episodeId || !cue || !word) return '';
  try {
    const result = await addVocab({
      word,
      sentence: cue.text,
      episodeId,
      episodeTitle: title,
      cueIndex: index,
      timeSec: cue.startSec,
    });
    return result === 'exists' ? 'Already saved' : `Saved “${word}”`;
  } catch (e) {
    return describeWriteError(e);
  }
}

// MOB-4: keep the screen on while playing in Caption view, if the setting allows.

let wakeLock: WakeLockSentinel | null = null;
let wantWakeLock = false;

function syncWakeLock(): void {
  const { status, playing, view } = usePlayer.getState();
  const want =
    status === 'ready' &&
    playing &&
    view === 'caption' &&
    useSettings.getState().keepScreenOn &&
    document.visibilityState === 'visible';
  if (want === wantWakeLock || !('wakeLock' in navigator)) return;
  wantWakeLock = want;
  if (want) {
    navigator.wakeLock.request('screen').then(
      (lock) => (wantWakeLock ? (wakeLock = lock) : void lock.release()),
      () => undefined, // refused, e.g. low battery
    );
  } else {
    void wakeLock?.release();
    wakeLock = null;
  }
}

usePlayer.subscribe(syncWakeLock);
useSettings.subscribe(syncWakeLock);
document.addEventListener('visibilitychange', syncWakeLock); // the browser releases it when hidden
