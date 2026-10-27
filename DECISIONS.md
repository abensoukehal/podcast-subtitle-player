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
