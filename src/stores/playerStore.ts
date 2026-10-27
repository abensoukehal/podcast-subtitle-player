import { create } from 'zustand';
import { durationMismatchWarning, parseSubtitles } from '../lib/subtitles/parse';
import { SubtitleParseError, type Cue } from '../lib/subtitles/types';
import { PlayerEngine, type PlayerState } from '../player/PlayerEngine';

export type View = 'transcript' | 'caption';

const VIEW_KEY = 'player-view';

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'caption' ? 'caption' : 'transcript';
  } catch {
    return 'transcript';
  }
}

interface PlayerStore extends PlayerState {
  title: string;
  cues: Cue[];
  index: number;
  warnings: string[];
  error: string | null;
  view: View;
}

export const engine = new PlayerEngine();

export const usePlayer = create<PlayerStore>(() => ({
  ...engine.getState(),
  title: '',
  cues: [],
  index: -1,
  warnings: [],
  error: null,
  view: readView(),
}));

engine.on('cuechange', (index) => usePlayer.setState({ index }));
engine.on('tick', (currentTime) => usePlayer.setState({ currentTime }));
engine.on('statechange', (state) => usePlayer.setState(state));
engine.on('error', () => usePlayer.setState({ error: 'This audio could not be played.' }));

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

/** Loads a pair of files. Returns an error message, or null on success. Never autoplays (PLY-1). */
export async function openEpisode(audio: File, subtitles: File): Promise<string | null> {
  let parsed;
  try {
    parsed = parseSubtitles(await subtitles.text(), subtitles.name);
  } catch (e) {
    if (e instanceof SubtitleParseError) return e.message;
    throw e;
  }
  const rate = usePlayer.getState().rate; // PLY-3: last speed is the default
  try {
    await engine.load(audio, parsed.cues, 0);
  } catch {
    return 'This audio format is not supported by your browser';
  }
  engine.setRate(rate);
  const mismatch = durationMismatchWarning(parsed.cues, engine.getState().duration);
  usePlayer.setState({
    title: audio.name.replace(/\.[^.]*$/, ''),
    cues: parsed.cues,
    warnings: mismatch ? [...parsed.warnings, mismatch] : parsed.warnings,
    error: null,
  });
  return null;
}

export function closeEpisode(): void {
  engine.pause();
  usePlayer.setState({ cues: [], title: '', warnings: [], error: null });
}
