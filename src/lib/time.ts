// [H:]MM:SS[,.]fff — hours optional, 1-3 digit fraction read as a decimal (PAR-7, PAR-9)
const TIMESTAMP = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[,.](\d{1,3}))?$/;

/** Parses an SRT or VTT timestamp to seconds, or null if invalid. */
export function parseTimestamp(s: string): number | null {
  const m = TIMESTAMP.exec(s.trim());
  if (!m) return null;
  const [, h = '0', mm = '0', ss = '0', frac = ''] = m;
  return Number(h) * 3600 + Number(mm) * 60 + Number(ss) + (frac ? Number(`0.${frac}`) : 0);
}

/** Formats seconds as m:ss, or h:mm:ss from one hour. */
export function formatTime(sec: number): string {
  const s = Number.isFinite(sec) ? Math.max(0, Math.floor(sec)) : 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
