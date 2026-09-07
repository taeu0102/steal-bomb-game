export type Player = {
  id: string;
  name: string;
  key: string;
  points: number;
  team: number;
  bot: boolean;
  hint: string | null;
  out: boolean;
};
export type State = {
  rulesVersion: 3;
  mode: 'individual' | 'team';
  teamCount: 2 | 3;
  lastPlayer: string | null;
  streak: number;
  calls: { number: number; players: string[] }[];
  phase: 'lobby' | 'ready' | 'open' | 'collecting' | 'cooldown' | 'result';
  round: number;
  gate: number;
  count: number;
  bomb: number;
  deadline: number;
  unlockAt: number;
  players: Player[];
  host: string;
  inputs: string[];
  practice: boolean;
  result: null | {
    reason: 'CRASH' | 'BOMB' | 'LIMIT';
    crashIds: string[];
    bombNumber: number;
    bombIds: string[];
    out: string[];
    winners: string[];
    finished: boolean;
    winnerTeams: number[];
    beforeBombPoints: Record<string, number>;
  };
  bots: Record<string, number>;
};
export const integer = (min: number, max: number) => {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return min + Math.floor((n[0] / 4294967296) * (max - min + 1));
};
export function newState(
  p: Player,
  practice: boolean,
  mode: State['mode'] = 'individual',
  teamCount: 2 | 3 = 3,
): State {
  return {
    rulesVersion: 3,
    mode,
    teamCount,
    lastPlayer: null,
    streak: 0,
    calls: [],
    phase: 'lobby',
    round: 0,
    gate: 0,
    count: 0,
    bomb: 0,
    deadline: 0,
    unlockAt: 0,
    players: [p],
    host: p.id,
    inputs: [],
    practice,
    result: null,
    bots: {},
  };
}
export function scheduleBots(s: State, now: number) {
  s.bots = {};
  for (const p of s.players.filter((p) => p.bot && !streakBlocked(s, p.id)))
    s.bots[p.id] = now + integer(750, 22000);
}
export function streakBlocked(s: State, id: string) {
  return s.mode === 'team' && s.lastPlayer === id && s.streak >= 2;
}
export function teamScores(
  players: Pick<Player, 'team' | 'points'>[],
  teamCount = 3,
) {
  return Array.from({ length: teamCount }, (_, id) => id).map((id) => ({
    id,
    name: ['레드', '블루', '골드'][id],
    points: players
      .filter((p) => p.team === id)
      .reduce((total, p) => total + p.points, 0),
  }));
}
export function nextTeam(players: Player[], teamCount = 3) {
  return Array.from({ length: teamCount }, (_, id) => id).sort(
    (a, b) =>
      players.filter((p) => p.team === a).length -
      players.filter((p) => p.team === b).length,
  )[0];
}
export function startRound(s: State, now: number): State {
  const r = structuredClone(s);
  r.round++;
  r.gate++;
  r.count = 0;
  r.bomb = integer(1, 15);
  r.inputs = [];
  r.calls = [];
  r.lastPlayer = null;
  r.streak = 0;
  r.phase = 'ready';
  r.unlockAt = now + 3200;
  r.result = null;
  for (const p of r.players) {
    p.out = false;
    p.hint = null;
  }
  const shuffled = [...r.players];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = integer(0, i);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  for (const p of shuffled.slice(0, 3))
    p.hint = integer(0, 1)
      ? `폭탄 숫자는 ${r.bomb % 2 ? '홀수' : '짝수'}다.`
      : `폭탄 숫자는 10 ${r.bomb >= 10 ? '이상' : '미만'}이다.`;
  scheduleBots(r, r.unlockAt);
  return r;
}
export function resolve(s: State, now: number): State {
  const r = structuredClone(s);
  if (r.phase !== 'collecting' || now <= r.deadline) return r;
  r.count++;
  r.calls.push({ number: r.count, players: [...r.inputs] });
  if (r.inputs.length === 1) {
    const id = r.inputs[0];
    r.players.find((p) => p.id === id)!.points += r.count * 10;
    r.streak = r.lastPlayer === id ? r.streak + 1 : 1;
    r.lastPlayer = id;
  }
  if (r.inputs.length >= 2 || r.count === r.bomb || r.count >= 15) {
    const reason =
      r.inputs.length >= 2 ? 'CRASH' : r.count === r.bomb ? 'BOMB' : 'LIMIT';
    const crashIds = reason === 'CRASH' ? [...r.inputs] : [];
    const bombIds =
      r.calls.find((call) => call.number === r.bomb)?.players ?? [];
    const penalties = [...new Set([...crashIds, ...bombIds])];
    const beforeBombPoints = Object.fromEntries(
      r.players.map((p) => [p.id, p.points]),
    );
    for (const p of r.players) {
      p.out = penalties.includes(p.id);
      if (bombIds.includes(p.id)) p.points = 0;
    }
    const best = Math.max(...r.players.map((p) => p.points));
    const teams = teamScores(r.players, r.teamCount ?? 3);
    const teamBest = Math.max(...teams.map((t) => t.points));
    const finished = r.round >= 3;
    const winnerTeams =
      finished && r.mode === 'team' && teamBest > 0
        ? teams.filter((t) => t.points === teamBest).map((t) => t.id)
        : [];
    r.result = {
      reason,
      crashIds,
      bombNumber: r.bomb,
      bombIds,
      out: penalties,
      finished,
      beforeBombPoints,
      winnerTeams,
      winners:
        finished && (r.mode === 'team' ? teamBest > 0 : best > 0)
          ? r.players
              .filter((p) =>
                r.mode === 'team'
                  ? winnerTeams.includes(p.team)
                  : p.points === best,
              )
              .map((p) => p.id)
          : [],
    };
    r.phase = 'result';
    // First show the collision, then reveal the bomb after 1800ms.
    // The API rebases unlockAt to the actual SQL commit time.
    r.unlockAt = now + 4000;
    r.bots = {};
  } else {
    r.phase = 'cooldown';
    r.unlockAt = now + integer(500, 1500);
    r.gate++;
    r.inputs = [];
    scheduleBots(r, r.unlockAt);
  }
  return r;
}
export function publicState(
  s: State,
  id: string,
  code: string,
  revision: number,
  now: number,
) {
  const me = s.players.find((p) => p.id === id)!;
  // Collecting is deliberately not broadcast: it must not warn others out of a crash.
  const phase = s.phase === 'collecting' ? 'open' : s.phase;
  const revealed =
    !!s.result && (s.result.reason === 'BOMB' || now >= s.unlockAt - 2200);
  const visibleOut = s.result
    ? revealed
      ? s.result.out
      : s.result.crashIds
    : [];
  const players = s.players.map(({ id, name, points, team, bot }) => ({
    id,
    name,
    team,
    bot,
    points: s.result && !revealed ? s.result.beforeBombPoints[id] : points,
    out: visibleOut.includes(id),
  }));
  return {
    mode: s.mode,
    teamCount: s.teamCount ?? 3,
    teams: s.mode === 'team' ? teamScores(players, s.teamCount ?? 3) : [],
    blockedByStreak: streakBlocked(s, id),
    myStreak: s.lastPlayer === id ? s.streak : 0,
    code,
    revision,
    serverNow: now,
    phase,
    round: s.round,
    gate: s.gate,
    count: s.count,
    unlockAt: s.unlockAt,
    host: s.host,
    practice: s.practice,
    me: id,
    hint: me.hint,
    submitted: s.inputs.includes(id),
    result: s.result
      ? {
          reason: s.result.reason,
          crashIds: s.result.crashIds,
          revealed,
          revealAt: s.unlockAt - (s.result.reason === 'BOMB' ? 4000 : 2200),
          bombNumber: revealed ? s.result.bombNumber : null,
          bombIds: revealed ? s.result.bombIds : [],
          out: visibleOut,
          finished: revealed && s.result.finished,
          winners: revealed ? s.result.winners : [],
          winnerTeams: revealed ? s.result.winnerTeams : [],
          calls: revealed ? s.calls : [],
        }
      : null,
    players,
  };
}
