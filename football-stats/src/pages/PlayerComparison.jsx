import { useState } from 'react';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import SearchInput from '../components/SearchInput';
import ErrorMessage from '../components/ErrorMessage';
import { SkeletonCard } from '../components/SkeletonCard';
import { searchPlayers, getPlayerTrophies, getPlayerSeasons, getPlayerStatsBySeason } from '../services/api';

const COLORS = ['#e94560', '#3b82f6'];

function PlayerSelector({ label, onSelect, loading, error }) {
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState(null);

  const handleSearch = async (query) => {
    setSearching(true);
    setSearchErr(null);
    try {
      const data = await searchPlayers(query);
      setResults(data);
    } catch (e) {
      setSearchErr(e.message);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="card space-y-3">
      <p className="font-semibold text-gray-300 text-sm uppercase tracking-wide">{label}</p>
      <SearchInput placeholder="Search player…" onSearch={handleSearch} loading={searching || loading} />
      {searchErr && <ErrorMessage message={searchErr} />}
      {results.length > 0 && (
        <div className="space-y-1 max-h-52 overflow-y-auto">
          {results.slice(0, 8).map((item) => (
            <button
              key={item.player.id}
              onClick={() => { onSelect(item); setResults([]); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#2a2a3e] text-left"
            >
              {item.player.photo && (
                <img src={item.player.photo} alt="" className="w-8 h-8 rounded-full object-cover" />
              )}
              <div>
                <p className="text-white text-sm">{item.player.name}</p>
                <p className="text-gray-500 text-xs">{item.statistics?.[0]?.team?.name} · {item.player.nationality}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {error && <ErrorMessage message={error} />}
    </div>
  );
}

function PlayerHeader({ item, color }) {
  const stat = item.statistics?.[0];
  return (
    <div className="flex items-center gap-3">
      {item.player.photo && (
        <img src={item.player.photo} alt="" className="w-16 h-16 rounded-full object-cover ring-2" style={{ ringColor: color }} />
      )}
      <div>
        <p className="font-bold text-white text-lg">{item.player.name}</p>
        <p className="text-sm text-gray-400">{stat?.team?.name} · {item.player.nationality}</p>
        <p className="text-xs text-gray-500">{stat?.games?.position}</p>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-[#1e1e2e] border border-[#2e2e45] rounded-lg p-3 text-sm">
        <p className="text-gray-300 mb-1 font-medium">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: <span className="font-bold">{p.value}</span></p>
        ))}
      </div>
    );
  }
  return null;
};

export default function PlayerComparison() {
  const [players, setPlayers] = useState([null, null]);
  const [stats, setStats] = useState([null, null]);
  const [loading, setLoading] = useState([false, false]);
  const [errors, setErrors] = useState([null, null]);
  const [chartType, setChartType] = useState('radar');

  const setAt = (arr, idx, val) => arr.map((v, i) => (i === idx ? val : v));

  const loadPlayerData = async (item, idx) => {
    setLoading((l) => setAt(l, idx, true));
    setErrors((e) => setAt(e, idx, null));
    setPlayers((p) => setAt(p, idx, item));
    try {
      const seasons = await getPlayerSeasons(item.player.id);
      const sorted = seasons.sort((a, b) => b - a);
      const [trophies, seasonData] = await Promise.all([
        getPlayerTrophies(item.player.id),
        Promise.all(sorted.slice(0, 5).map((s) => getPlayerStatsBySeason(item.player.id, s))),
      ]);
      const agg = { appearances: 0, goals: 0, assists: 0, yellow: 0, red: 0 };
      let passAccuracy = [];
      for (const entry of seasonData.filter(Boolean)) {
        for (const s of entry.statistics || []) {
          agg.appearances += s.games?.appearences || 0;
          agg.goals += s.goals?.total || 0;
          agg.assists += s.goals?.assists || 0;
          agg.yellow += s.cards?.yellow || 0;
          agg.red += s.cards?.red || 0;
          if (s.passes?.accuracy) passAccuracy.push(s.passes.accuracy);
        }
      }
      agg.passAccuracy = passAccuracy.length
        ? Math.round(passAccuracy.reduce((a, b) => a + b, 0) / passAccuracy.length)
        : 0;
      agg.trophies = trophies.length;
      agg.gpg = agg.appearances > 0 ? parseFloat((agg.goals / agg.appearances * 100).toFixed(1)) : 0;
      setStats((s) => setAt(s, idx, agg));
    } catch (e) {
      setErrors((err) => setAt(err, idx, e.message || 'Failed to load'));
    } finally {
      setLoading((l) => setAt(l, idx, false));
    }
  };

  const ready = players[0] && players[1] && stats[0] && stats[1];

  const buildBarData = () => {
    const keys = [
      { key: 'goals', label: 'Goals' },
      { key: 'assists', label: 'Assists' },
      { key: 'appearances', label: 'Appearances' },
      { key: 'yellow', label: 'Yellow Cards' },
      { key: 'trophies', label: 'Trophies' },
    ];
    return keys.map(({ key, label }) => ({
      name: label,
      [players[0].player.name]: stats[0][key],
      [players[1].player.name]: stats[1][key],
    }));
  };

  const buildRadarData = () => {
    const maxG = Math.max(stats[0].goals, stats[1].goals, 1);
    const maxA = Math.max(stats[0].assists, stats[1].assists, 1);
    const maxApp = Math.max(stats[0].appearances, stats[1].appearances, 1);
    const maxT = Math.max(stats[0].trophies, stats[1].trophies, 1);

    const normalize = (v, max) => Math.round((v / max) * 100);

    const subjects = [
      { subject: 'Goals', A: normalize(stats[0].goals, maxG), B: normalize(stats[1].goals, maxG) },
      { subject: 'Assists', A: normalize(stats[0].assists, maxA), B: normalize(stats[1].assists, maxA) },
      { subject: 'Appearances', A: normalize(stats[0].appearances, maxApp), B: normalize(stats[1].appearances, maxApp) },
      { subject: 'Pass Acc.', A: stats[0].passAccuracy, B: stats[1].passAccuracy },
      { subject: 'Trophies', A: normalize(stats[0].trophies, maxT), B: normalize(stats[1].trophies, maxT) },
      { subject: 'Goals/App%', A: Math.min(stats[0].gpg, 100), B: Math.min(stats[1].gpg, 100) },
    ];
    return subjects;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-1">Player Comparison</h1>
        <p className="text-gray-400 text-sm">Compare two players side by side across key stats</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PlayerSelector
          label="Player 1"
          onSelect={(item) => loadPlayerData(item, 0)}
          loading={loading[0]}
          error={errors[0]}
        />
        <PlayerSelector
          label="Player 2"
          onSelect={(item) => loadPlayerData(item, 1)}
          loading={loading[1]}
          error={errors[1]}
        />
      </div>

      {(loading[0] || loading[1]) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {ready && (
        <>
          {/* Player headers */}
          <div className="grid grid-cols-2 gap-4">
            {players.map((p, i) => (
              <div key={i} className="card">
                <PlayerHeader item={p} color={COLORS[i]} />
              </div>
            ))}
          </div>

          {/* Chart toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setChartType('radar')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${chartType === 'radar' ? 'bg-[#e94560] text-white' : 'btn-secondary'}`}
            >
              Radar Chart
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${chartType === 'bar' ? 'bg-[#e94560] text-white' : 'btn-secondary'}`}
            >
              Bar Chart
            </button>
          </div>

          {/* Chart */}
          <div className="card">
            <h3 className="section-title">Visual Comparison</h3>
            <ResponsiveContainer width="100%" height={360}>
              {chartType === 'radar' ? (
                <RadarChart data={buildRadarData()}>
                  <PolarGrid stroke="#2e2e45" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <Radar name={players[0].player.name} dataKey="A" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.25} />
                  <Radar name={players[1].player.name} dataKey="B" stroke={COLORS[1]} fill={COLORS[1]} fillOpacity={0.25} />
                  <Legend wrapperStyle={{ color: '#d1d5db', fontSize: '13px' }} />
                </RadarChart>
              ) : (
                <BarChart data={buildBarData()} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ color: '#d1d5db', fontSize: '13px' }} />
                  <Bar dataKey={players[0].player.name} fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey={players[1].player.name} fill={COLORS[1]} radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Stat rows */}
          <div className="card overflow-x-auto">
            <h3 className="section-title">Stats Breakdown</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-[#2e2e45]">
                  <th className="pb-3 text-center" style={{ color: COLORS[0] }}>
                    {players[0].player.name.split(' ').pop()}
                  </th>
                  <th className="pb-3 text-center text-gray-500">Stat</th>
                  <th className="pb-3 text-center" style={{ color: COLORS[1] }}>
                    {players[1].player.name.split(' ').pop()}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2e2e45]">
                {[
                  ['Appearances', 'appearances'],
                  ['Goals', 'goals'],
                  ['Assists', 'assists'],
                  ['Goals/App %', 'gpg'],
                  ['Pass Accuracy %', 'passAccuracy'],
                  ['Yellow Cards', 'yellow'],
                  ['Red Cards', 'red'],
                  ['Trophies', 'trophies'],
                ].map(([label, key]) => {
                  const v0 = stats[0][key];
                  const v1 = stats[1][key];
                  const isBetter0 = v0 > v1;
                  const isBetter1 = v1 > v0;
                  return (
                    <tr key={key} className="hover:bg-[#2a2a3e]/40">
                      <td className={`py-3 text-center font-semibold text-lg ${isBetter0 ? 'text-[#e94560]' : 'text-gray-300'}`}>{v0}</td>
                      <td className="py-3 text-center text-gray-400 text-xs">{label}</td>
                      <td className={`py-3 text-center font-semibold text-lg ${isBetter1 ? 'text-blue-400' : 'text-gray-300'}`}>{v1}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!ready && !loading[0] && !loading[1] && (
        <div className="card text-center py-16 text-gray-500">
          Search and select two players above to compare their stats
        </div>
      )}
    </div>
  );
}
