import { create } from 'zustand';
import type { Settings } from '../lib/db/schema';
import { DEFAULT_SETTINGS, getSettings, saveSettings } from '../lib/db/settings';

export const useSettings = create<Settings>(() => DEFAULT_SETTINGS);

const FONT_PX: Record<Settings['fontSize'], number> = { S: 16, M: 18, L: 21, XL: 24 }; // UI-5

/** Theme and transcript size live on <html>, so all CSS can use them. */
function applyToDocument({ theme, fontSize }: Settings): void {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  root.style.setProperty('--font-size', `${FONT_PX[fontSize]}px`);
}

useSettings.subscribe(applyToDocument);

/** Loads stored settings (defaults if there are none or reading fails). */
export async function reloadSettings(): Promise<void> {
  try {
    useSettings.setState(await getSettings(), true);
  } catch {
    // Keep the defaults.
  }
}

export const settingsReady: Promise<void> = reloadSettings();

export function updateSettings(patch: Partial<Settings>): void {
  useSettings.setState(patch);
  // ponytail: a failed settings write is ignored; the change still applies for this session
  saveSettings(useSettings.getState()).catch(() => undefined);
}
