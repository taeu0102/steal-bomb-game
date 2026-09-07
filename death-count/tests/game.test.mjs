import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { newState, startRound, resolve, publicState } from '../lib/game.ts';
import { NOW, PRESS_SQL } from '../lib/sql.ts';

const player = i => ({ id:`p${i}`,key:`key${i}`,name:`플레이어${i}`,wins:0,bot:false,hint:null,out:false });
let db, now;
function setup(n=15) {
  db?.close();db=new DatabaseSync(':memory:');now=100000;
  db.function('test_now',()=>now);
  db.exec(readFileSync(new URL('../drizzle/0000_brown_vermin.sql',import.meta.url),'utf8'));
  const s=newState(player(0),false);s.players=Array.from({length:n},(_,i)=>player(i));
  s.phase='open';s.round=1;s.gate=1;s.bomb=15;
  db.prepare('INSERT INTO death_rooms VALUES(?,?,0,?)').run('ABC234',JSON.stringify(s),9999999);
  return s;
}
const load=()=>JSON.parse(db.prepare('SELECT state FROM death_rooms').get().state);
function press(i,round=1,gate=1,key=`key${i}`) {
 return db.prepare(PRESS_SQL.replaceAll(NOW,'test_now()')).run(`p${i}`,'ABC234',round,gate,`p${i}`,key,`p${i}`).changes;
}
test('15 distinct inputs share exactly one 200ms window and crash together',()=>{
 setup();for(let i=0;i<15;i++){now=100000+i*10;assert.equal(press(i),1);}
 const s=load();assert.equal(s.deadline,100200);assert.equal(s.count,0);assert.equal(s.inputs.length,15);
 const r=resolve(s,100201);assert.equal(r.result.reason,'CRASH');assert.equal(r.result.out.length,15);assert.equal(r.count,1);assert.equal(r.players.reduce((a,p)=>a+p.wins,0),0);
});
test('inclusive 200ms boundary; 201ms excluded even before finalizer runs',()=>{
 setup();press(0);now+=200;assert.equal(press(1),1);now++;assert.equal(press(2),0);assert.deepEqual(load().inputs,['p0','p1']);
});
test('duplicate player, forged token and stale gate cannot change the count',()=>{
 setup();assert.equal(press(0),1);assert.equal(press(0),0);assert.equal(press(1,1,1,'wrong'),0);assert.equal(press(1,1,0),0);assert.equal(press(1,0,1),0);assert.equal(load().inputs.length,1);
});
test('single trap defers until deadline; crash overrides original trap',()=>{
 let s=setup();s.bomb=1;s.phase='collecting';s.inputs=['p0'];s.deadline=100200;
 assert.equal(resolve(s,100200).phase,'collecting');assert.equal(resolve(s,100201).result.reason,'BOMB');
 s.inputs.push('p1');const r=resolve(s,100201);assert.equal(r.result.reason,'CRASH');assert.equal(r.players.filter(p=>p.out).length,2);
});
test('safe count produces one 500–1500ms cooldown and exact unlock admits input',()=>{
 setup();press(0);let r=resolve(load(),100201);assert.equal(r.phase,'cooldown');assert.equal(r.gate,2);assert.ok(r.unlockAt-100201>=500&&r.unlockAt-100201<=1500);
 db.prepare('UPDATE death_rooms SET state=?').run(JSON.stringify(r));now=r.unlockAt-1;assert.equal(press(1,1,2),0);now++;assert.equal(press(1,1,2),1);
 assert.equal(load().deadline,now+200);
});
test('only 3 truthful personal hints; snapshot contains no secret state',()=>{
 const s=startRound(setup(),now);assert.equal(s.players.filter(p=>p.hint).length,3);
 for(const p of s.players){if(p.hint?.includes('홀수'))assert.equal(s.bomb%2,1);if(p.hint?.includes('짝수'))assert.equal(s.bomb%2,0);if(p.hint?.includes('이상'))assert.ok(s.bomb>=10);if(p.hint?.includes('미만'))assert.ok(s.bomb<10);
 const pub=publicState(s,p.id,'ABC234',0,now);assert.equal(pub.hint,p.hint);assert.ok(!('bomb'in pub));assert.ok(!('deadline'in pub));assert.ok(pub.players.every(p=>!('key'in p)&&!('hint'in p)));}
});
test('best of three awards survival once, resets elimination, permits joint winners',()=>{
 let s=setup(3);s.phase='collecting';s.deadline=0;s.inputs=['p0'];s.bomb=1;
 s=resolve(s,1000);assert.deepEqual(s.players.map(p=>p.wins),[0,1,1]);assert.deepEqual(resolve(s,2000),s);
 s=startRound(s,3000);assert.ok(s.players.every(p=>!p.out));s.phase='collecting';s.deadline=0;s.inputs=['p0'];s.bomb=1;
 s=resolve(s,4000);assert.equal(s.result.finished,true);assert.deepEqual(s.result.winners,['p1','p2']);
});
test('third round with no survivors and zero wins is a draw',()=>{
 const s=setup(2);s.round=3;s.phase='collecting';s.inputs=['p0','p1'];s.deadline=0;
 const r=resolve(s,1);assert.equal(r.result.finished,true);assert.deepEqual(r.result.winners,[]);
});

// Route tests execute real SQL against SQLite. Promises interleave between reads
// and writes to exercise the same CAS paths as independent Worker requests.
globalThis.__deathTestDb={prepare(sql){let args=[];const stmt=()=>db.prepare(sql.replaceAll(NOW,'test_now()'));return{
 bind(...x){args=x;return this;},async first(){return stmt().get(...args)??null;},async run(){if(globalThis.__deathDelaySave&&sql.startsWith('UPDATE death_rooms SET state=')){now+=globalThis.__deathDelaySave;globalThis.__deathDelaySave=0;}return{meta:{changes:stmt().run(...args).changes}};}
};},async batch(statements){db.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};
let source=readFileSync(new URL('../app/api/game/route.ts',import.meta.url),'utf8')
 .replace("import { rawDb } from '@/db';",'const rawDb = () => globalThis.__deathTestDb;')
 .replaceAll("'@/lib/game'",JSON.stringify(new URL('../lib/game.ts',import.meta.url).href))
 .replaceAll("'@/lib/sql'",JSON.stringify(new URL('../lib/sql.ts',import.meta.url).href));
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {POST}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const api=async body=>{const res=await POST(new Request('http://localhost/api/game',{method:'POST',body:JSON.stringify(body),headers:{'Content-Type':'application/json'}}));return{status:res.status,data:await res.json()};};
async function room(n){setup();db.exec('DELETE FROM death_rooms');const host=(await api({action:'create',name:'방장'})).data;const list=[host];for(let i=1;i<n;i++)list.push((await api({action:'join',code:host.code,name:`참가${i}`})).data);return list;}
test('concurrent joins at capacity 14 admit only one newcomer',async()=>{
 const list=await room(14),code=list[0].code;
 const results=await Promise.all([api({action:'join',code,name:'마지막A'}),api({action:'join',code,name:'마지막B'})]);
 assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(JSON.parse(db.prepare('SELECT state FROM death_rooms WHERE code=?').get(code).state).players.length,15);
});
test('real route: 15 concurrent inputs, simultaneous finalizers, one score settlement',async()=>{
 const list=await room(15),host=list[0];await api({action:'start',code:host.code,token:host.token});now+=3300;
 const state=(await api({action:'sync',code:host.code,token:host.token})).data;
 const results=await Promise.all(list.map(p=>api({action:'press',code:host.code,token:p.token,round:state.round,gate:state.gate})));
 assert.ok(results.every(r=>r.status===200));now+=201;
 const end=await Promise.all(list.map(p=>api({action:'sync',code:host.code,token:p.token})));
 assert.ok(end.every(r=>r.data.result?.out.length===15));assert.ok(end.every(r=>r.data.count===1));assert.ok(end.every(r=>r.data.players.every(p=>p.wins===0)));
});
test('authentication, host authorization and reconnection preserve identity',async()=>{
 const list=await room(2),host=list[0],guest=list[1];
 assert.equal((await api({action:'sync',code:host.code,token:'fake'})).status,401);
 assert.equal((await api({action:'start',code:host.code,token:guest.token})).status,403);
 await api({action:'start',code:host.code,token:host.token});const a=(await api({action:'sync',code:host.code,token:guest.token})).data;
 const b=(await api({action:'sync',code:host.code,token:guest.token})).data;assert.equal(a.me,b.me);assert.equal(a.hint,b.hint);assert.equal(a.players.length,2);assert.ok(!JSON.stringify(a).includes('key'));
});
test('simultaneous finalizers give 14 survivors exactly one win',async()=>{
 const list=await room(15),host=list[0];await api({action:'start',code:host.code,token:host.token});
 const s=JSON.parse(db.prepare('SELECT state FROM death_rooms').get().state);s.phase='collecting';s.bomb=1;s.inputs=[s.host];s.deadline=now-1;
 db.prepare('UPDATE death_rooms SET state=?').run(JSON.stringify(s));
 const end=await Promise.all(list.map(p=>api({action:'sync',code:host.code,token:p.token})));
 assert.ok(end.every(r=>r.data.players.filter(p=>p.wins===1).length===14));assert.ok(end.every(r=>r.data.result.reason==='BOMB'));
});
test('delayed CAS commit still starts full cooldown at actual write time',async()=>{
 const [host]=await room(2);await api({action:'start',code:host.code,token:host.token});
 const s=JSON.parse(db.prepare('SELECT state FROM death_rooms').get().state);s.phase='collecting';s.bomb=15;s.inputs=[s.host];s.deadline=now-1;
 db.prepare('UPDATE death_rooms SET state=?').run(JSON.stringify(s));globalThis.__deathDelaySave=700;
 const r=await api({action:'sync',code:host.code,token:host.token});assert.equal(r.data.phase,'cooldown');assert.ok(r.data.unlockAt-now>=500&&r.data.unlockAt-now<=1500);
});
