# Podcast Subtitle Player — Spec for Claude Code

Oct 27, 2026 · Ali BENSOUKEHAL

## Overview

Build a static web app that plays podcast audio (generated with NotebookLM) with synced, clickable subtitles, designed for an English learner. Everything runs in the browser: audio and subtitle files never leave the device, and there is no backend.

The app must let the user:

- Read along with an episode while the current sentence is highlighted.
- Replay, loop, slow down, and pause after individual sentences to practice listening and shadowing.
- Hide or blur subtitles to test listening, then reveal them to check.
- Save words and difficult sentences for later review, and export the words.
- Use it on desktop and phone, offline after the first visit.

## How to use this spec with Claude Code

Export this doc as Markdown and save it as SPEC.md at the root of an empty repository. Then work one milestone at a time (see Milestones) with a prompt like:

> Read SPEC.md. Implement milestone M1 only. Run lint, type-check and tests, then stop and summarize what you did.

Requirement IDs (for example PLY-4) are the checklist. Claude Code should reference them in commit messages and must not implement anything listed under Non-goals.

## Scope and non-goals

Version 1 is a single-user, single-device app: one person imports their own files and practices with them.

### In scope for v1

- Importing local audio files with matching SRT or VTT subtitle files.
- A library of episodes stored in the browser, with saved progress.
- A player with a synced transcript and learning controls (sentence replay, loop, speed, auto-pause, hidden subtitles).
- A vocabulary list and sentence bookmarks, with CSV export.
- Installable PWA that works offline.

### Non-goals for v1 (do not build)

- No backend, accounts, cloud sync, or sync between devices.
- No subtitle generation or speech recognition in the app (subtitles are created beforehand, for example with Whisper).
- No translation and no calls to dictionary APIs. Word lookup only opens an external dictionary page.
- No video playback, no streaming from URLs or RSS feeds, no audio editing.
- No analytics, telemetry, or third-party scripts.

### Assumptions

- Subtitles are in English and roughly sentence-level, one cue per sentence or phrase.
- Audio and subtitle files usually share a base name, for example `episode-01.m4a` and `episode-01.srt`.
- Audio is any format the browser can play: M4A/AAC, MP3 and WAV are required; others are best-effort.
- Episodes are up to about 60 minutes and 100 MB each.

Open question: the main phone platform (iOS or Android). It changes how much PWA testing is needed on Safari.

## Tech stack and architecture

A client-only React app built with Vite, deployed as static files. Use current stable versions and pin exact versions in package.json.

| Area            | Choice                                | Notes                                     |
| --------------- | ------------------------------------- | ----------------------------------------- |
| Build           | Vite                                  | Static output in dist/                    |
| UI              | React + TypeScript                    | strict: true, no any in src/lib           |
| State           | Zustand                               | Small stores, no Redux                    |
| Storage         | IndexedDB via idb                     | Audio stored as Blobs                     |
| Routing         | React Router, hash router             | Works on any static host without rewrites |
| Styling         | CSS Modules + CSS custom properties   | Light and dark themes                     |
| PWA             | vite-plugin-pwa (Workbox)             | Precache the app shell                    |
| Tests           | Vitest + Testing Library, Playwright  | Unit tests for all of src/lib             |
| Quality         | ESLint + Prettier                     | CI-ready scripts                          |
| Package manager | pnpm                                  |                                           |

### Architecture rules

- **One audio element.** A PlayerEngine class owns a single HTMLAudioElement. React never re-renders on every frame.
- **Precise timing.** While playing, PlayerEngine runs a requestAnimationFrame loop that reads currentTime. The timeupdate event fires only about 4 times per second, which is too coarse to stop exactly at the end of a sentence.
- **Cheap updates.** The engine emits cuechange only when the active cue index changes, and a throttled tick (max 10 per second) for the progress bar.
- **Pure logic in src/lib.** Parsing, cue lookup, time formatting and export are pure functions with unit tests. UI code calls them; it does not duplicate them.
- **Storage behind a module.** Components never call IndexedDB directly; they use functions from src/lib/db.

### PlayerEngine interface

```ts
type LoopMode =
  | { kind: 'off' }
  | { kind: 'cue'; index: number; times: number | 'infinite' }
  | { kind: 'range'; startSec: number; endSec: number };
type AutoPauseMode = { kind: 'off' } | { kind: 'manual' } | { kind: 'timed'; factor: number }; // see LRN-3

interface PlayerEngine {
  load(audio: Blob, cues: Cue[], offsetMs: number): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  toggle(): void;
  seek(timeSec: number): void;
  seekToCue(index: number, opts?: { play?: boolean }): void;
  prevCue(): void;
  nextCue(): void;
  replayCue(): void;
  setRate(rate: number): void;
  setOffset(offsetMs: number): void;
  setLoop(mode: LoopMode): void;
  setAutoPause(mode: AutoPauseMode): void;
  on(
    event: 'tick' | 'cuechange' | 'statechange' | 'ended' | 'error',
    cb: (payload: unknown) => void,
  ): () => void;
  destroy(): void;
}
```

### Project structure

```
src/
  main.tsx
  App.tsx                    # routes: /, /episode/:id, /vocabulary, /bookmarks, /settings
  lib/
    subtitles/
      types.ts               # Cue type
      parseSrt.ts
      parseVtt.ts
      parse.ts               # detect format, normalize, validate
    cues.ts                  # findCueIndexAt, currentSentenceIndex, navigation helpers
    time.ts                  # format and parse timestamps
    pairing.ts               # pair audio and subtitle files by base name
    export.ts                # CSV and JSON export
    db/
      schema.ts
      episodes.ts
      vocabulary.ts
      bookmarks.ts
      settings.ts
  player/
    PlayerEngine.ts
    mediaSession.ts
  stores/
    playerStore.ts
    libraryStore.ts
    settingsStore.ts
  components/
    library/                 # LibraryScreen, ImportDialog, EpisodeCard
    player/                  # PlayerScreen, TranscriptView, CaptionView, Controls, SentenceSheet
    review/                  # VocabularyScreen, BookmarksScreen
    settings/                # SettingsScreen
    common/
  styles/
tests/
  fixtures/                  # sample .srt and .vtt files, short sample audio
  e2e/
```

## Data model and storage

All data lives in one IndexedDB database named `subtitle-player` (version 1, migrations in the idb upgrade callback). Audio blobs sit in their own store so the library list never loads them.

### Types

```ts
interface Cue {
  index: number; // 0-based, in time order
  startSec: number;
  endSec: number;
  text: string; // plain text, tags removed, lines joined with a space
  speaker?: string; // from VTT <v Name> tags if present
}

interface Episode {
  id: string; // crypto.randomUUID()
  title: string; // from the audio file name, editable
  audioFileName: string;
  audioMimeType: string;
  subtitleFileName: string;
  durationSec: number;
  cues: Cue[];
  offsetMs: number; // subtitle sync offset, default 0, range -5000..5000
  lastPositionSec: number;
  finished: boolean;
  createdAt: number;
  updatedAt: number;
  lastPlayedAt?: number;
}

interface VocabEntry {
  id: string;
  word: string; // lowercased, trimmed, punctuation stripped
  sentence: string; // the cue text it came from
  episodeId: string;
  episodeTitle: string; // copied, so export still works after the episode is deleted
  cueIndex: number;
  timeSec: number;
  createdAt: number;
}

interface Bookmark {
  id: string;
  episodeId: string;
  cueIndex: number;
  text: string;
  startSec: number;
  note?: string;
  createdAt: number;
}

interface Settings {
  theme: 'system' | 'light' | 'dark';
  fontSize: 'S' | 'M' | 'L' | 'XL';
  defaultRate: number; // 0.5..1.5, default 1.0
  skipSec: 5 | 10 | 15; // default 5
  autoScroll: boolean; // default true
  subtitleVisibility: 'visible' | 'blurred' | 'hidden';
  revealAfterCue: boolean; // blurred mode: unblur when the cue ends
  autoPause: AutoPauseMode; // default { kind: 'off' }
  dictionaryUrlTemplate: string; // default 'https://dictionary.cambridge.org/dictionary/english/{word}'
}
```

### Object stores

| Store      | Key        | Indexes                     | Holds                         |
| ---------- | ---------- | --------------------------- | ----------------------------- |
| episodes   | id         | lastPlayedAt, createdAt     | Episode metadata and cues     |
| audio      | episode id | none                        | The audio Blob                |
| vocabulary | id         | episodeId, createdAt, word  | VocabEntry                    |
| bookmarks  | id         | episodeId, createdAt        | Bookmark                      |
| settings   | 'app'      | none                        | One Settings record           |

### Storage rules

- **STO-1** On the first successful import, call `navigator.storage.persist()`. Show the result and `navigator.storage.estimate()` usage in Settings.
- **STO-2** Save lastPositionSec every 5 seconds while playing, on pause, on visibilitychange to hidden, and on pagehide.
- **STO-3** Deleting an episode removes its metadata, audio blob and bookmarks in one transaction. Vocabulary entries are kept.
- **STO-4** Duplicate words are not added twice: if the same word and sentence exist, show "Already saved".
- **STO-5** If a write fails with a quota error, show a clear message with the storage used and suggest deleting episodes.
- **STO-6** Backup: export a JSON file with episode metadata (no audio), vocabulary, bookmarks and settings. Import merges by id, newer updatedAt or createdAt wins.

Note: Safari can clear website data for sites that have not been used for a while. Adding the app to the home screen reduces this risk, which is one more reason to ship it as a PWA.

## Subtitle parsing and cue logic

The parser turns an SRT or VTT file into a clean, sorted `Cue[]` and never throws on bad input: it skips broken blocks and reports warnings.

```ts
interface ParseResult {
  format: 'srt' | 'vtt';
  cues: Cue[];
  warnings: string[]; // e.g. "Skipped 2 malformed blocks"
}
function parseSubtitles(text: string, fileName: string): ParseResult;
```

### Common rules

- **PAR-1** Strip a UTF-8 BOM. Normalize CRLF and CR to LF.
- **PAR-2** Detect VTT by a first line starting with WEBVTT; otherwise parse as SRT. The file extension is only a hint.
- **PAR-3** Blocks are separated by one or more blank lines (whitespace-only lines count as blank).
- **PAR-4** Join multi-line cue text with a single space. Remove tags (`<i>`, `<b>`, `<u>`, `<font …>`, `<c…>`, `<lang …>`, inline timestamps like `<00:00:01.000>`) and ASS overrides like `{\an8}`. Decode `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`, `&nbsp;`.
- **PAR-5** Drop cues whose text is empty after cleaning.

### SRT

- **PAR-6** Optional numeric index line, then a timing line `HH:MM:SS,mmm --> HH:MM:SS,mmm`.
- **PAR-7** Accept `.` instead of `,`, 1 or 2 digit hours, and 1 to 3 digit fractions (read as a decimal fraction: `,5` = 500 ms). Ignore anything after the end time.

### VTT

- **PAR-8** Skip NOTE, STYLE and REGION blocks. Allow an optional cue identifier line before the timing line.
- **PAR-9** Accept `MM:SS.mmm` and `HH:MM:SS.mmm`. Ignore cue settings after the end time (`align:start` and so on).
- **PAR-10** If the text starts with `<v Name>`, store Name as speaker and remove the tag.

### Normalization

- **PAR-11** Sort by startSec, then re-index from 0.
- **PAR-12** If endSec <= startSec, set endSec to the next cue's start, or startSec + 2 for the last cue.
- **PAR-13** If a cue overlaps the next one, clamp its endSec to the next startSec. At most one cue is active at any time.
- **PAR-14** Zero cues after parsing is an error: "No subtitles found in this file."
- **PAR-15** After the audio loads, if the last cue ends more than 5 seconds after the audio duration, warn: "These subtitles may not match this audio."

### Active cue and navigation

The sync offset shifts subtitles in time: a positive offsetMs makes them appear later. All cue math uses `t = audio.currentTime - offsetMs / 1000`.

- **CUE-1** `findCueIndexAt(cues, t)` uses binary search and returns the index where start <= t < end, or -1 in a gap.
- **CUE-2** `currentSentenceIndex(cues, t)` returns the last cue with start <= t, or 0 before the first cue. The transcript highlights this index, so the highlight does not flicker in gaps between cues.
- **CUE-3** Seeking to a cue goes to start - 0.15 s (pre-roll, clamped at 0) so the first syllable is not cut.
- **CUE-4** Previous sentence: if more than 1 second has played in the current cue, go back to its start; otherwise go to the previous cue. Same behavior as the back button in music players.
- **CUE-5** Next sentence: go to the next cue's start. On the last cue, do nothing.
- **CUE-6** End-of-cue detection (for loop and auto-pause) runs in the animation-frame loop and fires when t >= cue.endSec - 0.03. It fires once per cue per pass and is reset by any seek. After `seekToCue(i)`, only cue i and later cues are armed, so the pre-roll never triggers the end of cue i - 1.

## Functional requirements

Requirements are grouped by area. Items marked (nice-to-have) belong to milestone M6 and can be skipped if time is short.

### Import and library (LIB)

- **LIB-1** Import with a button (file picker, multiple, accepts `audio/*,.srt,.vtt`) or by dragging files onto the library screen.
- **LIB-2** Pair audio and subtitle files automatically by base name, case-insensitive, ignoring the extension and a trailing language code: `episode-01.en.srt` pairs with `episode-01.m4a`.
- **LIB-3** Files that cannot be paired go to a pairing step: each unpaired audio file gets a dropdown of unpaired subtitle files. The user confirms or removes each pair.
- **LIB-4** For each pair: parse the subtitles, read the duration with a temporary audio element (loadedmetadata), then save. Show progress per file and any parser warnings. If the browser cannot play the audio, show "This audio format is not supported by your browser" and skip it.
- **LIB-5** The library lists episodes sorted by last played, then by date added. Each card shows title, duration, a progress bar, a "Finished" badge and the number of sentences.
- **LIB-6** Episode actions: rename, replace subtitles (keeps position and bookmarks only if the cue count is unchanged; otherwise warn that bookmarks will be removed), mark as finished or unfinished, delete with confirmation.
- **LIB-7** Empty state: one short paragraph explaining that the user should add an audio file and its SRT or VTT subtitle file with the same name.

### Player (PLY)

- **PLY-1** Opening an episode restores lastPositionSec (or 0 if finished) and the default speed. It never autoplays.
- **PLY-2** Controls: play/pause, back and forward by skipSec, previous sentence, next sentence, replay sentence, a seek bar with drag support and a time tooltip, elapsed and remaining time.
- **PLY-3** Speed from 0.5x to 1.5x in 0.05 steps, with presets 0.75, 0.9, 1.0 and 1.25. Keep preservesPitch = true. A change applies at once and becomes the new default.
- **PLY-4** Subtitle sync: buttons for -100 ms and +100 ms, the current offset value, and a reset. Saved per episode.
- **PLY-5** When the episode ends: mark it finished and show "Episode finished" with Replay and Back to library.
- **PLY-6** If the audio blob is missing or cannot be decoded, show an error with a "Re-import audio" action that keeps the subtitles, progress and bookmarks.

### Transcript and captions (TRN)

- **TRN-1** Two views, toggled in the header and remembered: Transcript (all sentences in a scrolling list) and Caption (the current sentence large in the center, with the previous and next sentences smaller and dimmed).
- **TRN-2** The current sentence is highlighted (background and stronger weight) and has `aria-current="true"`. Highlighting is per sentence, not per word, because the subtitles have no word timings.
- **TRN-3** Tapping a sentence seeks to it (CUE-3) and plays.
- **TRN-4** Auto-scroll keeps the current sentence about 35% from the top, with smooth scrolling. When the user scrolls by hand, auto-scroll pauses and a "Back to current" button appears. Tapping it, or tapping a sentence, turns auto-scroll back on.
- **TRN-5** Each row shows the start time (m:ss), the speaker if known, a bookmark marker if bookmarked, and an actions button that opens the Sentence sheet.
- **TRN-6** A sentence change re-renders only the two rows that changed (memoized rows). A transcript of 1,000 sentences must scroll smoothly on a mid-range phone; use `content-visibility: auto` on rows.
- **TRN-7** (nice-to-have) Search in the transcript: matches are highlighted, Enter jumps to the next match.

### Learning tools (LRN)

- **LRN-1** Subtitle visibility with one button that cycles Visible, Blurred, Hidden. In Blurred mode, the first tap on a sentence reveals it; the second tap seeks. A revealed sentence stays revealed until the episode is closed.
- **LRN-2** Reveal after listening: in Blurred mode with revealAfterCue on, each sentence unblurs automatically when it ends. The user listens first, then checks.
- **LRN-3** Auto-pause after each sentence, for shadowing practice:
  - Off.
  - Manual: pause at the end of each sentence and wait for Play or Space.
  - Timed: pause for the sentence duration multiplied by a factor (1.0 to 2.0, default 1.5), then continue. Show a small countdown ring on the play button.
- **LRN-4** Loop sentence: repeat the current sentence 2, 3 or 5 times, or until stopped, with a 0.5 second gap between repeats. After the last repeat, playback continues normally, and auto-pause (if on) applies once.
- **LRN-5** A-B loop: set start and end from the Sentence sheet ("Loop from here", "Loop to here"). Loops from the start of the first sentence to the end of the last one until cleared. Shown as a chip with a clear button.
- **LRN-6** "Replay slowly" plays the current sentence once at 0.75x, then restores the previous speed.

### Sentence sheet (SEN)

A bottom sheet on mobile and a popover on desktop. It opens from the row's actions button or a long-press (500 ms) on a sentence, and it pauses playback.

- **SEN-1** Shows the sentence, its start time and speaker. Each word is a tappable chip.
- **SEN-2** Actions: Replay, Replay slowly, Loop x3, Bookmark or Remove bookmark, Copy sentence, Loop from here, Loop to here.
- **SEN-3** Tapping one word chip shows: Save to vocabulary, Look up. Tapping several adjacent chips selects a phrase (for phrasal verbs and expressions) with a "Save phrase" action.
- **SEN-4** Look up opens dictionaryUrlTemplate with `{word}` replaced by the URL-encoded word, in a new tab.

### Vocabulary and bookmarks (REV)

- **REV-1** Vocabulary screen: newest first, each entry shows the word, the sentence with the word highlighted, the episode title and the date. Includes a search box and delete. Tapping an entry opens its episode at that sentence, if the episode still exists.
- **REV-2** Export vocabulary as CSV with columns word, sentence, episode, time, date (UTF-8 with BOM, RFC 4180 quoting) so it opens in Excel and imports into Anki.
- **REV-3** Bookmarks screen: grouped by episode, each with text, time and an editable note. Tapping a bookmark opens the episode and plays that sentence.

### Settings (SET)

- **SET-1** All Settings fields from the data model, with the dictionary template validated to contain `{word}`.
- **SET-2** Storage usage and persistence status (STO-1), backup export and import (STO-6), and "Delete all data" behind a typed confirmation.
- **SET-3** A keyboard shortcuts reference.

## UI layout and keyboard shortcuts

Mobile-first and calm: the transcript is the main content, controls stay at the bottom within thumb reach.

### Screens

- **UI-1** Navigation. On mobile, a bottom tab bar with Library, Vocabulary, Bookmarks and Settings. It is hidden on the player screen, which has a back button instead. On desktop, the same items sit in a top bar.
- **UI-2** Player screen, mobile (under 768 px). Top bar: back, episode title (one line, ellipsis), view toggle (TRN-1), visibility toggle (LRN-1), overflow menu (sync offset, replace subtitles). Middle: transcript or caption view. Bottom, fixed: a seek bar row, then a main row (previous sentence, back, play/pause, forward, next sentence), then a chip row (speed, loop, auto-pause, replay sentence).
- **UI-3** Player screen, desktop (1024 px and up). Same structure with the transcript centered at a max width of 760 px.
- **UI-4** Touch. Every control has a target of at least 44 x 44 px. Respect safe-area insets on phones with notches.

### Visual style

- **UI-5** System font stack. Transcript font sizes S, M, L, XL map to 16, 18, 21 and 24 px with line height 1.6. Caption view uses 1.5 times the transcript size.
- **UI-6** Light and dark themes through CSS custom properties, following the system by default. Text and the highlight color must reach a contrast ratio of at least 4.5:1 in both themes.
- **UI-7** prefers-reduced-motion turns off smooth scrolling and animations.

### Accessibility

- **UI-8** Every icon button has an aria-label. Focus is always visible. All features work with the keyboard alone.
- **UI-9** Do not put the transcript in an aria-live region: changing sentences would interrupt screen readers constantly.

### Keyboard shortcuts

Shortcuts are ignored while focus is in a text field.

| Key                | Action                                                    |
| ------------------ | --------------------------------------------------------- |
| Space              | Play or pause (also continues after a manual auto-pause)  |
| Left / Right arrow | Back / forward by skipSec                                 |
| Up / Down arrow    | Previous / next sentence                                  |
| R                  | Replay sentence                                           |
| S                  | Replay slowly                                             |
| L                  | Loop sentence: off, x3, until stopped, off                |
| P                  | Auto-pause: off, manual, timed, off                       |
| H                  | Subtitles: visible, blurred, hidden                       |
| [ / ]              | Speed down / up by 0.05                                   |
| B                  | Bookmark the current sentence                             |
| V                  | Switch Transcript and Caption view                        |
| , / .              | Sync offset -100 ms / +100 ms                             |
| Esc                | Close the sheet or dialog                                 |
| ?                  | Show the shortcuts list                                   |

## PWA, mobile and deployment

The app is installable, works fully offline after the first visit, and makes no network requests other than loading itself.

### PWA

- **PWA-1** Web app manifest: name "Subtitle Player", `display: standalone`, `start_url: ./`, theme and background colors for both themes, icons at 192 and 512 px plus a maskable icon. Create a simple original icon (for example, a speech bubble with a sound wave).
- **PWA-2** The service worker precaches the app shell only (HTML, JS, CSS, icons). Audio is never cached by the service worker; it lives in IndexedDB.
- **PWA-3** When a new version is available, show "New version available" with a Reload button. Never reload on its own during playback.
- **PWA-4** Everything, including import, works offline, because files are read locally.

### Mobile behavior

- **MOB-1** Media Session. Set the episode title as metadata. Handle play, pause, seekbackward, seekforward (by skipSec), seekto, and map previoustrack / nexttrack to previous / next sentence. Update setPositionState at most once per second. Headphone buttons and the lock screen then control the player.
- **MOB-2** Autoplay rules. Only call play() from a user action or a Media Session handler, and handle a rejected play() promise by showing the paused state.
- **MOB-3** Background playback. Browsers pause requestAnimationFrame when the page is hidden. When document.visibilityState is hidden, PlayerEngine switches to timeupdate-based checks for loop and auto-pause, and switches back to the frame loop when visible.
- **MOB-4** (nice-to-have) Keep the screen on with the Screen Wake Lock API while playing in Caption view, with a toggle in Settings.

### Deployment

- **DEP-1** `pnpm build` outputs static files to dist/ with `base: './'`, so the app works under a sub-path. The hash router avoids server rewrite rules.
- **DEP-2** Deploy to any static HTTPS host (GitHub Pages, Cloudflare Pages or Netlify). Service workers need HTTPS, except on localhost. Include a GitHub Actions workflow that builds and deploys to GitHub Pages on push to main.
- **DEP-3** Add a Content-Security-Policy meta tag starting from `default-src 'self'; media-src 'self' blob:; img-src 'self' data: blob:`, and adjust only if the build needs it.

Each browser on each device has its own library. To move vocabulary and bookmarks between devices, use backup export and import (STO-6).

## Testing and acceptance

Every milestone must pass `pnpm lint`, `pnpm typecheck` and `pnpm test` with no console errors before it is considered done.

### Unit tests (Vitest)

- **TST-1** Parser fixtures in tests/fixtures/, one test each:
  - SRT: basic; CRLF with BOM; `.` decimal separator, 1-digit hours and 1-digit fraction; multi-line text with `<i>`, `<font>`, `{\an8}` and HTML entities; malformed blocks (warnings, no crash); unsorted and overlapping cues; zero-length cues.
  - VTT: basic; NOTE, STYLE and REGION blocks; MM:SS.mmm timestamps; cue settings; `<v Speaker>` tags; inline timestamps and `<c>` tags.
  - An empty file and a random text file return the "No subtitles found" error.
- **TST-2** Cue logic: findCueIndexAt at exactly start, exactly end, in a gap, before the first cue, after the last cue, with one cue and with none. currentSentenceIndex, the 1-second rule of CUE-4, and the sync offset.
- **TST-3** Pairing: same base name, language code suffix, different letter case, unmatched files.
- **TST-4** CSV export: fields with commas, quotes and line breaks; BOM present.
- **TST-5** PlayerEngine with a fake audio element and fake timers: loop x3 plays exactly three times; manual auto-pause stops at every sentence end; timed auto-pause resumes after duration x factor; the pre-roll never triggers the previous sentence's end; a seek resets the armed cue; background mode uses timeupdate.
- **TST-6** Storage with fake-indexeddb: create, read, delete episode (audio and bookmarks removed, vocabulary kept), backup round trip.

### End-to-end tests (Playwright, Chromium and WebKit)

Generate a 20-second WAV fixture with a small Node script, so no binary tools are needed, plus a matching SRT with 6 sentences.

- **E2E-1** Import the fixture pair; it appears in the library with the right duration and sentence count.
- **E2E-2** Play; the highlighted sentence changes over time. Click sentence 4; the current time jumps to its start.
- **E2E-3** Reload the page; the position is restored.
- **E2E-4** Save a word from the Sentence sheet; it appears in Vocabulary; CSV export downloads a file.
- **E2E-5** After the first load, go offline and reload; the app opens and the episode plays.

### Acceptance criteria (manual, with a real NotebookLM episode on a real phone)

- **AC-1** Importing a 30-minute episode with its SRT takes under 5 seconds on a laptop.
- **AC-2** The highlight changes with the speech, with no visible delay.
- **AC-3** Loop and auto-pause stop before the first syllable of the next sentence is heard.
- **AC-4** A 1,000-sentence transcript scrolls smoothly on a mid-range phone.
- **AC-5** After adding the app to the home screen, it works in airplane mode, and headphone buttons control playback.
- **AC-6** Chrome offers to install the app, and the Lighthouse Accessibility score is 95 or higher.

## Milestones and definition of done

Build in six milestones, in order. Stop after each one for review, and commit with the requirement IDs in the message.

1. **M1 Foundation.** Scaffold the project (stack table, scripts dev, build, lint, typecheck, test, e2e). Implement the subtitle parser, cue logic and pairing with full unit tests. Covers PAR-1 to PAR-15, CUE-1 to CUE-5, TST-1 to TST-3. No real UI yet.
2. **M2 Player core.** PlayerEngine with the frame loop and events, the player screen with transcript and caption views, highlighting, tap to seek, auto-scroll, basic controls, speed and sync offset. Files are loaded directly with a file picker, without storage. Covers CUE-6, PLY-1 to PLY-4, TRN-1 to TRN-6.
3. **M3 Library and storage.** IndexedDB layer, import with pairing, library screen, progress saving, episode actions and errors. Covers LIB-1 to LIB-7, STO-1 to STO-5, PLY-5, PLY-6, TST-6, E2E-1 to E2E-3.
4. **M4 Learning tools.** Visibility modes, reveal after listening, auto-pause, sentence loop, A-B loop, replay slowly, and the Sentence sheet. Covers LRN-1 to LRN-6, SEN-1 to SEN-4, TST-5.
5. **M5 Review and settings.** Vocabulary, bookmarks, CSV export, settings screen and backup. Covers REV-1 to REV-3, SET-1 to SET-3, STO-6, TST-4, E2E-4.
6. **M6 PWA and polish.** Manifest, service worker, update prompt, Media Session, background mode, keyboard shortcuts, accessibility pass, deployment workflow and CSP, then the nice-to-haves. Covers PWA-1 to PWA-4, MOB-1 to MOB-4, DEP-1 to DEP-3, UI-1 to UI-9, TRN-7, E2E-5.

### Rules for Claude Code

- Do not add dependencies outside the stack table without asking first.
- If a requirement is unclear or conflicts with another, choose the simplest reasonable behavior, record it in DECISIONS.md with the requirement ID, and mention it in the milestone summary.
- Keep src/lib free of React and browser globals so it stays easy to test.

### Definition of done

- All requirements are implemented except unchecked nice-to-haves.
- Lint, type-check, unit and end-to-end tests pass in CI.
- README.md explains setup, scripts, deployment, and how to create SRT subtitles for an audio file.
- AC-1 to AC-6 are checked by hand on a real phone.
