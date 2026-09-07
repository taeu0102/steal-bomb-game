import { rawDb } from '@/db';
import {
  integer,
  newState,
  startRound,
  resolve,
  publicState,
  type State,
  type Player,
} from '@/lib/game';
import { NOW, PRESS_SQL } from '@/lib/sql';

type Row = { code: string; state: string; revision: number; now: number };
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const hash = async (s: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
async function read(code: string): Promise<Row> {
  const row = await rawDb()
    .prepare(
      `SELECT code,state,revision,${NOW} AS now FROM death_rooms WHERE code=? AND expires>${NOW}`,
    )
    .bind(code)
    .first<Row>();
  if (!row) throw new Error('방을 찾을 수 없습니다. 코드를 확인해 주세요.');
  return row;
}
async function save(row: Row, s: State, rebaseClock = false) {
  // Start countdown/cooldown at the actual atomic commit, not an earlier SELECT.
  const result = rebaseClock
    ? await rawDb()
        .prepare(`UPDATE death_rooms SET state=json_set(?, '$.unlockAt',${NOW}+?,
      '$.bots',json((SELECT json_group_object(key,CAST(value AS INTEGER)+${NOW}-?) FROM json_each(?)))),
      revision=revision+1 WHERE code=? AND revision=?`)
        .bind(
          JSON.stringify(s),
          s.unlockAt - row.now,
          row.now,
          JSON.stringify(s.bots),
          row.code,
          row.revision,
        )
        .run()
    : await rawDb()
        .prepare(
          'UPDATE death_rooms SET state=?,revision=revision+1 WHERE code=? AND revision=?',
        )
        .bind(JSON.stringify(s), row.code, row.revision)
        .run();
  return result.meta.changes === 1;
}
async function tick(code: string) {
  let row = await read(code);
  for (let retry = 0; retry < 4; retry++) {
    const s: State = JSON.parse(row.state);
    if (s.rulesVersion !== 2) {
      // Old rounds did not retain number ownership; never invent past callers.
      const reset = newState(s.players[0], s.practice);
      reset.players = s.players.map((p) => ({
        ...p,
        wins: 0,
        out: false,
        hint: null,
      }));
      reset.host = s.host;
      reset.gate = s.gate + 1;
      await save(row, reset);
      row = await read(code);
      continue;
    }
    if (s.phase === 'collecting' && row.now > s.deadline) {
      await save(row, resolve(s, row.now), true);
      row = await read(code);
      continue;
    }
    if (s.phase === 'ready' && row.now >= s.unlockAt) {
      s.phase = 'open';
      await save(row, s);
      row = await read(code);
      continue;
    }
    if (
      s.practice &&
      ['open', 'cooldown', 'collecting'].includes(s.phase) &&
      row.now >= s.unlockAt
    ) {
      const due = s.players.filter(
        (p) => p.bot && !s.inputs.includes(p.id) && s.bots[p.id] <= row.now,
      );
      if (due.length) {
        await rawDb().batch(
          due.map((p) =>
            rawDb()
              .prepare(PRESS_SQL)
              .bind(p.id, code, s.round, s.gate, p.id, p.key, p.id),
          ),
        );
        row = await read(code);
      }
    }
    return row;
  }
  return row;
}
export async function POST(req: Request) {
  try {
    if (Number(req.headers.get('content-length') ?? 0) > 4096)
      return json({ error: '요청이 너무 큽니다.' }, 413);
    const b = (await req.json()) as Record<string, any>;
    const action = b.action;
    if (
      ![
        'create',
        'join',
        'sync',
        'press',
        'start',
        'next',
        'restart',
        'leave',
      ].includes(action)
    )
      return json({ error: '잘못된 요청입니다.' }, 400);
    let code = String(b.code ?? '').toUpperCase();
    if (action === 'create' || action === 'join') {
      const name = String(b.name ?? '')
        .trim()
        .slice(0, 12);
      if (!name) return json({ error: '닉네임을 입력해 주세요.' }, 400);
      const token = crypto.randomUUID() + crypto.randomUUID();
      const p: Player = {
        id: crypto.randomUUID(),
        name,
        key: await hash(token),
        wins: 0,
        bot: false,
        hint: null,
        out: false,
      };
      if (action === 'create') {
        const s = newState(p, b.practice === true);
        if (s.practice)
          for (let i = 1; i <= 14; i++)
            s.players.push({
              id: crypto.randomUUID(),
              name: `BOT ${String(i).padStart(2, '0')}`,
              key: crypto.randomUUID(),
              wins: 0,
              bot: true,
              hint: null,
              out: false,
            });
        for (let retry = 0; retry < 20; retry++) {
          const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          code = Array.from(
            { length: 6 },
            () => alphabet[integer(0, alphabet.length - 1)],
          ).join('');
          const r = await rawDb()
            .prepare(
              `INSERT OR IGNORE INTO death_rooms(code,state,revision,expires) VALUES(?,?,0,${NOW}+7200000)`,
            )
            .bind(code, JSON.stringify(s))
            .run();
          if (r.meta.changes === 1) break;
          if (retry === 19)
            throw new Error('방 생성이 지연되고 있습니다. 다시 시도해 주세요.');
        }
      } else {
        if (!/^[A-Z2-9]{6}$/.test(code))
          return json({ error: '6자리 방 코드를 입력해 주세요.' }, 400);
        let joined = false;
        for (let retry = 0; retry < 20; retry++) {
          const row = await read(code);
          const s: State = JSON.parse(row.state);
          if (s.practice) throw new Error('연습 방에는 입장할 수 없습니다.');
          if (s.phase !== 'lobby')
            throw new Error('이미 시작한 방입니다. 다음 게임에 입장해 주세요.');
          if (s.players.length >= 15) throw new Error('방이 가득 찼습니다.');
          s.players.push(p);
          if (await save(row, s)) {
            joined = true;
            break;
          }
        }
        if (!joined) throw new Error('입장이 겹쳤습니다. 다시 눌러 주세요.');
      }
      const row = await read(code);
      return json({
        token,
        ...publicState(
          JSON.parse(row.state),
          p.id,
          code,
          row.revision,
          row.now,
        ),
      });
    }
    if (
      !/^[A-Z2-9]{6}$/.test(code) ||
      typeof b.token !== 'string' ||
      b.token.length > 100
    )
      return json({ error: '입장 정보가 없습니다.' }, 401);
    const key = await hash(b.token);
    let row = await read(code);
    let s: State = JSON.parse(row.state);
    let p = s.players.find((p) => p.key === key && !p.bot);
    if (!p)
      return json(
        { error: '입장 정보가 만료되었습니다. 다시 입장해 주세요.' },
        401,
      );
    const id = p.id;
    if (action === 'press') {
      if (!Number.isSafeInteger(b.round) || !Number.isSafeInteger(b.gate))
        return json({ error: '오래된 입력입니다.' }, 400);
      // Never await a JS read-modify-write to admit an input: this SQL is atomic.
      const r = await rawDb()
        .prepare(PRESS_SQL)
        .bind(id, code, b.round, b.gate, id, key, id)
        .run();
      row = await tick(code);
      return json({
        accepted: r.meta.changes === 1,
        ...publicState(JSON.parse(row.state), id, code, row.revision, row.now),
      });
    }
    row = await tick(code);
    s = JSON.parse(row.state);
    if (['start', 'next', 'restart', 'leave'].includes(action)) {
      for (let retry = 0; retry < 8; retry++) {
        s = JSON.parse(row.state);
        if (action !== 'leave' && s.host !== id)
          return json({ error: '방장만 시작할 수 있습니다.' }, 403);
        if (action === 'leave') {
          if (
            s.phase !== 'lobby' &&
            !(
              s.phase === 'result' &&
              s.result?.finished &&
              row.now >= s.unlockAt
            )
          )
            throw new Error(
              '진행 중에는 방을 나갈 수 없습니다. 창을 닫아도 판정은 유지됩니다.',
            );
          s.players = s.players.filter((p) => p.id !== id);
          if (s.host === id) s.host = s.players.find((p) => !p.bot)?.id ?? '';
        } else if (action === 'start') {
          if (s.phase !== 'lobby' || s.players.length !== 15)
            throw new Error('15명이 모두 입장하면 시작할 수 있습니다.');
          s = startRound(s, row.now);
        } else if (action === 'next') {
          if (
            s.phase !== 'result' ||
            s.result?.finished ||
            row.now < s.unlockAt ||
            b.round !== s.round
          )
            throw new Error('아직 다음 라운드를 시작할 수 없습니다.');
          s = startRound(s, row.now);
        } else {
          if (
            s.phase !== 'result' ||
            !s.result?.finished ||
            row.now < s.unlockAt
          )
            throw new Error('게임이 끝난 뒤 다시 시작할 수 있습니다.');
          for (const pl of s.players) {
            pl.wins = 0;
            pl.out = false;
            pl.hint = null;
          }
          s.phase = 'lobby';
          s.round = 0;
          s.count = 0;
          s.result = null;
          s.calls = [];
          s.inputs = [];
          s.gate++;
        }
        if (await save(row, s, action === 'start' || action === 'next')) break;
        row = await read(code);
        if (retry === 7)
          throw new Error('처리가 겹쳤습니다. 다시 시도해 주세요.');
      }
      if (action === 'leave') return json({ left: true });
      row = await read(code);
    }
    return json(
      publicState(JSON.parse(row.state), id, code, row.revision, row.now),
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : '연결 오류';
    if (/D1_|SQLITE|binding|database|syntax/i.test(message)) {
      console.error('game storage unavailable');
      return json(
        { error: '연결을 복구하고 있습니다. 잠시 후 다시 시도해 주세요.' },
        503,
      );
    }
    return json({ error: message.slice(0, 160) }, 400);
  }
}
