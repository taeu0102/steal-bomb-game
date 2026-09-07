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
const host = await api('create', {
    name: '팀 검증 A',
    mode: 'team',
    teamCount: 2,
  }),
  a = { code: host.code, token: host.token };
let b;
for (let i = 1; i < 15; i++) {
  const p = await api('join', { code: a.code, name: `팀 검증 ${i}` });
  if (i === 1) b = { code: a.code, token: p.token };
}
let v = await api('sync', a);
assert.equal(v.teamCount, 2);
assert.equal(v.teams.length, 2);
v = await api('setTeamCount', { ...a, teamCount: 3 });
assert.equal(v.teams.length, 3);
v = await api('setTeam', { ...b, team: 2 });
assert.equal(v.players.find((p) => p.id === v.me).team, 2);
v = await api('setTeamCount', { ...a, teamCount: 2 });
assert.ok(v.players.every((p) => p.team < 2));
v = await api('setTeam', { ...b, team: 0 });
assert.equal(v.players.find((p) => p.id === v.me).team, 0);
v = await api('start', a);
assert.equal(v.mode, 'team');
assert.deepEqual(
  [0, 1].map((t) => v.players.filter((p) => p.team === t).length),
  [9, 6],
);
async function ready() {
  v = await api('sync', a);
  if (v.unlockAt > v.serverNow) await sleep(v.unlockAt - v.serverNow + 80);
  v = await api('sync', a);
}
async function single(c, n) {
  await ready();
  const p = await api('press', { ...c, round: v.round, gate: v.gate });
  assert.equal(p.accepted, true);
  await sleep(250);
  v = await api('sync', a);
  assert.equal(v.count, n);
  if (v.result?.reason === 'BOMB') {
    assert.equal(v.result.revealed, true);
    assert.equal(v.result.bombNumber, n);
    assert.ok(
      v.players
        .filter((p) => v.result.bombIds.includes(p.id))
        .every((p) => p.points === 0),
    );
    console.log(
      JSON.stringify({
        mode: 'team',
        freeTeamSelection: true,
        teamSizes: [9, 6],
        bombStoppedAt: n,
      }),
    );
    process.exit(0);
  }
  assert.equal(v.phase, 'cooldown');
}
await single(a, 1);
await single(a, 2);
assert.equal(v.players.find((p) => p.id === v.me).points, 30);
assert.equal(v.blockedByStreak, true);
await ready();
const blocked = await api('press', { ...a, round: v.round, gate: v.gate });
assert.equal(blocked.accepted, false);
assert.equal(blocked.count, 2);
await single(b, 3);
assert.equal(v.blockedByStreak, false);
await single(a, 4);
assert.equal(v.players.find((p) => p.id === v.me).points, 70);
assert.equal(
  v.teams.reduce((sum, t) => sum + t.points, 0),
  100,
);
const solo = await api('create', { name: '개인전 검증' });
assert.equal(solo.mode, 'individual');
assert.deepEqual(solo.teams, []);
console.log(
  JSON.stringify({
    transport: 'anonymous HTTP',
    mode: 'team',
    players: 15,
    teamSizes: [9, 6],
    freeTeamSelection: true,
    switchBetweenTwoAndThree: true,
    counts: 4,
    aPoints: 70,
    bPoints: 30,
    thirdConsecutiveRejected: true,
    reEnabledAfterOther: true,
    individualAvailable: true,
  }),
);
