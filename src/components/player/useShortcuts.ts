import { useEffect } from 'react';
import {
  engine,
  cycleVisibility,
  setAutoPause,
  setOffset,
  setRate,
  setSentenceLoop,
  toggleBookmark,
  toggleView,
  usePlayer,
} from '../../stores/playerStore';
import { useSettings } from '../../stores/settingsStore';

const skip = (direction: 1 | -1) =>
  engine.seek(engine.getState().currentTime + direction * useSettings.getState().skipSec);

/** L: off, ×3, until stopped, off. */
function cycleLoop() {
  const { loop } = usePlayer.getState();
  if (loop.kind !== 'cue') setSentenceLoop(3);
  else setSentenceLoop(loop.times === 'infinite' ? null : 'infinite');
}

/** P: off, until Play, timed, off. */
function cycleAutoPause() {
  const mode = useSettings.getState().autoPause;
  if (mode.kind === 'off') setAutoPause({ kind: 'manual' });
  else if (mode.kind === 'manual') setAutoPause({ kind: 'timed', factor: 1.5 });
  else setAutoPause({ kind: 'off' });
}

/** Single letters are matched case-insensitively. */
const KEYS: Record<string, () => void> = {
  ' ': () => engine.toggle(),
  ArrowLeft: () => skip(-1),
  ArrowRight: () => skip(1),
  ArrowUp: () => engine.prevCue(),
  ArrowDown: () => engine.nextCue(),
  r: () => engine.replayCue(),
  s: () => engine.replayCueSlowly(),
  l: cycleLoop,
  p: cycleAutoPause,
  h: cycleVisibility,
  '[': () => setRate(engine.getState().rate - 0.05),
  ']': () => setRate(engine.getState().rate + 0.05),
  b: () => void toggleBookmark(usePlayer.getState().index),
  v: toggleView,
  ',': () => setOffset(engine.getState().offsetMs - 100),
  '.': () => setOffset(engine.getState().offsetMs + 100),
};

/**
 * Player keyboard shortcuts (SET-3 lists them). Ignored while typing in a field, with
 * Ctrl/Cmd/Alt, and while a dialog is open; Esc is left to dialogs and menus.
 */
export function useShortcuts(showHelp: () => void): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.repeat && e.key === ' ')) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (document.querySelector('dialog[open]')) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const action = key === '?' ? showHelp : KEYS[key];
      if (!action) return;
      e.preventDefault(); // also stops Space from pressing a focused button
      action();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showHelp]);
}
