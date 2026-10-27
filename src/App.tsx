import { useState } from 'react';
import { PlayerScreen } from './components/player/PlayerScreen';
import { pairFiles } from './lib/pairing';
import { openEpisode, usePlayer } from './stores/playerStore';
import styles from './App.module.css';

export default function App() {
  const loaded = usePlayer((s) => s.cues.length > 0);
  return loaded ? <PlayerScreen /> : <OpenFiles />;
}

/** M2 stand-in for the library: pick an audio file and its subtitles, nothing is stored. */
function OpenFiles() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function open(list: FileList | null) {
    const { pairs, unpairedAudio, unpairedSubtitles } = pairFiles([...(list ?? [])]);
    const [audio, subtitle] = pairs[0]
      ? [pairs[0].audio, pairs[0].subtitle]
      : [unpairedAudio[0], unpairedSubtitles[0]];
    if (!audio || !subtitle) {
      setError('Choose an audio file and its .srt or .vtt subtitle file together.');
      return;
    }
    setBusy(true);
    setError(await openEpisode(audio, subtitle));
    setBusy(false);
  }

  return (
    <main className={styles.open}>
      <h1>Subtitle Player</h1>
      <p>
        Choose an audio file and its SRT or VTT subtitle file at the same time, for example{' '}
        <code>episode-01.m4a</code> and <code>episode-01.srt</code>.
      </p>
      <label className={styles.pick}>
        {busy ? 'Opening…' : 'Choose files'}
        <input
          type="file"
          multiple
          accept="audio/*,.srt,.vtt"
          disabled={busy}
          onChange={(e) => void open(e.target.files)}
        />
      </label>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
