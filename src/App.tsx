import { HashRouter, Route, Routes } from 'react-router';
import { WithNavBar } from './components/common/NavBar';
import { UpdatePrompt } from './components/common/UpdatePrompt';
import { LibraryScreen } from './components/library/LibraryScreen';
import { PlayerScreen } from './components/player/PlayerScreen';
import { BookmarksScreen } from './components/review/BookmarksScreen';
import { VocabularyScreen } from './components/review/VocabularyScreen';
import { SettingsScreen } from './components/settings/SettingsScreen';

export default function App() {
  return (
    <HashRouter>
      <UpdatePrompt />
      <Routes>
        <Route element={<WithNavBar />}>
          <Route path="/" element={<LibraryScreen />} />
          <Route path="/vocabulary" element={<VocabularyScreen />} />
          <Route path="/bookmarks" element={<BookmarksScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Route>
        <Route path="/episode/:id" element={<PlayerScreen />} />
      </Routes>
    </HashRouter>
  );
}
