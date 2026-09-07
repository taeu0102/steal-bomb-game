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
    reason: 'CRASH' | 'BOMB';
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
      ? `함정 숫자는 ${r.bomb % 2 ? '홀수' : '짝수'}다.`
      : `함정 숫자는 10 ${r.bomb >= 10 ? '이상' : '미만'}이다.`;
  scheduleBots(r, r.unlockAt);
  return r;
}
export function resolve(s: State, now: number): State {
  const r = structuredClone(s);
  if (r.phase !== 'collecting' || now <= r.deadline) return r;
  r.count++;
  if (r.inputs.length >= 2 || r.count === r.bomb) {
    const reason = r.inputs.length >= 2 ? 'CRASH' : 'BOMB';
    for (const p of r.players) {
      p.out = r.inputs.includes(p.id);
      if (!p.out) p.wins++;
    }
    const best = Math.max(...r.players.map((p) => p.wins));
    const finished = best >= 2 || r.round >= 3;
    r.result = {
      reason,
      out: [...r.inputs],
      finished,
      winners:
        finished && best > 0
          ? r.players.filter((p) => p.wins === best).map((p) => p.id)
          : [],
    };
    r.phase = 'result';
    r.unlockAt = now + 1800;
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
    result: s.result,
    players: s.players.map(({ id, name, wins, bot, out }) => ({
      id,
      name,
      wins,
      bot,
      out,
    })),
  };
}
