import axios from 'axios';

const api = axios.create({
  baseURL: 'https://v3.football.api-sports.io',
  headers: {
    'x-apisports-key': process.env.REACT_APP_API_SPORTS_KEY,
  },
});

// ── Players ──────────────────────────────────────────────────────────────────

export const searchPlayers = async (name) => {
  const { data } = await api.get('/players', { params: { search: name } });
  return data.response;
};

export const getPlayerStats = async (playerId, season = 2023) => {
  const { data } = await api.get('/players', { params: { id: playerId, season } });
  return data.response?.[0] ?? null;
};

export const getPlayerTrophies = async (playerId) => {
  const { data } = await api.get('/trophies', { params: { player: playerId } });
  return data.response ?? [];
};

export const getPlayerTransfers = async (playerId) => {
  const { data } = await api.get('/transfers', { params: { player: playerId } });
  return data.response?.[0]?.transfers ?? [];
};

export const getPlayerSeasons = async (playerId) => {
  const { data } = await api.get('/players/seasons', { params: { player: playerId } });
  return data.response ?? [];
};

export const getPlayerStatsBySeason = async (playerId, season) => {
  const { data } = await api.get('/players', { params: { id: playerId, season } });
  return data.response?.[0] ?? null;
};

// ── Teams ─────────────────────────────────────────────────────────────────────

export const searchTeams = async (name) => {
  const { data } = await api.get('/teams', { params: { search: name } });
  return data.response;
};

export const getTeamById = async (teamId) => {
  const { data } = await api.get('/teams', { params: { id: teamId } });
  return data.response?.[0] ?? null;
};

export const getTeamStatistics = async (teamId, leagueId, season = 2023) => {
  const { data } = await api.get('/teams/statistics', {
    params: { team: teamId, league: leagueId, season },
  });
  return data.response ?? null;
};

export const getTeamTrophies = async (teamId) => {
  const { data } = await api.get('/trophies', { params: { team: teamId } });
  return data.response ?? [];
};

export const getTeamSquad = async (teamId) => {
  const { data } = await api.get('/players/squads', { params: { team: teamId } });
  return data.response?.[0]?.players ?? [];
};

export const getTeamFixtures = async (teamId, last = 10) => {
  const { data } = await api.get('/fixtures', { params: { team: teamId, last } });
  return data.response ?? [];
};

export const getTeamLeagues = async (teamId, season = 2023) => {
  const { data } = await api.get('/leagues', { params: { team: teamId, season } });
  return data.response ?? [];
};

// ── H2H ───────────────────────────────────────────────────────────────────────

export const getH2H = async (team1Id, team2Id) => {
  const { data } = await api.get('/fixtures/headtohead', {
    params: { h2h: `${team1Id}-${team2Id}`, last: 50 },
  });
  return data.response ?? [];
};
