/** SET-3: the keyboard shortcuts, as keys and what they do. */
export const SHORTCUTS: [keys: string[], action: string][] = [
  [['Space'], 'Play or pause (also continues after an auto-pause)'],
  [['←', '→'], 'Back / forward by the skip time'],
  [['↑', '↓'], 'Previous / next sentence'],
  [['R'], 'Replay sentence'],
  [['S'], 'Replay slowly'],
  [['L'], 'Loop sentence: off, ×3, until stopped, off'],
  [['P'], 'Auto-pause: off, until Play, timed, off'],
  [['H'], 'Subtitles: visible, blurred, hidden'],
  [['[', ']'], 'Speed down / up by 0.05'],
  [['B'], 'Bookmark the current sentence'],
  [['V'], 'Switch Transcript and Caption view'],
  [[',', '.'], 'Subtitle sync −100 ms / +100 ms'],
  [['Esc'], 'Close the sheet or dialog'],
  [['?'], 'Show the shortcuts list'],
];
