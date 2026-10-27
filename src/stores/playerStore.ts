import { create } from 'zustand';
import { getAudio, getEpisode, replaceAudio, updateEpisode } from '../lib/db/episodes';
import type { Episode } from '../lib/db/schema';
import { describeWriteError } from '../lib/db/storage';
import { durationMismatchWarning } from '../lib/subtitles/parse';
import type { Cue } from '../lib/subtitles/types';
import { PlayerEngine, type PlayerState } from '../player/PlayerEngine';

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

interface PlayerStore extends PlayerState {
  status: Status;
  episodeId: string | null;
  title: string;
  cues: Cue[];
  index: number;
  warnings: string[];
  error: string | null;
  ended: boolean;
  view: View;
}

export const engine = new PlayerEngine();

export const usePlayer = create<PlayerStore>(() => ({
  ...engine.getState(),
  status: 'idle',
  episodeId: null,
  title: '',
  cues: [],
  index: -1,
  warnings: [],
  error: null,
  ended: false,
  view: readView(),
}));

let lastSave = 0;
let openToken = 0; // the latest open wins when loads overlap

/** Writes to an episode; a failure is shown, never thrown (STO-5). */
async function saveEpisode(id: string, patch: Parameters<typeof updateEpisode>[1]): Promise<void> {
  try {
    await updateEpisode(id, patch);
  } catch (e) {
    usePlayer.setState({ error: await describeWriteError(e) });
  }
}

/** STO-2: saves the current position of the open episode. */
async function savePosition(): Promise<void> {
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
  const rate = usePlayer.getState().rate; // PLY-3: last speed is the default
  try {
    await engine.load(audio, episode.cues, episode.offsetMs);
  } catch {
    if (token === openToken) {
      usePlayer.setState({ status: 'audioError', error: 'This audio could not be decoded.' });
    }
    return false;
  }
  if (token !== openToken) return false;
  engine.setRate(rate);
  engine.seek(episode.finished ? 0 : episode.lastPositionSec);
  const mismatch = durationMismatchWarning(episode.cues, engine.getState().duration);
  usePlayer.setState({ status: 'ready', error: null, warnings: mismatch ? [mismatch] : [] });
  lastSave = Date.now();
  return true;
}

/** Opens a stored episode. Never autoplays (PLY-1). */
export async function openEpisode(id: string): Promise<void> {
  const token = ++openToken;
  engine.pause();
  usePlayer.setState({
    status: 'loading',
    episodeId: id,
    title: '',
    cues: [],
    index: -1,
    warnings: [],
    error: null,
    ended: false,
  });
  const [episode, audio] = await Promise.all([getEpisode(id), getAudio(id)]);
  if (token !== openToken) return;
  if (!episode) {
    usePlayer.setState({ status: 'missing' });
    return;
  }
  usePlayer.setState({ title: episode.title, cues: episode.cues });
  if (!audio) {
    usePlayer.setState({ status: 'audioError', error: 'The audio for this episode is missing.' });
    return;
  }
  if (await startPlayback(episode, audio, token)) {
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
  usePlayer.setState({
    status: 'idle',
    episodeId: null,
    title: '',
    cues: [],
    index: -1,
    warnings: [],
    error: null,
    ended: false,
  });
}

/** PLY-4: the sync offset is saved per episode. */
export function setOffset(offsetMs: number): void {
  engine.setOffset(offsetMs);
  const { episodeId } = usePlayer.getState();
  if (episodeId) void saveEpisode(episodeId, { offsetMs: engine.getState().offsetMs });
}

/** PLY-5: play the finished episode again from the start. */
export function replay(): void {
  engine.seek(0);
  void engine.play();
}
