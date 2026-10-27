import { registerSW } from 'virtual:pwa-register';
import { create } from 'zustand';
import ui from './ui.module.css';

const useUpdate = create<{ reload: (() => void) | null }>(() => ({ reload: null }));

// PWA-3: a new service worker waits until the user chooses to reload.
const updateSW = registerSW({
  onNeedRefresh: () => useUpdate.setState({ reload: () => void updateSW(true) }),
});

export function UpdatePrompt() {
  const reload = useUpdate((s) => s.reload);
  if (!reload) return null;
  return (
    <div className={`${ui.notice} ${ui.toast}`} role="status">
      <span>New version available</span>
      <button className={ui.chip} onClick={reload}>
        Reload
      </button>
    </div>
  );
}
