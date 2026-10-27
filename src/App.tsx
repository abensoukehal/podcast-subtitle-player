import { HashRouter, Route, Routes } from 'react-router';
import { LibraryScreen } from './components/library/LibraryScreen';
import { PlayerScreen } from './components/player/PlayerScreen';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LibraryScreen />} />
        <Route path="/episode/:id" element={<PlayerScreen />} />
      </Routes>
    </HashRouter>
  );
}
