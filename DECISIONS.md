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
