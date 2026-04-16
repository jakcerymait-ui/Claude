import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import PlayerSearch from './pages/PlayerSearch';
import PlayerComparison from './pages/PlayerComparison';
import TeamStats from './pages/TeamStats';
import HeadToHead from './pages/HeadToHead';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#0a0a0f]">
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<PlayerSearch />} />
            <Route path="/compare" element={<PlayerComparison />} />
            <Route path="/team" element={<TeamStats />} />
            <Route path="/h2h" element={<HeadToHead />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
