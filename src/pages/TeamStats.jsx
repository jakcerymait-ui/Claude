import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import SearchInput from '../components/SearchInput';
import ErrorMessage from '../components/ErrorMessage';
import StatBox from '../components/StatBox';
import Badge from '../components/Badge';
import { SkeletonCard, SkeletonTable } from '../components/SkeletonCard';
import {
  searchTeams,
  getTeamTrophies,
  getTeamSquad,
  getTeamFixtures,
  getTeamLeagues,
  getTeamStatistics,
} from '../services/api';

function FormBadge({ result }) {
  const colors = { W: 'win', D: 'draw', L: 'loss' };
  return <Badge variant={colors[result] || 'default'}>{result}</Badge>;
}

function getMatchResult(fixture, teamId) {
  const { teams, goals } = fixture;
  if (goals.home === null) return 'N/A';
  const isHome = teams.home.id === teamId;
  const teamGoals = isHome ? goals.home : goals.away;
  const oppGoals = isHome ? goals.away : goals.home;
  if (teamGoals > oppGoals) return 'W';
  if (teamGoals < oppGoals) return 'L';
  return 'D';
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-[#1e1e2e] border border-[#2e2e45] rounded-lg p-3 text-sm">
        <p className="text-gray-300 font-medium mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: <b>{p.value}</b></p>
        ))}
      </div>
    );
  }
  return null;
};

export default function TeamStats() {
  const [results, setResults] = useState([]);
  const [team, setTeam] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (query) => {
    setLoading(true);
    setError(null);
    setResults([]);
    setTeam(null);
    setData(null);
    try {
      const found = await searchTeams(query);
      setResults(found);
      if (found.length === 1) await loadTeam(found[0]);
    } catch (e) {
      setError(e.message || 'Failed to search teams');
    } finally {
      setLoading(false);
    }
  };

  const loadTeam = async (item) => {
    setTeam(item);
    setResults([]);
    setLoadingDetail(true);
    setData(null);
    try {
      const teamId = item.team.id;
      const [trophies, squad, fixtures, leagues] = await Promise.all([
        getTeamTrophies(teamId),
        getTeamSquad(teamId),
        getTeamFixtures(teamId, 10),
        getTeamLeagues(teamId, 2023),
      ]);
      let statistics = null;
      if (leagues.length > 0) {
        const primaryLeague = leagues[0]?.league?.id;
        statistics = await getTeamStatistics(teamId, primaryLeague, 2023);
      }
      setData({ trophies, squad, fixtures, statistics });
    } catch (e) {
      setError(e.message || 'Failed to load team details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const statsData = data?.statistics;
  const wins = statsData?.fixtures?.wins?.total ?? 0;
  const draws = statsData?.fixtures?.draws?.total ?? 0;
  const losses = statsData?.fixtures?.loses?.total ?? 0;
  const played = statsData?.fixtures?.played?.total ?? 0;
  const goalsFor = statsData?.goals?.for?.total?.total ?? 0;
  const goalsAgainst = statsData?.goals?.against?.total?.total ?? 0;
  const winPct = played > 0 ? ((wins / played) * 100).toFixed(1) : '0.0';

  const barData = [
    { name: 'Wins', value: wins, fill: '#22c55e' },
    { name: 'Draws', value: draws, fill: '#eab308' },
    { name: 'Losses', value: losses, fill: '#ef4444' },
  ];

  const groupedSquad = data?.squad?.reduce((acc, p) => {
    const pos = p.position || 'Unknown';
    if (!acc[pos]) acc[pos] = [];
    acc[pos].push(p);
    return acc;
  }, {});

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-1">Team Stats & History</h1>
        <p className="text-gray-400 text-sm">Search any club or national team for stats, squad, and trophies</p>
      </div>

      <SearchInput placeholder="e.g. Manchester City, Brazil…" onSearch={handleSearch} loading={loading} />

      {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}

      {results.length > 1 && !team && (
        <div className="card space-y-2">
          <p className="text-sm text-gray-400 mb-3">{results.length} teams found. Select one:</p>
          {results.slice(0, 10).map((item) => (
            <button
              key={item.team.id}
              onClick={() => loadTeam(item)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-[#12121a] hover:bg-[#2a2a3e] transition-colors text-left"
            >
              {item.team.logo && (
                <img src={item.team.logo} alt="" className="w-10 h-10 object-contain" />
              )}
              <div>
                <p className="text-white font-medium">{item.team.name}</p>
                <p className="text-gray-400 text-xs">{item.team.country} · {item.team.founded ? `Est. ${item.team.founded}` : ''}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {loadingDetail && (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonTable rows={5} />
        </div>
      )}

      {team && !loadingDetail && data && (
        <div className="space-y-6">
          {/* Team Header */}
          <div className="card flex flex-col sm:flex-row gap-5 items-start">
            {team.team.logo && (
              <img src={team.team.logo} alt={team.team.name} className="w-20 h-20 object-contain" />
            )}
            <div className="flex-1">
              <h2 className="text-2xl font-extrabold text-white mb-1">{team.team.name}</h2>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400 mb-3">
                {team.team.country && <span>🌍 {team.team.country}</span>}
                {team.team.founded && <span>📅 Founded {team.team.founded}</span>}
                {team.venue?.name && <span>🏟 {team.venue.name} (cap. {team.venue.capacity?.toLocaleString()})</span>}
              </div>
              {statsData?.league && (
                <Badge variant="accent">
                  {statsData.league.name} {statsData.league.season}
                </Badge>
              )}
            </div>
          </div>

          {/* Season Stats */}
          {statsData && (
            <>
              <div>
                <h3 className="section-title">Season Statistics</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatBox label="Played" value={played} />
                  <StatBox label="Wins" value={wins} accent />
                  <StatBox label="Draws" value={draws} />
                  <StatBox label="Losses" value={losses} />
                  <StatBox label="Goals For" value={goalsFor} accent />
                  <StatBox label="Goals Against" value={goalsAgainst} />
                  <StatBox label="Win Rate" value={`${winPct}%`} accent />
                  <StatBox label="Goal Diff" value={goalsFor - goalsAgainst} />
                </div>
              </div>

              {/* W/D/L Chart */}
              <div className="card">
                <h3 className="section-title">Win / Draw / Loss</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={barData} margin={{ top: 0, right: 10, bottom: 0, left: -10 }}>
                    <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 13 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {barData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {/* Recent Form */}
          {data.fixtures.length > 0 && (
            <div>
              <h3 className="section-title">Recent Form (Last 10)</h3>
              <div className="card space-y-2">
                <div className="flex gap-2 flex-wrap mb-3">
                  {data.fixtures.map((f) => {
                    const res = getMatchResult(f, team.team.id);
                    return <FormBadge key={f.fixture.id} result={res} />;
                  })}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[450px]">
                    <thead>
                      <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-[#2e2e45]">
                        <th className="text-left pb-2 pr-3">Date</th>
                        <th className="text-left pb-2 pr-3">Competition</th>
                        <th className="text-left pb-2 pr-3">Home</th>
                        <th className="text-center pb-2 pr-3">Score</th>
                        <th className="text-left pb-2">Away</th>
                        <th className="text-center pb-2">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2e2e45]">
                      {data.fixtures.map((f) => {
                        const res = getMatchResult(f, team.team.id);
                        return (
                          <tr key={f.fixture.id} className="hover:bg-[#2a2a3e]/40">
                            <td className="py-2.5 pr-3 text-gray-400 text-xs whitespace-nowrap">
                              {new Date(f.fixture.date).toLocaleDateString()}
                            </td>
                            <td className="py-2.5 pr-3 text-gray-400 text-xs">{f.league?.name}</td>
                            <td className="py-2.5 pr-3 text-white text-xs">
                              <div className="flex items-center gap-1">
                                {f.teams.home.logo && <img src={f.teams.home.logo} alt="" className="w-4 h-4 object-contain" />}
                                {f.teams.home.name}
                              </div>
                            </td>
                            <td className="py-2.5 pr-3 text-center font-bold text-white">
                              {f.goals.home} – {f.goals.away}
                            </td>
                            <td className="py-2.5 text-white text-xs">
                              <div className="flex items-center gap-1">
                                {f.teams.away.logo && <img src={f.teams.away.logo} alt="" className="w-4 h-4 object-contain" />}
                                {f.teams.away.name}
                              </div>
                            </td>
                            <td className="py-2.5 text-center">
                              <FormBadge result={res} />
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

          {/* Trophy Cabinet */}
          {data.trophies.length > 0 && (
            <div>
              <h3 className="section-title">Trophy Cabinet ({data.trophies.length})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {data.trophies.map((t, i) => (
                  <div key={i} className="card flex items-center gap-3 py-3">
                    <span className="text-2xl">🏆</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{t.league}</p>
                      <p className="text-gray-400 text-xs">{t.country} · {t.season}</p>
                    </div>
                    <Badge variant="accent">{t.place}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Squad */}
          {groupedSquad && Object.keys(groupedSquad).length > 0 && (
            <div>
              <h3 className="section-title">Current Squad</h3>
              <div className="space-y-4">
                {Object.entries(groupedSquad).map(([position, players]) => (
                  <div key={position}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">{position}s</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {players.map((p) => (
                        <div key={p.id} className="card py-3 flex items-center gap-3">
                          {p.photo && <img src={p.photo} alt="" className="w-10 h-10 rounded-full object-cover" />}
                          <div className="min-w-0">
                            <p className="text-white text-sm font-medium truncate">{p.name}</p>
                            {p.number && <p className="text-gray-500 text-xs">#{p.number}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
