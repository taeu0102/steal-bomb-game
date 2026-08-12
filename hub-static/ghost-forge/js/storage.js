import {
  MAX_GRADE,
  SCHEMA_VERSION,
  STARTING_KITS,
  getRunView,
  isValidRunState,
} from "./game-engine.js?v=6.0.1";
import { REVENGE_ENDINGS } from "./story.js?v=6.0.1";

const ENDING_IDS = new Set(REVENGE_ENDINGS.map((ending) => ending.id));

export const STORAGE_KEYS = Object.freeze({
  profile: "ghost-forge.profile.v1",
  active: "ghost-forge.active.v1",
  settings: "ghost-forge.settings.v1",
});

const DEFAULT_SETTINGS = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  soundEnabled: false,
  vibrationEnabled: true,
});

export function createDefaultProfile() {
  return {
    schemaVersion: SCHEMA_VERSION,
    totalRuns: 0,
    completedRuns: 0,
    bestScore: 0,
    totalBanked: 0,
    totalExplosions: 0,
    totalScrap: 0,
    fame: 0,
    highestGrade: 0,
    discoveredGrades: [0],
    unlockedKits: ["guardian"],
    selectedKit: "guardian",
    discoveredEndings: [],
    recordedRunIds: [],
    firstPlayedAt: null,
    lastPlayedAt: null,
    lastResult: null,
  };
}

function readJson(key) {
  try {
    const value = globalThis.localStorage?.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function safeCount(value, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(maximum, number));
}

function safeDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
}

function uniqueStrings(value, limit = 100) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item) => typeof item === "string"))].slice(-limit)
    : [];
}

function sanitizeLastResult(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (typeof value.runId !== "string" || !/^ghost-[0-9a-f]{8}$/.test(value.runId)) return null;
  return {
    runId: value.runId,
    score: safeCount(value.score),
    tierId: typeof value.tierId === "string" ? value.tierId : "empty",
    explosions: safeCount(value.explosions, 4),
    highestGrade: safeCount(value.highestGrade, MAX_GRADE),
    endingId: ENDING_IDS.has(value.endingId) ? value.endingId : null,
    finishedAt: safeDate(value.finishedAt),
  };
}

function unlockedKitsFor(profile) {
  const unlocked = new Set(["guardian"]);
  if (profile.completedRuns >= 1 || profile.bestScore >= 2000 || profile.unlockedKits?.includes("artisan")) {
    unlocked.add("artisan");
  }
  if (profile.highestGrade >= 50 || profile.unlockedKits?.includes("daring")) unlocked.add("daring");
  return Object.keys(STARTING_KITS).filter((kitId) => unlocked.has(kitId));
}

function sanitizeProfile(value) {
  const profile = createDefaultProfile();
  if (!value || typeof value !== "object" || Array.isArray(value)) return profile;

  profile.totalRuns = safeCount(value.totalRuns, 1_000_000);
  profile.completedRuns = safeCount(value.completedRuns, profile.totalRuns);
  profile.bestScore = safeCount(value.bestScore);
  profile.totalBanked = safeCount(value.totalBanked);
  profile.totalExplosions = safeCount(value.totalExplosions);
  profile.totalScrap = safeCount(value.totalScrap);
  profile.fame = safeCount(value.fame);
  profile.highestGrade = safeCount(value.highestGrade, MAX_GRADE);
  profile.discoveredGrades = Array.isArray(value.discoveredGrades)
    ? [...new Set(value.discoveredGrades.map((grade) => safeCount(grade, MAX_GRADE)))].sort((a, b) => a - b)
    : [0];
  if (!profile.discoveredGrades.includes(0)) profile.discoveredGrades.unshift(0);
  profile.recordedRunIds = uniqueStrings(value.recordedRunIds, 30).filter((runId) =>
    /^ghost-[0-9a-f]{8}$/.test(runId)
  );
  profile.discoveredEndings = uniqueStrings(value.discoveredEndings, REVENGE_ENDINGS.length).filter((endingId) =>
    ENDING_IDS.has(endingId)
  );
  profile.firstPlayedAt = safeDate(value.firstPlayedAt);
  profile.lastPlayedAt = safeDate(value.lastPlayedAt);
  profile.lastResult = sanitizeLastResult(value.lastResult);
  profile.unlockedKits = uniqueStrings(value.unlockedKits, Object.keys(STARTING_KITS).length);
  profile.unlockedKits = unlockedKitsFor(profile);
  profile.selectedKit =
    typeof value.selectedKit === "string" && profile.unlockedKits.includes(value.selectedKit)
      ? value.selectedKit
      : "guardian";
  return profile;
}

export function loadProfile() {
  const value = readJson(STORAGE_KEYS.profile);
  return value?.schemaVersion === SCHEMA_VERSION || value?.schemaVersion === 1
    ? sanitizeProfile(value)
    : createDefaultProfile();
}

export function saveProfile(profile) {
  return writeJson(STORAGE_KEYS.profile, {
    ...sanitizeProfile(profile),
    schemaVersion: SCHEMA_VERSION,
  });
}

export function recordRunStart() {
  const profile = loadProfile();
  const now = new Date().toISOString();
  profile.totalRuns += 1;
  profile.firstPlayedAt ||= now;
  profile.lastPlayedAt = now;
  const saved = saveProfile(profile);
  return { profile: sanitizeProfile(profile), saved };
}

export function recordRunFinish(run, endingId = null) {
  if (!isValidRunState(run) || run.phase !== "result") {
    return {
      profile: loadProfile(),
      saved: false,
      alreadyRecorded: false,
      isNewBest: false,
      isNewEnding: false,
      newlyUnlockedKits: [],
    };
  }

  const profile = loadProfile();
  if (profile.recordedRunIds.includes(run.runId)) {
    clearActiveRun();
    return {
      profile,
      saved: true,
      alreadyRecorded: true,
      isNewBest: false,
      isNewEnding: false,
      newlyUnlockedKits: [],
    };
  }

  const view = getRunView(run);
  const result = view.result;
  const previousKits = new Set(profile.unlockedKits);
  const validEndingId = ENDING_IDS.has(endingId) ? endingId : null;
  const isNewEnding = Boolean(validEndingId && !profile.discoveredEndings.includes(validEndingId));
  const isNewBest = result.score > profile.bestScore;
  const now = new Date().toISOString();

  profile.completedRuns += 1;
  profile.totalRuns = Math.max(profile.totalRuns, profile.completedRuns);
  profile.bestScore = Math.max(profile.bestScore, result.score);
  profile.totalBanked += result.score;
  profile.totalExplosions += result.explosions;
  profile.totalScrap += run.scrap;
  profile.fame += result.fame;
  profile.highestGrade = Math.max(profile.highestGrade, result.highestGrade);
  profile.discoveredGrades = [
    ...new Set([
      ...profile.discoveredGrades,
      ...run.results.flatMap((entry) =>
        Array.from({ length: entry.reachedGrade + 1 }, (_, grade) => grade)
      ),
    ]),
  ].sort((a, b) => a - b);
  profile.recordedRunIds = [...profile.recordedRunIds, run.runId].slice(-30);
  if (validEndingId) profile.discoveredEndings = [...new Set([...profile.discoveredEndings, validEndingId])];
  profile.lastPlayedAt = now;
  profile.lastResult = {
    runId: run.runId,
    score: result.score,
    tierId: result.tier.id,
    explosions: result.explosions,
    highestGrade: result.highestGrade,
    endingId: validEndingId,
    finishedAt: now,
  };
  profile.unlockedKits = unlockedKitsFor(profile);
  if (!profile.unlockedKits.includes(profile.selectedKit)) profile.selectedKit = "guardian";

  const newlyUnlockedKits = profile.unlockedKits.filter((kitId) => !previousKits.has(kitId));
  const saved = saveProfile(profile);
  if (saved) clearActiveRun();
  return {
    profile: sanitizeProfile(profile),
    saved,
    alreadyRecorded: false,
    isNewBest,
    isNewEnding,
    newlyUnlockedKits,
  };
}

export function loadActiveRun() {
  const value = readJson(STORAGE_KEYS.active);
  return isValidRunState(value) && value.phase !== "result" ? value : null;
}

export function saveActiveRun(run) {
  if (!isValidRunState(run) || run.phase === "result") return false;
  return writeJson(STORAGE_KEYS.active, run);
}

export function clearActiveRun() {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEYS.active);
  } catch {
    // 저장소가 막혀도 현재 런 결과는 화면에서 계속 확인할 수 있습니다.
  }
}

export function loadSettings() {
  const value = readJson(STORAGE_KEYS.settings);
  if (!value || (value.schemaVersion !== SCHEMA_VERSION && value.schemaVersion !== 1)) {
    return { ...DEFAULT_SETTINGS };
  }
  return {
    ...DEFAULT_SETTINGS,
    soundEnabled: value.soundEnabled === true,
    vibrationEnabled: value.vibrationEnabled !== false,
  };
}

export function saveSettings(settings) {
  return writeJson(STORAGE_KEYS.settings, {
    ...DEFAULT_SETTINGS,
    soundEnabled: settings?.soundEnabled === true,
    vibrationEnabled: settings?.vibrationEnabled !== false,
  });
}

export function clearAllForgeData() {
  try {
    Object.values(STORAGE_KEYS).forEach((key) => globalThis.localStorage?.removeItem(key));
  } catch {
    // 브라우저가 허용하는 범위에서만 게임 기록을 지웁니다.
  }
}
