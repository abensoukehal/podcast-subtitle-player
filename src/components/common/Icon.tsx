const PATHS = {
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
};

export function Icon({ name }: { name: keyof typeof PATHS }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
