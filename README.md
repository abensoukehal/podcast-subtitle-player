# Subtitle Player

A podcast player for English learners. Import an audio file (for example a NotebookLM episode) with its subtitles, and read along while the current sentence is highlighted. Replay, loop, slow down and pause after each sentence, hide the subtitles to test your listening, and save words and sentences for review.

Everything runs in the browser. Audio and subtitles never leave the device, there is no account and no backend, and the app works offline once installed.

The full requirements are in [SPEC.md](SPEC.md); choices made where the spec was open are in [DECISIONS.md](DECISIONS.md).

## Setup

You need Node.js 22 or later and pnpm (the version is pinned in `package.json`; `corepack enable` installs it).

```bash
pnpm install
pnpm dev
```

Then open the address Vite prints (http://localhost:5173 by default).

## Scripts

| Script           | What it does                                                     |
| ---------------- | ---------------------------------------------------------------- |
| `pnpm dev`       | Development server with hot reload                               |
| `pnpm build`     | Type-check and build the static app into `dist/`                 |
| `pnpm preview`   | Serve `dist/` locally, with the service worker                   |
| `pnpm lint`      | ESLint and a Prettier check                                      |
| `pnpm format`    | Format all files with Prettier                                   |
| `pnpm typecheck` | TypeScript, strict                                               |
| `pnpm test`      | Unit tests (Vitest)                                              |
| `pnpm e2e`       | Build, then end-to-end tests in Chromium and WebKit (Playwright) |
| `pnpm icons`     | Redraw the app icons in `public/` from `scripts/make-icons.mjs`  |

Before the first `pnpm e2e`, install the test browsers once:

```bash
pnpm exec playwright install chromium webkit
```

## Deployment

`pnpm build` writes a static site to `dist/` with relative paths and a hash router, so it works on any static HTTPS host and under any sub-path, with no rewrite rules. Service workers (offline use and installing the app) need HTTPS, except on localhost.

**GitHub Pages:** the workflow in `.github/workflows/ci.yml` runs lint, type-check, unit and end-to-end tests on every push and pull request, and deploys `dist/` on each push to `main`. Enable it once in the repository under Settings > Pages > Source: GitHub Actions.

**Cloudflare Pages or Netlify:** use `pnpm build` as the build command and `dist` as the output directory.

## Making subtitles for an audio file

The app needs an SRT or VTT file with roughly one cue per sentence. Give it the same base name as the audio (`episode-01.m4a` and `episode-01.srt`, or `episode-01.en.srt`) so the two pair automatically on import.

[Whisper](https://github.com/openai/whisper) makes good English subtitles on your own computer:

```bash
pip install -U openai-whisper
```

```bash
whisper episode-01.m4a --model small --language en --output_format srt
```

This writes `episode-01.srt` next to the audio. Larger models (`medium`, `large`) are more accurate and slower. [whisper.cpp](https://github.com/ggerganov/whisper.cpp) is a faster alternative with the same output format (`-osrt`).

If the subtitles run slightly ahead of or behind the speech, fix it in the player with the sync offset (⋮ menu, or the `,` and `.` keys); it is saved per episode.

## Using the app

- **Import** on the Library screen, or drop the files on it. Files that don't pair by name get a dropdown to pair them by hand.
- **Tap a sentence** to play from it. Its **⋮** button (or a long-press) opens the sentence sheet: replay, replay slowly, loop, bookmark, copy, and tap words to save them or look them up.
- The chips under the player set the **speed**, **sentence loop** and **auto-pause** after each sentence (for shadowing).
- The eye button switches subtitles between **visible, blurred and hidden**.
- **Vocabulary** exports a CSV that opens in Excel and imports into Anki.
- **Settings** has backup export and import, to move your words and bookmarks to another browser or device (audio is not included).
- On a computer, press **?** in the player for the keyboard shortcuts.

## Project layout

```
src/lib/          pure logic: subtitle parsing, cue lookup, pairing, export, IndexedDB access
src/player/       PlayerEngine (the one audio element) and Media Session
src/stores/       Zustand stores
src/components/   screens and UI
tests/unit/       Vitest; tests/fixtures/ holds the subtitle samples
tests/e2e/        Playwright; the audio fixture is generated in memory
```
