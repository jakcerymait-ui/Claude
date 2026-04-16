import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import SearchInput from '../components/SearchInput';
import ErrorMessage from '../components/ErrorMessage';
import StatBox from '../components/StatBox';
import { SkeletonCard, SkeletonTable } from '../components/SkeletonCard';
import { searchTeams, getH2H } from '../services/api';

const COLORS = ['#e94560', '#3b82f6'];

function TeamSelector({ label, onSelect, selected, color }) {
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState(null);

  const handleSearch = async (query) => {
    setSearching(true);
    setErr(null);
    try {
      const found = await searchTeams(query);
      setResults(found);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="card space-y-3">
      <p className="font-semibold text-gray-300 text-sm uppercase tracking-wide">{label}</p>
      {selected ? (
        <div className="flex items-center gap-3">
          {selected.team.logo && (
            <img src={selected.team.logo} alt="" className="w-12 h-12 object-contain" />
          )}
          <div className="flex-1">
            <p className="text-white font-semibold">{selected.team.name}</p>
            <p className="text-gray-400 text-xs">{selected.team.country}</p>
          </div>
          <button
            onClick={() => { onSelect(null); setResults([]); }}
            className="text-gray-500 hover:text-red-400 text-xs px-2 py-1 rounded"
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <SearchInput placeholder="Search team…" onSearch={handleSearch} loading={searching} />
          {err && <ErrorMessage message={err} />}
          {results.length > 0 && (
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {results.slice(0, 8).map((item) => (
                <button
                  key={item.team.id}
                  onClick={() => { onSelect(item); setResults([]); }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#2a2a3e] text-left"
                >
                  {item.team.logo && <img src={item.team.logo} alt="" className="w-7 h-7 object-contain" />}
                  <div>
                    <p className="text-white text-sm">{item.team.name}</p>
                    <p className="text-gray-500 text-xs">{item.team.country}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-[#1e1e2e] border border-[#2e2e45] rounded-lg p-3 text-sm">
        <p className="text-gray-300 mb-1 font-medium">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: <b>{p.value}</b></p>
        ))}
      </div>
    );
  }
  return null;
};

export default function HeadToHead() {
  const [teams, setTeams] = useState([null, null]);
  const [fixtures, setFixtures] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const setAt = (arr, idx, val) => arr.map((v, i) => (i === idx ? val : v));

  const handleLoad = async () => {
    if (!teams[0] || !teams[1]) return;
    setLoading(true);
    setError(null);
    setFixtures(null);
    try {
      const data = await getH2H(teams[0].team.id, teams[1].team.id);
      setFixtures(data);
    } catch (e) {
      setError(e.message || 'Failed to load H2H data');
    } finally {
      setLoading(false);
    }
  };

  const computeH2H = () => {
    if (!fixtures || !teams[0] || !teams[1]) return null;
    const t0id = teams[0].team.id;
    let t0Wins = 0, t1Wins = 0, draws = 0, t0Goals = 0, t1Goals = 0;
    let biggestT0 = null, biggestT1 = null;

    for (const f of fixtures) {
      if (f.goals.home === null) continue;
      const isT0Home = f.teams.home.id === t0id; // t1id not stored since we derive t1 as the other side
      const t0G = isT0Home ? f.goals.home : f.goals.away;
      const t1G = isT0Home ? f.goals.away : f.goals.home;
      t0Goals += t0G;
      t1Goals += t1G;
      if (t0G > t1G) {
        t0Wins++;
        const diff = t0G - t1G;
        if (!biggestT0 || diff > biggestT0.diff) biggestT0 = { f, diff, t0G, t1G };
      } else if (t1G > t0G) {
        t1Wins++;
        const diff = t1G - t0G;
        if (!biggestT1 || diff > biggestT1.diff) biggestT1 = { f, diff, t0G, t1G };
      } else {
        draws++;
      }
    }

    return { t0Wins, t1Wins, draws, t0Goals, t1Goals, biggestT0, biggestT1 };
  };

  const h2h = computeH2H();

  const barData = h2h
    ? [
        { name: 'Wins', [teams[0].team.name]: h2h.t0Wins, [teams[1].team.name]: h2h.t1Wins },
        { name: 'Goals', [teams[0].team.name]: h2h.t0Goals, [teams[1].team.name]: h2h.t1Goals },
        { name: 'Draws', Draws: h2h.draws },
      ]
    : [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-1">Head-to-Head</h1>
        <p className="text-gray-400 text-sm">Compare two teams' full H2H record across all competitions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TeamSelector
          label="Team 1"
          selected={teams[0]}
          onSelect={(t) => setTeams((prev) => setAt(prev, 0, t))}
          color={COLORS[0]}
        />
        <TeamSelector
          label="Team 2"
          selected={teams[1]}
          onSelect={(t) => setTeams((prev) => setAt(prev, 1, t))}
          color={COLORS[1]}
        />
      </div>

      {teams[0] && teams[1] && (
        <button onClick={handleLoad} className="btn-primary w-full sm:w-auto" disabled={loading}>
          {loading ? (
            <span className="flex items-center gap-2 justify-center">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Loading H2H…
            </span>
          ) : (
            'Load Head-to-Head Record'
          )}
        </button>
      )}

      {error && <ErrorMessage message={error} onRetry={handleLoad} />}

      {loading && (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonTable rows={8} />
        </div>
      )}

      {h2h && fixtures && !loading && (
        <div className="space-y-6">
          {/* VS Header */}
          <div className="card">
            <div className="flex items-center justify-around py-4">
              <div className="flex flex-col items-center gap-2">
                {teams[0].team.logo && <img src={teams[0].team.logo} alt="" className="w-16 h-16 object-contain" />}
                <p className="text-white font-bold text-center">{teams[0].team.name}</p>
                <span className="text-3xl font-black text-[#e94560]">{h2h.t0Wins}</span>
                <span className="text-xs text-gray-400">WINS</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-4xl font-black text-gray-500">VS</span>
                <span className="text-sm text-gray-400">{fixtures.length} matches</span>
                <div className="mt-2 text-center">
                  <span className="text-xl font-bold text-yellow-400">{h2h.draws}</span>
                  <p className="text-xs text-gray-400">DRAWS</p>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                {teams[1].team.logo && <img src={teams[1].team.logo} alt="" className="w-16 h-16 object-contain" />}
                <p className="text-white font-bold text-center">{teams[1].team.name}</p>
                <span className="text-3xl font-black text-blue-400">{h2h.t1Wins}</span>
                <span className="text-xs text-gray-400">WINS</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox label="Total Matches" value={fixtures.length} />
            <StatBox label={`${teams[0].team.name} Wins`} value={h2h.t0Wins} accent />
            <StatBox label={`${teams[1].team.name} Wins`} value={h2h.t1Wins} />
            <StatBox label="Draws" value={h2h.draws} />
            <StatBox label={`${teams[0].team.name} Goals`} value={h2h.t0Goals} accent />
            <StatBox label={`${teams[1].team.name} Goals`} value={h2h.t1Goals} />
            <StatBox label="Avg Goals/Game" value={fixtures.length > 0 ? ((h2h.t0Goals + h2h.t1Goals) / fixtures.length).toFixed(1) : '0'} />
            <StatBox label="Total Goals" value={h2h.t0Goals + h2h.t1Goals} />
          </div>

          {/* Chart */}
          <div className="card">
            <h3 className="section-title">Visual Summary</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ top: 5, right: 20, bottom: 5, left: -10 }}>
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 13 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: '#d1d5db', fontSize: '13px' }} />
                <Bar dataKey={teams[0].team.name} fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                <Bar dataKey={teams[1].team.name} fill={COLORS[1]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Draws" fill="#eab308" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Biggest Wins */}
          {(h2h.biggestT0 || h2h.biggestT1) && (
            <div>
              <h3 className="section-title">Biggest Wins</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {h2h.biggestT0 && (
                  <div className="card border-[#e94560]/30">
                    <p className="text-xs text-gray-400 mb-2">🏆 {teams[0].team.name}'s biggest win</p>
                    <p className="text-white font-semibold">
                      {h2h.biggestT0.f.teams.home.name} <span className="text-[#e94560] font-black">{h2h.biggestT0.f.goals.home}–{h2h.biggestT0.f.goals.away}</span> {h2h.biggestT0.f.teams.away.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(h2h.biggestT0.f.fixture.date).toLocaleDateString()} · {h2h.biggestT0.f.league?.name}</p>
                  </div>
                )}
                {h2h.biggestT1 && (
                  <div className="card border-blue-500/30">
                    <p className="text-xs text-gray-400 mb-2">🏆 {teams[1].team.name}'s biggest win</p>
                    <p className="text-white font-semibold">
                      {h2h.biggestT1.f.teams.home.name} <span className="text-blue-400 font-black">{h2h.biggestT1.f.goals.home}–{h2h.biggestT1.f.goals.away}</span> {h2h.biggestT1.f.teams.away.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(h2h.biggestT1.f.fixture.date).toLocaleDateString()} · {h2h.biggestT1.f.league?.name}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Match List */}
          <div>
            <h3 className="section-title">All H2H Matches</h3>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm min-w-[450px]">
                <thead>
                  <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-[#2e2e45]">
                    <th className="text-left pb-3 pr-3">Date</th>
                    <th className="text-left pb-3 pr-3">Competition</th>
                    <th className="text-left pb-3 pr-3">Home</th>
                    <th className="text-center pb-3 pr-3">Score</th>
                    <th className="text-left pb-3">Away</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2e2e45]">
                  {fixtures.map((f) => {
                    if (f.goals.home === null) return null;
                    const isT0Win = (f.teams.home.id === teams[0].team.id && f.goals.home > f.goals.away) ||
                      (f.teams.away.id === teams[0].team.id && f.goals.away > f.goals.home);
                    const isDraw = f.goals.home === f.goals.away;
                    return (
                      <tr key={f.fixture.id} className="hover:bg-[#2a2a3e]/40">
                        <td className="py-2.5 pr-3 text-gray-400 text-xs whitespace-nowrap">
                          {new Date(f.fixture.date).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 pr-3 text-gray-400 text-xs max-w-[120px] truncate">{f.league?.name}</td>
                        <td className="py-2.5 pr-3 text-white text-xs">
                          <div className="flex items-center gap-1">
                            {f.teams.home.logo && <img src={f.teams.home.logo} alt="" className="w-4 h-4 object-contain" />}
                            <span className={f.teams.home.id === teams[0].team.id ? 'text-[#e94560]' : f.teams.home.id === teams[1].team.id ? 'text-blue-400' : ''}>
                              {f.teams.home.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 text-center">
                          <span className={`font-black ${isDraw ? 'text-yellow-400' : isT0Win ? 'text-[#e94560]' : 'text-blue-400'}`} >
                            {f.goals.home} – {f.goals.away}
                          </span>
                        </td>
                        <td className="py-2.5 text-white text-xs">
                          <div className="flex items-center gap-1">
                            {f.teams.away.logo && <img src={f.teams.away.logo} alt="" className="w-4 h-4 object-contain" />}
                            <span className={f.teams.away.id === teams[0].team.id ? 'text-[#e94560]' : f.teams.away.id === teams[1].team.id ? 'text-blue-400' : ''}>
                              {f.teams.away.name}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!teams[0] && !teams[1] && (
        <div className="card text-center py-16 text-gray-500">
          Select two teams above to view their Head-to-Head record
        </div>
      )}
    </div>
  );
}
