import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { newState, startRound, resolve, publicState } from '../lib/game.ts';
import { NOW, PRESS_SQL } from '../lib/sql.ts';

const player = (i) => ({
  id: `p${i}`,
  key: `key${i}`,
  name: `플레이어${i}`,
  points: 0,
  team: i % 3,
  bot: false,
  hint: null,
  out: false,
});
let db, now;
function setup(n = 15) {
  db?.close();
  db = new DatabaseSync(':memory:');
  now = 100000;
  db.function('test_now', () => now);
  db.exec(
    readFileSync(
      new URL('../drizzle/0000_brown_vermin.sql', import.meta.url),
      'utf8',
    ),
  );
  const s = newState(player(0), false);
  s.players = Array.from({ length: n }, (_, i) => player(i));
  s.phase = 'open';
  s.round = 1;
  s.gate = 1;
  s.bomb = 15;
  db.prepare('INSERT INTO death_rooms VALUES(?,?,0,?)').run(
    'ABC234',
    JSON.stringify(s),
    9999999,
  );
  return s;
}
const load = () =>
  JSON.parse(db.prepare('SELECT state FROM death_rooms').get().state);
function press(i, round = 1, gate = 1, key = `key${i}`) {
  return db
    .prepare(PRESS_SQL.replaceAll(NOW, 'test_now()'))
    .run(`p${i}`, 'ABC234', round, gate, `p${i}`, key, `p${i}`).changes;
}
test('15 distinct inputs share exactly one 200ms window and crash together', () => {
  setup();
  for (let i = 0; i < 15; i++) {
    now = 100000 + i * 10;
    assert.equal(press(i), 1);
  }
  const s = load();
  assert.equal(s.deadline, 100200);
  assert.equal(s.count, 0);
  assert.equal(s.inputs.length, 15);
  const r = resolve(s, 100201);
  assert.equal(r.result.reason, 'CRASH');
  assert.equal(r.result.out.length, 15);
  assert.equal(r.count, 1);
  assert.equal(
    r.players.reduce((a, p) => a + p.points, 0),
    0,
  );
});
test('inclusive 200ms boundary; 201ms excluded even before finalizer runs', () => {
  setup();
  press(0);
  now += 200;
  assert.equal(press(1), 1);
  now++;
  assert.equal(press(2), 0);
  assert.deepEqual(load().inputs, ['p0', 'p1']);
});
test('duplicate player, forged token and stale gate cannot change the count', () => {
  setup();
  assert.equal(press(0), 1);
  assert.equal(press(0), 0);
  assert.equal(press(1, 1, 1, 'wrong'), 0);
  assert.equal(press(1, 1, 0), 0);
  assert.equal(press(1, 0, 1), 0);
  assert.equal(load().inputs.length, 1);
});
test('single bomb ends immediately after the collision window and discloses reset score', () => {
  let s = setup();
  s.bomb = 1;
  s.phase = 'collecting';
  s.inputs = ['p0'];
  s.deadline = 100200;
  assert.equal(resolve(s, 100200).phase, 'collecting');
  s.players[0].points = 120;
  const ended = resolve(s, 100201);
  assert.equal(ended.phase, 'result');
  assert.equal(ended.result.reason, 'BOMB');
  const pub = publicState(ended, 'p0', 'ABC234', 0, 100201);
  assert.equal(pub.result.revealed, true);
  assert.equal(pub.result.bombNumber, 1);
  assert.equal(pub.players[0].points, 0);
  persist(ended);
  now = 200000;
  assert.equal(press(1, 1, ended.gate), 0);
  assert.deepEqual(resolve(s, 100201).calls, [{ number: 1, players: ['p0'] }]);
  s.inputs.push('p1');
  const r = resolve(s, 100201);
  assert.equal(r.result.reason, 'CRASH');
  assert.equal(r.players.filter((p) => p.out).length, 2);
});
test('every bomb from 1 through 15 stops at that count and prevents any following click', () => {
  for (let bomb = 1; bomb <= 15; bomb++) {
    const s = setup();
    s.bomb = bomb;
    persist(s);
    for (let n = 1; n <= bomb; n++) {
      assert.equal(press(n % 2, 1, n), 1);
      const r = confirm();
      assert.equal(r.count, n);
      assert.equal(r.phase, n === bomb ? 'result' : 'cooldown');
      if (n === bomb) {
        assert.equal(r.result.reason, 'BOMB');
        assert.equal(r.players[n % 2].points, 0);
        assert.equal(press(2, 1, r.gate), 0);
      }
    }
  }
});
test('bomb-free branch gives exactly three truthful private hints and hides absence from others', () => {
  const random = mock.method(crypto, 'getRandomValues', (a) => {
    a.fill(0);
    return a;
  });
  try {
    const s = startRound(setup(), now);
    assert.equal(s.bomb, 0);
    assert.equal(
      s.players.filter((p) => p.hint === '이번 라운드에는 폭탄이 없다.').length,
      3,
    );
    const other = s.players.find((p) => p.hint === null);
    const pub = publicState(s, other.id, 'ABC234', 0, now);
    assert.equal(pub.hint, null);
    assert.equal(pub.result, null);
    assert.ok(!JSON.stringify(pub).includes('폭탄이 없다'));
  } finally {
    random.mock.restore();
  }
});
test('bomb-free round reaches 15 with all 1200 points retained; crash still ends early without reset', () => {
  const s = setup();
  s.bomb = 0;
  persist(s);
  let r;
  for (let n = 1; n <= 15; n++) {
    assert.equal(press(n % 2, 1, n), 1);
    r = confirm();
    assert.equal(r.phase, n === 15 ? 'result' : 'cooldown');
  }
  assert.equal(r.result.reason, 'LIMIT');
  assert.equal(r.result.bombNumber, 0);
  assert.deepEqual(r.result.out, []);
  assert.equal(
    r.players.reduce((sum, p) => sum + p.points, 0),
    1200,
  );
  assert.equal(press(0, 1, r.gate), 0);
  const crash = setup();
  crash.bomb = 0;
  crash.players[0].points = 100;
  crash.phase = 'collecting';
  crash.inputs = ['p0', 'p1'];
  crash.deadline = 0;
  const end = resolve(crash, 1000);
  assert.equal(end.result.reason, 'CRASH');
  assert.deepEqual(end.result.bombIds, []);
  assert.equal(end.players[0].points, 100);
});
test('safe count produces one 500–1500ms cooldown and exact unlock admits input', () => {
  setup();
  press(0);
  let r = resolve(load(), 100201);
  assert.equal(r.phase, 'cooldown');
  assert.equal(r.gate, 2);
  assert.ok(r.unlockAt - 100201 >= 500 && r.unlockAt - 100201 <= 1500);
  db.prepare('UPDATE death_rooms SET state=?').run(JSON.stringify(r));
  now = r.unlockAt - 1;
  assert.equal(press(1, 1, 2), 0);
  now++;
  assert.equal(press(1, 1, 2), 1);
  assert.equal(load().deadline, now + 200);
});
test('only 3 truthful personal hints; snapshot contains no secret state', () => {
  const s = startRound(setup(), now);
  assert.equal(s.players.filter((p) => p.hint).length, 3);
  for (const p of s.players) {
    if (p.hint?.includes('홀수')) assert.equal(s.bomb % 2, 1);
    if (p.hint?.includes('짝수')) assert.equal(s.bomb % 2, 0);
    if (p.hint?.includes('이상')) assert.ok(s.bomb >= 10);
    if (p.hint?.includes('미만')) assert.ok(s.bomb < 10);
    const pub = publicState(s, p.id, 'ABC234', 0, now);
    assert.equal(pub.hint, p.hint);
    assert.ok(!('bomb' in pub));
    assert.ok(!('deadline' in pub));
    assert.ok(pub.players.every((p) => !('key' in p) && !('hint' in p)));
  }
});
test('three rounds accumulate points, reset elimination, and finish only in round three', () => {
  let s = setup(3);
  s.phase = 'collecting';
  s.deadline = 0;
  s.count = 14;
  s.calls = [{ number: 1, players: ['p0'] }];
  s.inputs = ['p2'];
  s.bomb = 1;
  s = resolve(s, 1000);
  assert.deepEqual(
    s.players.map((p) => p.points),
    [0, 0, 150],
  );
  assert.deepEqual(resolve(s, 2000), s);
  s = startRound(s, 3000);
  assert.ok(s.players.every((p) => !p.out));
  s.phase = 'collecting';
  s.deadline = 0;
  s.count = 14;
  s.calls = [{ number: 1, players: ['p0'] }];
  s.inputs = ['p2'];
  s.bomb = 1;
  s = resolve(s, 4000);
  assert.equal(s.result.finished, false);
  assert.equal(s.players[2].points, 300);
  s = startRound(s, 5000);
  s.phase = 'collecting';
  s.deadline = 0;
  s.inputs = ['p0', 'p1'];
  s.bomb = 15;
  s = resolve(s, 6000);
  assert.equal(s.result.finished, true);
  assert.deepEqual(s.result.winners, ['p2']);
});
test('third round with no survivors and zero points is a draw', () => {
  const s = setup(2);
  s.round = 3;
  s.phase = 'collecting';
  s.inputs = ['p0', 'p1'];
  s.deadline = 0;
  const r = resolve(s, 1);
  assert.equal(r.result.finished, true);
  assert.deepEqual(r.result.winners, []);
});

// Route tests execute real SQL against SQLite. Promises interleave between reads
// and writes to exercise the same CAS paths as independent Worker requests.
globalThis.__deathTestDb = {
  prepare(sql) {
    let args = [];
    const stmt = () => db.prepare(sql.replaceAll(NOW, 'test_now()'));
    return {
      bind(...x) {
        args = x;
        return this;
      },
      async first() {
        return stmt().get(...args) ?? null;
      },
      async run() {
        if (
          globalThis.__deathDelaySave &&
          sql.startsWith('UPDATE death_rooms SET state=')
        ) {
          now += globalThis.__deathDelaySave;
          globalThis.__deathDelaySave = 0;
        }
        return { meta: { changes: stmt().run(...args).changes } };
      },
    };
  },
  async batch(statements) {
    db.exec('BEGIN');
    try {
      const result = [];
      for (const s of statements) result.push(await s.run());
      db.exec('COMMIT');
      return result;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  },
};
let source = readFileSync(
  new URL('../app/api/game/route.ts', import.meta.url),
  'utf8',
)
  .replace(
    "import { rawDb } from '@/db';",
    'const rawDb = () => globalThis.__deathTestDb;',
  )
  .replaceAll(
    "'@/lib/game'",
    JSON.stringify(new URL('../lib/game.ts', import.meta.url).href),
  )
  .replaceAll(
    "'@/lib/sql'",
    JSON.stringify(new URL('../lib/sql.ts', import.meta.url).href),
  );
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
}).outputText;
const { POST } = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
);
const api = async (body) => {
  const res = await POST(
    new Request('http://localhost/api/game', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  return { status: res.status, data: await res.json() };
};
async function room(n, mode = 'individual') {
  setup();
  db.exec('DELETE FROM death_rooms');
  const host = (await api({ action: 'create', name: '방장', mode })).data;
  const list = [host];
  for (let i = 1; i < n; i++)
    list.push(
      (await api({ action: 'join', code: host.code, name: `참가${i}` })).data,
    );
  return list;
}
test('concurrent joins at capacity 14 admit only one newcomer', async () => {
  const list = await room(14),
    code = list[0].code;
  const results = await Promise.all([
    api({ action: 'join', code, name: '마지막A' }),
    api({ action: 'join', code, name: '마지막B' }),
  ]);
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.equal(
    JSON.parse(
      db.prepare('SELECT state FROM death_rooms WHERE code=?').get(code).state,
    ).players.length,
    15,
  );
});
test('real route: 15 concurrent inputs, simultaneous finalizers, one score settlement', async () => {
  const list = await room(15),
    host = list[0];
  await api({ action: 'start', code: host.code, token: host.token });
  now += 3300;
  const state = (
    await api({ action: 'sync', code: host.code, token: host.token })
  ).data;
  const results = await Promise.all(
    list.map((p) =>
      api({
        action: 'press',
        code: host.code,
        token: p.token,
        round: state.round,
        gate: state.gate,
      }),
    ),
  );
  assert.ok(results.every((r) => r.status === 200));
  now += 201;
  const end = await Promise.all(
    list.map((p) => api({ action: 'sync', code: host.code, token: p.token })),
  );
  assert.ok(end.every((r) => r.data.result?.out.length === 15));
  assert.ok(end.every((r) => r.data.count === 1));
  assert.ok(end.every((r) => r.data.players.every((p) => p.points === 0)));
});
test('authentication, host authorization and reconnection preserve identity', async () => {
  const list = await room(15),
    host = list[0],
    guest = list[1];
  assert.equal(
    (await api({ action: 'sync', code: host.code, token: 'fake' })).status,
    401,
  );
  assert.equal(
    (await api({ action: 'start', code: host.code, token: guest.token }))
      .status,
    403,
  );
  await api({ action: 'start', code: host.code, token: host.token });
  const a = (await api({ action: 'sync', code: host.code, token: guest.token }))
    .data;
  const b = (await api({ action: 'sync', code: host.code, token: guest.token }))
    .data;
  assert.equal(a.me, b.me);
  assert.equal(a.hint, b.hint);
  assert.equal(a.players.length, 15);
  assert.ok(!JSON.stringify(a).includes('key'));
});
test('simultaneous finalizers reset the bomb caller exactly once with no survival reward', async () => {
  const list = await room(15),
    host = list[0];
  await api({ action: 'start', code: host.code, token: host.token });
  const s = JSON.parse(db.prepare('SELECT state FROM death_rooms').get().state);
  s.phase = 'collecting';
  s.bomb = 15;
  s.count = 14;
  s.inputs = [s.host];
  s.deadline = now - 1;
  db.prepare('UPDATE death_rooms SET state=?').run(JSON.stringify(s));
  await Promise.all(
    list.map((p) => api({ action: 'sync', code: host.code, token: p.token })),
  );
  now += 1800;
  const end = await Promise.all(
    list.map((p) => api({ action: 'sync', code: host.code, token: p.token })),
  );
  assert.ok(end.every((r) => r.data.players.every((p) => p.points === 0)));
  assert.ok(end.every((r) => r.data.result.reason === 'BOMB'));
});
test('delayed CAS commit still starts full cooldown at actual write time', async () => {
  const [host] = await room(15);
  await api({ action: 'start', code: host.code, token: host.token });
  const s = JSON.parse(db.prepare('SELECT state FROM death_rooms').get().state);
  s.phase = 'collecting';
  s.bomb = 15;
  s.inputs = [s.host];
  s.deadline = now - 1;
  db.prepare('UPDATE death_rooms SET state=?').run(JSON.stringify(s));
  globalThis.__deathDelaySave = 700;
  const r = await api({ action: 'sync', code: host.code, token: host.token });
  assert.equal(r.data.phase, 'cooldown');
  assert.ok(r.data.unlockAt - now >= 500 && r.data.unlockAt - now <= 1500);
});
test('earlier bomb caller joins later crash penalties only after reveal', () => {
  const s = setup();
  s.bomb = 3;
  s.count = 6;
  s.calls = [{ number: 3, players: ['p0'] }];
  s.phase = 'collecting';
  s.deadline = 0;
  s.inputs = ['p1', 'p2'];
  const r = resolve(s, 1000);
  assert.deepEqual(r.result.out, ['p1', 'p2', 'p0']);
  const before = publicState(r, 'p0', 'ABC234', 5, 2799);
  assert.equal(before.result.bombNumber, null);
  assert.deepEqual(before.result.bombIds, []);
  assert.deepEqual(before.result.calls, []);
  assert.ok(!before.players.find((p) => p.id === 'p0').out);
  assert.ok(before.players.every((p) => p.points === 0));
  const after = publicState(r, 'p0', 'ABC234', 5, 2800);
  assert.equal(after.result.bombNumber, 3);
  assert.deepEqual(after.result.bombIds, ['p0']);
  assert.ok(after.players.find((p) => p.id === 'p0').out);
  assert.ok(after.players.every((p) => p.points === 0));
});
test('crash before bomb has no additional penalty; overlapping penalties deduplicate', () => {
  const s = setup();
  s.bomb = 10;
  s.count = 6;
  s.phase = 'collecting';
  s.deadline = 0;
  s.inputs = ['p1', 'p2'];
  let r = resolve(s, 1000);
  assert.deepEqual(r.result.bombIds, []);
  assert.deepEqual(r.result.out, ['p1', 'p2']);
  s.bomb = 3;
  s.calls = [{ number: 3, players: ['p1'] }];
  r = resolve(s, 1000);
  assert.deepEqual(r.result.out, ['p1', 'p2']);
  assert.deepEqual(r.result.bombIds, ['p1']);
  s.bomb = 7;
  r = resolve(s, 1000);
  assert.deepEqual(r.result.bombIds, ['p1', 'p2']);
  assert.equal(r.result.out.length, 2);
});
test('15 ends without collision, reveals original bomb, and never admits 16', () => {
  const s = setup();
  s.count = 14;
  s.bomb = 4;
  s.calls = [{ number: 4, players: ['p4'] }];
  s.phase = 'collecting';
  s.deadline = 0;
  s.inputs = ['p14'];
  const r = resolve(s, 1000);
  assert.equal(r.result.reason, 'LIMIT');
  assert.deepEqual(r.result.crashIds, []);
  assert.deepEqual(r.result.out, ['p4']);
  assert.equal(r.count, 15);
  db.prepare('UPDATE death_rooms SET state=?').run(JSON.stringify(r));
  assert.equal(press(0), 0);
});
test('14 players cannot start; 15 can; reveal cannot be skipped by host', async () => {
  const list = await room(14),
    host = list[0];
  assert.equal(
    (await api({ action: 'start', code: host.code, token: host.token })).status,
    400,
  );
  await api({ action: 'join', code: host.code, name: '15번째' });
  assert.equal(
    (await api({ action: 'start', code: host.code, token: host.token })).status,
    200,
  );
  const s = JSON.parse(db.prepare('SELECT state FROM death_rooms').get().state);
  s.phase = 'collecting';
  s.inputs = [s.host, s.players[1].id];
  s.deadline = now - 1;
  s.round = 3;
  db.prepare('UPDATE death_rooms SET state=?').run(JSON.stringify(s));
  await api({ action: 'sync', code: host.code, token: host.token });
  assert.equal(
    (await api({ action: 'restart', code: host.code, token: host.token }))
      .status,
    400,
  );
  assert.equal(
    (await api({ action: 'leave', code: host.code, token: host.token })).status,
    400,
  );
  now += 1800;
  const r = await api({ action: 'sync', code: host.code, token: host.token });
  assert.equal(r.data.result.revealed, true);
});

function persist(s) {
  db.prepare('UPDATE death_rooms SET state=?').run(JSON.stringify(s));
}
function confirm() {
  now = load().deadline + 1;
  const s = resolve(load(), now);
  persist(s);
  now = s.unlockAt;
  return s;
}
test('individual can take 1, 2, 3 for 60 total; same-window duplicates never pay', () => {
  setup();
  for (let n = 1; n <= 3; n++) {
    assert.equal(press(0, 1, n), 1);
    assert.equal(press(0, 1, n), 0);
    assert.equal(load().players[0].points, (n - 1) * n * 5);
    confirm();
  }
  assert.equal(load().players[0].points, 60);
  assert.equal(
    publicState(load(), 'p0', 'ABC234', 0, now).blockedByStreak,
    false,
  );
});
test('team third consecutive click is atomically rejected until another player confirms', () => {
  const s = setup();
  s.mode = 'team';
  persist(s);
  assert.equal(press(0), 1);
  confirm();
  assert.equal(press(0, 1, 2), 1);
  confirm();
  const before = load();
  assert.equal(before.players[0].points, 30);
  assert.equal(press(0, 1, 3), 0);
  assert.deepEqual(load(), before);
  assert.equal(
    publicState(before, 'p0', 'ABC234', 0, now).blockedByStreak,
    true,
  );
  assert.equal(press(1, 1, 3), 1);
  const pending = load();
  assert.equal(press(0, 1, 3), 0);
  assert.deepEqual(load(), pending);
  confirm();
  assert.equal(
    publicState(load(), 'p0', 'ABC234', 0, now).blockedByStreak,
    false,
  );
  assert.equal(press(0, 1, 4), 1);
  confirm();
  assert.equal(load().players[0].points, 70);
  assert.equal(load().players[1].points, 30);
  const next = startRound({ ...load(), lastPlayer: 'p0', streak: 2 }, now);
  assert.equal(next.streak, 0);
  assert.equal(next.lastPlayer, null);
  assert.equal(next.players[0].points, 70);
});
test('crash pays nothing; bomb resets all prior points only at public reveal, including team total', () => {
  const s = setup();
  s.mode = 'team';
  s.players[0].points = 160;
  s.players[1].points = 90;
  s.players[3].points = 40;
  s.bomb = 2;
  s.calls = [{ number: 2, players: ['p0'] }];
  s.count = 5;
  s.phase = 'collecting';
  s.deadline = 0;
  s.inputs = ['p1', 'p2'];
  const r = resolve(s, 1000);
  assert.equal(r.players[0].points, 0);
  assert.equal(r.players[1].points, 90);
  const before = publicState(r, 'p0', 'ABC234', 0, 2799),
    after = publicState(r, 'p0', 'ABC234', 0, 2800);
  assert.equal(before.players[0].points, 160);
  assert.equal(before.teams[0].points, 200);
  assert.equal(after.teams[0].points, 40);
  assert.equal(after.players[0].points, 0);
  assert.ok(!JSON.stringify(before).includes('beforeBombPoints'));
});
test('team winners use final sum after bomb reset and support ties', () => {
  const s = setup();
  s.mode = 'team';
  s.round = 3;
  s.players[0].points = 1000;
  s.players[1].points = 50;
  s.players[2].points = 20;
  s.players[5].points = 30;
  s.bomb = 1;
  s.calls = [{ number: 1, players: ['p0'] }];
  s.count = 3;
  s.phase = 'collecting';
  s.deadline = 0;
  s.inputs = ['p6', 'p7'];
  const r = resolve(s, 1000);
  assert.deepEqual(r.result.winnerTeams, [1, 2]);
  assert.equal(r.result.winners.length, 10);
  assert.ok(!r.result.winners.includes('p0'));
  s.mode = 'individual';
  s.players[2].points = 50;
  assert.deepEqual(resolve(s, 1000).result.winners, ['p1', 'p2']);
});
test('team API supplies initial balanced assignments and resets scores on restart', async () => {
  const list = await room(15, 'team'),
    h = list[0],
    c = { code: h.code, token: h.token };
  let r = (await api({ action: 'sync', ...c })).data;
  assert.equal(r.mode, 'team');
  assert.deepEqual(
    [0, 1, 2].map((t) => r.players.filter((p) => p.team === t).length),
    [5, 5, 5],
  );
  await api({ action: 'leave', code: h.code, token: list[4].token });
  await api({ action: 'join', code: h.code, name: '교체' });
  let s = load();
  assert.deepEqual(
    [0, 1, 2].map((t) => s.players.filter((p) => p.team === t).length),
    [5, 5, 5],
  );
  s.players[0].points = 80;
  s.round = 3;
  s.phase = 'collecting';
  s.inputs = [s.players[1].id, s.players[2].id];
  s.bomb = 15;
  s.deadline = now - 1;
  persist(s);
  await api({ action: 'sync', ...c });
  now += 4001;
  r = (await api({ action: 'restart', ...c })).data;
  assert.equal(r.phase, 'lobby');
  assert.equal(r.mode, 'team');
  assert.ok(r.players.every((p) => p.points === 0));
  assert.ok(r.teams.every((t) => t.points === 0));
  assert.equal(r.blockedByStreak, false);
  const p = (
    await api({ action: 'create', name: '봇팀', mode: 'team', practice: true })
  ).data;
  assert.deepEqual(
    [0, 1, 2].map((t) => p.players.filter((p) => p.team === t).length),
    [5, 5, 5],
  );
});

test('free team selection supports 2 or 3 teams, uneven rosters, host control and lobby-only changes', async () => {
  const list = await room(15, 'team'),
    h = list[0],
    g = list[1],
    c = { code: h.code, token: h.token },
    gc = { code: h.code, token: g.token };
  assert.equal(
    (await api({ action: 'setTeamCount', ...gc, teamCount: 2 })).status,
    403,
  );
  assert.equal(
    (await api({ action: 'setTeam', ...gc, playerId: h.me, team: 1 })).status,
    403,
  );
  assert.equal(
    (await api({ action: 'setTeamCount', ...c, teamCount: 4 })).status,
    400,
  );
  let r = (await api({ action: 'setTeamCount', ...c, teamCount: 2 })).data;
  assert.equal(r.teams.length, 2);
  assert.ok(r.players.every((p) => p.team < 2));
  assert.equal((await api({ action: 'setTeam', ...gc, team: 2 })).status, 400);
  for (const p of r.players)
    assert.equal(
      (await api({ action: 'setTeam', ...c, playerId: p.id, team: 0 })).status,
      200,
    );
  assert.equal((await api({ action: 'start', ...c })).status, 400);
  r = (await api({ action: 'setTeam', ...gc, team: 1 })).data;
  assert.deepEqual(
    [0, 1].map((t) => r.players.filter((p) => p.team === t).length),
    [14, 1],
  );
  r = (await api({ action: 'setTeamCount', ...c, teamCount: 3 })).data;
  assert.equal(r.teams.length, 3);
  assert.equal((await api({ action: 'start', ...c })).status, 400);
  await api({ action: 'setTeam', ...c, playerId: list[2].me, team: 2 });
  r = (await api({ action: 'start', ...c })).data;
  assert.equal(r.phase, 'ready');
  assert.deepEqual(
    [0, 1, 2].map((t) => r.players.filter((p) => p.team === t).length),
    [13, 1, 1],
  );
  assert.equal((await api({ action: 'setTeam', ...gc, team: 0 })).status, 400);
  assert.equal(
    (await api({ action: 'setTeamCount', ...c, teamCount: 2 })).status,
    400,
  );
});
test('two-team creation, legacy default and two-team final scoring', async () => {
  setup();
  db.exec('DELETE FROM death_rooms');
  const p = (
    await api({
      action: 'create',
      name: '2팀',
      mode: 'team',
      teamCount: 2,
      practice: true,
    })
  ).data;
  assert.equal(p.teamCount, 2);
  assert.equal(p.teams.length, 2);
  assert.deepEqual(
    [0, 1].map((t) => p.players.filter((p) => p.team === t).length),
    [8, 7],
  );
  assert.equal(
    (
      await api({
        action: 'create',
        name: '오류',
        mode: 'team',
        teamCount: '2',
      })
    ).status,
    400,
  );
  const s = setup();
  s.mode = 'team';
  s.teamCount = 2;
  s.players.forEach((p, i) => {
    p.team = i % 2;
    p.points = i % 2 ? 10 : 0;
  });
  s.round = 3;
  s.phase = 'collecting';
  s.deadline = 0;
  s.inputs = ['p0', 'p2'];
  s.bomb = 15;
  const r = resolve(s, 1000);
  assert.deepEqual(r.result.winnerTeams, [1]);
  assert.equal(publicState(r, 'p0', 'ABC234', 0, 2800).teams.length, 2);
  delete s.teamCount;
  assert.equal(publicState(s, 'p0', 'ABC234', 0, 0).teamCount, 3);
});
