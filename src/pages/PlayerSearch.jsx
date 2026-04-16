import { useState } from 'react';
import SearchInput from '../components/SearchInput';
import ErrorMessage from '../components/ErrorMessage';
import StatBox from '../components/StatBox';
import Badge from '../components/Badge';
import { SkeletonPlayerCard, SkeletonTable } from '../components/SkeletonCard';
import {
  searchPlayers,
  getPlayerTrophies,
  getPlayerTransfers,
  getPlayerSeasons,
  getPlayerStatsBySeason,
} from '../services/api';

export default function PlayerSearch() {
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [playerData, setPlayerData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (query) => {
    setLoading(true);
    setError(null);
    setResults([]);
    setSelected(null);
    setPlayerData(null);
    try {
      const data = await searchPlayers(query);
      setResults(data);
      if (data.length === 1) await loadPlayer(data[0]);
    } catch (e) {
      setError(e.message || 'Failed to search players');
    } finally {
      setLoading(false);
    }
  };

  const loadPlayer = async (item) => {
    setSelected(item);
    setLoadingDetail(true);
    setPlayerData(null);
    try {
      const seasons = await getPlayerSeasons(item.player.id);
      const seasonList = seasons.sort((a, b) => b - a);
      const [trophies, transfers] = await Promise.all([
        getPlayerTrophies(item.player.id),
        getPlayerTransfers(item.player.id),
      ]);
      const seasonStats = await Promise.all(
        seasonList.slice(0, 8).map((s) => getPlayerStatsBySeason(item.player.id, s))
      );
      setPlayerData({ trophies, transfers, seasonStats: seasonStats.filter(Boolean), seasons: seasonList });
    } catch (e) {
      setError(e.message || 'Failed to load player details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const aggregateStats = (seasonStats) => {
    const totals = { appearances: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0, cleanSheets: 0 };
    for (const entry of seasonStats) {
      for (const s of entry.statistics || []) {
        totals.appearances += s.games?.appearences || 0;
        totals.goals += s.goals?.total || 0;
        totals.assists += s.goals?.assists || 0;
        totals.yellowCards += s.cards?.yellow || 0;
        totals.redCards += s.cards?.red || 0;
        totals.cleanSheets += s.goals?.conceded === 0 ? (s.games?.appearences || 0) : 0;
      }
    }
    return totals;
  };

  const latestStats = selected?.statistics?.[0];
  const position = latestStats?.games?.position || 'Unknown';
  const isGK = position === 'Goalkeeper';

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-1">Player Search</h1>
        <p className="text-gray-400 text-sm">Search for any footballer and view their full career stats</p>
      </div>

      <SearchInput placeholder="e.g. Lionel Messi, Cristiano Ronaldo…" onSearch={handleSearch} loading={loading} />

      {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}

      {/* Search Results List */}
      {results.length > 1 && !selected && (
        <div className="card space-y-2">
          <p className="text-sm text-gray-400 mb-3">{results.length} players found. Select one:</p>
          {results.slice(0, 10).map((item) => (
            <button
              key={item.player.id}
              onClick={() => loadPlayer(item)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-[#12121a] hover:bg-[#2a2a3e] transition-colors text-left"
            >
              {item.player.photo && (
                <img src={item.player.photo} alt="" className="w-10 h-10 rounded-full object-cover bg-[#2a2a3e]" />
              )}
              <div>
                <p className="text-white font-medium">{item.player.name}</p>
                <p className="text-gray-400 text-xs">
                  {item.statistics?.[0]?.team?.name} · {item.player.nationality}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Loading skeleton */}
      {loadingDetail && (
        <div className="space-y-4">
          <SkeletonPlayerCard />
          <SkeletonTable rows={6} />
        </div>
      )}

      {/* Player Detail */}
      {selected && !loadingDetail && playerData && (
        <PlayerDetail
          item={selected}
          playerData={playerData}
          isGK={isGK}
          aggregateStats={aggregateStats}
        />
      )}
    </div>
  );
}

function PlayerDetail({ item, playerData, isGK, aggregateStats }) {
  const { player } = item;
  const { trophies, transfers, seasonStats } = playerData;
  const totals = aggregateStats(seasonStats);
  const latestStat = item.statistics?.[0];
  const nationality = player.nationality;
  const age = player.age;

  const gpg = totals.appearances > 0
    ? (totals.goals / totals.appearances).toFixed(2)
    : '0.00';

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          {player.photo && (
            <img src={player.photo} alt={player.name} className="w-24 h-24 rounded-full object-cover ring-2 ring-[#e94560] flex-shrink-0" />
          )}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h2 className="text-2xl font-extrabold text-white">{player.name}</h2>
              {latestStat?.games?.position && (
                <Badge variant="accent">{latestStat.games.position}</Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400 mb-3">
              {nationality && <span>🌍 {nationality}</span>}
              {age && <span>🎂 Age {age}</span>}
              {latestStat?.team?.name && <span>🏟 {latestStat.team.name}</span>}
              {player.height && <span>📏 {player.height}</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {trophies.slice(0, 4).map((t, i) => (
                <span key={i} className="stat-badge">🏆 {t.league}</span>
              ))}
              {trophies.length > 4 && (
                <span className="stat-badge">+{trophies.length - 4} more</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Career Total Stats */}
      <div>
        <h3 className="section-title">Career Totals</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox label="Appearances" value={totals.appearances} />
          <StatBox label="Goals" value={totals.goals} accent />
          <StatBox label="Assists" value={totals.assists} />
          <StatBox label="Goals/Game" value={gpg} />
          <StatBox label="Yellow Cards" value={totals.yellowCards} />
          <StatBox label="Red Cards" value={totals.redCards} />
          {isGK && <StatBox label="Clean Sheets" value={totals.cleanSheets} />}
          <StatBox label="Trophies" value={trophies.length} accent />
        </div>
      </div>

      {/* Career Timeline */}
      {seasonStats.length > 0 && (
        <div>
          <h3 className="section-title">Career Timeline</h3>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="text-gray-400 border-b border-[#2e2e45] text-xs uppercase tracking-wide">
                  <th className="text-left pb-3 pr-4">Season</th>
                  <th className="text-left pb-3 pr-4">Club</th>
                  <th className="text-center pb-3 pr-4">Apps</th>
                  <th className="text-center pb-3 pr-4">Goals</th>
                  <th className="text-center pb-3 pr-4">Assists</th>
                  <th className="text-center pb-3">🟨/🟥</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2e2e45]">
                {seasonStats.map((entry, idx) => {
                  const stats = entry?.statistics || [];
                  return stats.map((s, si) => (
                    <tr key={`${idx}-${si}`} className="hover:bg-[#2a2a3e]/40 transition-colors">
                      <td className="py-2.5 pr-4 text-gray-300 font-medium">{playerData.seasons[idx]}</td>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          {s.team?.logo && <img src={s.team.logo} alt="" className="w-5 h-5 object-contain" />}
                          <span className="text-white">{s.team?.name}</span>
                        </div>
                      </td>
                      <td className="text-center py-2.5 pr-4 text-gray-300">{s.games?.appearences ?? 0}</td>
                      <td className="text-center py-2.5 pr-4 font-semibold text-[#e94560]">{s.goals?.total ?? 0}</td>
                      <td className="text-center py-2.5 pr-4 text-blue-400">{s.goals?.assists ?? 0}</td>
                      <td className="text-center py-2.5 text-gray-300">
                        {s.cards?.yellow ?? 0}/{s.cards?.red ?? 0}
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Club Career (Transfers) */}
      {transfers.length > 0 && (
        <div>
          <h3 className="section-title">Transfer History</h3>
          <div className="space-y-2">
            {transfers.map((t, i) => (
              <div key={i} className="card flex flex-wrap items-center gap-3 py-3">
                <div className="flex items-center gap-2 min-w-[120px]">
                  {t.teams?.out?.logo && <img src={t.teams.out.logo} alt="" className="w-6 h-6 object-contain" />}
                  <span className="text-gray-300 text-sm">{t.teams?.out?.name}</span>
                </div>
                <span className="text-gray-500">→</span>
                <div className="flex items-center gap-2 min-w-[120px]">
                  {t.teams?.in?.logo && <img src={t.teams.in.logo} alt="" className="w-6 h-6 object-contain" />}
                  <span className="text-white font-medium text-sm">{t.teams?.in?.name}</span>
                </div>
                <span className="ml-auto text-xs text-gray-500">{t.date?.split('-')[0]}</span>
                {t.type && <Badge>{t.type}</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trophy Cabinet */}
      {trophies.length > 0 && (
        <div>
          <h3 className="section-title">Trophy Cabinet ({trophies.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {trophies.map((t, i) => (
              <div key={i} className="card flex items-center gap-3 py-3">
                <span className="text-2xl">🏆</span>
                <div>
                  <p className="text-white text-sm font-medium">{t.league}</p>
                  <p className="text-gray-400 text-xs">{t.country} · {t.season}</p>
                </div>
                <Badge variant="accent" className="ml-auto">{t.place}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
