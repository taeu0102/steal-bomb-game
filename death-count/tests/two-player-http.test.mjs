import assert from 'node:assert/strict';
const base = process.env.GAME_URL ?? 'http://localhost:5174';
async function api(action, extra = {}, status = 200) {
  const r = await fetch(base + '/api/game', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...extra }),
  });
  const d = await r.json();
  assert.equal(r.status, status, JSON.stringify(d));
  return d;
}
for (const mode of ['individual', 'team']) {
  const h = await api('create', { name: '2인 검증 A', mode, teamCount: 2 }),
    c = { code: h.code, token: h.token };
  await api('start', c, 400);
  const g = await api('join', { code: h.code, name: '2인 검증 B' });
  const s = await api('start', c);
  assert.equal(s.players.length, 2);
  assert.equal(s.practice, false);
  assert.ok(s.players.every((p) => !p.bot));
  assert.equal(s.phase, 'ready');
  const other = await api('sync', { code: h.code, token: g.token });
  assert.equal(other.round, 1);
  assert.equal(other.players.length, 2);
  console.log(
    JSON.stringify({ mode, players: 2, noBots: true, started: true }),
  );
}
const p = await api('create', { name: '연습', practice: true });
assert.equal(p.players.length, 15);
assert.equal(p.players.filter((p) => p.bot).length, 14);
