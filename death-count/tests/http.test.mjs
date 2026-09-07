import assert from 'node:assert/strict';
const base = process.env.GAME_URL ?? 'http://localhost:5174';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(action, extra = {}) {
  const r = await fetch(base + '/api/game', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...extra }),
  });
  const d = await r.json();
  assert.equal(r.status, 200, JSON.stringify(d));
  return d;
}
const host = await api('create', { name: 'HTTP 방장' }),
  credentials = [{ code: host.code, token: host.token }];
for (let i = 1; i < 15; i++) {
  const p = await api('join', { code: host.code, name: `HTTP ${i}` });
  credentials.push({ code: host.code, token: p.token });
}
await api('start', credentials[0]);
await sleep(3350);
const start = await Promise.all(credentials.map((c) => api('sync', c)));
assert.equal(start.filter((s) => s.hint !== null).length, 3);
assert.ok(start.every((s) => s.players.length === 15));
const begin = performance.now();
const presses = await Promise.all(
  credentials.map((c) =>
    api('press', { ...c, round: start[0].round, gate: start[0].gate }),
  ),
);
await sleep(250);
const end = await Promise.all(credentials.map((c) => api('sync', c)));
assert.ok(
  end.every((s) => s.phase === 'result' && s.result.reason === 'CRASH'),
);
const outcome = JSON.stringify(end[0].result);
assert.ok(end.every((s) => JSON.stringify(s.result) === outcome));
assert.equal(
  end[0].result.out.length,
  presses.filter((p) => p.accepted).length,
);
assert.ok(end.every((s) => s.count === 1));
assert.ok(end.every((s) => s.players.every((p) => p.points === 0)));
assert.ok(end.every((s) => s.result.bombNumber === null && !s.result.revealed));
await sleep(1850);
const revealed = await Promise.all(credentials.map((c) => api('sync', c)));
assert.ok(
  revealed.every(
    (s) =>
      s.result.revealed &&
      s.result.bombNumber >= 0 &&
      s.result.bombNumber <= 15,
  ),
);
assert.ok(
  revealed.every(
    (s) => JSON.stringify(s.result) === JSON.stringify(revealed[0].result),
  ),
);
const restored = await api('sync', credentials[4]);
assert.equal(restored.me, start[4].me);
assert.equal(restored.hint, start[4].hint);
console.log(
  JSON.stringify({
    transport: 'HTTP',
    players: 15,
    accepted: presses.filter((p) => p.accepted).length,
    result: 'CRASH',
    consistent: true,
    elapsedMs: Math.round(performance.now() - begin),
  }),
);

const practice = await api('create', { name: '연습 검증', practice: true }),
  pc = { code: practice.code, token: practice.token };
await api('start', pc);
let progressed = false;
const cutoff = Date.now() + 45000;
// Bomb hits now continue play, so a random practice round need not end in 45s.
// Verify autonomous progress here; deterministic unit tests cover all end paths.
while (Date.now() < cutoff) {
  const s = await api('sync', pc);
  if (s.phase === 'result' || s.count >= 3) {
    assert.ok(s.count >= 1 && s.count <= 15);
    progressed = true;
    console.log(
      JSON.stringify({
        practice: true,
        players: s.players.length,
        count: s.count,
        result: s.result?.reason ?? 'PROGRESSING',
      }),
    );
    break;
  }
  await sleep(140);
}
assert.ok(progressed, 'Practice bots must advance counts without host input');
