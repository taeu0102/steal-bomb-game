'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Volume2,
  VolumeX,
  ArrowUpRight,
  ArrowLeft,
  Copy,
  Radio,
  ShieldAlert,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DeathAudio } from '@/lib/audio';

type View = {
  code: string;
  revision: number;
  serverNow: number;
  phase: string;
  round: number;
  gate: number;
  count: number;
  unlockAt: number;
  host: string;
  practice: boolean;
  me: string;
  hint: string | null;
  submitted: boolean;
  players: {
    id: string;
    name: string;
    wins: number;
    bot: boolean;
    out: boolean;
  }[];
  result: null | {
    reason: string;
    crashIds: string[];
    revealed: boolean;
    revealAt: number;
    bombNumber: number | null;
    bombIds: string[];
    out: string[];
    winners: string[];
    finished: boolean;
  };
};
type Session = { code: string; token: string };
const SESSION_KEY = 'death-count-session-v1';

export default function Game() {
  const [v, setV] = useState<View | null>(null),
    [session, setSession] = useState<Session | null>(null);
  const [name, setName] = useState(''),
    [code, setCode] = useState(''),
    [joining, setJoining] = useState(false);
  const [busy, setBusy] = useState(false),
    [pressPending, setPressPending] = useState(false);
  const [error, setError] = useState(''),
    [connected, setConnected] = useState(false),
    [muted, setMuted] = useState(false);
  const [clock, setClock] = useState(0),
    [impact, setImpact] = useState(''),
    [copied, setCopied] = useState(false);
  const ref = useRef<View | null>(null),
    time = useRef({ server: 0, local: 0 }),
    lastSeen = useRef(0);
  const audio = useRef<DeathAudio | null>(null),
    sessionRef = useRef<Session | null>(null),
    working = useRef(false);
  const getAudio = () => audio.current ?? (audio.current = new DeathAudio());
  const installSession = (s: Session | null) => {
    sessionRef.current = s;
    setSession(s);
    if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(SESSION_KEY);
  };
  const apply = (data: View) => {
    const old = ref.current;
    if (
      old &&
      (data.revision < old.revision ||
        (data.revision === old.revision && data.serverNow < old.serverNow))
    )
      return;
    if (old && data.round === old.round && data.result && !old.result) {
      const kind = data.result.reason === 'CRASH' ? 'crash' : '';
      setImpact(kind);
      if (kind) getAudio().crash();
      setTimeout(() => setImpact(''), 700);
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
        navigator.vibrate?.(kind === 'crash' ? [80, 35, 100] : 100);
    } else if (old?.result && data.result?.revealed && !old.result.revealed) {
      getAudio().bomb();
      setImpact('bomb');
      setTimeout(() => setImpact(''), 700);
    } else if (old && data.count > old.count && !data.result) getAudio().safe();
    ref.current = data;
    setV(data);
    time.current = { server: data.serverNow, local: performance.now() };
    lastSeen.current = performance.now();
    setConnected(true);
  };
  async function request(
    action: string,
    extra: Record<string, unknown> = {},
    s = sessionRef.current,
  ) {
    const response = await fetch('/api/game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...s, ...extra }),
      signal: AbortSignal.timeout(8000),
    });
    const data = (await response.json()) as View & {
      token: string;
      left?: boolean;
      error?: string;
      accepted?: boolean;
    };
    if (!response.ok) throw new Error(data.error || '연결을 확인해 주세요.');
    return data;
  }
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) installSession(JSON.parse(saved));
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
    }
    const invite = new URLSearchParams(location.search).get('room');
    if (invite) {
      setCode(invite.toUpperCase());
      setJoining(true);
    }
    const interval = setInterval(() => {
      setClock(time.current.server + performance.now() - time.current.local);
      if (lastSeen.current && performance.now() - lastSeen.current > 3500)
        setConnected(false);
    }, 60);
    return () => {
      clearInterval(interval);
      audio.current?.stop();
    };
  }, []);
  useEffect(() => {
    if (!session) return;
    let gone = false,
      timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const data = await request('sync', {}, session);
        if (!gone) {
          apply(data);
          setError('');
        }
      } catch (e) {
        if (!gone) {
          setConnected(false);
          setError(e instanceof Error ? e.message : '연결을 확인해 주세요.');
        }
      }
      if (!gone)
        timer = setTimeout(
          poll,
          document.hidden
            ? 1200
            : ref.current?.phase === 'lobby' || ref.current?.phase === 'result'
              ? 650
              : 140,
        );
    };
    poll();
    return () => {
      gone = true;
      clearTimeout(timer);
    };
  }, [session]);
  useEffect(() => {
    if (!v || !['open', 'cooldown'].includes(v.phase) || muted || !connected)
      return;
    const interval = setInterval(
      () => {
        if (!document.hidden) getAudio().heartbeat(v.count);
      },
      Math.max(740, 1500 - v.count * 42),
    );
    return () => clearInterval(interval);
  }, [v?.phase, v?.count, muted, connected]);

  async function enter(action: 'create' | 'join', practice = false) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError('');
    getAudio().unlock();
    try {
      const data = await request(
        action,
        { name: name.trim() || (practice ? '나' : ''), code, practice },
        null,
      );
      const s = { code: data.code, token: data.token };
      installSession(s);
      ref.current = null;
      apply(data);
      if (practice) apply(await request('start', {}, s));
    } catch (e) {
      setError(e instanceof Error ? e.message : '입장하지 못했습니다.');
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  async function command(action: string) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError('');
    getAudio().unlock();
    try {
      const data = await request(action, { round: ref.current?.round });
      if (data.left) {
        installSession(null);
        ref.current = null;
        setV(null);
        setConnected(false);
      } else apply(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '다시 시도해 주세요.');
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  const playable =
    !!v &&
    connected &&
    !pressPending &&
    !v.submitted &&
    (v.phase === 'open' || (v.phase === 'cooldown' && clock >= v.unlockAt));
  const pressLock = useRef(false);
  async function press() {
    if (!playable || pressLock.current || !ref.current) return;
    pressLock.current = true;
    setPressPending(true);
    getAudio().unlock();
    getAudio().tap();
    const { round, gate } = ref.current;
    try {
      apply(await request('press', { round, gate }));
    } catch {
      setError('입력을 확인하고 있습니다.');
      setConnected(false);
    } finally {
      pressLock.current = false;
      setPressPending(false);
    }
  }
  async function copyRoom() {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/?room=${v!.code}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(`방 코드 ${v!.code}를 친구에게 알려 주세요.`);
    }
  }
  function sound() {
    const a = getAudio();
    a.setEnabled(muted);
    if (muted) a.unlock();
    setMuted(!muted);
  }
  const me = v?.players.find((p) => p.id === v.me),
    host = v?.host === v?.me;
  const number = String(v?.count ?? 0).padStart(2, '0');
  const alive = v?.players.filter((p) => !p.out).length ?? 15;
  const active = v && !['lobby', 'result'].includes(v.phase);

  return (
    <main className={`game ${impact} ${active ? 'in-play' : ''}`}>
      <div className="grain" aria-hidden="true" />
      <div className="edge-glow" aria-hidden="true" />
      <header className="topbar">
        <a
          href="/"
          onClick={(e) => {
            if (session) e.preventDefault();
          }}
          className="wordmark"
        >
          <span className="mark">×</span> DEATH COUNT
          <span className="edition">/ 15</span>
        </a>
        <button
          className="sound-button"
          onClick={sound}
          aria-label={muted ? '소리 켜기' : '소리 끄기'}
        >
          {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
        </button>
      </header>

      {!session ? (
        <section className="entry">
          <div className="entry-top">
            <span className="eyebrow">
              <span className="live-dot" /> REAL-TIME SURVIVAL
            </span>
            <span className="tiny">01 — 15</span>
          </div>
          <div className="title-block">
            <h1>
              누르는 순간,
              <br />
              <span>끝날 수 있다.</span>
            </h1>
            <p>같이 누르면, 같이 끝난다.</p>
          </div>
          <div className="entry-number" aria-hidden="true">
            <span>0</span>
            <span>1</span>
            <i>?</i>
            <div className="number-baseline" />
          </div>
          <div className="entry-form">
            <label htmlFor="nickname">당신의 이름</label>
            <Input
              id="nickname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={12}
              placeholder="닉네임을 입력하세요"
              autoComplete="nickname"
              className="text-field"
            />
            {joining && (
              <>
                <label htmlFor="roomcode">방 코드</label>
                <Input
                  id="roomcode"
                  value={code}
                  onChange={(e) =>
                    setCode(
                      e.target.value.replace(/[^a-z2-9]/gi, '').toUpperCase(),
                    )
                  }
                  maxLength={6}
                  placeholder="6자리 코드"
                  autoCapitalize="characters"
                  className="text-field code-field"
                />
              </>
            )}
            <Button
              className="primary"
              disabled={busy}
              onClick={() => enter(joining ? 'join' : 'create')}
            >
              {busy ? '연결 중…' : joining ? '입장하기' : '방 만들기'}
              <ArrowUpRight size={22} />
            </Button>
            <div className="entry-links">
              <button
                onClick={() => {
                  setJoining(!joining);
                  setError('');
                }}
              >
                {joining ? '새 방 만들기' : '코드로 참가'}
                <ChevronRight size={15} />
              </button>
              <button disabled={busy} onClick={() => enter('create', true)}>
                혼자 연습 <span>+ 14 BOTS</span>
              </button>
            </div>
          </div>
          <details className="rules">
            <summary>
              게임 방법 <span>+</span>
            </summary>
            <p>
              15명이 모여 1부터 숫자를 올립니다. 무작위 3명만 폭탄 힌트를
              받습니다. 0.2초 안에 두 명 이상 누르면 게임이 끝나고 함께 누른
              사람은 벌칙입니다. 이어 폭탄 숫자를 공개합니다. 앞서 그 숫자를
              누른 사람도 벌칙에 추가됩니다. 폭탄에 도달하기 전에 끝났다면 추가
              벌칙은 없습니다.
            </p>
            <p>
              생존하면 1승. 매 판 모두 다시 참가하며, 먼저 2승을 얻으면 공동
              우승도 가능합니다. 최대 3판 후에는 최고 승수가 우승하며 모두
              0승이면 무승부입니다.
            </p>
            <p>
              폭탄 숫자를 단독으로 눌러도 게임은 계속됩니다. 충돌 없이 15까지
              가면 숫자 올리기를 끝내고 폭탄 벌칙만 공개합니다. 같은 사람의
              벌칙은 중복되지 않습니다.
            </p>
            <p>15인 · 무작위 3명에게 힌트 · 방은 2시간 유지됩니다.</p>
          </details>
          <footer className="entry-footer">
            <span>데스 카운트</span>
            <span>눈치가 곧 생존이다.</span>
          </footer>
        </section>
      ) : !v ? (
        <section className="recovery">
          <span className="live-dot" />
          <h1>방에 다시 연결 중</h1>
          <p>기존 참가 정보를 복구합니다.</p>
          <button
            onClick={() => {
              installSession(null);
              setError('');
            }}
          >
            입장 화면으로
          </button>
        </section>
      ) : (
        <>
          <div className="room-strip">
            <span>
              <Radio size={13} />
              {v.practice ? '연습 · 14 BOTS' : `ROOM ${v.code}`}
            </span>
            <span className={connected ? 'online' : 'offline'}>
              {connected ? '연결됨' : '재연결 중'}
            </span>
          </div>
          {v.phase === 'lobby' ? (
            <section className="lobby">
              <span className="eyebrow">STAND BY</span>
              <h1>
                누가 먼저
                <br />
                <span>움직일까.</span>
              </h1>
              <button className="room-code" onClick={copyRoom}>
                <small>친구에게 방 코드를 알려 주세요</small>
                <strong>{v.code}</strong>
                <span>
                  <Copy size={14} />
                  {copied ? '초대 링크 복사됨' : '초대 링크 복사'}
                </span>
              </button>
              <div className="roster-head">
                <span>대기 중인 플레이어</span>
                <strong>
                  {v.players.length}
                  <small> / 15</small>
                </strong>
              </div>
              <div className="roster">
                {v.players.map((p, i) => (
                  <div className="player" key={p.id}>
                    <span className="player-no">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span>
                      {p.name}
                      {p.id === v.me && <em>나</em>}
                    </span>
                    {p.id === v.host && <small>방장</small>}
                  </div>
                ))}
              </div>
              <div className="lobby-actions">
                <Button
                  className="primary"
                  disabled={
                    busy || !connected || !host || v.players.length < 15
                  }
                  onClick={() => command('start')}
                >
                  {host
                    ? v.players.length < 15
                      ? `${15 - v.players.length}명 더 기다리는 중`
                      : '게임 시작'
                    : '방장이 시작할 때까지 대기'}
                  <ArrowUpRight size={22} />
                </Button>
                <button
                  className="quiet"
                  disabled={busy}
                  onClick={() => command('leave')}
                >
                  <ArrowLeft size={14} />방 나가기
                </button>
              </div>
            </section>
          ) : (
            <section className="arena">
              <div className="round-row">
                <span>
                  ROUND <b>{String(v.round).padStart(2, '0')}</b>
                  <small> / 03</small>
                </span>
                <div
                  className="win-marks"
                  aria-label={`내 승수 ${me?.wins ?? 0}`}
                >
                  <i className={(me?.wins ?? 0) > 0 ? 'won' : ''} />
                  <i className={(me?.wins ?? 0) > 1 ? 'won' : ''} />
                </div>
              </div>
              <div
                className="seats"
                aria-label={`생존 ${alive}명, 전체 ${v.players.length}명`}
              >
                {Array.from({ length: 15 }, (_, i) => {
                  const p = v.players[i];
                  return (
                    <i
                      key={i}
                      title={
                        p ? `${p.name}${p.out ? ' · 탈락' : ''}` : '빈 자리'
                      }
                      className={
                        !p
                          ? 'empty'
                          : p.out
                            ? 'out'
                            : p.id === v.me
                              ? 'mine'
                              : ''
                      }
                    />
                  );
                })}
              </div>
              <div
                className={`count-stage ${v.phase === 'result' ? 'ended' : ''}`}
              >
                <span className="count-label">
                  {v.phase === 'ready'
                    ? '손가락을 준비하세요'
                    : v.phase === 'result'
                      ? 'LAST NUMBER'
                      : 'CURRENT COUNT'}
                </span>
                <div className="big-count" aria-live="polite">
                  {v.phase === 'ready'
                    ? String(
                        Math.min(
                          4,
                          Math.max(1, Math.ceil((v.unlockAt - clock) / 1000)),
                        ),
                      )
                    : number}
                </div>
                <div className="count-caption">
                  {v.phase === 'result' ? (
                    v.result?.reason === 'CRASH' ? (
                      'CRASH'
                    ) : (
                      'COUNT COMPLETE'
                    )
                  ) : v.phase === 'ready' ? (
                    '곧 시작합니다.'
                  ) : (
                    <>
                      다음 숫자 <b>{String(v.count + 1).padStart(2, '0')}</b>
                      <span className="caption-rule" />
                    </>
                  )}
                </div>
              </div>
              {v.phase === 'result' ? (
                <div className="outcome">
                  <span
                    className={`outcome-tag ${me?.out ? 'lost' : 'survived'}`}
                  >
                    {!v.result?.revealed
                      ? me?.out
                        ? '충돌 벌칙 확정'
                        : '폭탄 판정 대기'
                      : me?.out
                        ? '이번 판 벌칙'
                        : '벌칙 면제 +1승'}
                  </span>
                  <h2>
                    {!v.result?.revealed
                      ? '아직, 끝난 게 아니다.'
                      : v.result?.finished
                        ? v.result.winners.length === 0
                          ? '아무도 살아남지 못했다.'
                          : v.result.winners.includes(v.me)
                            ? '끝까지 살아남았다.'
                            : '이번 승부는 여기까지.'
                        : me?.out
                          ? '벌칙을 피하지 못했다.'
                          : '이번엔 살아남았다.'}
                  </h2>
                  <p>
                    {v.result?.reason === 'CRASH'
                      ? `${v.count}에서 ${v.result.crashIds.length}명이 동시에 눌렀습니다.`
                      : '충돌 없이 15까지 도달했습니다.'}
                  </p>
                  {!!v.result?.crashIds.length && (
                    <div className="clash-names">
                      충돌 벌칙 ·{' '}
                      {v.players
                        .filter((p) => v.result!.crashIds.includes(p.id))
                        .map((p) => p.name)
                        .join(', ')}
                    </div>
                  )}
                  <div
                    className={`bomb-reveal ${v.result?.revealed ? 'is-revealed' : ''}`}
                    aria-live="polite"
                  >
                    <span>
                      {v.result?.revealed
                        ? '숨겨진 폭탄 숫자'
                        : '폭탄 숫자 공개 중'}
                    </span>
                    <strong>
                      {v.result?.revealed
                        ? String(v.result.bombNumber).padStart(2, '0')
                        : '??'}
                    </strong>
                    {!v.result?.revealed ? (
                      <p>당신이 누른 숫자를 기억하나요?</p>
                    ) : (
                      <>
                        <b>
                          {v.result.bombIds.length
                            ? `폭탄 벌칙 · ${v.players
                                .filter((p) => v.result!.bombIds.includes(p.id))
                                .map((p) => p.name)
                                .join(', ')}`
                            : '폭탄에 도달하지 않았다. 추가 벌칙 없음.'}
                        </b>
                        {!!v.result.bombIds.length && (
                          <p>
                            {v.result.bombIds.filter(
                              (id) => !v.result!.crashIds.includes(id),
                            ).length
                              ? `추가 벌칙 ${v.result.bombIds.filter((id) => !v.result!.crashIds.includes(id)).length}명`
                              : '충돌 벌칙과 겹칩니다. 벌칙은 한 번만 적용합니다.'}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  {v.result?.finished && (
                    <div className="winners">
                      {v.result.winners.length
                        ? '우승 · ' +
                          v.players
                            .filter((p) => v.result!.winners.includes(p.id))
                            .map((p) => p.name)
                            .join(', ')
                        : '전원 0승 · 무승부'}
                    </div>
                  )}
                  <div className="score-list">
                    {v.players.map((p) => (
                      <div key={p.id} className={p.id === v.me ? 'is-me' : ''}>
                        <span>
                          {p.name}
                          {p.id === v.me ? ' · 나' : ''}
                        </span>
                        <span>
                          {!v.result?.revealed
                            ? p.out
                              ? '충돌'
                              : '판정 대기'
                            : [
                                v.result.crashIds.includes(p.id) ? '충돌' : '',
                                v.result.bombIds.includes(p.id) ? '폭탄' : '',
                              ]
                                .filter(Boolean)
                                .join(' + ') || '면제'}
                        </span>
                        <b>{p.wins}승</b>
                      </div>
                    ))}
                  </div>
                  <Button
                    className="primary"
                    disabled={
                      busy ||
                      !host ||
                      !connected ||
                      !v.result?.revealed ||
                      clock < v.unlockAt
                    }
                    onClick={() =>
                      command(v.result?.finished ? 'restart' : 'next')
                    }
                  >
                    {host
                      ? v.result?.finished
                        ? '다시 모이기'
                        : '다음 라운드'
                      : '방장을 기다리는 중'}
                    <ArrowUpRight size={21} />
                  </Button>
                  {v.result?.finished && (
                    <button className="quiet" onClick={() => command('leave')}>
                      방 나가기
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="private-hint">
                    <ShieldAlert size={16} />
                    <div>
                      <span>나에게만 보이는 힌트</span>
                      <p>{v.hint ?? '이번 판에는 힌트가 없다.'}</p>
                    </div>
                  </div>
                  <div className="press-zone">
                    <div className="press-meta">
                      <span>
                        {v.submitted || pressPending
                          ? '당신의 선택을 판정 중'
                          : playable
                            ? '누를까. 기다릴까.'
                            : '잠깐의 정적.'}
                      </span>
                      <span>{alive} ALIVE</span>
                    </div>
                    <button
                      className={`death-button ${playable ? 'armed' : ''}`}
                      disabled={!playable}
                      onClick={press}
                      aria-label="카운트 올리기"
                    >
                      <span>
                        {!connected
                          ? '연결 중'
                          : v.phase === 'ready'
                            ? '준비'
                            : v.submitted || pressPending
                              ? '…'
                              : playable
                                ? '누르기'
                                : '잠깐'}
                      </span>
                      <span className="button-cross">+</span>
                    </button>
                    <p className="danger-note">겹치는 순간, 함께 끝난다.</p>
                  </div>
                </>
              )}
            </section>
          )}
        </>
      )}
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
    </main>
  );
}
