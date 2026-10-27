// Generates the E2E fixture pair in memory, so no binary tools or files are needed.

const SAMPLE_RATE = 8000;

/** A mono 16-bit PCM WAV with a quiet 440 Hz tone. */
export function makeWav(seconds: number): Buffer {
  const samples = seconds * SAMPLE_RATE;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + samples * 2, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); // fmt chunk size
  wav.writeUInt16LE(1, 20); // PCM
  wav.writeUInt16LE(1, 22); // mono
  wav.writeUInt32LE(SAMPLE_RATE, 24);
  wav.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  wav.writeUInt16LE(2, 32); // block align
  wav.writeUInt16LE(16, 34); // bits per sample
  wav.write('data', 36);
  wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    wav.writeInt16LE(
      Math.round(Math.sin((2 * Math.PI * 440 * i) / SAMPLE_RATE) * 3000),
      44 + i * 2,
    );
  }
  return wav;
}

export const SENTENCES = [
  'Welcome to the show.',
  'Today we talk about learning English.',
  'Listen to one sentence at a time.',
  'Then repeat it out loud.',
  'Slow it down when it is too fast.',
  'Thanks for listening.',
];

/** Sentence i starts at 1 + 3i seconds and lasts 2.5 seconds. */
export const sentenceStart = (i: number) => 1 + 3 * i;

const ts = (sec: number) =>
  `00:00:${String(Math.floor(sec)).padStart(2, '0')},${sec % 1 ? '500' : '000'}`;

export const SRT = SENTENCES.map(
  (text, i) => `${i + 1}\n${ts(sentenceStart(i))} --> ${ts(sentenceStart(i) + 2.5)}\n${text}\n`,
).join('\n');
