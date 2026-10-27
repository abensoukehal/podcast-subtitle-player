import { useEffect, useState } from 'react';
import { deleteAllData, exportBackup, importBackup } from '../../lib/db/backup';
import type { Settings } from '../../lib/db/schema';
import { describeWriteError, formatBytes, persistStorage, storageInfo } from '../../lib/db/storage';
import { parseBackup } from '../../lib/export';
import { MAX_RATE, MIN_RATE } from '../../player/PlayerEngine';
import { refreshLibrary } from '../../stores/libraryStore';
import { reloadSettings, updateSettings, useSettings } from '../../stores/settingsStore';
import { downloadFile, today } from '../common/download';
import { Screen } from '../common/Screen';
import { ShortcutsTable } from '../common/ShortcutsTable';
import ui from '../common/ui.module.css';
import styles from '../common/screen.module.css';

const FONT_SIZES: Settings['fontSize'][] = ['S', 'M', 'L', 'XL'];

/** SET-1 to SET-3 */
export function SettingsScreen() {
  return (
    <Screen title="Settings">
      <Appearance />
      <Playback />
      <Learning />
      <Dictionary />
      <Storage />
      <Shortcuts />
    </Screen>
  );
}

function Appearance() {
  const theme = useSettings((s) => s.theme);
  const fontSize = useSettings((s) => s.fontSize);
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Appearance</h2>
      <label className={styles.field}>
        Theme
        <select
          className={styles.select}
          value={theme}
          onChange={(e) => updateSettings({ theme: e.target.value as Settings['theme'] })}
        >
          <option value="system">Same as the device</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      <div className={styles.field} role="group" aria-labelledby="font-size-label">
        <span id="font-size-label">Transcript text size</span>
        <div className={styles.row}>
          {FONT_SIZES.map((size) => (
            <button
              key={size}
              className={ui.chip}
              aria-pressed={fontSize === size}
              onClick={() => updateSettings({ fontSize: size })}
            >
              {size}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function Playback() {
  const defaultRate = useSettings((s) => s.defaultRate);
  const skipSec = useSettings((s) => s.skipSec);
  const autoScroll = useSettings((s) => s.autoScroll);
  const keepScreenOn = useSettings((s) => s.keepScreenOn);
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Playback</h2>
      <label className={styles.field}>
        Default speed: {defaultRate.toFixed(2)}×
        <input
          type="range"
          className={styles.range}
          min={MIN_RATE}
          max={MAX_RATE}
          step={0.05}
          value={defaultRate}
          onChange={(e) => updateSettings({ defaultRate: Number(e.target.value) })}
        />
      </label>
      <label className={styles.field}>
        Back and forward buttons skip
        <select
          className={styles.select}
          value={skipSec}
          onChange={(e) =>
            updateSettings({ skipSec: Number(e.target.value) as Settings['skipSec'] })
          }
        >
          <option value={5}>5 seconds</option>
          <option value={10}>10 seconds</option>
          <option value={15}>15 seconds</option>
        </select>
      </label>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={autoScroll}
          onChange={(e) => updateSettings({ autoScroll: e.target.checked })}
        />
        Keep the current sentence in view
      </label>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={keepScreenOn}
          onChange={(e) => updateSettings({ keepScreenOn: e.target.checked })}
        />
        Keep the screen on while playing in Caption view
      </label>
    </section>
  );
}

function Learning() {
  const visibility = useSettings((s) => s.subtitleVisibility);
  const revealAfterCue = useSettings((s) => s.revealAfterCue);
  const autoPause = useSettings((s) => s.autoPause);
  const factor = autoPause.kind === 'timed' ? autoPause.factor : 1.5;
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Learning</h2>
      <label className={styles.field}>
        Subtitles
        <select
          className={styles.select}
          value={visibility}
          onChange={(e) =>
            updateSettings({
              subtitleVisibility: e.target.value as Settings['subtitleVisibility'],
            })
          }
        >
          <option value="visible">Visible</option>
          <option value="blurred">Blurred (tap to reveal)</option>
          <option value="hidden">Hidden</option>
        </select>
      </label>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={revealAfterCue}
          onChange={(e) => updateSettings({ revealAfterCue: e.target.checked })}
        />
        Reveal blurred sentences after listening
      </label>
      <label className={styles.field}>
        Pause after each sentence
        <select
          className={styles.select}
          value={autoPause.kind}
          onChange={(e) => {
            const kind = e.target.value as Settings['autoPause']['kind'];
            updateSettings({ autoPause: kind === 'timed' ? { kind, factor } : { kind } });
          }}
        >
          <option value="off">Off</option>
          <option value="manual">Until I press Play</option>
          <option value="timed">For a time, then continue</option>
        </select>
      </label>
      {autoPause.kind === 'timed' && (
        <label className={styles.field}>
          Pause for {factor}× the sentence length
          <input
            type="range"
            className={styles.range}
            min={1}
            max={2}
            step={0.1}
            value={factor}
            onChange={(e) =>
              updateSettings({ autoPause: { kind: 'timed', factor: Number(e.target.value) } })
            }
          />
        </label>
      )}
    </section>
  );
}

/** SET-1: the template must contain {word}; an invalid value is shown but not saved. */
function Dictionary() {
  const saved = useSettings((s) => s.dictionaryUrlTemplate);
  const [value, setValue] = useState(saved);
  const valid = value.includes('{word}') && /^https?:\/\//.test(value);
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Dictionary</h2>
      <label className={styles.field}>
        Look-up address ({'{word}'} is replaced by the word)
        <input
          className={styles.input}
          type="url"
          value={value}
          aria-invalid={!valid}
          aria-describedby="dictionary-error"
          onChange={(e) => {
            setValue(e.target.value);
            if (e.target.value.includes('{word}') && /^https?:\/\//.test(e.target.value)) {
              updateSettings({ dictionaryUrlTemplate: e.target.value });
            }
          }}
        />
      </label>
      {!valid && (
        <p id="dictionary-error" className={styles.error}>
          Enter a web address that starts with https:// and contains {'{word}'}.
        </p>
      )}
    </section>
  );
}

/** SET-2, STO-1, STO-6 */
function Storage() {
  const [info, setInfo] = useState<Awaited<ReturnType<typeof storageInfo>> | null>(null);
  const [message, setMessage] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const refresh = () => void storageInfo().then(setInfo);

  useEffect(refresh, []);

  const run = async (action: () => Promise<string>) => {
    try {
      setMessage(await action());
    } catch (e) {
      setMessage(e instanceof Error && e.message ? e.message : await describeWriteError(e));
    }
    refresh();
  };

  const importFile = (file: File) =>
    run(async () => {
      const counts = await importBackup(parseBackup(await file.text()));
      await Promise.all([reloadSettings(), refreshLibrary()]);
      return `Imported ${counts.episodes} episodes, ${counts.vocabulary} words and ${counts.bookmarks} bookmarks. Restored episodes have no audio: open one to re-import its audio file.`;
    });

  const deleteAll = () =>
    run(async () => {
      await deleteAllData();
      await Promise.all([reloadSettings(), refreshLibrary()]);
      setConfirmText('');
      return 'All data was deleted.';
    });

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Storage</h2>
      {info && (
        <p>
          {info.usage === undefined
            ? 'Storage use is not available in this browser.'
            : `${formatBytes(info.usage)} used${info.quota ? ` of ${formatBytes(info.quota)}` : ''}.`}{' '}
          {info.persisted
            ? 'Your data is protected from automatic clearing.'
            : 'The browser may clear this data when space is low or the app is not used for a while.'}
        </p>
      )}
      {info && !info.persisted && (
        <button
          className={ui.chip}
          onClick={() =>
            run(async () =>
              (await persistStorage())
                ? 'Your data is now protected.'
                : 'The browser did not allow it. Adding the app to your home screen helps.',
            )
          }
        >
          Ask to protect my data
        </button>
      )}

      <h3>Backup</h3>
      <p className={styles.meta}>
        A backup holds episode details and progress, vocabulary, bookmarks and settings, but not
        audio. Use it to move to another device.
      </p>
      <div className={styles.row}>
        <button
          className={ui.button}
          onClick={() =>
            run(async () => {
              const backup = await exportBackup();
              downloadFile(
                `subtitle-player-backup-${today()}.json`,
                JSON.stringify(backup),
                'application/json',
              );
              return 'Backup downloaded.';
            })
          }
        >
          Export backup
        </button>
        <label className={ui.chip}>
          Import backup
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void importFile(file);
            }}
          />
        </label>
      </div>

      <h3>Delete all data</h3>
      <label className={styles.field}>
        Type DELETE to remove every episode, word, bookmark and setting from this browser.
        <input
          className={styles.input}
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          autoComplete="off"
        />
      </label>
      <button
        className={`${ui.chip} ${ui.danger}`}
        disabled={confirmText !== 'DELETE'}
        onClick={() => void deleteAll()}
      >
        Delete all data
      </button>
      <p className={styles.status} role="status">
        {message}
      </p>
    </section>
  );
}

function Shortcuts() {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Keyboard shortcuts</h2>
      <ShortcutsTable />
      <p className={styles.meta}>Shortcuts are ignored while you type in a text field.</p>
    </section>
  );
}
