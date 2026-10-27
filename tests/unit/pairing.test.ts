import { describe, expect, it } from 'vitest';
import { pairFiles } from '../../src/lib/pairing';

const files = (...names: string[]) => names.map((name) => ({ name }));
const pairNames = (r: ReturnType<typeof pairFiles<{ name: string }>>) =>
  r.pairs.map((p) => [p.audio.name, p.subtitle.name]);

describe('pairFiles', () => {
  it('pairs by base name', () => {
    const r = pairFiles(
      files('episode-01.m4a', 'episode-02.mp3', 'episode-02.vtt', 'episode-01.srt'),
    );
    expect(pairNames(r)).toEqual([
      ['episode-01.m4a', 'episode-01.srt'],
      ['episode-02.mp3', 'episode-02.vtt'],
    ]);
    expect(r.unpairedAudio).toEqual([]);
    expect(r.unpairedSubtitles).toEqual([]);
  });

  it('ignores a trailing language code on the subtitle', () => {
    const r = pairFiles(files('episode-01.en.srt', 'episode-01.m4a', 'talk.en-US.vtt', 'talk.wav'));
    expect(pairNames(r)).toEqual([
      ['episode-01.m4a', 'episode-01.en.srt'],
      ['talk.wav', 'talk.en-US.vtt'],
    ]);
  });

  it('prefers an exact base name over a language-code match', () => {
    const r = pairFiles(files('news.bbc.mp3', 'news.srt', 'news.bbc.srt'));
    expect(pairNames(r)).toEqual([['news.bbc.mp3', 'news.bbc.srt']]);
    expect(r.unpairedSubtitles.map((f) => f.name)).toEqual(['news.srt']);
  });

  it('ignores letter case', () => {
    expect(pairNames(pairFiles(files('Episode-01.M4A', 'EPISODE-01.SRT')))).toEqual([
      ['Episode-01.M4A', 'EPISODE-01.SRT'],
    ]);
  });

  it('returns unmatched files', () => {
    const r = pairFiles(files('a.mp3', 'b.srt', 'c.wav', 'a.srt'));
    expect(pairNames(r)).toEqual([['a.mp3', 'a.srt']]);
    expect(r.unpairedAudio.map((f) => f.name)).toEqual(['c.wav']);
    expect(r.unpairedSubtitles.map((f) => f.name)).toEqual(['b.srt']);
  });
});
