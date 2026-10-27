export interface Pairing<T> {
  pairs: { audio: T; subtitle: T }[];
  unpairedAudio: T[];
  unpairedSubtitles: T[];
}

export const isSubtitleFile = (name: string): boolean => /\.(srt|vtt)$/i.test(name);

const stem = (name: string) => name.toLowerCase().replace(/\.[^.]*$/, '');

// .en, .eng, .en-US, .pt_BR
const LANG_SUFFIX = /\.[a-z]{2,3}(?:[-_][a-z0-9]{2,4})?$/;

/**
 * LIB-2: pairs audio and subtitle files by base name, case-insensitive, ignoring the
 * extension and a trailing language code on the subtitle. An exact base name wins.
 * Any file that is not .srt or .vtt counts as audio.
 */
export function pairFiles<T extends { name: string }>(files: readonly T[]): Pairing<T> {
  const subtitles = files.filter((f) => isSubtitleFile(f.name));
  const used = new Set<T>();
  const pairs: Pairing<T>['pairs'] = [];
  const unpairedAudio: T[] = [];

  const take = (match: (subtitleStem: string) => boolean) =>
    subtitles.find((s) => !used.has(s) && match(stem(s.name)));

  for (const audio of files.filter((f) => !isSubtitleFile(f.name))) {
    const key = stem(audio.name);
    const subtitle = take((s) => s === key) ?? take((s) => s.replace(LANG_SUFFIX, '') === key);
    if (subtitle) {
      used.add(subtitle);
      pairs.push({ audio, subtitle });
    } else {
      unpairedAudio.push(audio);
    }
  }

  return { pairs, unpairedAudio, unpairedSubtitles: subtitles.filter((s) => !used.has(s)) };
}
