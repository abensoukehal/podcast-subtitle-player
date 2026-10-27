import { getDb, type Settings } from './schema';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  fontSize: 'M',
  defaultRate: 1,
  skipSec: 5,
  autoScroll: true,
  subtitleVisibility: 'visible',
  revealAfterCue: false,
  autoPause: { kind: 'off' },
  dictionaryUrlTemplate: 'https://dictionary.cambridge.org/dictionary/english/{word}',
  keepScreenOn: true,
};

/** Stored settings over the defaults, so fields added later get their default. */
export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await (await getDb()).get('settings', 'app')) };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await (await getDb()).put('settings', settings, 'app');
}
