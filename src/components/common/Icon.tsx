const dots = [7, 12, 17]
  .flatMap((y) => [6, 12, 18].map((x) => `M${x} ${y + 1.5}a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z`))
  .join('');
const eye = 'M12 5C6.5 5 2.7 9.2 1.5 12c1.2 2.8 5 7 10.5 7s9.3-4.2 10.5-7C21.3 9.2 17.5 5 12 5z';

// A string is one path; an array draws separate paths, so they do not cut into each other.
const PATHS: Record<string, string | string[]> = {
  play: 'M8 5v14l11-7z',
  pause: 'M6 5h4v14H6zm8 0h4v14h-4z',
  prev: 'M6 6h2v12H6zm2 6 10 6V6z',
  next: 'M16 6h2v12h-2zM6 18l10-6L6 6z',
  rewind: 'M11 6v12l-8-6zm9 0v12l-8-6z',
  forward: 'M4 6v12l8-6zm9 0v12l8-6z',
  back: 'M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z',
  transcript: 'M4 6h16v2H4zm0 5h16v2H4zm0 5h10v2H4z',
  caption: 'M3 5h18v14H3zm2 2v10h14V7zm2 6h10v2H7z',
  more: 'M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  eye: `${eye}m0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z`,
  eyeOff: [`${eye}m0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z`, 'M3.4 2 22 20.6 20.6 22 2 3.4z'],
  blur: dots,
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  search:
    'M10 4a6 6 0 1 0 3.5 10.9l5.3 5.3 1.4-1.4-5.3-5.3A6 6 0 0 0 10 4zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
  library: 'M4 4h4v16H4zm6 0h4v16h-4zm5.6 1.3 3.9-1 4 15.4-3.9 1z',
  words: 'M5 3h14v18H5zm2 2v14h10V5zm2 2h6v2H9zm0 4h6v2H9zm0 4h4v2H9z',
  settings: 'M3 6h10v2H3zm14 0h4v2h-4zm-2-2h2v6h-2zM3 16h4v2H3zm8 0h10v2H11zm-2-2h2v6H9z',
  close:
    'M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z',
};

export type IconName =
  | 'play'
  | 'pause'
  | 'prev'
  | 'next'
  | 'rewind'
  | 'forward'
  | 'back'
  | 'transcript'
  | 'caption'
  | 'more'
  | 'eye'
  | 'eyeOff'
  | 'blur'
  | 'bookmark'
  | 'search'
  | 'library'
  | 'words'
  | 'settings'
  | 'close';

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  const paths = PATHS[name]!;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      {(Array.isArray(paths) ? paths : [paths]).map((d) => (
        <path key={d} d={d} fill="currentColor" fillRule="evenodd" />
      ))}
    </svg>
  );
}
