export type Player = {
  id: string;
  name: string;
  key: string;
  wins: number;
  bot: boolean;
  hint: string | null;
  out: boolean;
};
export type State = {
  rulesVersion: 2;
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
    reason: 'CRASH' | 'LIMIT';
    crashIds: string[];
    bombNumber: number;
    bombIds: string[];
    out: string[];
    winners: string[];
    finished: boolean;
  };
  bots: Record<string, number>;
};
export const integer = (min: number, max: number) => {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return min + Math.floor((n[0] / 4294967296) * (max - min + 1));
};
export function newState(p: Player, practice: boolean): State {
  return {
    rulesVersion: 2,
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
  for (const p of s.players.filter((p) => p.bot))
    s.bots[p.id] = now + integer(750, 22000);
}
export function startRound(s: State, now: number): State {
  const r = structuredClone(s);
  r.round++;
  r.gate++;
  r.count = 0;
  r.bomb = integer(1, 15);
  r.inputs = [];
  r.calls = [];
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
  if (r.inputs.length >= 2 || r.count >= 15) {
    const reason = r.inputs.length >= 2 ? 'CRASH' : 'LIMIT';
    const crashIds = reason === 'CRASH' ? [...r.inputs] : [];
    const bombIds =
      r.calls.find((call) => call.number === r.bomb)?.players ?? [];
    const penalties = [...new Set([...crashIds, ...bombIds])];
    for (const p of r.players) {
      p.out = penalties.includes(p.id);
      if (!p.out) p.wins++;
    }
    const best = Math.max(...r.players.map((p) => p.wins));
    const finished = best >= 2 || r.round >= 3;
    r.result = {
      reason,
      crashIds,
      bombNumber: r.bomb,
      bombIds,
      out: penalties,
      finished,
      winners:
        finished && best > 0
          ? r.players.filter((p) => p.wins === best).map((p) => p.id)
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
  const revealed = !!s.result && now >= s.unlockAt - 2200;
  const visibleOut = s.result
    ? revealed
      ? s.result.out
      : s.result.crashIds
    : [];
  return {
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
          revealAt: s.unlockAt - 2200,
          bombNumber: revealed ? s.result.bombNumber : null,
          bombIds: revealed ? s.result.bombIds : [],
          out: visibleOut,
          finished: revealed && s.result.finished,
          winners: revealed ? s.result.winners : [],
          calls: revealed ? s.calls : [],
        }
      : null,
    players: s.players.map(({ id, name, wins, bot, out }) => ({
      id,
      name,
      wins: s.result && !revealed && !out ? wins - 1 : wins,
      bot,
      out: visibleOut.includes(id),
    })),
  };
}
