# Decisions

Choices made where the spec was unclear or in conflict. Newest last.

## M1

- **Stack versions.** TypeScript is pinned to 6.0.3, not 7.x: typescript-eslint 8.72 supports TypeScript `<6.1`.
- **Dependencies per milestone.** Only what M1 uses is installed. Zustand, idb, React Router, vite-plugin-pwa and Testing Library are added in the milestone that first needs them.
- **PAR-14 vs "never throws".** `parseSubtitles` never throws on malformed blocks; it throws `SubtitleParseError("No subtitles found in this file.")` only when no cue is left, so callers can't miss the error.
- **PAR-2 file name hint.** The extension never changes the format. A `.vtt` file without a `WEBVTT` header is parsed as SRT and gets a warning.
- **PAR-6 / PAR-8 identifier line.** Both formats accept any single line (numeric or not) before the timing line.
- **PAR-7 / PAR-9 timestamps.** One parser for both formats: hours optional, `,` or `.` separator, 0 to 3 digit fraction.
- **PAR-10 speaker.** `<v Name>` is read in SRT files too; it is harmless there.
- **PAR-12 / PAR-13 equal starts.** Two cues with the same start: the first becomes zero-length and is never active (at most one active cue).
- **CUE-4 / CUE-5 with pre-roll.** Seeking lands 0.15 s before a cue (CUE-3), which is inside the previous cue. Previous/next navigation treats a position up to 0.2 s before a cue start as inside that cue, so pressing Next right after a seek moves on instead of re-targeting the same cue. The highlight (CUE-2) does not use this lead; the engine in M2 must hold the target index during pre-roll to avoid a 150 ms flash of the previous sentence.
- **LIB-2 language code.** The trailing code is stripped from subtitle names only (`.en`, `.eng`, `.en-US`, `.pt_BR`), and an exact base name match is tried first, so `news.bbc.mp3` pairs with `news.bbc.srt`, not `news.srt`.
- **LIB-2 file kinds.** Any file that is not `.srt` or `.vtt` counts as audio; LIB-4 rejects files the browser cannot play.
- **Unit test location.** Unit tests live in `tests/unit/` so `src/` holds no Node-only code.

## M2

- **Dependencies.** Added Zustand only. React Router waits for M3, when there is more than one screen.
- **CUE-6 event.** The engine emits a `cueend` event (not in the spec's event list) when a cue ends. M4 builds loop, auto-pause and reveal-after-listening (LRN-2) on it. `setLoop` and `setAutoPause` are left for M4.
- **CUE-6 arming after a plain seek.** `seek(t)` arms only cues that have not ended at `t`, so seeking into a gap never fires the cue just before it.
- **CUE-2 during pre-roll.** After `seekToCue(i)`, cue `i` stays current until playback reaches its start, so the previous sentence does not flash for 150 ms.
- **PLY-1 / PLY-4 without storage.** M2 has no storage: an episode opens at 0 and the sync offset lives in memory. Both are saved per episode in M3.
- **PLY-3 default speed.** The last chosen speed is kept in memory for the next file. It becomes `Settings.defaultRate` in M5.
- **PLY-2 skip amount.** Fixed at 5 s until `Settings.skipSec` exists (M5).
- **TRN-1 remembered view.** Stored in `localStorage`; the Settings record has no field for it.
- **TRN-4 long jumps.** Auto-scroll is smooth for nearby sentences but instant when the target is more than two screens away (seek bar jumps), because smooth-scrolling hundreds of rows takes seconds. Manual scroll is detected from wheel, touch and scroll keys.
- **TRN-5 partial.** Rows show time and speaker. The bookmark marker (M5) and the actions button for the Sentence sheet (M4) come with those features.
- **Menus.** Speed and sync menus use the native `popover` attribute, no library.
- **File picker.** M2 opens one audio and one subtitle file picked together, paired by name (or the only two files). The library replaces it in M3.

## M3

- **Dependencies.** Added idb, React Router (hash router) and fake-indexeddb (dev, named in TST-6).
- **Schema.** All five object stores are created in version 1 now, so M5 needs no migration. `AutoPauseMode` lives in `src/lib/db/schema.ts` with the other data types.
- **Audio as Blobs, with a fallback.** WebKit refuses to store Blobs in IndexedDB in some sessions (private browsing, Playwright's WebKit), and a refused write stalls later transactions on the same stores. Support is probed once in a throwaway database; where Blobs are refused, the audio is stored as `{ data: ArrayBuffer, type }`. `getAudio` always returns a Blob.
- **STO-1 display.** `navigator.storage.persist()` is called after each successful import (it is a no-op once granted). Showing the result and usage is part of the Settings screen (M5).
- **STO-2 and unload.** The position is saved every 5 s while playing, on pause, on hidden and on pagehide. A write started during unload may not finish, so the worst case after closing a playing tab is the last 5-second save.
- **LIB-3 pairing step.** The dialog lists every audio file: auto-paired ones show their subtitle file, unpaired ones get a dropdown of the unused subtitle files. Any item can be removed. If nothing needs pairing, import starts at once.
- **LIB-1 dropped files.** Files that are neither subtitles nor audio/video by MIME type are skipped with a note.
- **LIB-4 duration.** If the browser reports an infinite duration (some streams), 0 is stored rather than rejecting the file.
- **LIB-6 rename and delete.** Use the native `prompt()` and `confirm()` dialogs.
- **LIB-6 replace subtitles.** When the sentence count changes, both the position and the bookmarks are reset, after a confirmation.
- **PLY-6 location.** "Re-import audio" is on the player screen, where the error shows.
- **E2E-3.** The test waits for the pause-save to reach IndexedDB before reloading (see STO-2 and unload).
- **E2E fixtures.** The 20-second WAV and its SRT are generated in memory in `tests/e2e/fixtures.ts` and passed to the file input as buffers; no file is written.
- **TST-6 backup round trip.** Backup (STO-6) is in M5, so its round-trip test comes with it.
- **Navigation bar.** UI-1 (tab bar / top bar) is in M6; M3 has only the library and player routes.

## M4

- **Settings storage now.** Visibility, reveal-after-listening, auto-pause, default speed and skip seconds are `Settings` fields, so `src/lib/db/settings.ts` and a settings store were added now; M5 adds the Settings screen. PLY-3's "new default" is now saved, and skipSec is read from settings.
- **Engine events.** Besides `cueend` (M2), the engine emits `loopchange` and `wait` (why it paused: manual, timed with its length, or the loop gap) so the UI can show the loop chip, the "Continue" label and the countdown ring.
- **Play during a wait.** Play during a timed auto-pause or a loop gap continues at once; Pause, seek or picking a sentence cancels the wait.
- **LRN-3 timed length.** The pause is the sentence's length in the audio times the factor, regardless of playback speed.
- **LRN-4 loop follows the user.** With a sentence loop on, choosing another sentence (tap, previous, next, Replay) moves the loop there and restarts its count. The loop chip offers Off, 2, 3, 5 times and Until stopped.
- **LRN-5 A-B loop.** Jumps back with no gap and no auto-pause at the end of the range. "Loop to here" with no start set loops that one sentence; the two ends may be set in any order. Choosing a sentence loop clears the A-B loop.
- **LRN-6 after a slow replay.** The previous speed is restored at the end of the sentence and playback continues (auto-pause applies), the same as Replay.
- **MOB-3 early.** The engine also checks cue ends on every `timeupdate`, which is what keeps loop and auto-pause working when animation frames stop in the background. There is no explicit visibility switch: both run, and a cue end still fires once. TST-5 covers it.
- **LRN-1 Hidden mode.** Rows show "Hidden sentence" in place of the text; tapping seeks. Revealing only applies in Blurred mode.
- **LRN-2 toggle location.** "Reveal blurred sentences after listening" is in the player's overflow menu until the Settings screen exists.
- **SEN sheet.** A native modal `<dialog>`: a bottom sheet under 768 px, a centered dialog above. Right-click also opens it on desktop. Replay, Replay slowly, Loop ×3 and the loop ends close the sheet; Bookmark, Copy and word actions keep it open.
- **SEN-3 phrases.** Tapping a neighbour of the selection extends it; tapping elsewhere starts a new selection; tapping the only selected word clears it. Look up is offered for single words only, as the spec lists. Punctuation-only tokens are not tappable.
- **SEN-4 link.** Look up is a real link (`target="_blank" rel="noopener noreferrer"`), not `window.open`.
- **TRN-5 completed.** Rows now have the bookmark marker and the actions button.
- **TRN-4 setting.** `Settings.autoScroll` off disables auto-scroll and the "Back to current" button.

## M5

- **Navigation.** The library header has plain links to Vocabulary, Bookmarks and Settings; each of those screens has a back button. The real navigation bar (UI-1) is M6.
- **Opening at a sentence.** `#/episode/:id?cue=N` opens the episode at sentence N (REV-1), and `&play=1` also plays it (REV-3). The parameters are read once and removed from the address, so a reload resumes from the saved position instead.
- **REV-1.** The search matches the word, the sentence and the episode title. Deleting an entry asks no confirmation. Entries whose episode was deleted stay, marked "(deleted)", and do not open anything.
- **REV-2 dates.** The `date` column is the UTC date (YYYY-MM-DD); `time` is the sentence start (m:ss). Rows end with CRLF.
- **REV-3.** Bookmarks are grouped in library order, then sentence order. A note is saved when the field loses focus; an empty note removes it. Bookmarks can also be removed here.
- **STO-6 merge.** Episodes compare `updatedAt`, vocabulary and bookmarks compare `createdAt`; a tie keeps the local record. So an edited bookmark note does not travel through a backup if the bookmark already exists on the other device. Settings in a backup replace the current settings. Restored episodes have no audio and show the PLY-6 "Re-import audio" screen.
- **STO-6 validation.** A backup is checked at import (app name, version, and the fields the app relies on in every record); anything else is rejected as a whole with "This is not a valid backup file."
- **SET-1 dictionary.** The template must start with http(s):// and contain `{word}`; an invalid value is shown with an error and not saved.
- **SET-2 delete all.** Typing DELETE enables the button; it empties every store, including settings.
- **SET-3.** The shortcut list is shown now and lives in `src/components/common/shortcuts.ts`; the keys themselves work from M6.
- **UI-6 theme early.** The theme setting needs a light/dark override, so the dark colors now apply under `prefers-color-scheme` unless `data-theme` on `<html>` says otherwise. Two module-level dark rules became a `--danger` token.

## M6

- **Dependencies.** Added vite-plugin-pwa and its peer workbox-window (stack table).
- **PWA-1 colors.** A manifest has one `theme_color`, so it is the light top-bar color; `<meta name="theme-color">` tags cover light and dark. The icon (speech bubble with a sound wave) is drawn in `scripts/make-icons.mjs` and rendered to PNG with Playwright's Chromium, so no image tool or new dependency is needed.
- **PWA-2.** Workbox precaches HTML, JS, CSS, icons and the manifest only. Audio is played from blob URLs out of IndexedDB and never goes through the service worker.
- **PWA-3.** `registerType: 'prompt'`: a waiting service worker activates only when the user taps Reload in the "New version available" message.
- **DEP-3.** The CSP meta tag is added at build time only; the dev server needs inline scripts for hot reload. The build needed no change to the spec's policy, and no violations were seen.
- **E2E on the build.** `pnpm e2e` builds and runs Playwright against `vite preview`, so the service worker and the CSP are exercised in every end-to-end test. E2E-5 passes in Chromium and WebKit.
- **MOB-1.** Seek back/forward use the offset the OS asks for, or skipSec. `setPositionState` is updated on state changes and at most once per second while playing.
- **MOB-3.** Covered since M4 by checking cue ends on `timeupdate` as well as in the frame loop, without an explicit switch on visibility.
- **MOB-4.** Added `Settings.keepScreenOn`, default on: the wake lock is held only while playing in Caption view with the page visible.
- **UI-1.** Vocabulary, Bookmarks and Settings lost their back button; the tab bar (top bar on desktop) replaces it. The player keeps its back button and has no tab bar.
- **UI-2.** "Replace subtitles" is also in the player's ⋮ menu; it shares the library's code and reloads the episode afterwards.
- **UI-4.** File pickers inside chip labels are now visually hidden but focusable (they were `hidden`, which kept keyboard users out), and the A-B loop clear button is 44 px.
- **UI-6.** All text and highlight color pairs were measured: the lowest is 4.80:1 (muted text on the dark notice background).
- **Shortcuts.** Ignored with Ctrl/Cmd/Alt, in any input, select or text area (so the seek bar keeps its arrow keys), and while a dialog is open. Space is prevented by default so it never also presses a focused button. "?" opens a dialog with the same table as Settings.
- **TRN-7.** The search button is in the player header in Transcript view. Enter jumps to the next match and Shift+Enter to the previous one; jumping pauses auto-scroll, and "Back to current" returns. Esc closes the search.
- **Not checked here.** AC-1 to AC-6 need a real phone and a real NotebookLM episode, and the Lighthouse score was not measured. The built-in browser pane of the development app refuses service workers, so offline use was verified with Playwright only.

## Design updates

- **TRN-1 caption view fade** (from the Screens canvas, 2026-10-28). Caption view shows two sentences before and two after the current one instead of one each, and the column fades out toward its top and bottom edges (a CSS mask, transparent at the edges, opaque from 30% to 70%). The design system's CaptionView matches.
