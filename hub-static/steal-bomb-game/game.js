const MIN_PLAYERS = 3;
const MAX_PLAYERS = 8;
const MAX_TURNS = 3;
const ACTION_SECONDS = 15;
const STARTING_CHIPS = 100;
const BASE_ANTE = 10;
const BOMB_PENALTY = 25;
const LOSER_PENALTY = 10;
const TOTAL_BOMBS = 5;
const BOMB_JACKPOT_COUNT = 3;
const PROJECT_CONFIG = window.STEAL_BOMB_CONFIG || {};
const SUPABASE_URL = PROJECT_CONFIG.supabaseUrl;
const SUPABASE_PUBLIC_KEY = PROJECT_CONFIG.supabaseAnonKey;

const roomState = {
  client: null,
  channel: null,
  room: null,
  playerKey: localStorage.getItem("steal-bomb-player-key") || crypto.randomUUID(),
  playerName: localStorage.getItem("steal-bomb-player-name") || "",
  mode: localStorage.getItem("steal-bomb-mode") || "solo",
  botTimer: null,
  busy: false,
};

const uiState = {
  timerId: null,
  lastTickSecond: null,
  resolvingTimeout: false,
  lastQuoteKey: "",
  lastPressureActionId: 0,
  voiceRoomCode: "",
  voiceLimit: 0,
  voiceCount: 0,
  quoteTimer: null,
};

const audioState = {
  context: null,
  muted: localStorage.getItem("steal-bomb-sound-muted") === "1",
  quoteAudio: null,
  musicGain: null,
  musicFilter: null,
  musicTimer: null,
  musicStep: 0,
};

localStorage.setItem("steal-bomb-player-key", roomState.playerKey);

const el = {
  playerCount: document.querySelector("#playerCount"),
  newGameBtn: document.querySelector("#newGameBtn"),
  soundToggle: document.querySelector("#soundToggle"),
  soloModeBtn: document.querySelector("#soloModeBtn"),
  multiModeBtn: document.querySelector("#multiModeBtn"),
  joinForm: document.querySelector("#joinForm"),
  playerName: document.querySelector("#playerName"),
  roomCodeInput: document.querySelector("#roomCodeInput"),
  lobbyPanel: document.querySelector("#lobbyPanel"),
  lobbyTitle: document.querySelector("#lobbyTitle"),
  lobbyHint: document.querySelector("#lobbyHint"),
  roomCodeBadge: document.querySelector("#roomCodeBadge"),
  copyRoomBtn: document.querySelector("#copyRoomBtn"),
  startRoomBtn: document.querySelector("#startRoomBtn"),
  phaseLabel: document.querySelector("#phaseLabel"),
  turnTitle: document.querySelector("#turnTitle"),
  roundPill: document.querySelector("#roundPill"),
  stakePill: document.querySelector("#stakePill"),
  riskPill: document.querySelector("#riskPill"),
  lastTurnPill: document.querySelector("#lastTurnPill"),
  actionTimer: document.querySelector("#actionTimer"),
  timerValue: document.querySelector("#timerValue"),
  timerLabel: document.querySelector("#timerLabel"),
  timerBar: document.querySelector("#timerBar"),
  deckCount: document.querySelector("#deckCount"),
  discardCard: document.querySelector("#discardCard"),
  tableWrap: document.querySelector(".table-wrap"),
  table: document.querySelector(".table"),
  tableJackpot: document.querySelector("#tableJackpot"),
  bombToken: document.querySelector(".bomb-token"),
  seatLayer: document.querySelector("#seatLayer"),
  playerStatus: document.querySelector("#playerStatus"),
  currentHint: document.querySelector("#currentHint"),
  logList: document.querySelector("#logList"),
  handInsight: document.querySelector("#handInsight"),
  jokboHint: document.querySelector("#jokboHint"),
  jokboList: document.querySelector("#jokboList"),
  myHand: document.querySelector("#myHand"),
  myBest: document.querySelector("#myBest"),
  myTip: document.querySelector("#myTip"),
  primaryAction: document.querySelector("#primaryAction"),
  fastAction: document.querySelector("#fastAction"),
  quoteToast: document.querySelector("#quoteToast"),
  choiceModal: document.querySelector("#choiceModal"),
  modalKicker: document.querySelector("#modalKicker"),
  modalTitle: document.querySelector("#modalTitle"),
  modalCopy: document.querySelector("#modalCopy"),
  modalCards: document.querySelector("#modalCards"),
  modalTimer: document.querySelector("#modalTimer"),
  closeModalBtn: document.querySelector("#closeModalBtn"),
};

const JOKBO_ROWS = [
  { category: "gwang", title: "광땡", detail: "1·3·8월 광패 조합. 판을 뒤집는 최상위 족보입니다.", example: "삼팔광땡" },
  { category: "ddang", title: "땡", detail: "같은 월 2장. 10땡이 가장 높고 1땡이 가장 낮습니다.", example: "10땡" },
  { category: "special", title: "특수 족보", detail: "알리, 독사, 구삥, 장삥, 장사, 세륙 순으로 강합니다.", example: "1월+2월" },
  { category: "gut", title: "끗", detail: "두 월의 합 끝자리. 9끗은 갑오로 강하게 봅니다.", example: "갑오" },
  { category: "mangtong", title: "망통", detail: "합 끝자리가 0이면 최하위 일반 족보입니다.", example: "4월+6월" },
  { category: "bomb", title: "폭탄", detail: "폭탄 1~2장은 위험하지만, 3장 이상 모으면 최종 1위가 됩니다.", example: "3장 승리" },
];

const QUOTES = {
  room: ["내가 빙다리 핫바지로 보이냐."],
  solo: ["내가 달건이 생활을 열일곱에 시작했다...", "아수라발발타"],
  start: ["아수라발발타", "싸움은 기술이 아니라 담대함이지."],
  turn: ["싸움은 기술이 아니라 담대함이지.", "후달리냐?"],
  draw: ["손은 눈보다 빠르니까.", "후달리냐?"],
  double: ["묻고 더블로 가!"],
  steal: ["내가 빙다리 핫바지로 보이냐.", "손은 눈보다 빠르니까."],
  targeted: ["내가 빙다리 핫바지로 보이냐."],
  bomb: ["싸늘하다. 가슴에 비수가 날아와 꽂힌다. 하지만 걱정하지 마라. 손은 눈보다 빠르니까."],
  pressure: ["후달리냐?"],
  timeout: ["후달리냐?", "싸늘하다. 가슴에 비수가 날아와 꽂힌다. 하지만 걱정하지 마라. 손은 눈보다 빠르니까."],
  finish: ["싸움은 기술이 아니라 담대함이지."],
  win: ["묻고 더블로 가!"],
  lose: ["내가 빙다리 핫바지로 보이냐."],
  needPlayers: ["세 명은 모여야 진짜 판이 열립니다."],
};

const QUOTE_AUDIO = {
  "내가 빙다리 핫바지로 보이냐.": "bingdari.wav",
  "후달리냐?": "hudallinya.wav",
  "아수라발발타": "asura.wav",
  "싸늘하다. 가슴에 비수가 날아와 꽂힌다. 하지만 걱정하지 마라. 손은 눈보다 빠르니까.": "cold-dagger.wav",
  "손은 눈보다 빠르니까.": "faster-than-eyes.wav",
  "묻고 더블로 가!": "double.wav",
  "싸움은 기술이 아니라 담대함이지.": "boldness.wav",
  "내가 달건이 생활을 열일곱에 시작했다...": "seventeen.wav",
  "세 명은 모여야 진짜 판이 열립니다.": "need-players.wav",
};

const VOICE_QUOTE_KINDS = new Set(["room", "solo", "start", "double", "targeted", "bomb", "timeout", "finish", "win", "lose", "needPlayers"]);

const BOT_NAMES = ["검은손", "밤패", "은빛눈", "묵패", "불씨", "그림자", "끝장"];

let cardSeq = 1;

function assertConfig() {
  if (!SUPABASE_URL || !SUPABASE_PUBLIC_KEY || SUPABASE_PUBLIC_KEY.includes("replace_me")) {
    el.phaseLabel.textContent = "설정 필요";
    el.turnTitle.textContent = "Supabase 공개 키 설정이 필요합니다";
    el.lobbyHint.textContent = "Vercel 환경변수 SUPABASE_URL과 SUPABASE_ANON_KEY 또는 SUPABASE_PUBLISHABLE_KEY를 설정한 뒤 다시 배포하세요.";
    throw new Error("Missing Supabase config");
  }
}

function initSupabase() {
  assertConfig();
  roomState.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);
}

function makeCard(month, variant) {
  return {
    id: `c${cardSeq++}`,
    kind: "month",
    month,
    gwang: [1, 3, 8].includes(month) && variant === 0,
    variant,
  };
}

function makeBomb() {
  return {
    id: `b${cardSeq++}`,
    kind: "bomb",
    month: 0,
    gwang: false,
    variant: 0,
  };
}

function buildDeck(playerCount) {
  cardSeq = 1;
  const deck = [];
  for (let variant = 0; variant < 4; variant += 1) {
    for (let month = 1; month <= 10; month += 1) {
      deck.push(makeCard(month, variant));
    }
  }
  for (let i = 0; i < TOTAL_BOMBS; i += 1) deck.push(makeBomb());
  return shuffle(deck);
}

function shuffle(cards) {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function generateRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function getRoomCodeFromUrl() {
  return new URLSearchParams(location.search).get("room")?.toUpperCase() || "";
}

function buildInviteUrl(code) {
  const url = new URL(location.href);
  url.searchParams.set("room", code);
  return url.toString();
}

function normalizeName(name) {
  return name.trim().slice(0, 16) || `P${Math.floor(Math.random() * 90) + 10}`;
}

function initialState({ code, maxPlayers, hostName, mode }) {
  return {
    roomCode: code,
    maxPlayers,
    mode,
    status: "lobby",
    hostKey: roomState.playerKey,
    players: [
      {
        key: roomState.playerKey,
        name: hostName,
        seat: 0,
        isBot: false,
        chips: STARTING_CHIPS,
        chipDelta: 0,
        joinedAt: new Date().toISOString(),
      },
    ],
    deck: [],
    discard: [],
    lastDiscard: null,
    phase: "lobby",
    currentSeat: 0,
    pending: null,
    pot: 0,
    stakesSettled: false,
    deadlineAt: null,
    actionSeconds: ACTION_SECONDS,
    actionId: 0,
    logs: [`${hostName}님이 방을 만들었습니다.`],
    results: [],
  };
}

function addBotPlayers(game) {
  const needed = Math.max(0, game.maxPlayers - game.players.length);
  for (let i = 0; i < needed; i += 1) {
    const seat = game.players.length;
    game.players.push({
      key: `bot-${game.roomCode}-${seat}`,
      name: BOT_NAMES[i % BOT_NAMES.length],
      seat,
      isBot: true,
      chips: STARTING_CHIPS,
      chipDelta: 0,
      joinedAt: new Date().toISOString(),
    });
  }
}

function dealGame(game, autoOpenBots = false) {
  const deck = buildDeck(game.players.length);
  game.players.sort((a, b) => a.seat - b.seat);
  game.pot = 0;
  game.stakesSettled = false;
  game.players.forEach((player) => {
    player.chips = Number.isFinite(player.chips) ? player.chips : STARTING_CHIPS;
    player.chips = Math.max(0, player.chips - BASE_ANTE);
    player.chipDelta = -BASE_ANTE;
    game.pot += BASE_ANTE;
    player.hand = [deck.pop(), deck.pop(), deck.pop()].map((card) => ({ card, open: false }));
    player.turns = 0;
    selectBestCards(player);
    if (autoOpenBots && player.isBot) {
      openCardForPlayer(player, chooseInitialOpenIndex(player));
    }
  });
  game.deck = deck;
  game.discard = [];
  game.lastDiscard = null;
  game.status = "playing";
  game.currentSeat = 0;
  game.results = [];
  enterPhase(game, "chooseOpen", null);
  if (autoOpenBots) {
    addLog(game, "AI 봇들이 공개패를 선택했습니다. 이제 내 공개패를 고르세요.");
  } else {
    addLog(game, "게임을 시작했습니다. 15초 안에 공개패를 선택하세요.");
  }
}

function getGame() {
  return roomState.room?.state || null;
}

function myPlayer(game = getGame()) {
  return game?.players.find((player) => player.key === roomState.playerKey) || null;
}

function nextSeat(game, seat) {
  const activeSeats = game.players.map((player) => player.seat).sort((a, b) => a - b);
  const index = activeSeats.indexOf(seat);
  return activeSeats[(index + 1) % activeSeats.length];
}

function playerBySeat(game, seat) {
  return game.players.find((player) => player.seat === seat);
}

function addLog(game, message) {
  game.logs = [message, ...(game.logs || [])].slice(0, 14);
}

function setDeadline(game, seconds = ACTION_SECONDS) {
  game.actionSeconds = seconds;
  game.actionId = (game.actionId || 0) + 1;
  game.deadlineAt = new Date(Date.now() + seconds * 1000).toISOString();
}

function clearDeadline(game) {
  game.actionId = (game.actionId || 0) + 1;
  game.deadlineAt = null;
}

function enterPhase(game, phase, pending = game.pending) {
  game.phase = phase;
  game.pending = pending;
  if (["chooseOpen", "turn", "replace", "steal", "return"].includes(phase)) {
    setDeadline(game);
  } else {
    clearDeadline(game);
  }
}

async function saveGame(mutator) {
  if (!roomState.room || roomState.busy) return false;
  roomState.busy = true;
  try {
    const game = structuredClone(getGame());
    const result = mutator(game);
    if (result === false) return false;

    const { data, error } = await roomState.client
      .from("card_game_rooms")
      .update({ state: game, status: game.status })
      .eq("room_code", roomState.room.room_code)
      .select()
      .single();

    if (error) throw error;
    setRoom(data);
    return true;
  } catch (error) {
    console.error(error);
    alert(`처리 중 오류가 발생했습니다: ${error.message}`);
    return false;
  } finally {
    roomState.busy = false;
  }
}

async function createRoom() {
  playSound("click");
  const name = normalizeName(el.playerName.value);
  const maxPlayers = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Number(el.playerCount.value) || 6));
  const mode = roomState.mode === "multi" ? "multi" : "solo";
  el.playerCount.value = String(maxPlayers);
  roomState.playerName = name;
  localStorage.setItem("steal-bomb-player-name", name);

  const code = generateRoomCode();
  const state = initialState({ code, maxPlayers, hostName: name, mode });
  if (mode === "solo") {
    addBotPlayers(state);
    dealGame(state, true);
    addLog(state, `${maxPlayers - 1}명의 AI 봇이 판에 앉았습니다.`);
  }
  const { data, error } = await roomState.client
    .from("card_game_rooms")
    .insert({
      room_code: code,
      max_players: maxPlayers,
      status: state.status,
      state,
    })
    .select()
    .single();

  if (error) {
    alert(`방 생성 실패: ${error.message}`);
    return;
  }

  history.replaceState(null, "", buildInviteUrl(code));
  setRoom(data);
  subscribeRoom(code);
  playSound(mode === "solo" ? "start" : "room");
  showQuote(mode === "solo" ? "solo" : "room");
}

async function joinRoom(code, name) {
  playSound("click");
  const roomCode = code.trim().toUpperCase();
  if (!roomCode) {
    alert("방 코드를 입력하세요.");
    return;
  }

  roomState.playerName = normalizeName(name);
  localStorage.setItem("steal-bomb-player-name", roomState.playerName);

  const { data, error } = await roomState.client
    .from("card_game_rooms")
    .select("*")
    .eq("room_code", roomCode)
    .single();

  if (error || !data) {
    alert("방을 찾을 수 없습니다.");
    return;
  }

  const game = data.state;
  let player = game.players.find((item) => item.key === roomState.playerKey);
  if (!player) {
    if (game.mode === "solo") {
      alert("1인 연습 방에는 다른 사용자가 참가할 수 없습니다. 다인 모드로 새 방을 만들어주세요.");
      return;
    }
    if (game.status !== "lobby") {
      alert("이미 시작된 방에는 새로 참가할 수 없습니다.");
      return;
    }
    if (game.players.length >= data.max_players) {
      alert("방 인원이 가득 찼습니다.");
      return;
    }
    const usedSeats = new Set(game.players.map((item) => item.seat));
    const seat = Array.from({ length: data.max_players }, (_, index) => index).find((index) => !usedSeats.has(index));
    player = {
      key: roomState.playerKey,
      name: roomState.playerName,
      seat,
      isBot: false,
      chips: STARTING_CHIPS,
      chipDelta: 0,
      joinedAt: new Date().toISOString(),
    };
    game.players.push(player);
    addLog(game, `${roomState.playerName}님이 참가했습니다.`);

    const updated = await roomState.client
      .from("card_game_rooms")
      .update({ state: game })
      .eq("room_code", roomCode)
      .select()
      .single();

    if (updated.error) {
      alert(`참가 실패: ${updated.error.message}`);
      return;
    }
    setRoom(updated.data);
  } else {
    setRoom(data);
  }

  history.replaceState(null, "", buildInviteUrl(roomCode));
  subscribeRoom(roomCode);
  playSound("join");
}

function setRoom(room) {
  const previous = roomState.room?.state || null;
  roomState.room = room;
  if (room.state?.mode && roomState.mode !== room.state.mode) {
    roomState.mode = room.state.mode;
    localStorage.setItem("steal-bomb-mode", roomState.mode);
    updateModeUI();
  }
  reactToRoomChange(previous, room.state);
  render();
  scheduleBotAction();
}

function subscribeRoom(code) {
  if (roomState.channel) roomState.client.removeChannel(roomState.channel);
  roomState.channel = roomState.client
    .channel(`card-game-room-${code}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "card_game_rooms",
        filter: `room_code=eq.${code}`,
      },
      (payload) => setRoom(payload.new),
    )
    .subscribe();
}

function startGame() {
  playSound("click");
  const game = getGame();
  if (!game || myPlayer(game)?.key !== game.hostKey) return;
  if (game.players.length < MIN_PLAYERS) {
    alert("최소 3명이 필요합니다.");
    showQuote("needPlayers");
    return;
  }

  saveGame((next) => {
    dealGame(next, next.mode === "solo");
  });
  playSound("start");
  showQuote("start");
}

function chooseOpen(index) {
  playSound("click");
  const game = getGame();
  const me = myPlayer(game);
  if (!game || !me || game.phase !== "chooseOpen" || me.hand?.some((slot) => slot.open)) return;

  saveGame((next) => {
    const player = next.players.find((item) => item.key === roomState.playerKey);
    if (!player || player.hand?.some((slot) => slot.open)) return false;
    openCardForPlayer(player, index);
    addLog(next, `${player.name}님이 공개패를 선택했습니다.`);
    if (next.players.every((item) => item.hand?.some((slot) => slot.open))) {
      enterPhase(next, "turn", null);
      next.currentSeat = next.players[0].seat;
      addLog(next, `${playerBySeat(next, next.currentSeat).name}님의 차례입니다.`);
    }
  });
}

function drawCard() {
  playSound("click");
  const game = getGame();
  const me = myPlayer(game);
  if (!game || !me || game.phase !== "turn" || game.currentSeat !== me.seat) return;

  saveGame((next) => {
    drawForSeat(next, me.seat, `${me.name}님이 카드를 뽑았습니다.`);
  });
  playSound("draw");
  showQuote("draw");
}

function chooseReplace(shouldReplace) {
  playSound("click");
  const game = getGame();
  const me = myPlayer(game);
  if (!game || !me || game.phase !== "replace" || game.pending?.playerSeat !== me.seat) return;

  saveGame((next) => {
    replaceForSeat(next, me.seat, shouldReplace);
  });
  showQuote(shouldReplace ? "double" : "turn");
}

function toggleUseCard(index) {
  playSound("click");
  const game = getGame();
  const me = myPlayer(game);
  if (!game || !me?.hand?.[index]) return;
  const card = me.hand[index].card;

  saveGame((next) => {
    const player = next.players.find((item) => item.key === roomState.playerKey);
    if (!player?.hand?.some((slot) => slot.card.id === card.id)) return false;
    sanitizeSelectedCards(player);
    const selected = [...(player.selectedCardIds || [])];
    if (selected.includes(card.id)) return false;
    if (selected.length >= 2) selected.shift();
    selected.push(card.id);
    player.selectedCardIds = selected;
    addLog(next, `${player.name}님이 사용할 패를 선택했습니다.`);
  });
}

function stealCard(index) {
  playSound("click");
  const game = getGame();
  const me = myPlayer(game);
  if (!game || !me || game.phase !== "steal" || game.pending?.stealerSeat !== me.seat) return;

  saveGame((next) => {
    stealForSeat(next, me.seat, index);
  });
  playSound("steal");
  showQuote("steal");
}

function returnCard(index) {
  playSound("click");
  const game = getGame();
  const me = myPlayer(game);
  if (!game || !me || game.phase !== "return" || game.pending?.stealerSeat !== me.seat) return;

  saveGame((next) => {
    returnForSeat(next, me.seat, index);
  });
}

function openCardForPlayer(player, index) {
  const safeIndex = player.hand[index] ? index : chooseInitialOpenIndex(player);
  player.hand.forEach((slot, slotIndex) => {
    slot.open = slotIndex === safeIndex;
  });
}

function drawFromDeck(game) {
  if (!game.deck.length && game.discard.length) {
    game.deck = shuffle(game.discard);
    game.discard = [];
    addLog(game, "버린 패를 섞어 덱을 다시 만들었습니다.");
  }
  if (!game.deck.length) {
    game.deck = buildDeck(game.players.length);
    addLog(game, "예비 덱을 새로 섞었습니다.");
  }
  return game.deck.pop();
}

function drawForSeat(game, seat, logMessage) {
  const player = playerBySeat(game, seat);
  const drawnCard = drawFromDeck(game);
  enterPhase(game, "replace", {
    playerSeat: seat,
    drawnCard,
  });
  addLog(game, logMessage || `${player.name}님이 시간 종료로 카드를 자동으로 뽑았습니다.`);
  if (drawnCard.kind === "bomb") {
    addLog(game, `${player.name}님 손끝에 폭탄이 스쳤습니다.`);
  }
}

function replaceForSeat(game, seat, shouldReplace) {
  const player = playerBySeat(game, seat);
  const openIndex = slotOpenIndex(player);
  const drawn = game.pending.drawnCard;
  const replaceWithDrawn = shouldReplace && drawn.kind !== "bomb";
  if (replaceWithDrawn) {
    const floor = player.hand[openIndex].card;
    const selectedIds = player.selectedCardIds || [];
    game.discard.push(floor);
    game.lastDiscard = floor;
    player.hand[openIndex].card = drawn;
    if (selectedIds.includes(floor.id)) {
      player.selectedCardIds = selectedIds.map((id) => (id === floor.id ? drawn.id : id));
    }
    addLog(game, `${player.name}님이 공개패를 교체했습니다.`);
  } else {
    game.discard.push(drawn);
    game.lastDiscard = drawn;
    addLog(game, drawn.kind === "bomb" ? `${player.name}님이 뽑은 폭탄을 버렸습니다.` : `${player.name}님이 뽑은 패를 버렸습니다.`);
  }
  sanitizeSelectedCards(player, player.isBot);
  enterPhase(game, "steal", {
    victimSeat: seat,
    stealerSeat: nextSeat(game, seat),
  });
  addLog(game, `${playerBySeat(game, game.pending.stealerSeat).name}님이 스틸할 차례입니다.`);
}

function stealForSeat(game, stealerSeat, index) {
  const victim = playerBySeat(game, game.pending.victimSeat);
  const stealer = playerBySeat(game, stealerSeat);
  if (!victim || !stealer || victim.hand[index]?.open) return false;
  const stolen = victim.hand.splice(index, 1)[0];
  stealer.hand.push({ ...stolen, open: false, justStolen: true });
  sanitizeSelectedCards(victim, victim.isBot);
  sanitizeSelectedCards(stealer, stealer.isBot);
  enterPhase(game, "return", {
    ...game.pending,
    stolenCard: stolen.card,
  });
  addLog(game, `${stealer.name}님이 ${victim.name}님의 숨은 패를 가져갔습니다.`);
}

function returnForSeat(game, stealerSeat, index) {
  const victim = playerBySeat(game, game.pending.victimSeat);
  const stealer = playerBySeat(game, stealerSeat);
  if (!victim || !stealer || stealer.hand[index]?.open) return false;
  const returned = stealer.hand.splice(index, 1)[0];
  victim.hand.push({ card: returned.card, open: false });
  stealer.hand.forEach((slot) => delete slot.justStolen);
  sanitizeSelectedCards(victim, victim.isBot);
  sanitizeSelectedCards(stealer, stealer.isBot);
  addLog(game, `${stealer.name}님이 ${victim.name}님에게 카드 1장을 돌려줬습니다.`);
  if (returned.card.kind === "bomb") {
    addLog(game, "폭탄이 테이블을 건너갔습니다.");
  }
  completeTurn(game);
}

function completeTurn(game) {
  const player = playerBySeat(game, game.pending.victimSeat);
  player.turns += 1;
  if (game.players.every((item) => item.turns >= MAX_TURNS)) {
    game.phase = "finished";
    game.status = "finished";
    game.pending = null;
    game.players.forEach((item) => sanitizeSelectedCards(item, item.isBot));
    game.results = rankPlayers(game.players);
    settleStakes(game);
    clearDeadline(game);
    addLog(game, "모든 플레이어가 3턴을 마쳤습니다. 최종 순위를 공개합니다.");
    return;
  }
  game.currentSeat = nextSeat(game, player.seat);
  enterPhase(game, "turn", null);
  addLog(game, `${playerBySeat(game, game.currentSeat).name}님의 차례입니다.`);
}

function settleStakes(game) {
  if (game.stakesSettled || !game.results?.length) return;
  const winnerResult = game.results[0];
  const winner = playerBySeat(game, winnerResult.seat);
  if (!winner) return;

  winner.chips = (winner.chips || 0) + (game.pot || 0);
  winner.chipDelta = (winner.chipDelta || 0) + (game.pot || 0);

  game.results.slice(1).forEach((result, index) => {
    const player = playerBySeat(game, result.seat);
    if (!player) return;
    const isLast = index === game.results.length - 2;
    const penalty = result.hasBomb ? BOMB_PENALTY : isLast ? LOSER_PENALTY : 0;
    if (!penalty) return;
    player.chips = Math.max(0, (player.chips || 0) - penalty);
    player.chipDelta = (player.chipDelta || 0) - penalty;
    winner.chips += penalty;
    winner.chipDelta += penalty;
    game.pot = (game.pot || 0) + penalty;
  });

  game.results = game.results.map((result) => {
    const player = playerBySeat(game, result.seat);
    return {
      ...result,
      chips: player?.chips || 0,
      chipDelta: player?.chipDelta || 0,
    };
  });
  game.stakesSettled = true;
  addLog(game, `${winner.name}님이 판돈 ${game.pot || 0}점을 가져갔습니다.`);
}

function resolveExpiredAction() {
  const game = getGame();
  if (!game?.deadlineAt || uiState.resolvingTimeout || remainingSeconds(game) > 0) return;
  uiState.resolvingTimeout = true;
  saveGame((next) => {
    if (!next.deadlineAt || remainingSeconds(next) > 0) return false;
    if (next.phase === "chooseOpen") {
      const unresolved = next.players.filter((player) => player.hand && !player.hand.some((slot) => slot.open));
      unresolved.forEach((player) => openCardForPlayer(player, chooseInitialOpenIndex(player)));
      if (unresolved.length) addLog(next, `시간 종료로 ${unresolved.length}명이 공개패를 자동 선택했습니다.`);
      if (next.players.every((player) => player.hand?.some((slot) => slot.open))) {
        enterPhase(next, "turn", null);
        next.currentSeat = next.players[0].seat;
        addLog(next, `${playerBySeat(next, next.currentSeat).name}님의 차례입니다.`);
      }
      return;
    }
    if (next.phase === "turn") {
      drawForSeat(next, next.currentSeat);
      return;
    }
    if (next.phase === "replace") {
      const player = playerBySeat(next, next.pending.playerSeat);
      replaceForSeat(next, player.seat, shouldReplaceOpen(player, next.pending.drawnCard));
      return;
    }
    if (next.phase === "steal") {
      const victim = playerBySeat(next, next.pending.victimSeat);
      stealForSeat(next, next.pending.stealerSeat, chooseStealIndex(victim));
      return;
    }
    if (next.phase === "return") {
      const stealer = playerBySeat(next, next.pending.stealerSeat);
      returnForSeat(next, stealer.seat, chooseReturnIndex(stealer));
    }
  }).finally(() => {
    uiState.resolvingTimeout = false;
  });
  playSound("timeout");
  showQuote("timeout");
}

function chooseInitialOpenIndex(player) {
  const normalIndexes = player.hand
    .map((slot, index) => ({ slot, index }))
    .filter((item) => item.slot.card.kind !== "bomb");
  const candidates = normalIndexes.length ? normalIndexes : player.hand.map((slot, index) => ({ slot, index }));
  let lowest = candidates[0].index;
  let lowestScore = Number.POSITIVE_INFINITY;
  candidates.forEach(({ slot, index }) => {
    const score = slot.card.kind === "bomb" ? -100 : slot.card.month + (slot.card.gwang ? 0.5 : 0);
    if (score < lowestScore) {
      lowestScore = score;
      lowest = index;
    }
  });
  return lowest;
}

function chooseStealIndex(victim) {
  const candidates = hiddenIndexes(victim);
  return candidates[Math.floor(Math.random() * candidates.length)] ?? 0;
}

function chooseReturnIndex(player) {
  const candidates = hiddenIndexes(player);
  const bombIndex = candidates.find((index) => player.hand[index].card.kind === "bomb");
  if (bombIndex !== undefined) return bombIndex;

  let bestIndex = candidates[0] ?? 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  candidates.forEach((index) => {
    const remaining = player.hand.filter((_, slotIndex) => slotIndex !== index).map((slot) => slot.card);
    const best = evaluateBest(remaining);
    const card = player.hand[index].card;
    const score = best.score * 100 + best.tie - (card.month || 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function shouldReplaceOpen(player, drawn) {
  if (drawn?.kind === "bomb") return false;
  const openIndex = slotOpenIndex(player);
  const currentBest = evaluateBest(player.hand.map((slot) => slot.card));
  const simulatedCards = player.hand.map((slot, index) => (index === openIndex ? drawn : slot.card));
  const simulatedBest = evaluateBest(simulatedCards);
  return simulatedBest.score > currentBest.score || (simulatedBest.score === currentBest.score && simulatedBest.tie > currentBest.tie);
}

function hiddenIndexes(player) {
  return player.hand.map((slot, index) => (slot.open ? -1 : index)).filter((index) => index >= 0);
}

function bestCardIds(player) {
  const hand = player.hand || [];
  const best = evaluateBest(player.hand?.map((slot) => slot.card) || []);
  const ids = best.cards.map((card) => card.id).slice(0, 2);
  for (const slot of hand) {
    if (ids.length >= 2) break;
    if (!ids.includes(slot.card.id)) ids.push(slot.card.id);
  }
  return ids.slice(0, 2);
}

function selectBestCards(player) {
  player.selectedCardIds = bestCardIds(player);
  return player.selectedCardIds;
}

function sanitizeSelectedCards(player, forceBest = false) {
  if (!player?.hand) return [];
  if (forceBest) return selectBestCards(player);
  const available = new Set(player.hand.map((slot) => slot.card.id));
  const selected = [...new Set(player.selectedCardIds || [])]
    .filter((id) => available.has(id))
    .slice(0, 2);
  player.selectedCardIds = selected.length === 2 ? selected : bestCardIds(player);
  return player.selectedCardIds;
}

function activeSlotsForPlayer(player) {
  if (!player?.hand) return [];
  const selected = new Set(player.selectedCardIds || []);
  const active = player.hand.filter((slot) => selected.has(slot.card.id));
  if (active.length === 2) return active;
  const best = new Set(bestCardIds(player));
  return player.hand.filter((slot) => best.has(slot.card.id));
}

function evaluatePlayerSelection(player) {
  const activeSlots = activeSlotsForPlayer(player);
  const activeCards = activeSlots.map((slot) => slot.card);
  const bombCount = player?.hand?.filter((slot) => slot.card.kind === "bomb").length || 0;
  return {
    activeCards,
    activeCardIds: activeCards.map((card) => card.id),
    best: evaluateBest(activeCards),
    hasBomb: bombCount > 0,
    bombCount,
    bombJackpot: bombCount >= BOMB_JACKPOT_COUNT,
  };
}

function rankPlayers(players) {
  return players
    .map((player) => {
      const selection = evaluatePlayerSelection(player);
      return {
        seat: player.seat,
        name: player.name,
        hand: player.hand,
        hasBomb: selection.hasBomb,
        bombCount: selection.bombCount,
        bombJackpot: selection.bombJackpot,
        best: selection.best,
        activeCardIds: selection.activeCardIds,
      };
    })
    .sort((a, b) => {
      if (a.bombJackpot !== b.bombJackpot) return a.bombJackpot ? -1 : 1;
      if (a.hasBomb !== b.hasBomb) return a.hasBomb ? 1 : -1;
      if (b.best.score !== a.best.score) return b.best.score - a.best.score;
      return b.best.tie - a.best.tie;
    });
}

function evaluateBest(cards) {
  const normalCards = cards.filter((card) => card.kind === "month");
  if (normalCards.length < 2) return { label: "판정불가", score: 0, tie: 0, category: "none", cards: [] };
  let best = { label: "망통", score: 0, tie: 0, category: "mangtong", cards: [] };
  for (let i = 0; i < normalCards.length; i += 1) {
    for (let j = i + 1; j < normalCards.length; j += 1) {
      const combo = {
        ...evaluatePair(normalCards[i], normalCards[j]),
        cards: [normalCards[i], normalCards[j]],
      };
      if (combo.score > best.score || (combo.score === best.score && combo.tie > best.tie)) best = combo;
    }
  }
  return best;
}

function evaluatePair(a, b) {
  const months = [a.month, b.month].sort((x, y) => x - y);
  const tie = Math.max(a.month, b.month);
  const bothGwang = a.gwang && b.gwang;
  if (bothGwang && months[0] === 3 && months[1] === 8) return { label: "삼팔광땡", score: 12000, tie, category: "gwang" };
  if (bothGwang && months[0] === 1 && months[1] === 8) return { label: "일팔광땡", score: 11000, tie, category: "gwang" };
  if (bothGwang && months[0] === 1 && months[1] === 3) return { label: "일삼광땡", score: 10000, tie, category: "gwang" };
  if (a.month === b.month) return { label: `${a.month}땡`, score: 9000 + a.month, tie: a.month, category: "ddang" };
  const key = months.join("-");
  const specials = {
    "1-2": ["알리", 8000],
    "1-4": ["독사", 7900],
    "1-9": ["구삥", 7800],
    "1-10": ["장삥", 7700],
    "4-10": ["장사", 7600],
    "4-6": ["세륙", 7500],
  };
  if (specials[key]) return { label: specials[key][0], score: specials[key][1], tie, category: "special" };
  const gut = (a.month + b.month) % 10;
  if (gut === 0) return { label: "망통", score: 5000, tie, category: "mangtong" };
  return { label: gut === 9 ? "갑오" : `${gut}끗`, score: 6000 + gut, tie, category: "gut" };
}

function cardName(card) {
  if (!card) return "없음";
  if (card.kind === "bomb") return "폭탄";
  return `${card.month}월${card.gwang ? " 광" : ""}`;
}

function slotOpenIndex(player) {
  return player.hand?.findIndex((slot) => slot.open) ?? -1;
}

function seatPosition(index, total) {
  const compact = window.innerWidth <= 860;
  const layouts = compact ? COMPACT_SEAT_LAYOUTS : SEAT_LAYOUTS;
  const layout = layouts[total];
  if (layout?.[index]) return layout[index];

  const angle = ((180 - (index * 360) / total) * Math.PI) / 180;
  const radiusX = compact ? 33 : 41;
  const radiusY = compact ? 31 : 34;
  return {
    left: 50 + Math.cos(angle) * radiusX,
    top: 50 - Math.sin(angle) * radiusY,
  };
}

const SEAT_LAYOUTS = {
  3: [
    { left: 15, top: 50 },
    { left: 72, top: 25 },
    { left: 72, top: 75 },
  ],
  4: [
    { left: 15, top: 50 },
    { left: 50, top: 23 },
    { left: 85, top: 50 },
    { left: 50, top: 78 },
  ],
  5: [
    { left: 15, top: 50 },
    { left: 33, top: 24 },
    { left: 67, top: 24 },
    { left: 85, top: 50 },
    { left: 50, top: 78 },
  ],
  6: [
    { left: 27, top: 24 },
    { left: 50, top: 23 },
    { left: 73, top: 24 },
    { left: 73, top: 75 },
    { left: 50, top: 76 },
    { left: 27, top: 75 },
  ],
  7: [
    { left: 17, top: 23 },
    { left: 39, top: 22 },
    { left: 61, top: 22 },
    { left: 83, top: 23 },
    { left: 72, top: 75 },
    { left: 50, top: 76 },
    { left: 28, top: 75 },
  ],
  8: [
    { left: 17, top: 23 },
    { left: 39, top: 22 },
    { left: 61, top: 22 },
    { left: 83, top: 23 },
    { left: 83, top: 75 },
    { left: 61, top: 76 },
    { left: 39, top: 76 },
    { left: 17, top: 75 },
  ],
};

const COMPACT_SEAT_LAYOUTS = {
  3: [
    { left: 23, top: 50 },
    { left: 73, top: 24 },
    { left: 73, top: 76 },
  ],
  4: [
    { left: 23, top: 50 },
    { left: 50, top: 22 },
    { left: 77, top: 50 },
    { left: 50, top: 78 },
  ],
  5: [
    { left: 23, top: 50 },
    { left: 36, top: 24 },
    { left: 64, top: 24 },
    { left: 77, top: 50 },
    { left: 50, top: 78 },
  ],
  6: [
    { left: 28, top: 23 },
    { left: 50, top: 22 },
    { left: 72, top: 23 },
    { left: 72, top: 77 },
    { left: 50, top: 78 },
    { left: 28, top: 77 },
  ],
  7: [
    { left: 18, top: 21 },
    { left: 39, top: 20 },
    { left: 61, top: 20 },
    { left: 82, top: 21 },
    { left: 72, top: 80 },
    { left: 50, top: 81 },
    { left: 28, top: 80 },
  ],
  8: [
    { left: 18, top: 21 },
    { left: 39, top: 20 },
    { left: 61, top: 20 },
    { left: 82, top: 21 },
    { left: 82, top: 79 },
    { left: 61, top: 80 },
    { left: 39, top: 80 },
    { left: 18, top: 79 },
  ],
};

function riskState(game, me) {
  if (!game || !me?.hand || game.status === "lobby") return { level: "idle", label: "위험 대기" };
  const selection = evaluatePlayerSelection(me);
  const remaining = remainingSeconds(game);
  const owner = actionOwner(game);
  const isMine = owner === me.seat || (game.phase === "chooseOpen" && !me.hand.some((slot) => slot.open));
  if (selection.bombJackpot) return { level: "safe", label: "폭탄 3장 승리권" };
  if (selection.hasBomb) return { level: "critical", label: "폭탄 보유" };
  if (remaining !== null && remaining <= 5 && isMine) return { level: "danger", label: "시간 압박" };
  if (game.phase === "steal" && game.pending?.victimSeat === me.seat) return { level: "danger", label: "패 노출 위험" };
  if (isLastTurnPlayer(game, me)) return { level: "tense", label: "마지막 턴" };
  if (selection.best.category === "mangtong" || selection.best.score < 6005) return { level: "warning", label: "낮은 족보" };
  return { level: "safe", label: "안전권" };
}

function isLastTurnPlayer(game, player) {
  return Boolean(game?.status === "playing" && player?.hand && (player.turns || 0) >= MAX_TURNS - 1);
}

function activeTurnPlayer(game) {
  if (!game) return null;
  if (game.phase === "turn") return playerBySeat(game, game.currentSeat);
  if (game.phase === "replace") return playerBySeat(game, game.pending?.playerSeat);
  if (game.phase === "steal" || game.phase === "return") return playerBySeat(game, game.pending?.victimSeat);
  return null;
}

function render() {
  const game = getGame();
  const me = myPlayer(game);
  renderLobby(game, me);
  renderBoard(game, me);
  renderSeats(game, me);
  renderStatus(game);
  renderHand(game, me);
  renderJokbo(game, me);
  renderLogs(game);
  renderActions(game, me);
  renderModal(game, me);
  renderTimer(game, me);
}

function renderLobby(game, me) {
  if (!game) {
    el.roomCodeBadge.textContent = "방 코드 없음";
    el.copyRoomBtn.disabled = true;
    el.startRoomBtn.disabled = true;
    if (roomState.mode === "solo") {
      el.lobbyTitle.textContent = "AI 봇과 바로 연습하세요";
      el.lobbyHint.textContent = "전체 인원을 고르면 나머지 자리는 AI 봇이 채웁니다.";
    } else {
      el.lobbyTitle.textContent = "다인 대전 방을 만들거나 참가하세요";
      el.lobbyHint.textContent = "방 코드를 공유하고 3명 이상 모이면 시작할 수 있습니다.";
    }
    return;
  }
  el.lobbyTitle.textContent = `${game.roomCode} 방`;
  const botCount = game.players.filter((player) => player.isBot).length;
  el.lobbyHint.textContent =
    game.mode === "solo"
      ? `1인 연습 중 · AI 봇 ${botCount}명 · 총 ${game.players.length}명`
      : `${game.players.length}/${game.maxPlayers}명 참가 중 · 최소 ${MIN_PLAYERS}명부터 시작`;
  el.roomCodeBadge.textContent = `방 코드 ${game.roomCode}`;
  el.copyRoomBtn.disabled = game.mode === "solo";
  el.startRoomBtn.disabled = !(game.status === "lobby" && me?.key === game.hostKey && game.players.length >= MIN_PLAYERS);
  el.startRoomBtn.textContent = game.mode === "solo" ? "AI와 시작" : "게임 시작";
}

function renderBoard(game, me) {
  if (!game) {
    el.phaseLabel.textContent = "로비";
    el.turnTitle.textContent = "방을 만들거나 참가하세요";
    el.roundPill.textContent = "0턴 진행";
    el.stakePill.textContent = "판돈 0점";
    el.riskPill.textContent = "위험 대기";
    el.riskPill.className = "risk-pill idle";
    el.lastTurnPill.hidden = true;
    if (el.bombToken) el.bombToken.className = "bomb-token";
    if (document.body) document.body.dataset.risk = "idle";
    el.deckCount.textContent = "0장";
    if (el.tableJackpot) el.tableJackpot.textContent = "ROOM JACKPOT";
    el.discardCard.className = "small-card muted";
    el.discardCard.textContent = "없음";
    el.currentHint.textContent = "-";
    return;
  }

  const allTurns = game.players.reduce((sum, player) => sum + (player.turns || 0), 0);
  el.deckCount.textContent = `${game.deck?.length || 0}장`;
  el.discardCard.className = `small-card${game.lastDiscard?.kind === "bomb" ? " bomb" : ""}${!game.lastDiscard ? " muted" : ""}`;
  el.discardCard.innerHTML = game.lastDiscard ? miniCardHTML(game.lastDiscard) : "없음";
  el.roundPill.textContent = `${allTurns}/${game.players.length * MAX_TURNS}턴 진행`;
  el.stakePill.textContent = `판돈 ${game.pot || 0}점`;
  if (el.tableJackpot) el.tableJackpot.textContent = `JACKPOT ${game.pot || 0}점`;

  const risk = riskState(game, me);
  const bombCount = game.players.filter((player) => player.hand?.some((slot) => slot.card.kind === "bomb")).length;
  el.riskPill.textContent = risk.label;
  el.riskPill.className = `risk-pill ${risk.level}`;
  const activePlayer = activeTurnPlayer(game);
  const mineLastTurn = isLastTurnPlayer(game, me);
  const activeLastTurn = isLastTurnPlayer(game, activePlayer);
  el.lastTurnPill.hidden = !(mineLastTurn || activeLastTurn);
  el.lastTurnPill.textContent = mineLastTurn ? "마지막 턴" : `${activePlayer?.name || "상대"} 마지막 턴`;
  if (el.bombToken) {
    el.bombToken.className = `bomb-token ${risk.level}${bombCount ? " armed" : ""}`;
    el.bombToken.title = bombCount ? `폭탄 ${bombCount}개 이동 중` : "폭탄 대기";
  }
  if (document.body) document.body.dataset.risk = risk.level;

  const phaseText = {
    lobby: "로비",
    chooseOpen: "공개패 선택",
    turn: "카드 뽑기",
    replace: "공개패 교체",
    steal: "스틸",
    return: "반환",
    finished: "게임 종료",
  };
  el.phaseLabel.textContent = phaseText[game.phase] || game.phase;

  if (game.phase === "lobby") el.turnTitle.textContent = "참가자를 기다리는 중입니다";
  if (game.phase === "chooseOpen") el.turnTitle.textContent = "15초 안에 공개패를 선택하세요";
  if (game.phase === "turn") {
    const player = playerBySeat(game, game.currentSeat);
    el.turnTitle.textContent = isLastTurnPlayer(game, player)
      ? `${player.name}님의 마지막 턴입니다. 신중하게 카드를 뽑으세요`
      : `${player.name}님이 카드를 뽑을 차례입니다`;
  }
  if (game.phase === "replace") {
    const player = playerBySeat(game, game.pending.playerSeat);
    el.turnTitle.textContent = isLastTurnPlayer(game, player)
      ? `${player.name}님의 마지막 턴입니다. 공개패 교체를 신중하게 선택하세요`
      : `${player.name}님이 공개패 교체 여부를 선택합니다`;
  }
  if (game.phase === "steal") el.turnTitle.textContent = `${playerBySeat(game, game.pending.stealerSeat).name}님이 ${playerBySeat(game, game.pending.victimSeat).name}님의 숨은 패를 가져갑니다`;
  if (game.phase === "return") el.turnTitle.textContent = `${playerBySeat(game, game.pending.stealerSeat).name}님이 카드 1장을 돌려줍니다`;
  if (game.phase === "finished") el.turnTitle.textContent = "최종 순위가 공개되었습니다";
  el.currentHint.textContent = me ? `${me.name} · P${me.seat + 1}` : "-";
}

function renderSeats(game, me) {
  el.seatLayer.innerHTML = "";
  if (!game) {
    if (el.tableWrap) delete el.tableWrap.dataset.seatCount;
    if (el.table) delete el.table.dataset.seatCount;
    return;
  }
  if (el.tableWrap) el.tableWrap.dataset.seatCount = String(game.players.length);
  if (el.table) el.table.dataset.seatCount = String(game.players.length);
  game.players.forEach((player, index) => {
    const publicSlot = player.hand?.find((slot) => slot.open);
    const selection = player.hand ? evaluatePlayerSelection(player) : null;
    const pos = seatPosition(index, game.players.length);
    const seat = document.createElement("article");
    const classes = ["seat"];
    if (isSeatActive(game, player.seat)) classes.push("current");
    if (me?.seat === player.seat) classes.push("human");
    if (publicSlot?.card.kind === "bomb") classes.push("danger");
    if (player.isBot) classes.push("bot");
    seat.className = classes.join(" ");
    seat.style.left = `${pos.left}%`;
    seat.style.top = `${pos.top}%`;
    seat.innerHTML = `
      <div class="seat-top">
        <span class="seat-name">${escapeHtml(player.name)}${player.isBot ? " AI" : ""}</span>
        <span class="turn-count">${player.turns || 0}/${MAX_TURNS}턴</span>
      </div>
      <div class="public-line">
        <div class="public-card ${publicSlot?.card.kind === "bomb" ? "bomb" : ""}">${publicSlot ? miniCardHTML(publicSlot.card) : "대기"}</div>
        <div class="seat-meta">
          <span>공개 카드</span>
          <b>${me?.seat === player.seat && selection ? selection.best.label : player.isBot ? "AI 판단 중" : "숨은 패 비공개"}</b>
          <em>칩 ${player.chips ?? STARTING_CHIPS}점</em>
        </div>
      </div>
    `;
    el.seatLayer.appendChild(seat);
  });
}

function renderStatus(game) {
  el.playerStatus.innerHTML = "";
  if (!game) return;
  game.players.forEach((player) => {
    const publicSlot = player.hand?.find((slot) => slot.open);
    const row = document.createElement("div");
    const rowClass = ["status-row"];
    if (isSeatActive(game, player.seat)) rowClass.push("current");
    if (publicSlot?.card.kind === "bomb") rowClass.push("danger");
    if (player.isBot) rowClass.push("bot");
    row.className = rowClass.join(" ");
    row.innerHTML = `
      <div class="avatar">${player.seat + 1}</div>
      <div class="status-main">
        <b>${escapeHtml(player.name)}${player.isBot ? " · AI" : ""}${player.key === game.hostKey ? " · 방장" : ""}</b>
        <span>${publicSlot ? `공개 ${cardName(publicSlot.card)}` : "공개패 미선택"} · 칩 ${player.chips ?? STARTING_CHIPS}점</span>
      </div>
      <small>${player.turns || 0}/${MAX_TURNS}</small>
    `;
    el.playerStatus.appendChild(row);
  });
}

function renderHand(game, me) {
  if (!game || !me?.hand) {
    el.myBest.textContent = me ? "게임 대기 중" : "방 참가 필요";
    el.myTip.textContent = me ? "방장이 게임을 시작하면 카드가 표시됩니다." : "이름과 방 코드를 입력해 참가하세요.";
    el.myHand.innerHTML = "";
    return;
  }

  const selection = evaluatePlayerSelection(me);
  const best = selection.best;
  const hasBomb = selection.hasBomb;
  const bombJackpot = selection.bombJackpot;
  const activeIds = new Set(selection.activeCardIds);
  const lastTurn = isLastTurnPlayer(game, me);
  el.myBest.textContent = `${bombJackpot ? `폭탄 ${selection.bombCount}장 · 승리권` : hasBomb ? `${best.label} · 폭탄 위험` : best.label}${lastTurn ? " · 마지막 턴" : ""}`;
  const baseTip = selection.activeCards.length
    ? `사용패: ${selection.activeCards.map(cardName).join(" + ")}${bombJackpot ? " · 폭탄 3장 이상은 최종 승리 조건" : hasBomb ? " · 폭탄 1~2장은 최종 최하위 위험" : ""}`
    : "공개패는 모두에게 보이고, 숨은 패는 내 화면에서만 보입니다.";
  el.myTip.textContent = lastTurn ? `마지막 턴입니다. ${baseTip} 교체 후 선택이 최종 순위에 크게 반영됩니다.` : baseTip;
  el.myHand.innerHTML = me.hand
    .map((slot, index) => {
      const selected = activeIds.has(slot.card.id);
      return `
        <button type="button" class="hand-card-button ${selected ? "selected" : ""}" data-use-index="${index}" aria-pressed="${selected}">
          ${cardHTML(slot, { visible: true, selected })}
          <span>${selected ? "사용" : "후보"}</span>
        </button>
      `;
    })
    .join("");
}

function renderJokbo(game, me) {
  const selection = me?.hand ? evaluatePlayerSelection(me) : null;
  const best = selection?.best;
  const hasBomb = Boolean(selection?.hasBomb);
  const bombJackpot = Boolean(selection?.bombJackpot);
  const activeCategory = hasBomb ? "bomb" : best?.category;
  if (!best) {
    el.handInsight.innerHTML = `<b>방 참가 필요</b><span>게임이 시작되면 현재 족보와 위험도가 표시됩니다.</span>`;
    el.jokboHint.textContent = "내 패 기준";
  } else {
    const combo = selection.activeCards.length ? selection.activeCards.map(cardName).join(" + ") : "조합 대기";
    const level = bombJackpot ? "strong" : hasBomb ? "danger" : best.score >= 9000 ? "strong" : best.score >= 7500 ? "good" : best.score >= 6000 ? "normal" : "weak";
    const risk = riskState(game, me);
    el.handInsight.innerHTML = `
      <b class="${level}">${bombJackpot ? `폭탄 ${selection.bombCount}장 승리권` : hasBomb ? `폭탄 ${selection.bombCount}장 보유` : best.label}</b>
      <span>위험도 ${risk.label} · 사용패는 ${combo}입니다.${bombJackpot ? " 폭탄 3장 이상은 최종 순위에서 무조건 1위입니다." : hasBomb ? " 폭탄 1~2장은 최종 보유 시 최하위 위험입니다." : ""}</span>
    `;
    el.jokboHint.textContent = `현재 ${bombJackpot ? "폭탄 승리권" : hasBomb ? "위험" : best.label}`;
  }
  el.jokboList.innerHTML = JOKBO_ROWS.map((row) => `
    <article class="jokbo-row ${row.category === activeCategory ? "active" : ""}">
      <div>
        <b>${row.title}</b>
        <span>${row.detail}</span>
      </div>
      <em>${row.example}</em>
    </article>
  `).join("");
}

function renderLogs(game) {
  el.logList.innerHTML = (game?.logs || []).slice(0, 8).map((log) => `<li>${escapeHtml(log)}</li>`).join("");
}

function renderActions(game, me) {
  el.primaryAction.disabled = true;
  el.primaryAction.textContent = "대기";
  if (!game || !me) return;

  if (game.phase === "turn" && game.currentSeat === me.seat) {
    el.primaryAction.disabled = false;
    el.primaryAction.textContent = "카드 뽑기";
    return;
  }
  if (game.phase === "chooseOpen" && !me.hand?.some((slot) => slot.open)) {
    el.primaryAction.disabled = false;
    el.primaryAction.textContent = "공개패 선택";
    return;
  }
  if (game.phase === "replace" && game.pending?.playerSeat === me.seat) {
    el.primaryAction.disabled = false;
    el.primaryAction.textContent = "교체 선택";
    return;
  }
  if (game.phase === "steal" && game.pending?.stealerSeat === me.seat) {
    el.primaryAction.disabled = false;
    el.primaryAction.textContent = "스틸 선택";
    return;
  }
  if (game.phase === "return" && game.pending?.stealerSeat === me.seat) {
    el.primaryAction.disabled = false;
    el.primaryAction.textContent = "반환 선택";
    return;
  }
  if (game.phase === "finished") {
    el.primaryAction.disabled = false;
    el.primaryAction.textContent = "결과 보기";
  }
}

function renderModal(game, me) {
  el.choiceModal.classList.add("hidden");
  if (!game || !me) return;

  if (game.phase === "chooseOpen" && me.hand && !me.hand.some((slot) => slot.open)) {
    showModal("공개패 선택", "처음 받은 3장 중 바닥에 공개할 카드 1장을 고르세요. 15초 후 자동 선택됩니다.", me.hand, "open");
  }
  if (game.phase === "replace" && game.pending?.playerSeat === me.seat) {
    const openSlot = me.hand[slotOpenIndex(me)];
    const drawnSlot = { card: game.pending.drawnCard, open: false };
    const lastTurnCopy = isLastTurnPlayer(game, me) ? "마지막 턴입니다. 이 선택이 최종 순위에 크게 반영됩니다. " : "";
    el.choiceModal.classList.remove("hidden");
    if (game.pending.drawnCard.kind === "bomb") {
      el.modalKicker.textContent = "폭탄 처리";
      el.modalTitle.textContent = "뽑은 폭탄은 버릴 수 있습니다";
      el.modalCopy.textContent = `${lastTurnCopy}현재 공개패는 유지하고, 방금 뽑은 폭탄만 버림패로 내려놓습니다. 15초 후 자동으로 버립니다.`;
      el.modalCards.innerHTML = `
        <div class="replace-choice drawn-bomb-choice">
          <div class="replace-card locked-action" aria-label="현재 공개패 유지">
            <span>현재 공개패 유지</span>
            ${cardHTML(openSlot, { visible: true, choice: false, locked: true })}
            <em>현재 공개패: ${cardName(openSlot.card)}</em>
          </div>
          <button type="button" class="replace-card bomb-discard-action" data-replace-action="discard" aria-label="뽑은 폭탄 버리기">
            <span>뽑은 폭탄 버리기</span>
            ${cardHTML(drawnSlot, { visible: true, choice: true })}
            <em>손패에 추가하지 않고 버립니다</em>
          </button>
        </div>
      `;
      return;
    }
    el.modalKicker.textContent = "공개패 교체";
    el.modalTitle.textContent = "사용할 공개패를 직접 고르세요";
    el.modalCopy.textContent = `${lastTurnCopy}현재 공개패를 누르면 유지하고, 뽑은 패를 누르면 공개패로 교체합니다. 15초 후 자동 결정됩니다.`;
    el.modalCards.innerHTML = `
      <div class="replace-choice">
        <button type="button" class="replace-card keep-action" data-replace-action="keep" aria-label="현재 공개패 유지">
          <span>현재 공개패 유지</span>
          ${cardHTML(openSlot, { visible: true, choice: true })}
          <em>현재 공개패: ${cardName(openSlot.card)}</em>
        </button>
        <button type="button" class="replace-card replace-action" data-replace-action="replace" aria-label="뽑은 패로 교체">
          <span>뽑은 패 사용</span>
          ${cardHTML(drawnSlot, { visible: true, choice: true })}
          <em>뽑은 패: ${cardName(drawnSlot.card)}</em>
        </button>
      </div>
    `;
  }
  if (game.phase === "steal" && game.pending?.stealerSeat === me.seat) {
    const victim = playerBySeat(game, game.pending.victimSeat);
    showModal(`${victim.name}님의 숨은 패 선택`, "공개패는 가져갈 수 없습니다. 15초가 지나면 숨은 패 1장이 자동 선택됩니다.", victim.hand, "steal");
  }
  if (game.phase === "return" && game.pending?.stealerSeat === me.seat) {
    const victim = playerBySeat(game, game.pending.victimSeat);
    showModal(`${victim.name}님에게 돌려줄 카드 선택`, "내 공개패는 돌려줄 수 없습니다. 폭탄이 있으면 자동 반환 우선 대상입니다.", me.hand, "return");
  }
  if (game.phase === "finished") {
    el.choiceModal.classList.remove("hidden");
    el.modalKicker.textContent = "최종 결과";
    el.modalTitle.textContent = "순위 공개";
    el.modalCopy.textContent = "폭탄 보유자는 족보와 관계없이 최하위 처리됩니다.";
    el.modalCards.innerHTML = `<div class="result-board">${game.results.map(resultHTML).join("")}</div>`;
  }
}

function showModal(title, copy, hand, action) {
  el.choiceModal.classList.remove("hidden");
  el.modalKicker.textContent = "선택";
  el.modalTitle.textContent = title;
  el.modalCopy.textContent = copy;
  el.modalCards.innerHTML = hand
    .map((slot, index) => {
      const disabled = action !== "open" && slot.open;
      const data = disabled ? "" : `data-${action}-index="${index}"`;
      const visible = action === "steal" ? slot.open : true;
      return `<button type="button" ${disabled ? "disabled" : data}>${cardHTML(slot, { visible, choice: !disabled, locked: disabled })}</button>`;
    })
    .join("");
}

function renderTimer(game, me) {
  const remaining = remainingSeconds(game);
  if (remaining === null) {
    el.actionTimer.className = "timer-card idle";
    el.timerValue.textContent = "--";
    el.timerLabel.textContent = "대기 중";
    el.timerBar.style.width = "0%";
    el.modalTimer.className = "modal-timer idle";
    el.modalTimer.querySelector("span").textContent = "--";
    return;
  }

  const total = game.actionSeconds || ACTION_SECONDS;
  const ratio = Math.max(0, Math.min(1, remaining / total));
  const owner = actionOwner(game);
  const isMine = me && (owner === me.seat || (game.phase === "chooseOpen" && !me.hand?.some((slot) => slot.open)));
  const urgent = remaining <= 5;
  el.actionTimer.className = `timer-card${urgent ? " urgent" : ""}${isMine ? " mine" : ""}`;
  el.timerValue.textContent = String(remaining).padStart(2, "0");
  el.timerLabel.textContent = isMine ? "내 선택 시간" : owner === null ? "전체 선택 중" : `${playerBySeat(game, owner)?.name || "상대"} 선택 중`;
  el.timerBar.style.width = `${ratio * 100}%`;
  el.modalTimer.className = `modal-timer${urgent ? " urgent" : ""}`;
  el.modalTimer.querySelector("span").textContent = String(remaining).padStart(2, "0");

  if (remaining > 0 && remaining <= 5 && uiState.lastTickSecond !== remaining) {
    uiState.lastTickSecond = remaining;
    playSound(remaining <= 3 ? "countdownUrgent" : "countdownTick");
    if (remaining === 5 && isMine && uiState.lastPressureActionId !== game.actionId) {
      uiState.lastPressureActionId = game.actionId;
      showQuote("pressure");
    }
  }
  if (remaining === 0) resolveExpiredAction();
}

function remainingSeconds(game) {
  if (!game?.deadlineAt) return null;
  return Math.max(0, Math.ceil((new Date(game.deadlineAt).getTime() - Date.now()) / 1000));
}

function actionOwner(game) {
  if (!game) return null;
  if (game.phase === "chooseOpen") return null;
  if (game.phase === "turn") return game.currentSeat;
  if (game.phase === "replace") return game.pending?.playerSeat;
  if (game.phase === "steal" || game.phase === "return") return game.pending?.stealerSeat;
  return null;
}

function isSeatActive(game, seat) {
  if (game.phase === "chooseOpen") {
    const player = playerBySeat(game, seat);
    return Boolean(player?.hand && !player.hand.some((slot) => slot.open));
  }
  return actionOwner(game) === seat;
}

function scheduleBotAction() {
  clearTimeout(roomState.botTimer);
  const game = getGame();
  const action = getBotAction(game);
  if (!action) return;
  const delay = 620 + Math.floor(Math.random() * 760);
  roomState.botTimer = setTimeout(() => runBotAction(action), delay);
}

function getBotAction(game) {
  if (!game || game.mode !== "solo" || game.status !== "playing") return null;
  if (game.phase === "chooseOpen") {
    const bot = game.players.find((player) => player.isBot && player.hand && !player.hand.some((slot) => slot.open));
    return bot ? { phase: game.phase, actionId: game.actionId, seat: bot.seat, kind: "open" } : null;
  }
  if (game.phase === "turn") {
    const player = playerBySeat(game, game.currentSeat);
    return player?.isBot ? { phase: game.phase, actionId: game.actionId, seat: player.seat, kind: "draw" } : null;
  }
  if (game.phase === "replace") {
    const player = playerBySeat(game, game.pending?.playerSeat);
    return player?.isBot ? { phase: game.phase, actionId: game.actionId, seat: player.seat, kind: "replace" } : null;
  }
  if (game.phase === "steal") {
    const player = playerBySeat(game, game.pending?.stealerSeat);
    return player?.isBot ? { phase: game.phase, actionId: game.actionId, seat: player.seat, kind: "steal" } : null;
  }
  if (game.phase === "return") {
    const player = playerBySeat(game, game.pending?.stealerSeat);
    return player?.isBot ? { phase: game.phase, actionId: game.actionId, seat: player.seat, kind: "return" } : null;
  }
  return null;
}

function runBotAction(action) {
  let botQuote = null;
  saveGame((next) => {
    if (next.mode !== "solo" || next.actionId !== action.actionId || next.phase !== action.phase) return false;
    const bot = playerBySeat(next, action.seat);
    if (!bot?.isBot) return false;

    if (action.kind === "open") {
      const unresolvedBots = next.players.filter((player) => player.isBot && player.hand && !player.hand.some((slot) => slot.open));
      unresolvedBots.forEach((player) => openCardForPlayer(player, chooseInitialOpenIndex(player)));
      addLog(next, "AI 봇이 공개패를 골랐습니다.");
      if (next.players.every((player) => player.hand?.some((slot) => slot.open))) {
        enterPhase(next, "turn", null);
        next.currentSeat = next.players[0].seat;
        addLog(next, `${playerBySeat(next, next.currentSeat).name}님의 차례입니다.`);
      }
      return;
    }

    if (action.kind === "draw") {
      drawForSeat(next, bot.seat, `${bot.name} 봇이 덱에서 패를 뽑았습니다.`);
      botQuote = next.pending?.drawnCard?.kind === "bomb" ? null : "draw";
      return;
    }

    if (action.kind === "replace") {
      const shouldReplace = shouldReplaceOpen(bot, next.pending.drawnCard);
      replaceForSeat(next, bot.seat, shouldReplace);
      botQuote = shouldReplace ? "double" : null;
      return;
    }

    if (action.kind === "steal") {
      const victim = playerBySeat(next, next.pending.victimSeat);
      stealForSeat(next, bot.seat, chooseStealIndex(victim));
      botQuote = victim?.key === roomState.playerKey ? null : "steal";
      return;
    }

    if (action.kind === "return") {
      returnForSeat(next, bot.seat, chooseReturnIndex(bot));
    }
  }).then((saved) => {
    if (!saved) return;
    if (action.kind === "draw") playSound("draw");
    if (action.kind === "steal") playSound("steal");
    if (action.kind === "return") playSound("click");
    if (botQuote) showQuote(botQuote);
  });
}

function miniCardHTML(card) {
  if (!card) return "없음";
  if (card.kind === "bomb") return `<span>폭탄</span>`;
  return `<img class="mini-face" src="${cardImagePath(card)}" alt="${cardName(card)}" />`;
}

function cardHTML(slot, options = {}) {
  const { visible = true, choice = false, locked = false, selected = false } = options;
  if (!visible) {
    return `<div class="game-card back ${choice ? "choice" : ""}"><span class="month">?</span><span class="caption">비공개</span></div>`;
  }
  const card = slot.card;
  const classes = ["game-card"];
  if (slot.open) classes.push("open");
  if (card.kind === "bomb") classes.push("bomb");
  if (choice) classes.push("choice");
  if (locked) classes.push("locked");
  if (selected) classes.push("selected");
  if (card.kind === "bomb") {
    return `
      <div class="${classes.join(" ")}">
        <div class="bomb-card-art"><span></span></div>
        <span class="month">폭탄</span>
        <span class="caption">최종 보유 시 최하위</span>
      </div>
    `;
  }
  return `
    <div class="${classes.join(" ")}">
      <img class="card-face" src="${cardImagePath(card)}" alt="${cardName(card)}" />
      <span class="month">${cardName(card)}</span>
      ${slot.justStolen ? '<span class="badge">스틸</span>' : ""}
    </div>
  `;
}

function cardImagePath(card) {
  const fileMap = {
    "1-0": "Hanafuda_January_Hikari.png",
    "1-1": "Hanafuda_January_Tanzaku.png",
    "1-2": "Hanafuda_January_Kasu_1.png",
    "1-3": "Hanafuda_January_Kasu_2.png",
    "2-0": "Hanafuda_February_Tane.png",
    "2-1": "Hanafuda_February_Tanzaku.png",
    "2-2": "Hanafuda_February_Kasu_1.png",
    "2-3": "Hanafuda_February_Kasu_2.png",
    "3-0": "Hanafuda_March_Hikari.png",
    "3-1": "Hanafuda_March_Tanzaku.png",
    "3-2": "Hanafuda_March_Kasu_1.png",
    "3-3": "Hanafuda_March_Kasu_2.png",
    "4-0": "Hanafuda_April_Tane.png",
    "4-1": "Hanafuda_April_Tanzaku.png",
    "4-2": "Hanafuda_April_Kasu_1.png",
    "4-3": "Hanafuda_April_Kasu_2.png",
    "5-0": "Hanafuda_May_Tane.png",
    "5-1": "Hanafuda_May_Tanzaku.png",
    "5-2": "Hanafuda_May_Kasu_1.png",
    "5-3": "Hanafuda_May_Kasu_2.png",
    "6-0": "Hanafuda_June_Tane.png",
    "6-1": "Hanafuda_June_Tanzaku.png",
    "6-2": "Hanafuda_June_Kasu_1.png",
    "6-3": "Hanafuda_June_Kasu_2.png",
    "7-0": "Hanafuda_July_Tane.png",
    "7-1": "Hanafuda_July_Tanzaku.png",
    "7-2": "Hanafuda_July_Kasu_1.png",
    "7-3": "Hanafuda_July_Kasu_2.png",
    "8-0": "Hanafuda_August_Hikari.png",
    "8-1": "Hanafuda_August_Tane.png",
    "8-2": "Hanafuda_August_Kasu_1.png",
    "8-3": "Hanafuda_August_Kasu_2.png",
    "9-0": "Hanafuda_September_Tane.png",
    "9-1": "Hanafuda_September_Tanzaku.png",
    "9-2": "Hanafuda_September_Kasu_1.png",
    "9-3": "Hanafuda_September_Kasu_2.png",
    "10-0": "Hanafuda_October_Tane.png",
    "10-1": "Hanafuda_October_Tanzaku.png",
    "10-2": "Hanafuda_October_Kasu_1.png",
    "10-3": "Hanafuda_October_Kasu_2.png",
  };
  return `./assets/hanafuda/${fileMap[`${card.month}-${card.variant}`]}`;
}

function resultHTML(result, index) {
  const activeIds = new Set(result.activeCardIds || []);
  const delta = result.chipDelta || 0;
  const deltaText = delta > 0 ? `+${delta}` : `${delta}`;
  const cards = result.hand
    .map((slot) => `<span class="result-card ${slot.card.kind === "bomb" ? "bomb" : ""} ${activeIds.has(slot.card.id) ? "used" : ""}">${miniCardHTML(slot.card)}</span>`)
    .join("");
  const resultLabel = result.bombJackpot
    ? `폭탄 ${result.bombCount}장 역전승`
    : result.hasBomb
      ? `폭탄 ${result.bombCount}장 최하위`
      : `${result.best.label} 사용`;
  return `
    <div class="result-row ${result.bombJackpot ? "bomb-winner" : result.hasBomb ? "bombed" : ""}">
      <span class="result-rank">${index + 1}위</span>
      <strong>${escapeHtml(result.name)}</strong>
      <div class="result-cards">${cards}</div>
      <b>${resultLabel}</b>
      <em class="result-delta ${delta >= 0 ? "gain" : "loss"}">${deltaText}점 · 잔액 ${result.chips ?? 0}점</em>
    </div>
  `;
}

function reactToRoomChange(previous, next) {
  const me = myPlayer(next);
  if (!previous || !next) return;
  if (previous.actionId !== next.actionId) {
    uiState.lastTickSecond = null;
  }
  if (previous.phase !== next.phase) {
    if (next.phase === "turn" && me?.seat === next.currentSeat) {
      playSound("turn");
      showQuote("turn");
    }
    if (next.phase === "steal" && next.pending?.victimSeat === me?.seat) {
      playSound("steal");
      showQuote("targeted");
    } else if (next.phase === "steal" && next.pending?.stealerSeat === me?.seat) {
      playSound("steal");
      showQuote("steal");
    }
    if (next.phase === "replace" && next.pending?.drawnCard?.kind === "bomb") {
      playSound("bomb");
      showQuote("bomb");
    }
    if (next.phase === "finished") {
      const winner = next.results?.[0];
      const mine = next.results?.find((result) => result.seat === me?.seat);
      playSound(winner?.seat === me?.seat ? "win" : "lose");
      showQuote(winner?.seat === me?.seat ? "win" : "finish");
      if (mine?.hasBomb) playSound("bomb");
    }
  }
}

function showQuote(kind) {
  const lines = QUOTES[kind] || QUOTES.turn;
  const line = lines[Math.floor(Math.random() * lines.length)];
  const key = `${kind}:${line}`;
  if (uiState.lastQuoteKey === key && el.quoteToast.classList.contains("show")) return;
  uiState.lastQuoteKey = key;
  el.quoteToast.textContent = line;
  el.quoteToast.classList.toggle("long", line.length >= 34);
  el.quoteToast.classList.add("show");
  if (shouldPlayQuoteVoice(kind)) speakQuote(line, kind);
  clearTimeout(uiState.quoteTimer);
  uiState.quoteTimer = setTimeout(() => {
    el.quoteToast.classList.remove("show");
  }, 2600);
}

function resetQuoteVoiceBudget(roomCode = "") {
  uiState.voiceRoomCode = roomCode;
  uiState.voiceLimit = 2 + Math.floor(Math.random() * 3);
  uiState.voiceCount = 0;
}

function ensureQuoteVoiceBudget() {
  const code = getGame()?.roomCode || "lobby";
  if (uiState.voiceRoomCode !== code || !uiState.voiceLimit) resetQuoteVoiceBudget(code);
}

function shouldPlayQuoteVoice(kind) {
  if (audioState.muted || !VOICE_QUOTE_KINDS.has(kind)) return false;
  ensureQuoteVoiceBudget();
  if (uiState.voiceCount >= uiState.voiceLimit) return false;
  uiState.voiceCount += 1;
  return true;
}

function speakQuote(line, kind) {
  if (audioState.muted) return;
  if (playQuoteAudio(line, kind)) return;
  speakQuoteWithSynth(line, kind);
}

function playQuoteAudio(line, kind) {
  if (!(QUOTE_AUDIO[line] && "Audio" in window)) return false;
  try {
    if (audioState.quoteAudio) {
      audioState.quoteAudio.pause();
      audioState.quoteAudio.currentTime = 0;
    }
    const audio = new Audio(`./assets/voice/${QUOTE_AUDIO[line]}`);
    audio.volume = kind === "pressure" ? 0.88 : 0.96;
    audioState.quoteAudio = audio;
    const playPromise = audio.play();
    if (playPromise?.catch) {
      playPromise.catch(() => speakQuoteWithSynth(line, kind));
    }
    return true;
  } catch (error) {
    console.warn("Quote audio unavailable", error);
    return false;
  }
}

function speakQuoteWithSynth(line, kind) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(line);
    utterance.lang = "ko-KR";
    utterance.rate = line.length > 34 || kind === "bomb" ? 0.84 : 0.92;
    utterance.pitch = kind === "pressure" || kind === "targeted" ? 0.72 : 0.82;
    utterance.volume = 0.95;
    const voices = window.speechSynthesis.getVoices();
    const koreanVoice = voices.find((voice) => voice.lang?.toLowerCase().startsWith("ko")) || voices.find((voice) => voice.name?.toLowerCase().includes("korean"));
    if (koreanVoice) utterance.voice = koreanVoice;
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    console.warn("Quote voice unavailable", error);
  }
}

function setMode(mode) {
  if (roomState.room?.state?.status === "playing") {
    alert("진행 중인 판이 끝난 뒤 모드를 바꿀 수 있습니다.");
    return;
  }
  roomState.mode = mode === "multi" ? "multi" : "solo";
  localStorage.setItem("steal-bomb-mode", roomState.mode);
  playSound("click");
  updateModeUI();
  renderLobby(getGame(), myPlayer(getGame()));
}

function updateModeUI() {
  const isSolo = roomState.mode !== "multi";
  el.soloModeBtn.classList.toggle("active", isSolo);
  el.multiModeBtn.classList.toggle("active", !isSolo);
  el.newGameBtn.textContent = isSolo ? "AI 연습 시작" : "방 만들기";
  el.playerCount.setAttribute("aria-label", isSolo ? "AI 포함 전체 인원" : "최대 인원");
}

function updateSoundButton() {
  el.soundToggle.textContent = audioState.muted ? "무음" : "음향+BGM";
  el.soundToggle.classList.toggle("muted", audioState.muted);
  el.soundToggle.setAttribute("aria-label", audioState.muted ? "효과음과 배경음 켜기" : "효과음과 배경음 끄기");
}

function unlockAudio() {
  if (audioState.muted) return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioState.context) audioState.context = new AudioContextClass();
  if (audioState.context.state === "suspended") audioState.context.resume();
  startBackgroundMusic();
  return audioState.context;
}

function playSound(kind) {
  const ctx = unlockAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  if (kind === "click") {
    chip(ctx, t, 780, 0.035, 0.045);
    noise(ctx, t, 0.035, 1900, 0.028);
  }
  if (kind === "room" || kind === "join") {
    impact(ctx, t, 95, 0.28, 0.13);
    chip(ctx, t + 0.08, 460, 0.06, 0.06);
    chip(ctx, t + 0.18, 700, 0.05, 0.045);
  }
  if (kind === "start") {
    impact(ctx, t, 72, 0.5, 0.18);
    tone(ctx, 146, t + 0.05, 0.28, "sawtooth", 0.055);
    chip(ctx, t + 0.22, 880, 0.08, 0.06);
    chip(ctx, t + 0.33, 1320, 0.07, 0.045);
  }
  if (kind === "turn") {
    pulse(ctx, t, 130, 0.1, 0.08);
    pulse(ctx, t + 0.16, 195, 0.1, 0.058);
    chip(ctx, t + 0.25, 1180, 0.05, 0.04);
  }
  if (kind === "draw") {
    noise(ctx, t, 0.16, 1800, 0.06);
    slide(ctx, t + 0.02, 1500, 360, 0.14, 0.045);
    chip(ctx, t + 0.16, 720, 0.045, 0.055);
  }
  if (kind === "countdownTick") {
    chip(ctx, t, 880, 0.04, 0.035);
    pulse(ctx, t + 0.035, 220, 0.05, 0.025);
  }
  if (kind === "countdownUrgent") {
    chip(ctx, t, 1260, 0.055, 0.065);
    impact(ctx, t, 150, 0.11, 0.06);
  }
  if (kind === "timeout") {
    impact(ctx, t, 82, 0.46, 0.18);
    slide(ctx, t + 0.05, 440, 92, 0.42, 0.09);
    noise(ctx, t + 0.18, 0.2, 360, 0.06);
  }
  if (kind === "steal") {
    noise(ctx, t, 0.12, 2600, 0.065);
    slide(ctx, t, 320, 1260, 0.18, 0.08);
    chip(ctx, t + 0.17, 1580, 0.055, 0.06);
    impact(ctx, t + 0.2, 110, 0.18, 0.08);
  }
  if (kind === "bomb") {
    impact(ctx, t, 54, 0.72, 0.22);
    slide(ctx, t, 210, 38, 0.78, 0.18);
    noise(ctx, t + 0.04, 0.46, 220, 0.16);
    noise(ctx, t + 0.18, 0.34, 1300, 0.055);
  }
  if (kind === "win") {
    impact(ctx, t, 110, 0.22, 0.1);
    [330, 440, 660, 880].forEach((freq, index) => chip(ctx, t + index * 0.09, freq, 0.07, 0.055));
    tone(ctx, 220, t, 0.64, "triangle", 0.045);
  }
  if (kind === "lose") {
    impact(ctx, t, 74, 0.42, 0.13);
    slide(ctx, t, 260, 78, 0.62, 0.095);
    noise(ctx, t + 0.26, 0.18, 430, 0.04);
  }
}

function startBackgroundMusic() {
  const ctx = audioState.context;
  if (!ctx || audioState.muted || audioState.musicTimer) return;
  audioState.musicFilter = ctx.createBiquadFilter();
  audioState.musicFilter.type = "lowpass";
  audioState.musicFilter.frequency.setValueAtTime(1200, ctx.currentTime);
  audioState.musicGain = ctx.createGain();
  audioState.musicGain.gain.setValueAtTime(0.0001, ctx.currentTime);
  audioState.musicGain.gain.exponentialRampToValueAtTime(0.055, ctx.currentTime + 1.2);
  audioState.musicFilter.connect(audioState.musicGain).connect(ctx.destination);
  audioState.musicStep = 0;
  scheduleBackgroundStep();
  audioState.musicTimer = setInterval(scheduleBackgroundStep, 420);
}

function stopBackgroundMusic() {
  if (audioState.musicTimer) clearInterval(audioState.musicTimer);
  audioState.musicTimer = null;
  if (audioState.musicGain && audioState.context) {
    const t = audioState.context.currentTime;
    audioState.musicGain.gain.cancelScheduledValues(t);
    audioState.musicGain.gain.setTargetAtTime(0.0001, t, 0.08);
  }
  audioState.musicGain = null;
  audioState.musicFilter = null;
}

function scheduleBackgroundStep() {
  const ctx = audioState.context;
  const destination = audioState.musicFilter;
  if (!ctx || !destination || audioState.muted) return;
  const step = audioState.musicStep % 16;
  const t = ctx.currentTime + 0.02;
  const bassPattern = [55, 0, 82, 0, 65, 0, 98, 0, 55, 0, 73, 0, 82, 0, 49, 0];
  const bass = bassPattern[step];
  if (bass) {
    pulse(ctx, t, bass, 0.16, step % 8 === 0 ? 0.18 : 0.12, destination);
  }
  if ([2, 6, 10, 14].includes(step)) noise(ctx, t + 0.03, 0.045, 1800, 0.026, destination);
  if ([4, 12].includes(step)) impact(ctx, t, 74, 0.15, 0.075, destination);
  if (step === 15) chip(ctx, t + 0.09, 1180, 0.04, 0.028, destination);
  audioState.musicStep += 1;
}

function tone(ctx, frequency, start, duration, type = "sine", volume = 0.08, destination = ctx.destination) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function slide(ctx, start, from, to, duration, volume = 0.08, destination = ctx.destination) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sawtooth";
  oscillator.frequency.setValueAtTime(from, start);
  oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function chip(ctx, start, frequency, duration, volume, destination = ctx.destination) {
  tone(ctx, frequency, start, duration, "square", volume, destination);
}

function pulse(ctx, start, frequency, duration, volume, destination = ctx.destination) {
  tone(ctx, frequency, start, duration, "triangle", volume, destination);
  tone(ctx, frequency * 0.5, start, duration * 1.2, "sine", volume * 0.55, destination);
}

function impact(ctx, start, frequency, duration, volume, destination = ctx.destination) {
  slide(ctx, start, frequency * 2.5, frequency, duration, volume, destination);
  noise(ctx, start, Math.min(0.16, duration * 0.42), frequency * 7, volume * 0.5, destination);
}

function noise(ctx, start, duration, filterFrequency, volume, destination = ctx.destination) {
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(filterFrequency, start);
  filter.Q.setValueAtTime(1.6, start);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.buffer = buffer;
  source.connect(filter).connect(gain).connect(destination);
  source.start(start);
  source.stop(start + duration + 0.02);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

el.newGameBtn.addEventListener("click", createRoom);
el.soloModeBtn.addEventListener("click", () => setMode("solo"));
el.multiModeBtn.addEventListener("click", () => setMode("multi"));
el.soundToggle.addEventListener("click", () => {
  audioState.muted = !audioState.muted;
  localStorage.setItem("steal-bomb-sound-muted", audioState.muted ? "1" : "0");
  updateSoundButton();
  if (audioState.muted) {
    stopBackgroundMusic();
    if (audioState.quoteAudio) audioState.quoteAudio.pause();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }
  if (!audioState.muted) playSound("turn");
});
el.joinForm.addEventListener("submit", (event) => {
  event.preventDefault();
  joinRoom(el.roomCodeInput.value, el.playerName.value);
});
el.copyRoomBtn.addEventListener("click", async () => {
  playSound("click");
  const game = getGame();
  if (!game) return;
  await navigator.clipboard.writeText(buildInviteUrl(game.roomCode));
  el.copyRoomBtn.textContent = "복사됨";
  setTimeout(() => {
    el.copyRoomBtn.textContent = "초대 링크 복사";
  }, 1400);
});
el.startRoomBtn.addEventListener("click", startGame);
el.primaryAction.addEventListener("click", () => {
  const game = getGame();
  const me = myPlayer(game);
  if (!game || !me) return;
  if (game.phase === "turn") drawCard();
  if (["chooseOpen", "replace", "steal", "return", "finished"].includes(game.phase)) renderModal(game, me);
});
el.fastAction.addEventListener("click", () => {
  playSound("click");
  location.reload();
});
el.myHand.addEventListener("click", (event) => {
  const useCard = event.target.closest("[data-use-index]");
  if (useCard) toggleUseCard(Number(useCard.dataset.useIndex));
});
el.closeModalBtn.addEventListener("click", () => {
  playSound("click");
  el.choiceModal.classList.add("hidden");
});
el.modalCards.addEventListener("click", (event) => {
  const open = event.target.closest("[data-open-index]");
  const replace = event.target.closest("[data-replace-action]");
  const steal = event.target.closest("[data-steal-index]");
  const returned = event.target.closest("[data-return-index]");
  if (open) chooseOpen(Number(open.dataset.openIndex));
  if (replace) chooseReplace(replace.dataset.replaceAction === "replace");
  if (steal) stealCard(Number(steal.dataset.stealIndex));
  if (returned) returnCard(Number(returned.dataset.returnIndex));
});
document.addEventListener("pointerdown", unlockAudio, { passive: true });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopBackgroundMusic();
});

try {
  initSupabase();
  updateModeUI();
  updateSoundButton();
  el.playerName.value = roomState.playerName;
  const code = getRoomCodeFromUrl();
  if (code) {
    el.roomCodeInput.value = code;
    if (roomState.playerName) joinRoom(code, roomState.playerName);
  }
  render();
  uiState.timerId = setInterval(() => renderTimer(getGame(), myPlayer(getGame())), 250);
} catch (error) {
  console.error(error);
}
