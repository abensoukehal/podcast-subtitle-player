import { create } from 'zustand';
import type { Settings } from '../lib/db/schema';
import { DEFAULT_SETTINGS, getSettings, saveSettings } from '../lib/db/settings';

export const useSettings = create<Settings>(() => DEFAULT_SETTINGS);

/** Resolves once stored settings are loaded (defaults if reading fails). */
export const settingsReady: Promise<void> = getSettings().then(
  (s) => useSettings.setState(s),
  () => undefined,
);

export function updateSettings(patch: Partial<Settings>): void {
  useSettings.setState(patch);
  // ponytail: a failed settings write is ignored; the change still applies for this session
  saveSettings(useSettings.getState()).catch(() => undefined);
}
