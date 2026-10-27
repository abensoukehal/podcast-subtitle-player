import { HashRouter, Route, Routes } from 'react-router';
import { LibraryScreen } from './components/library/LibraryScreen';
import { PlayerScreen } from './components/player/PlayerScreen';
import { BookmarksScreen } from './components/review/BookmarksScreen';
import { VocabularyScreen } from './components/review/VocabularyScreen';
import { SettingsScreen } from './components/settings/SettingsScreen';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LibraryScreen />} />
        <Route path="/episode/:id" element={<PlayerScreen />} />
        <Route path="/vocabulary" element={<VocabularyScreen />} />
        <Route path="/bookmarks" element={<BookmarksScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
      </Routes>
    </HashRouter>
  );
}
