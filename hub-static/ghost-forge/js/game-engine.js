export const SCHEMA_VERSION = 2;
export const ARTIFACT_COUNT = 4;
export const MAX_ATTEMPTS = 12;
export const DEFAULT_DURABILITY = 5;
export const MAX_GRADE = 100;
export const MAX_STABILITY = 3;
export const MAX_AMPLIFICATION = 4;
export const MAX_POLISH = 2;

export const GRADE_TITLES = deepFreeze([
  { milestone: 0, id: "rusted_grudge", name: "녹슨 원한" },
  { milestone: 10, id: "pot_lid_victor", name: "솥뚜껑을 넘은 자" },
  { milestone: 20, id: "wanted", name: "관청의 수배자" },
  { milestone: 30, id: "gate_breaker", name: "관문을 넘은 자" },
  { milestone: 40, id: "palace_scratch", name: "궁문의 흠집" },
  { milestone: 50, id: "royal_nightmare", name: "왕실의 악몽" },
  { milestone: 60, id: "legend_waker", name: "전설을 깨운 자" },
  { milestone: 70, id: "shield_yacha", name: "방패 앞의 야차" },
  { milestone: 80, id: "heaven_shaker", name: "하늘문을 흔든 자" },
  { milestone: 90, id: "divine_threshold", name: "신좌의 문턱" },
  { milestone: 100, id: "world_end_blade", name: "멸세검의 주인" },
]);

export const SAFE_CHANCE_BANDS = Object.freeze([
  9800, 9600, 9400, 9200, 8900, 8500, 8000, 7400, 6600, 5500, 0,
]);
export const AMPLIFY_CHANCE_BANDS = Object.freeze([
  7600, 7200, 6800, 6400, 5900, 5400, 4800, 4100, 3400, 2600, 0,
]);

function gradeBand(grade) {
  return Math.min(GRADE_TITLES.length - 1, Math.floor(grade / 10));
}

// 기존 `SAFE_CHANCES[grade]` API를 유지하면서 확률은 10강 단위로만 바뀝니다.
export const SAFE_CHANCES = Object.freeze(
  Array.from({ length: MAX_GRADE + 1 }, (_, grade) => SAFE_CHANCE_BANDS[gradeBand(grade)])
);
export const AMPLIFY_BASE_CHANCES = Object.freeze(
  Array.from({ length: MAX_GRADE + 1 }, (_, grade) => AMPLIFY_CHANCE_BANDS[gradeBand(grade)])
);

export const GRADE_DATA = deepFreeze(
  Array.from({ length: MAX_GRADE + 1 }, (_, grade) => {
    const title = GRADE_TITLES[gradeBand(grade)];
    return {
      grade,
      id: title.id,
      name: title.name,
      multiplier: Number((1.035 ** grade).toFixed(6)),
    };
  })
);

export const REWARD_ITEMS = deepFreeze({
  charm: {
    id: "charm",
    title: "보호 부적",
    short: "실패 피해 0",
    description: "다음 강화나 증폭의 실패 피해를 막습니다. 성공해도 소모됩니다.",
  },
  powder: {
    id: "powder",
    title: "청명분",
    short: "다음 증폭 +12%p",
    description: "다음 위험 증폭 확률을 12%p 높입니다.",
  },
  goldThread: {
    id: "goldThread",
    title: "봉인금실",
    short: "다음 봉인 +25%",
    description: "다음 봉인 점수를 25% 높입니다. 긴급 봉인에도 적용됩니다.",
  },
  repairNail: {
    id: "repairNail",
    title: "수선못",
    short: "다음 단계 내구도 6",
    description: "다음 단조 단계의 시작 내구도를 5에서 6으로 높입니다.",
  },
});

export const STARTING_KITS = deepFreeze({
  guardian: {
    id: "guardian",
    title: "수호 꾸러미",
    description: "보호 부적 1개로 시작합니다.",
    inventory: { charm: 1, powder: 0, goldThread: 0, repairNail: 0 },
  },
  artisan: {
    id: "artisan",
    title: "장인 꾸러미",
    description: "봉인금실 1개로 시작합니다.",
    inventory: { charm: 0, powder: 0, goldThread: 1, repairNail: 0 },
  },
  daring: {
    id: "daring",
    title: "승부 꾸러미",
    description: "청명분 1개로 시작합니다.",
    inventory: { charm: 0, powder: 1, goldThread: 0, repairNail: 0 },
  },
});

export const RESULT_TIERS = deepFreeze([
  { id: "empty", title: "빈 인장", minScore: 0 },
  { id: "rough", title: "거친 인장", minScore: 1 },
  { id: "bronze", title: "동빛 인장", minScore: 1000 },
  { id: "silver", title: "은빛 인장", minScore: 3000 },
  { id: "gold", title: "금빛 인장", minScore: 7000 },
  { id: "yacha", title: "멸신 인장", minScore: 12000 },
]);

const PHASES = Object.freeze(["forging", "reward", "result"]);
const ARTIFACT_STATUSES = Object.freeze(["forging", "sealed", "emergency", "exploded"]);
const REWARD_IDS = Object.freeze(Object.keys(REWARD_ITEMS));
const UINT32_MAX_PLUS_ONE = 0x1_0000_0000;
const DEFAULT_SEED = 0x9e3779b9;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clampInteger(value, minimum, maximum) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return minimum;
  return Math.max(minimum, Math.min(maximum, number));
}

function isIntegerBetween(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

function normalizeSeed(seed) {
  let normalized = Number(seed);
  if (!Number.isFinite(normalized)) {
    try {
      if (typeof globalThis.crypto?.getRandomValues === "function") {
        const random = new Uint32Array(1);
        globalThis.crypto.getRandomValues(random);
        normalized = random[0];
      } else {
        normalized = Date.now();
      }
    } catch {
      normalized = Date.now();
    }
  }
  normalized = Math.floor(normalized) >>> 0;
  return normalized || DEFAULT_SEED;
}

function randomUnit(state) {
  state.rngState = (state.rngState + 0x6d2b79f5) >>> 0;
  let value = state.rngState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  value = (value ^ (value >>> 14)) >>> 0;
  state.rngCursor += 1;
  return value / UINT32_MAX_PLUS_ONE;
}

function rollBasisPoints(state) {
  return Math.floor(randomUnit(state) * 10_000) + 1;
}

function appendHistory(state, event) {
  state.history.push({ sequence: state.history.length + 1, ...event });
}

function makeArtifact(index, maxDurability = DEFAULT_DURABILITY, stageStartGrade = 0) {
  return {
    index,
    stageStartGrade,
    grade: stageStartGrade,
    durability: maxDurability,
    maxDurability,
    stability: 0,
    amplification: 0,
    polish: 0,
    attempts: 0,
    status: "forging",
  };
}

function inventoryFromProfile(profile) {
  const requestedKit = typeof profile?.selectedKit === "string" ? profile.selectedKit : "guardian";
  const unlocked = Array.isArray(profile?.unlockedKits) ? profile.unlockedKits : ["guardian"];
  const kitId = STARTING_KITS[requestedKit] && unlocked.includes(requestedKit) ? requestedKit : "guardian";
  return { kitId, inventory: clone(STARTING_KITS[kitId].inventory) };
}

function getResultTier(score) {
  return RESULT_TIERS.filter((tier) => score >= tier.minScore).at(-1);
}

function makeRewardOffers(state) {
  const firstIndex = Math.floor(randomUnit(state) * REWARD_IDS.length);
  const secondOffset = Math.floor(randomUnit(state) * (REWARD_IDS.length - 1));
  const secondIndex = secondOffset >= firstIndex ? secondOffset + 1 : secondOffset;
  return [REWARD_IDS[firstIndex], REWARD_IDS[secondIndex]];
}

function startNextArtifact(state) {
  const nextIndex = state.artifactIndex + 1;
  const checkpointGrade = state.current.grade;
  let maxDurability = DEFAULT_DURABILITY;
  let usedRepairNail = false;
  if (state.inventory.repairNail > 0) {
    state.inventory.repairNail -= 1;
    maxDurability += 1;
    usedRepairNail = true;
  }
  state.artifactIndex = nextIndex;
  state.current = makeArtifact(nextIndex, maxDurability, checkpointGrade);
  state.phase = "forging";
  state.rewardOffers = [];
  state.armedCharm = false;
  appendHistory(state, {
    type: "artifact_start",
    artifactIndex: nextIndex,
    checkpointGrade,
    maxDurability,
    usedRepairNail,
  });
}

function consumeGoldThread(state) {
  if (state.inventory.goldThread < 1) return false;
  state.inventory.goldThread -= 1;
  return true;
}

function finishArtifact(state, outcome) {
  const artifact = state.current;
  const reachedGrade = artifact.grade;
  if (outcome === "exploded") {
    artifact.grade = artifact.stageStartGrade;
    artifact.stability = 0;
    artifact.amplification = 0;
    artifact.polish = 0;
  }
  const sealed = outcome === "sealed" || outcome === "emergency";
  const usedGoldThread = sealed ? consumeGoldThread(state) : false;
  const sealFactor = outcome === "emergency" ? 0.8 : 1;
  const goldFactor = usedGoldThread ? 1.25 : 1;
  const value = sealed ? deriveArtifactValue(artifact, sealFactor * goldFactor) : 0;

  artifact.status = outcome;
  if (outcome === "exploded") state.scrap += 1;
  else state.bankedScore += value;

  const result = {
    artifactIndex: artifact.index,
    outcome,
    stageStartGrade: artifact.stageStartGrade,
    reachedGrade,
    grade: artifact.grade,
    durability: artifact.durability,
    maxDurability: artifact.maxDurability,
    stability: artifact.stability,
    amplification: artifact.amplification,
    polish: artifact.polish,
    attempts: artifact.attempts,
    value,
    sealFactor,
    usedGoldThread,
  };
  state.results.push(result);
  appendHistory(state, {
    type: "artifact_finish",
    artifactIndex: artifact.index,
    outcome,
    reachedGrade,
    checkpointGrade: artifact.grade,
    value,
    usedGoldThread,
  });

  if (artifact.index >= ARTIFACT_COUNT - 1) {
    state.phase = "result";
    state.rewardOffers = [];
    state.armedCharm = false;
    appendHistory(state, {
      type: "run_finish",
      artifactIndex: artifact.index,
      score: state.bankedScore,
    });
    return;
  }

  state.phase = "reward";
  state.rewardOffers = makeRewardOffers(state);
  state.armedCharm = false;
}

function useAttemptInsurance(state, action) {
  const usedCharm = state.armedCharm && state.inventory.charm > 0;
  const usedPowder = action === "amplify" && state.inventory.powder > 0;
  if (usedCharm) state.inventory.charm -= 1;
  if (usedPowder) state.inventory.powder -= 1;
  state.armedCharm = false;
  return { usedCharm, usedPowder };
}

function settleAttempt(state, action, chance, success, roll, usedCharm, usedPowder) {
  const artifact = state.current;
  artifact.attempts += 1;
  let damage = 0;

  if (success && action === "reinforce") {
    artifact.grade = Math.min(MAX_GRADE, artifact.grade + 2);
    artifact.stability = Math.min(MAX_STABILITY, artifact.stability + 1);
  } else if (success && action === "amplify") {
    artifact.grade = Math.min(MAX_GRADE, artifact.grade + 5);
    artifact.amplification = Math.min(MAX_AMPLIFICATION, artifact.amplification + 1);
    artifact.stability = 0;
  } else {
    damage = usedCharm ? 0 : action === "reinforce" ? 1 : 2;
    artifact.durability = Math.max(0, artifact.durability - damage);
    if (action === "amplify") artifact.stability = 0;
  }

  appendHistory(state, {
    type: action,
    artifactIndex: artifact.index,
    chance,
    roll,
    success,
    damage,
    usedCharm,
    usedPowder,
    grade: artifact.grade,
    durability: artifact.durability,
  });

  if (artifact.durability === 0) finishArtifact(state, "exploded");
  else if (artifact.attempts >= MAX_ATTEMPTS) finishArtifact(state, "emergency");
}

function canReinforce(artifact) {
  if (!artifact || artifact.status !== "forging" || artifact.attempts >= MAX_ATTEMPTS) return false;
  return artifact.grade < MAX_GRADE;
}

function canAmplify(artifact) {
  if (!artifact || artifact.status !== "forging" || artifact.attempts >= MAX_ATTEMPTS) return false;
  return artifact.grade < MAX_GRADE;
}

export function deriveArtifactValue(artifact, sealMultiplier = 1) {
  artifact = artifact?.current ?? artifact;
  if (!artifact || !isIntegerBetween(artifact.grade, 0, MAX_GRADE)) return 0;
  const gradeMultiplier = GRADE_DATA[artifact.grade].multiplier;
  const amplification = clampInteger(artifact.amplification, 0, MAX_AMPLIFICATION);
  const polish = clampInteger(artifact.polish, 0, MAX_POLISH);
  const multiplier = Math.max(0, Number(sealMultiplier) || 0);
  return Math.round(
    100 * gradeMultiplier * (1 + amplification * 0.35) * (1 + polish * 0.15) * multiplier
  );
}

export function createRun(seed, profile = {}) {
  const normalizedSeed = normalizeSeed(seed);
  const kit = inventoryFromProfile(profile);
  return {
    schemaVersion: SCHEMA_VERSION,
    runId: `ghost-${normalizedSeed.toString(16).padStart(8, "0")}`,
    seed: normalizedSeed,
    rngState: normalizedSeed,
    rngCursor: 0,
    phase: "forging",
    artifactIndex: 0,
    artifactCount: ARTIFACT_COUNT,
    bankedScore: 0,
    scrap: 0,
    selectedKit: kit.kitId,
    inventory: kit.inventory,
    armedCharm: false,
    current: makeArtifact(0),
    rewardOffers: [],
    results: [],
    history: [],
  };
}

export function getActionPreview(state) {
  if (!isValidRunState(state) || state.phase !== "forging") return null;

  const artifact = state.current;
  const charmReady = state.armedCharm && state.inventory.charm > 0;
  const powderReady = state.inventory.powder > 0;
  const goldReady = state.inventory.goldThread > 0;
  const reinforceChance = SAFE_CHANCES[artifact.grade];
  const stabilityBonus = artifact.stability * 800;
  const powderBonus = powderReady ? 1200 : 0;
  const amplifyChance = Math.min(
    9000,
    AMPLIFY_BASE_CHANCES[artifact.grade] + stabilityBonus + powderBonus
  );

  const reinforced = clone(artifact);
  reinforced.grade = Math.min(MAX_GRADE, reinforced.grade + 2);
  reinforced.stability = Math.min(MAX_STABILITY, reinforced.stability + 1);

  const amplified = clone(artifact);
  amplified.grade = Math.min(MAX_GRADE, amplified.grade + 5);
  amplified.amplification = Math.min(MAX_AMPLIFICATION, amplified.amplification + 1);
  amplified.stability = 0;

  const sealMultiplier = goldReady ? 1.25 : 1;
  const nextAttemptIsEmergency = artifact.attempts === MAX_ATTEMPTS - 1;
  const emergencyMultiplier = 0.8 * sealMultiplier;

  return {
    reinforce: {
      enabled: canReinforce(artifact),
      chance: reinforceChance,
      chancePercent: reinforceChance / 100,
      usesCharm: charmReady,
      success: {
        grade: reinforced.grade,
        gradeName: GRADE_DATA[reinforced.grade].name,
        stability: reinforced.stability,
        polish: reinforced.polish,
        value: deriveArtifactValue(reinforced),
        sealValue: deriveArtifactValue(reinforced, sealMultiplier),
        emergencySealValue: nextAttemptIsEmergency
          ? deriveArtifactValue(reinforced, emergencyMultiplier)
          : null,
      },
      failure: {
        damage: charmReady ? 0 : 1,
        durability: Math.max(0, artifact.durability - (charmReady ? 0 : 1)),
        explodes: !charmReady && artifact.durability <= 1,
        emergencySealValue:
          nextAttemptIsEmergency && (charmReady || artifact.durability > 1)
            ? deriveArtifactValue(artifact, emergencyMultiplier)
            : null,
      },
    },
    amplify: {
      enabled: canAmplify(artifact),
      chance: amplifyChance,
      chancePercent: amplifyChance / 100,
      baseChance: AMPLIFY_BASE_CHANCES[artifact.grade],
      stabilityBonus,
      powderBonus,
      usesCharm: charmReady,
      usesPowder: powderReady,
      success: {
        grade: amplified.grade,
        gradeName: GRADE_DATA[amplified.grade].name,
        amplification: amplified.amplification,
        value: deriveArtifactValue(amplified),
        sealValue: deriveArtifactValue(amplified, sealMultiplier),
        emergencySealValue: nextAttemptIsEmergency
          ? deriveArtifactValue(amplified, emergencyMultiplier)
          : null,
      },
      failure: {
        damage: charmReady ? 0 : 2,
        durability: Math.max(0, artifact.durability - (charmReady ? 0 : 2)),
        explodes: !charmReady && artifact.durability <= 2,
        emergencySealValue:
          nextAttemptIsEmergency && (charmReady || artifact.durability > 2)
            ? deriveArtifactValue(artifact, emergencyMultiplier)
            : null,
      },
    },
    seal: {
      enabled: true,
      value: deriveArtifactValue(artifact, sealMultiplier),
      baseValue: deriveArtifactValue(artifact),
      multiplier: sealMultiplier,
      usesGoldThread: goldReady,
    },
    remainingAttempts: MAX_ATTEMPTS - artifact.attempts,
    nextAttemptIsEmergency,
    emergencyMultiplier: 0.8,
  };
}

export function reinforce(state) {
  if (!isValidRunState(state) || state.phase !== "forging" || !canReinforce(state.current)) {
    return state;
  }

  const next = clone(state);
  const chance = SAFE_CHANCES[next.current.grade];
  const { usedCharm, usedPowder } = useAttemptInsurance(next, "reinforce");
  const roll = rollBasisPoints(next);
  settleAttempt(next, "reinforce", chance, roll <= chance, roll, usedCharm, usedPowder);
  return next;
}

export function amplify(state) {
  if (!isValidRunState(state) || state.phase !== "forging" || !canAmplify(state.current)) {
    return state;
  }

  const next = clone(state);
  const baseChance = AMPLIFY_BASE_CHANCES[next.current.grade];
  const stabilityBonus = next.current.stability * 800;
  const powderBonus = next.inventory.powder > 0 ? 1200 : 0;
  const chance = Math.min(9000, baseChance + stabilityBonus + powderBonus);
  const { usedCharm, usedPowder } = useAttemptInsurance(next, "amplify");
  const roll = rollBasisPoints(next);
  settleAttempt(next, "amplify", chance, roll <= chance, roll, usedCharm, usedPowder);
  return next;
}

export function sealCurrent(state) {
  if (!isValidRunState(state) || state.phase !== "forging") return state;
  const next = clone(state);
  finishArtifact(next, "sealed");
  return next;
}

export function toggleCharm(state) {
  if (!isValidRunState(state) || state.phase !== "forging" || state.inventory.charm < 1) {
    return state;
  }
  const next = clone(state);
  next.armedCharm = !next.armedCharm;
  appendHistory(next, {
    type: "toggle_charm",
    artifactIndex: next.artifactIndex,
    armed: next.armedCharm,
  });
  return next;
}

export function chooseReward(state, rewardId) {
  if (
    !isValidRunState(state) ||
    state.phase !== "reward" ||
    !state.rewardOffers.includes(rewardId) ||
    !REWARD_ITEMS[rewardId]
  ) {
    return state;
  }

  const next = clone(state);
  next.inventory[rewardId] += 1;
  appendHistory(next, {
    type: "reward",
    artifactIndex: next.artifactIndex,
    rewardId,
  });
  startNextArtifact(next);
  return next;
}

export function getRunView(state) {
  if (!isValidRunState(state)) return null;
  const artifact = state.current;
  const grade = GRADE_DATA[artifact.grade];
  const preview = state.phase === "forging" ? getActionPreview(state) : null;
  const explosions = state.results.filter((result) => result.outcome === "exploded").length;
  const sealedCount = state.results.length - explosions;
  const highestGrade = Math.max(
    artifact.grade,
    ...state.results.map((result) => result.reachedGrade)
  );
  const tier = state.phase === "result" ? getResultTier(state.bankedScore) : null;

  return {
    phase: state.phase,
    runId: state.runId,
    artifactIndex: state.artifactIndex,
    artifactNumber: state.artifactIndex + 1,
    artifactCount: state.artifactCount,
    bankedScore: state.bankedScore,
    scrap: state.scrap,
    selectedKit: state.selectedKit,
    inventory: clone(state.inventory),
    armedCharm: state.armedCharm,
    grade: artifact.grade,
    gradeId: grade.id,
    gradeName: grade.name,
    durability: artifact.durability,
    maxDurability: artifact.maxDurability,
    stability: artifact.stability,
    amplification: artifact.amplification,
    polish: artifact.polish,
    attempts: artifact.attempts,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - artifact.attempts),
    currentValue: deriveArtifactValue(artifact),
    artifactStatus: artifact.status,
    current: clone(artifact),
    actionPreview: preview,
    rewardOffers: state.rewardOffers.map((id) => REWARD_ITEMS[id]),
    results: clone(state.results),
    lastEvent: state.history.length ? clone(state.history.at(-1)) : null,
    result:
      state.phase === "result"
        ? {
            score: state.bankedScore,
            tier,
            bankrupt: state.bankedScore === 0,
            explosions,
            sealedCount,
            highestGrade,
            fame: Math.floor(Math.sqrt(state.bankedScore)),
          }
        : null,
  };
}

function validInventory(inventory) {
  return (
    inventory &&
    typeof inventory === "object" &&
    !Array.isArray(inventory) &&
    REWARD_IDS.every((id) => Number.isInteger(inventory[id]) && inventory[id] >= 0)
  );
}

function validArtifact(artifact, expectedIndex) {
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) return false;
  return (
    artifact.index === expectedIndex &&
    isIntegerBetween(artifact.stageStartGrade, 0, MAX_GRADE) &&
    isIntegerBetween(artifact.grade, 0, MAX_GRADE) &&
    artifact.grade >= artifact.stageStartGrade &&
    isIntegerBetween(artifact.maxDurability, DEFAULT_DURABILITY, DEFAULT_DURABILITY + 1) &&
    isIntegerBetween(artifact.durability, 0, artifact.maxDurability) &&
    isIntegerBetween(artifact.stability, 0, MAX_STABILITY) &&
    isIntegerBetween(artifact.amplification, 0, MAX_AMPLIFICATION) &&
    isIntegerBetween(artifact.polish, 0, MAX_POLISH) &&
    isIntegerBetween(artifact.attempts, 0, MAX_ATTEMPTS) &&
    ARTIFACT_STATUSES.includes(artifact.status)
  );
}

function validResult(result, expectedIndex) {
  if (!validArtifact({ ...result, index: result.artifactIndex, status: result.outcome }, expectedIndex)) {
    return false;
  }
  if (!["sealed", "emergency", "exploded"].includes(result.outcome)) return false;
  if (!Number.isInteger(result.value) || result.value < 0) return false;
  if (![0.8, 1].includes(result.sealFactor) || typeof result.usedGoldThread !== "boolean") return false;
  if (!isIntegerBetween(result.reachedGrade, result.stageStartGrade, MAX_GRADE)) return false;
  if (result.outcome === "exploded") {
    return (
      result.durability === 0 &&
      result.grade === result.stageStartGrade &&
      result.value === 0 &&
      !result.usedGoldThread
    );
  }
  if (result.reachedGrade !== result.grade) return false;
  if (result.durability < 1) return false;
  const multiplier = result.sealFactor * (result.usedGoldThread ? 1.25 : 1);
  return result.value === deriveArtifactValue(result, multiplier);
}

export function isValidRunState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return false;
  if (state.schemaVersion !== SCHEMA_VERSION) return false;
  if (typeof state.runId !== "string" || !/^ghost-[0-9a-f]{8}$/.test(state.runId)) return false;
  if (!isIntegerBetween(state.seed, 1, 0xffff_ffff)) return false;
  if (state.runId !== `ghost-${state.seed.toString(16).padStart(8, "0")}`) return false;
  if (!isIntegerBetween(state.rngState, 0, 0xffff_ffff)) return false;
  if (!Number.isInteger(state.rngCursor) || state.rngCursor < 0) return false;
  if (!PHASES.includes(state.phase)) return false;
  if (state.artifactCount !== ARTIFACT_COUNT) return false;
  if (!isIntegerBetween(state.artifactIndex, 0, ARTIFACT_COUNT - 1)) return false;
  if (!Number.isInteger(state.bankedScore) || state.bankedScore < 0) return false;
  if (!Number.isInteger(state.scrap) || state.scrap < 0) return false;
  if (!STARTING_KITS[state.selectedKit] || !validInventory(state.inventory)) return false;
  if (typeof state.armedCharm !== "boolean") return false;
  if (state.armedCharm && (state.phase !== "forging" || state.inventory.charm < 1)) return false;
  if (!validArtifact(state.current, state.artifactIndex)) return false;

  if (!Array.isArray(state.results) || state.results.length > ARTIFACT_COUNT) return false;
  if (!state.results.every((result, index) => validResult(result, index))) return false;
  if (
    !state.results.every(
      (result, index) => index === 0 || result.stageStartGrade === state.results[index - 1].grade
    )
  ) {
    return false;
  }
  const expectedBank = state.results.reduce((total, result) => total + result.value, 0);
  const expectedScrap = state.results.filter((result) => result.outcome === "exploded").length;
  if (state.bankedScore !== expectedBank || state.scrap !== expectedScrap) return false;

  if (!Array.isArray(state.rewardOffers)) return false;
  if (new Set(state.rewardOffers).size !== state.rewardOffers.length) return false;
  if (!state.rewardOffers.every((id) => REWARD_IDS.includes(id))) return false;

  if (state.phase === "forging") {
    if (state.current.status !== "forging" || state.current.durability < 1) return false;
    if (state.current.attempts >= MAX_ATTEMPTS) return false;
    if (state.results.length !== state.artifactIndex || state.rewardOffers.length !== 0) return false;
    if (state.artifactIndex > 0 && state.current.stageStartGrade !== state.results.at(-1).grade) return false;
  } else {
    if (state.current.status === "forging") return false;
    if (state.results.length !== state.artifactIndex + 1) return false;
    const finalResult = state.results.at(-1);
    if (
      finalResult.artifactIndex !== state.current.index ||
      finalResult.outcome !== state.current.status ||
      finalResult.grade !== state.current.grade ||
      finalResult.durability !== state.current.durability ||
      finalResult.attempts !== state.current.attempts
    ) {
      return false;
    }
    if (state.phase === "reward" && state.rewardOffers.length !== 2) return false;
    if (state.phase === "result" && (state.artifactIndex !== ARTIFACT_COUNT - 1 || state.rewardOffers.length)) {
      return false;
    }
  }

  if (!Array.isArray(state.history)) return false;
  const validHistory = state.history.every(
    (entry, index) =>
      entry &&
      typeof entry === "object" &&
      entry.sequence === index + 1 &&
      [
        "reinforce",
        "amplify",
        "toggle_charm",
        "artifact_finish",
        "artifact_start",
        "reward",
        "run_finish",
      ].includes(entry.type) &&
      isIntegerBetween(entry.artifactIndex, 0, ARTIFACT_COUNT - 1)
  );
  if (!validHistory) return false;
  const actionHistoryValid = state.history.every((entry) => {
    if (entry.type !== "reinforce" && entry.type !== "amplify") return true;
    return (
      isIntegerBetween(entry.chance, 1, 10_000) &&
      isIntegerBetween(entry.roll, 1, 10_000) &&
      entry.success === (entry.roll <= entry.chance) &&
      typeof entry.usedCharm === "boolean" &&
      typeof entry.usedPowder === "boolean" &&
      isIntegerBetween(entry.damage, 0, 2)
    );
  });
  if (!actionHistoryValid) return false;
  const randomActionCount = state.history.filter(
    (entry) => entry.type === "reinforce" || entry.type === "amplify"
  ).length;
  const rewardRollCount = Math.min(state.results.length, ARTIFACT_COUNT - 1) * 2;
  if (state.rngCursor !== randomActionCount + rewardRollCount) return false;
  const expectedRngState = (state.seed + Math.imul(state.rngCursor, 0x6d2b79f5)) >>> 0;
  if (state.rngState !== expectedRngState) return false;

  return true;
}
