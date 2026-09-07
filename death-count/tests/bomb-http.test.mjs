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
const h = await api('create', {
    name: '폭탄 검증',
    mode: 'team',
    teamCount: 2,
  }),
  a = { code: h.code, token: h.token };
let b;
for (let i = 1; i < 15; i++) {
  const p = await api('join', { code: h.code, name: `검증${i}` });
  if (i === 1) b = { code: h.code, token: p.token };
}
let v = await api('start', a);
for (let n = 1; n <= 15; n++) {
  await sleep(Math.max(0, v.unlockAt - v.serverNow) + 80);
  v = await api('sync', a);
  const c = n % 2 ? a : b;
  const accepted = await api('press', { ...c, round: v.round, gate: v.gate });
  assert.equal(accepted.accepted, true);
  await sleep(230);
  v = await api('sync', a);
  assert.equal(v.count, n);
  if (v.phase === 'result') {
    assert.equal(v.result.reason, 'BOMB');
    assert.equal(v.result.revealed, true);
    assert.equal(v.result.bombNumber, n);
    assert.equal(v.result.bombIds.length, 1);
    assert.equal(v.players.find((p) => p.id === v.result.bombIds[0]).points, 0);
    const denied = await api('press', { ...a, round: v.round, gate: v.gate });
    assert.equal(denied.accepted, false);
    assert.equal(denied.count, n);
    console.log(
      JSON.stringify({
        anonymous: true,
        players: 15,
        bomb: n,
        immediateRoundEnd: true,
        scoreReset: true,
        nextInputRejected: true,
      }),
    );
    process.exit(0);
  }
  assert.equal(v.phase, 'cooldown');
}
assert.fail('Bomb must end the round by count 15');
