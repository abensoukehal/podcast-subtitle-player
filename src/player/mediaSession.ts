import type { PlayerEngine } from './PlayerEngine';

/**
 * MOB-1: lock screen, notification and headphone controls for the open episode.
 * Previous/next track map to previous/next sentence. Returns a function that unbinds.
 */
export function bindMediaSession(
  engine: PlayerEngine,
  title: string,
  skipSec: () => number,
): () => void {
  if (!('mediaSession' in navigator)) return () => undefined;
  const session = navigator.mediaSession;
  session.metadata = new MediaMetadata({
    title,
    artist: 'Subtitle Player',
    artwork: [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png' }],
  });

  const skip = (sec: number) => engine.seek(engine.getState().currentTime + sec);
  const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
    ['play', () => void engine.play()], // MOB-2: a Media Session handler may start playback
    ['pause', () => engine.pause()],
    ['seekbackward', (d) => skip(-(d.seekOffset ?? skipSec()))],
    ['seekforward', (d) => skip(d.seekOffset ?? skipSec())],
    ['seekto', (d) => d.seekTime !== undefined && engine.seek(d.seekTime)],
    ['previoustrack', () => engine.prevCue()],
    ['nexttrack', () => engine.nextCue()],
  ];
  const setHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
    try {
      session.setActionHandler(action, handler);
    } catch {
      // This browser does not support the action.
    }
  };
  handlers.forEach(([action, handler]) => setHandler(action, handler));

  const updatePosition = () => {
    const { duration, currentTime, rate } = engine.getState();
    if (!duration) return;
    try {
      session.setPositionState({
        duration,
        position: Math.min(currentTime, duration),
        playbackRate: rate,
      });
    } catch {
      // Older browsers lack setPositionState.
    }
  };
  let lastUpdate = 0;
  const offTick = engine.on('tick', () => {
    if (Date.now() - lastUpdate < 1000) return; // at most once per second
    lastUpdate = Date.now();
    updatePosition();
  });
  const offState = engine.on('statechange', ({ playing }) => {
    session.playbackState = playing ? 'playing' : 'paused';
    updatePosition();
  });
  updatePosition();

  return () => {
    offTick();
    offState();
    handlers.forEach(([action]) => setHandler(action, null));
    session.metadata = null;
    session.playbackState = 'none';
  };
}
