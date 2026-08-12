import {
  GRADE_DATA,
  MAX_AMPLIFICATION,
  MAX_POLISH,
  RESULT_TIERS,
  STARTING_KITS,
  amplify,
  chooseReward,
  createRun,
  getRunView,
  reinforce,
  sealCurrent,
  toggleCharm,
} from "./game-engine.js?v=6.0.1";
import {
  loadActiveRun,
  loadProfile,
  loadSettings,
  recordRunFinish,
  recordRunStart,
  saveActiveRun,
  saveProfile,
  saveSettings,
} from "./storage.js?v=6.0.1";
import { GameAudio } from "./audio.js?v=6.0.1";
import {
  REVENGE_ENDINGS,
  getForgeWhisper,
  getNextGradeMilestone,
  getRevengeEnding,
} from "./story.js?v=6.0.1";

const ARTIFACTS = Object.freeze([
  { name: "원한검", kicker: "첫째 밤 · 원한을 새긴다", mark: "怨" },
  { name: "혈월검", kicker: "둘째 밤 · 귀화를 봉인한다", mark: "月" },
  { name: "야차검", kicker: "셋째 밤 · 전설을 깨운다", mark: "夜" },
  { name: "멸세검", kicker: "마지막 밤 · 신좌를 겨눈다", mark: "滅" },
]);

const GRADE_COLORS = Object.freeze([
  "#8d948f",
  "#b9845c",
  "#9ba8ad",
  "#c8d6d4",
  "#d5b06a",
  "#e36a50",
  "#8fbfe0",
  "#a678d6",
  "#ef7898",
  "#cfa3ff",
  "#fff0ba",
]);

const ITEM_MARKS = Object.freeze({ charm: "護", powder: "明", goldThread: "封", repairNail: "修" });
const ITEM_SHORT = Object.freeze({ powder: "청명분", goldThread: "봉인금실", repairNail: "수선못" });
const KIT_SHORT = Object.freeze({
  guardian: "수호 · 부적 1",
  artisan: "장인 · 금실 1",
  daring: "승부 · 청명분 1",
});
const numberFormat = new Intl.NumberFormat("ko-KR");

const byId = (id) => document.getElementById(id);
const elements = {
  startScreen: byId("startScreen"),
  forgeScreen: byId("forgeScreen"),
  resultScreen: byId("resultScreen"),
  startTitle: byId("startTitle"),
  bestScore: byId("bestScore"),
  totalSealed: byId("totalSealed"),
  kitSelect: byId("kitSelect"),
  startKitHint: byId("startKitHint"),
  continueButton: byId("continueButton"),
  continueMeta: byId("continueMeta"),
  startButton: byId("startButton"),
  contractButton: byId("contractButton"),
  homeButton: byId("homeButton"),
  soundButton: byId("soundButton"),
  soundIconUse: byId("soundIconUse"),
  infoButton: byId("infoButton"),
  artifactProgress: byId("artifactProgress"),
  bankScoreLabel: byId("bankScoreLabel"),
  bankedScore: byId("bankedScore"),
  forgeStage: byId("forgeStage"),
  artifactKicker: byId("artifactKicker"),
  artifactTitle: byId("artifactTitle"),
  gradeLevel: byId("gradeLevel"),
  gradeName: byId("gradeName"),
  weaponWrap: byId("weaponWrap"),
  weaponImage: byId("weaponImage"),
  resultCallout: byId("resultCallout"),
  resultLabel: byId("resultLabel"),
  resultDetail: byId("resultDetail"),
  durabilityPips: byId("durabilityPips"),
  stabilityPips: byId("stabilityPips"),
  currentValue: byId("currentValue"),
  attemptsLeft: byId("attemptsLeft"),
  inventoryRow: byId("inventoryRow"),
  charmButton: byId("charmButton"),
  charmCount: byId("charmCount"),
  charmState: byId("charmState"),
  passiveItems: byId("passiveItems"),
  reinforceButton: byId("reinforceButton"),
  reinforceChance: byId("reinforceChance"),
  reinforceOutcome: byId("reinforceOutcome"),
  amplifyButton: byId("amplifyButton"),
  amplifyChance: byId("amplifyChance"),
  amplifyOutcome: byId("amplifyOutcome"),
  sealButton: byId("sealButton"),
  sealOutcome: byId("sealOutcome"),
  resultTitle: byId("resultTitle"),
  finalScore: byId("finalScore"),
  resultRank: byId("resultRank"),
  newRecordBanner: byId("newRecordBanner"),
  endingKicker: byId("endingKicker"),
  endingStoryTitle: byId("endingStoryTitle"),
  endingStoryBody: byId("endingStoryBody"),
  demonAfterword: byId("demonAfterword"),
  endingCollection: byId("endingCollection"),
  artifactResults: byId("artifactResults"),
  sealedCount: byId("sealedCount"),
  destroyedCount: byId("destroyedCount"),
  scrapCount: byId("scrapCount"),
  retryButton: byId("retryButton"),
  saveRetryButton: byId("saveRetryButton"),
  resultHomeButton: byId("resultHomeButton"),
  rewardDialog: byId("rewardDialog"),
  artifactOutcomeLabel: byId("artifactOutcomeLabel"),
  rewardTitle: byId("rewardTitle"),
  artifactOutcomeText: byId("artifactOutcomeText"),
  rewardOptions: byId("rewardOptions"),
  contractDialog: byId("contractDialog"),
  contractTitle: byId("contractTitle"),
  acceptContractButton: byId("acceptContractButton"),
  acceptContractLabel: byId("acceptContractLabel"),
  closeContractButton: byId("closeContractButton"),
  infoDialog: byId("infoDialog"),
  infoTitle: byId("infoTitle"),
  vibrationButton: byId("vibrationButton"),
  leaveDialog: byId("leaveDialog"),
  leaveTitle: byId("leaveTitle"),
  confirmLeaveButton: byId("confirmLeaveButton"),
  toast: byId("toast"),
};

let profile = loadProfile();
let settings = loadSettings();
let run = null;
let inputLocked = false;
let toastTimer = 0;
let lastRecordedRunId = null;
let lastRecordResult = null;
let pendingRunAfterContract = false;

const audio = new GameAudio();
audio.setEnabled(settings.soundEnabled === true);

function formatNumber(value) {
  return numberFormat.format(Math.max(0, Math.round(Number(value) || 0)));
}

function delay(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2200);
}

function vibrate(pattern) {
  if (settings.vibrationEnabled === false || !navigator.vibrate) return;
  navigator.vibrate(pattern);
}

function closeDialog(dialog) {
  if (dialog?.open) dialog.close();
}

function showOnly(screen) {
  [elements.startScreen, elements.forgeScreen, elements.resultScreen].forEach((candidate) => {
    candidate.hidden = candidate !== screen;
  });
}

function focusSoon(element) {
  window.requestAnimationFrame(() => {
    window.setTimeout(() => element?.focus({ preventScroll: true }), 0);
  });
}

function renderSoundSetting() {
  const enabled = settings.soundEnabled === true;
  elements.soundButton.setAttribute("aria-pressed", String(enabled));
  elements.soundButton.setAttribute("aria-label", enabled ? "소리 끄기" : "소리 켜기");
  elements.soundIconUse.setAttribute("href", enabled ? "#icon-sound" : "#icon-muted");
}

function renderVibrationSetting() {
  const enabled = settings.vibrationEnabled !== false;
  elements.vibrationButton.textContent = enabled ? "켬" : "끔";
  elements.vibrationButton.setAttribute("aria-pressed", String(enabled));
}

function getActiveRunLabel(active) {
  const view = getRunView(active);
  if (!view) return "";
  if (view.phase === "reward") return `${view.artifactNumber}번째 밤 완료 · 도구 선택`;
  return `${view.artifactNumber}/${view.artifactCount} 밤 · ${view.gradeName} +${view.grade}`;
}

function renderKitSelect() {
  elements.kitSelect.replaceChildren();
  profile.unlockedKits.forEach((kitId) => {
    const option = document.createElement("option");
    option.value = kitId;
    option.textContent = KIT_SHORT[kitId] ?? STARTING_KITS[kitId]?.title ?? kitId;
    elements.kitSelect.append(option);
  });
  elements.kitSelect.value = profile.selectedKit;
  elements.kitSelect.disabled = profile.unlockedKits.length < 2;
  const selected = STARTING_KITS[profile.selectedKit] ?? STARTING_KITS.guardian;
  elements.startKitHint.textContent = `${selected.title} · ${selected.description}`;
}

function renderStart({ focus = false } = {}) {
  profile = loadProfile();
  const active = loadActiveRun();
  showOnly(elements.startScreen);
  closeDialog(elements.rewardDialog);
  closeDialog(elements.leaveDialog);
  closeDialog(elements.contractDialog);
  audio.stopAmbient();
  elements.bestScore.textContent = formatNumber(profile.bestScore);
  elements.totalSealed.textContent = formatNumber(profile.completedRuns);
  renderKitSelect();
  elements.continueButton.hidden = !active;
  elements.continueMeta.textContent = active ? getActiveRunLabel(active) : "";
  if (focus) focusSoon(elements.startTitle);
}

function makeProgressNode(index, view) {
  const node = document.createElement("span");
  node.className = "artifact-node";
  node.textContent = String(index + 1);
  const result = view.results[index];
  if (result) node.classList.add(result.outcome === "exploded" ? "is-destroyed" : "is-sealed");
  else if (index === view.artifactIndex) node.classList.add("is-active");
  const status = result
    ? result.outcome === "exploded"
      ? "파괴"
      : "봉인 완료"
    : index === view.artifactIndex
      ? "현재 단조"
      : "대기";
  node.setAttribute("aria-label", `${index + 1}번째 단조, ${status}`);
  return node;
}

function renderPips(container, current, maximum, type) {
  container.replaceChildren();
  for (let index = 0; index < maximum; index += 1) {
    const pip = document.createElement("i");
    pip.className = index < current ? "is-on" : type === "durability" ? "is-broken" : "";
    container.append(pip);
  }
  const label = type === "durability" ? "내구도" : "안정도";
  container.setAttribute("aria-label", `${label} ${current}/${maximum}`);
}

function renderWeapon(view) {
  const artifact = ARTIFACTS[view.artifactIndex];
  const lostDurability = Math.max(0, view.maxDurability - view.durability);
  const gradeRatio = view.grade / 100;
  const colorIndex = Math.min(GRADE_COLORS.length - 1, Math.floor(view.grade / 10));
  elements.artifactKicker.textContent = artifact.kicker;
  elements.artifactTitle.firstChild.textContent = `${artifact.name} `;
  elements.gradeLevel.textContent = `+${view.grade}`;
  const nextMilestone = getNextGradeMilestone(view.grade);
  elements.gradeName.textContent = nextMilestone
    ? `${view.gradeName} · 다음 칭호까지 ${nextMilestone.grade - view.grade}강`
    : `${view.gradeName} · 최고 강화`;
  elements.weaponImage.alt = `${view.gradeName} 등급 ${artifact.name}, 강화 +${view.grade}`;
  elements.weaponWrap.dataset.grade = String(view.grade);
  elements.weaponWrap.dataset.damage = String(lostDurability);
  elements.weaponWrap.style.setProperty("--grade-color", GRADE_COLORS[colorIndex]);
  elements.weaponWrap.style.setProperty("--grade-glow", `${Math.round(gradeRatio * 17)}px`);
  elements.weaponWrap.style.setProperty("--grade-opacity", String((gradeRatio * 0.34).toFixed(2)));
  elements.weaponWrap.style.setProperty("--rune-opacity", String((gradeRatio * 0.88).toFixed(2)));
  elements.weaponWrap.style.setProperty(
    "--damage-opacity",
    String(Math.min(0.92, lostDurability / Math.max(1, view.maxDurability)).toFixed(2))
  );
}

function renderInventory(view) {
  elements.charmCount.textContent = String(view.inventory.charm);
  elements.charmButton.disabled = inputLocked || view.phase !== "forging" || view.inventory.charm < 1;
  elements.charmButton.setAttribute("aria-pressed", String(view.armedCharm));
  if (view.inventory.charm < 1) elements.charmState.textContent = "남은 부적 없음";
  else if (view.armedCharm) elements.charmState.textContent = "이번 타격 후 소모 · 성공 포함";
  else elements.charmState.textContent = "눌러서 다음 타격에 장착";
  elements.charmButton.setAttribute(
    "aria-label",
    `보호 부적 ${view.inventory.charm}개, ${view.armedCharm ? "장착됨, 성공해도 이번 타격 뒤 소모" : "장착 안 됨"}`
  );

  elements.passiveItems.replaceChildren();
  ["powder", "goldThread", "repairNail"].forEach((itemId) => {
    const count = view.inventory[itemId];
    if (count < 1) return;
    const tag = document.createElement("span");
    tag.className = "passive-tag";
    tag.textContent = `${ITEM_MARKS[itemId]} ${ITEM_SHORT[itemId]} ${count}`;
    elements.passiveItems.append(tag);
  });
}

function failureText(preview) {
  if (preview.failure.damage === 0) return "실패 피해 0(부적)";
  if (preview.failure.explodes) return "실패 시 검 파괴";
  return `실패 내구도 -${preview.failure.damage}`;
}

function reinforceSuccessText(view, success) {
  const gradeGain = success.grade - view.grade;
  const effect = gradeGain > 0 ? `등급 +${gradeGain}·안정 +1` : `연마 ${success.polish}/${MAX_POLISH}·안정 +1`;
  return `${effect} → ${formatNumber(success.sealValue)}점`;
}

function amplifySuccessText(view, success) {
  const gradeGain = success.grade - view.grade;
  const effect = gradeGain > 0 ? `등급 +${gradeGain}·가치 +35%` : `증폭 ${success.amplification}/${MAX_AMPLIFICATION}`;
  return `${effect} → ${formatNumber(success.sealValue)}점`;
}

function emergencyActionText(action) {
  const failed = action.failure.explodes
    ? "실패 파괴"
    : `실패 ${formatNumber(action.failure.emergencySealValue)}점`;
  return `성공 ${formatNumber(action.success.emergencySealValue)}점 · ${failed}`;
}

function renderActions(view) {
  const preview = view.actionPreview;
  const forging = view.phase === "forging" && preview;
  if (!forging) {
    [elements.reinforceButton, elements.amplifyButton, elements.sealButton, elements.charmButton].forEach(
      (button) => (button.disabled = true)
    );
    return;
  }

  elements.reinforceChance.textContent = `${preview.reinforce.chancePercent}%`;
  const reinforceResult = preview.nextAttemptIsEmergency
    ? emergencyActionText(preview.reinforce)
    : `성공 ${reinforceSuccessText(view, preview.reinforce.success)} / ${failureText(preview.reinforce)}`;
  elements.reinforceOutcome.textContent = reinforceResult;
  elements.reinforceButton.disabled = inputLocked || !preview.reinforce.enabled;
  elements.reinforceButton.setAttribute(
    "aria-label",
    `안전 강화, 성공 확률 ${preview.reinforce.chancePercent}퍼센트, ${reinforceResult}`
  );

  elements.amplifyChance.textContent = `${preview.amplify.chancePercent}%`;
  const bonusParts = [];
  if (preview.amplify.stabilityBonus) bonusParts.push(`안정 +${preview.amplify.stabilityBonus / 100}%p`);
  if (preview.amplify.powderBonus) bonusParts.push(`청명 +${preview.amplify.powderBonus / 100}%p`);
  const bonus = bonusParts.length ? ` (${bonusParts.join(", ")})` : "";
  const amplifyResult = preview.nextAttemptIsEmergency
    ? emergencyActionText(preview.amplify)
    : `${preview.amplify.usesPowder ? "청명분 포함 · " : ""}성공 ${amplifySuccessText(view, preview.amplify.success)} / 안정 0·${failureText(preview.amplify)}`;
  elements.amplifyOutcome.textContent = amplifyResult;
  elements.amplifyButton.disabled = inputLocked || !preview.amplify.enabled;
  elements.amplifyButton.title = `기본 ${preview.amplify.baseChance / 100}%${bonus}`;
  elements.amplifyButton.setAttribute(
    "aria-label",
    `위험 증폭, 성공 확률 ${preview.amplify.chancePercent}퍼센트${bonus}, ${amplifyResult}`
  );

  if (view.grade >= 100) {
    elements.reinforceChance.textContent = "MAX";
    elements.reinforceOutcome.textContent = "최고 강화 도달 · 지금 봉인하세요";
    elements.reinforceButton.setAttribute("aria-label", "안전 강화, 최고 강화 +100에 도달해 사용할 수 없음");
    elements.amplifyChance.textContent = "MAX";
    elements.amplifyOutcome.textContent = "신좌로 갈 준비가 끝났습니다";
    elements.amplifyButton.setAttribute("aria-label", "위험 증폭, 최고 강화 +100에 도달해 사용할 수 없음");
  }

  elements.sealOutcome.textContent = `${formatNumber(preview.seal.value)}점 확정${preview.seal.usesGoldThread ? " · 금실 +25%" : " · 이후 위험 없음"}`;
  elements.sealButton.disabled = inputLocked;
  elements.sealButton.setAttribute(
    "aria-label",
    `지금 봉인, ${formatNumber(preview.seal.value)}점 확정, 이후 위험 없음`
  );
}

function setCallout(label, detail, tone = "") {
  elements.resultCallout.className = "result-callout";
  if (tone) elements.resultCallout.classList.add(`is-${tone}`);
  elements.resultLabel.textContent = label;
  elements.resultDetail.textContent = detail;
}

function defaultCallout(view) {
  const preview = view.actionPreview;
  if (!preview) return;
  if (preview.nextAttemptIsEmergency) {
    setCallout(
      "마지막 타격 · 결과별 정산점",
      `강화 ${emergencyActionText(preview.reinforce)} / 증폭 ${emergencyActionText(preview.amplify)}`,
      "danger"
    );
    return;
  }
  const stabilityBonus = preview.amplify.stabilityBonus / 100;
  const stabilityText = stabilityBonus > 0 ? ` · 안정 보너스 +${stabilityBonus}%p` : "";
  const nextMilestone = getNextGradeMilestone(view.grade);
  const milestoneText = nextMilestone
    ? ` · ${nextMilestone.title}까지 ${nextMilestone.grade - view.grade}강`
    : " · 최고 강화 도달";
  setCallout(
    `악마 · “${getForgeWhisper(view.grade)}”`,
    `안전 ${preview.reinforce.chancePercent}% · 증폭 ${preview.amplify.chancePercent}%${stabilityText}${milestoneText}`,
    view.grade >= 60 ? "danger" : stabilityBonus > 0 ? "success" : ""
  );
}

function renderForgeView(view, { focus = false, keepCallout = false } = {}) {
  showOnly(elements.forgeScreen);
  elements.artifactProgress.replaceChildren(
    ...Array.from({ length: view.artifactCount }, (_, index) => makeProgressNode(index, view))
  );
  const nextTier = RESULT_TIERS.find((tier) => tier.minScore >= 700 && tier.minScore > view.bankedScore);
  elements.bankScoreLabel.textContent = nextTier
    ? `${nextTier.title}까지 ${formatNumber(nextTier.minScore - view.bankedScore)}`
    : "최고 인장권";
  elements.bankedScore.textContent = formatNumber(view.bankedScore);
  renderWeapon(view);
  renderPips(elements.durabilityPips, view.durability, view.maxDurability, "durability");
  renderPips(elements.stabilityPips, view.stability, 3, "stability");
  const displayedSealValue =
    view.actionPreview?.seal.value ?? view.results.at(-1)?.value ?? view.currentValue;
  elements.currentValue.textContent = formatNumber(displayedSealValue);
  elements.attemptsLeft.textContent = String(view.remainingAttempts);
  renderInventory(view);
  renderActions(view);
  elements.forgeStage.setAttribute("aria-busy", String(inputLocked));
  if (!keepCallout && view.phase === "forging") defaultCallout(view);
  if (focus) focusSoon(elements.artifactTitle);
}

function lastFinishedArtifact() {
  return run?.results?.at(-1) ?? null;
}

function rewardOutcomeCopy(result) {
  const artifact = ARTIFACTS[result.artifactIndex];
  if (result.outcome === "exploded") {
    return {
      label: `단조 실패 · +${result.stageStartGrade}로 복구`,
      text: `${artifact.name}은 깨졌습니다. 이번 밤에 올린 강화만 잃고, 앞서 봉인한 +${result.stageStartGrade}부터 다음 단조를 시작합니다.`,
    };
  }
  if (result.outcome === "emergency") {
    return {
      label: `긴급 봉인 · ${formatNumber(result.value)}점`,
      text: `열두 번째 타격 뒤 화로가 닫혀 ${artifact.name}을 긴급 봉인했습니다.${result.usedGoldThread ? " 봉인금실 +25%도 적용되었습니다." : ""}`,
    };
  }
  return {
    label: `봉인 완료 · ${formatNumber(result.value)}점`,
      text: `${artifact.name}${artifact.name.endsWith("도") ? "를" : "을"} +${result.grade}에 봉인했습니다. 다음 밤은 이 강화 수치부터 이어집니다.`,
  };
}

function showRewardDialog() {
  if (!run || run.phase !== "reward") return;
  const view = getRunView(run);
  const result = lastFinishedArtifact();
  const copy = rewardOutcomeCopy(result);
  elements.artifactOutcomeLabel.textContent = copy.label;
  elements.artifactOutcomeText.textContent = copy.text;
  elements.rewardOptions.replaceChildren();
  view.rewardOffers.forEach((reward) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "reward-option";
    button.dataset.rewardId = reward.id;
    const mark = document.createElement("span");
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = ITEM_MARKS[reward.id] ?? "具";
    const title = document.createElement("b");
    title.textContent = reward.title;
    const description = document.createElement("small");
    description.textContent = `${reward.short} · ${reward.description}`;
    button.append(mark, title, description);
    elements.rewardOptions.append(button);
  });
  if (!elements.rewardDialog.open) elements.rewardDialog.showModal();
  focusSoon(elements.rewardTitle);
}

function renderResult() {
  if (!run || run.phase !== "result") return;
  const view = getRunView(run);
  const ending = getRevengeEnding(view);
  if (lastRecordedRunId !== run.runId) {
    lastRecordResult = recordRunFinish(run, ending.id);
    lastRecordedRunId = lastRecordResult.saved || lastRecordResult.alreadyRecorded ? run.runId : null;
    profile = lastRecordResult.profile;
    if (!lastRecordResult.saved) showToast("기록을 저장하지 못했습니다. 이 화면은 닫지 마세요.");
  }
  showOnly(elements.resultScreen);
  closeDialog(elements.rewardDialog);
  audio.stopAmbient();
  audio.play("result");
  elements.finalScore.textContent = formatNumber(view.result.score);
  elements.resultRank.textContent = `${view.result.tier.title} · 명성 +${formatNumber(view.result.fame)}`;
  elements.endingKicker.textContent = ending.kicker;
  elements.endingStoryTitle.textContent = ending.title;
  elements.endingStoryBody.textContent = ending.body;
  elements.demonAfterword.textContent = `악마 · “${ending.demon}”`;
  const savedEndingCount = lastRecordResult?.saved === false
    ? loadProfile().discoveredEndings?.length ?? 0
    : profile.discoveredEndings?.length ?? 0;
  elements.endingCollection.textContent = `멸망 실패 기록 ${savedEndingCount}/${REVENGE_ENDINGS.length}`;
  const bannerParts = [];
  if (lastRecordResult?.saved && lastRecordResult?.isNewBest) bannerParts.push("새 최고 기록");
  if (lastRecordResult?.saved && lastRecordResult?.isNewEnding) bannerParts.push("새 실패 결말 발견");
  if (lastRecordResult?.saved) {
    lastRecordResult.newlyUnlockedKits.forEach((kitId) => {
      bannerParts.push(`${STARTING_KITS[kitId]?.title ?? "새 꾸러미"} 해금`);
    });
  }
  elements.newRecordBanner.textContent = bannerParts.join(" · ");
  elements.newRecordBanner.hidden = bannerParts.length === 0;
  elements.saveRetryButton.hidden = lastRecordResult?.saved !== false;
  elements.artifactResults.replaceChildren();
  view.results.forEach((result, index) => {
    const card = document.createElement("div");
    card.className = `result-card${result.outcome === "exploded" ? " is-destroyed" : ""}`;
    const mark = document.createElement("span");
    mark.textContent = ARTIFACTS[index].mark;
    const body = document.createElement("div");
    const title = document.createElement("b");
    title.textContent = `${ARTIFACTS[index].name} +${result.stageStartGrade}→+${result.reachedGrade}`;
    const detail = document.createElement("small");
    const craftNotes = [
      result.amplification ? `증폭${result.amplification}` : "",
      result.polish ? `연마${result.polish}` : "",
      result.usedGoldThread ? "금실" : "",
    ].filter(Boolean);
    const craftSuffix = craftNotes.length ? ` · ${craftNotes.join("·")}` : "";
    detail.textContent =
      result.outcome === "exploded"
        ? `파괴 · 0점${craftSuffix}`
        : `${result.outcome === "emergency" ? "긴급 봉인" : "봉인"} · ${formatNumber(result.value)}점${craftSuffix}`;
    body.append(title, detail);
    card.append(mark, body);
    elements.artifactResults.append(card);
  });
  elements.sealedCount.textContent = String(view.result.sealedCount);
  elements.destroyedCount.textContent = String(view.result.explosions);
  elements.scrapCount.textContent = String(view.scrap);
  focusSoon(elements.resultTitle);
}

function renderRun(options = {}) {
  if (!run) return renderStart(options);
  const view = getRunView(run);
  if (!view) {
    run = null;
    showToast("이어하기 기록이 손상되어 새로 시작합니다.");
    return renderStart(options);
  }
  if (view.phase === "result") return renderResult();
  renderForgeView(view, options);
  audio.startAmbient();
  if (view.phase === "reward") showRewardDialog();
}

function resultCopy(event, view, beforeView) {
  const artifact = ARTIFACTS[view.artifactIndex];
  const finished = view.results.at(-1);
  if (finished?.artifactIndex === view.artifactIndex && finished.outcome === "emergency") {
    return {
      label: "화로가 닫혔습니다 · 긴급 봉인",
      detail: `${artifact.name} ${formatNumber(finished.value)}점 확정${finished.usedGoldThread ? " · 봉인금실 포함" : ""}`,
      tone: "success",
      animation: "success",
      sound: "seal",
      vibration: 28,
    };
  }
  if (!event.success && finished?.artifactIndex === view.artifactIndex && finished.outcome === "exploded") {
    return {
      label: `${artifact.name} 파괴`,
      detail: `이번 밤의 강화만 잃습니다 · 다음 밤은 +${finished.stageStartGrade}부터 재개`,
      tone: "danger",
      animation: "destroyed",
      sound: "explode",
      vibration: [70, 35, 90],
    };
  }
  if (event.success) {
    const crossedMilestone = beforeView && Math.floor(beforeView.grade / 10) < Math.floor(view.grade / 10);
    const gradeStayed = beforeView && view.grade === beforeView.grade;
    const successLabel =
      crossedMilestone
        ? `새 칭호 · ${view.gradeName}`
        : event.type === "reinforce" && gradeStayed
        ? `연마 성공 · ${view.polish}/${MAX_POLISH}`
        : event.type === "amplify" && gradeStayed
          ? `증폭 성공 · ${view.amplification}/${MAX_AMPLIFICATION}`
          : `${event.type === "reinforce" ? "강화" : "증폭"} 성공 · ${view.gradeName} +${view.grade}`;
    return {
      label: successLabel,
      detail: crossedMilestone
        ? `강화 +${view.grade} 도달 · 복수 원정이 한 단계 전진했습니다`
        : event.type === "reinforce"
          ? `안정도 ${view.stability}/3 · 다음 증폭 확률이 올라갑니다`
          : `증폭 ${view.amplification}단계 · 현재 봉인가치 ${formatNumber(view.actionPreview?.seal.value ?? view.currentValue)}점`,
      tone: "success",
      animation: "success",
      sound: "success",
      vibration: 24,
    };
  }
  if (event.usedCharm) {
    return {
      label: "보호 부적이 피해를 막았습니다",
      detail: "부적 1장 소모 · 검의 내구도 유지",
      tone: "failure",
      animation: "protected",
      sound: "charm",
      vibration: [18, 25, 18],
    };
  }
  return {
    label: `${event.type === "reinforce" ? "강화" : "증폭"} 실패 · 내구도 -${event.damage}`,
    detail: `남은 내구도 ${view.durability}/${view.maxDurability} · 지금 봉인할 수 있습니다`,
    tone: "failure",
    animation: "failure",
    sound: "failure",
    vibration: 42,
  };
}

function clearWeaponAnimation() {
  elements.weaponWrap.classList.remove(
    "is-striking",
    "is-success",
    "is-failure",
    "is-destroyed",
    "is-protected"
  );
}

async function handleStrike(action) {
  if (inputLocked || !run || run.phase !== "forging") return;
  const activeRunId = run.runId;
  const beforeView = getRunView(run);
  inputLocked = true;
  renderActions(getRunView(run));
  elements.forgeStage.setAttribute("aria-busy", "true");
  setCallout(action === "reinforce" ? "안전 강화 중…" : "위험 증폭 중…", "망치가 내려갑니다", "");
  clearWeaponAnimation();
  elements.weaponWrap.classList.add("is-striking");
  audio.play(action);
  await delay(240);
  if (!run || run.runId !== activeRunId) return;

  const next = action === "reinforce" ? reinforce(run) : amplify(run);
  if (next === run) {
    inputLocked = false;
    clearWeaponAnimation();
    renderRun();
    return;
  }
  run = next;
  const event = [...run.history].reverse().find((entry) => entry.type === action);
  const view = getRunView(run);
  const copy = resultCopy(event, view, beforeView);
  if (run.phase !== "result" && !saveActiveRun(run)) showToast("이어하기 저장이 제한되었습니다.");
  renderForgeView(view, { keepCallout: true });
  setCallout(copy.label, copy.detail, copy.tone);
  clearWeaponAnimation();
  elements.weaponWrap.classList.add(`is-${copy.animation}`);
  audio.play(copy.sound);
  vibrate(copy.vibration);
  await delay(copy.animation === "destroyed" ? 760 : 640);
  if (!run || run.runId !== activeRunId) return;
  clearWeaponAnimation();
  inputLocked = false;
  if (run.phase === "reward") {
    renderForgeView(getRunView(run), { keepCallout: true });
    showRewardDialog();
  } else if (run.phase === "result") {
    renderResult();
  } else {
    renderRun();
  }
}

async function handleSeal() {
  if (inputLocked || !run || run.phase !== "forging") return;
  const activeRunId = run.runId;
  inputLocked = true;
  const before = getRunView(run);
  const sealedValue = before.actionPreview.seal.value;
  run = sealCurrent(run);
  if (run.phase !== "result" && !saveActiveRun(run)) showToast("이어하기 저장이 제한되었습니다.");
  const view = getRunView(run);
  renderForgeView(view, { keepCallout: true });
  setCallout("봉인 완료", `${formatNumber(sealedValue)}점 확정 · 이 점수는 더는 사라지지 않습니다`, "success");
  clearWeaponAnimation();
  elements.weaponWrap.classList.add("is-success");
  audio.play("seal");
  vibrate(32);
  await delay(620);
  if (!run || run.runId !== activeRunId) return;
  clearWeaponAnimation();
  inputLocked = false;
  if (run.phase === "result") renderResult();
  else showRewardDialog();
}

function startRunNow() {
  closeDialog(elements.infoDialog);
  closeDialog(elements.contractDialog);
  closeDialog(elements.rewardDialog);
  lastRecordedRunId = null;
  lastRecordResult = null;
  inputLocked = false;
  run = createRun(undefined, profile);
  const started = recordRunStart();
  profile = started.profile;
  if (!started.saved) showToast("기록 저장이 제한되었지만 이번 판은 계속할 수 있습니다.");
  if (!saveActiveRun(run)) showToast("이어하기 저장이 제한되었습니다.");
  audio.play("tap");
  renderRun({ focus: true });
}

function openContract({ startAfter = false } = {}) {
  pendingRunAfterContract = startAfter;
  elements.acceptContractLabel.textContent = startAfter ? "계약하고 망치를 든다" : "계약서를 다시 읽었다";
  elements.closeContractButton.textContent = startAfter ? "아직은 돌아선다" : "닫기";
  if (!elements.contractDialog.open) elements.contractDialog.showModal();
  focusSoon(elements.contractTitle);
}

function requestRunStart() {
  if (profile.totalRuns === 0) {
    openContract({ startAfter: true });
    return;
  }
  startRunNow();
}

function continueRun() {
  const active = loadActiveRun();
  if (!active) {
    showToast("이어할 담금질이 없습니다.");
    return renderStart();
  }
  run = active;
  lastRecordedRunId = null;
  lastRecordResult = null;
  audio.play("tap");
  renderRun({ focus: true });
}

elements.startButton.addEventListener("click", requestRunStart);
elements.continueButton.addEventListener("click", continueRun);
elements.retryButton.addEventListener("click", requestRunStart);
elements.contractButton.addEventListener("click", () => openContract());
elements.acceptContractButton.addEventListener("click", () => {
  const shouldStart = pendingRunAfterContract;
  pendingRunAfterContract = false;
  closeDialog(elements.contractDialog);
  audio.play("tap");
  if (shouldStart) startRunNow();
});
elements.closeContractButton.addEventListener("click", () => {
  pendingRunAfterContract = false;
  closeDialog(elements.contractDialog);
});
elements.contractDialog.addEventListener("cancel", () => {
  pendingRunAfterContract = false;
});
elements.saveRetryButton.addEventListener("click", () => {
  if (!run || run.phase !== "result") return;
  lastRecordedRunId = null;
  renderResult();
});
elements.resultHomeButton.addEventListener("click", () => {
  run = null;
  renderStart({ focus: true });
});

elements.reinforceButton.addEventListener("click", () => handleStrike("reinforce"));
elements.amplifyButton.addEventListener("click", () => handleStrike("amplify"));
elements.sealButton.addEventListener("click", handleSeal);
elements.charmButton.addEventListener("click", () => {
  if (inputLocked || !run) return;
  const next = toggleCharm(run);
  if (next === run) return;
  run = next;
  if (!saveActiveRun(run)) showToast("부적 상태를 저장하지 못했습니다.");
  audio.play("tap");
  renderRun();
});

elements.rewardOptions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-reward-id]");
  if (!button || !run || inputLocked) return;
  const next = chooseReward(run, button.dataset.rewardId);
  if (next === run) return;
  run = next;
  closeDialog(elements.rewardDialog);
  if (!saveActiveRun(run)) showToast("보상 선택을 저장하지 못했습니다.");
  audio.play("reward");
  vibrate(20);
  renderRun({ focus: true });
});

elements.rewardDialog.addEventListener("cancel", (event) => {
  // 도구를 고르기 전에는 다음 단조를 시작할 수 없으므로 뒤로가기로 닫히지 않게 한다.
  event.preventDefault();
});

elements.homeButton.addEventListener("click", () => {
  if (inputLocked) {
    showToast("타격 결과가 나온 뒤 이동할 수 있습니다.");
    return;
  }
  if (!elements.forgeScreen.hidden && run && run.phase !== "result") {
    elements.leaveDialog.showModal();
    focusSoon(elements.leaveTitle);
    return;
  }
  run = null;
  renderStart({ focus: true });
});

elements.confirmLeaveButton.addEventListener("click", () => {
  if (run && run.phase !== "result" && !saveActiveRun(run)) showToast("현재 단조를 저장하지 못했습니다.");
  closeDialog(elements.leaveDialog);
  run = null;
  renderStart({ focus: true });
});

elements.infoButton.addEventListener("click", () => {
  renderVibrationSetting();
  elements.infoDialog.showModal();
  focusSoon(elements.infoTitle);
});

elements.kitSelect.addEventListener("change", () => {
  if (!profile.unlockedKits.includes(elements.kitSelect.value)) return;
  profile = { ...profile, selectedKit: elements.kitSelect.value };
  if (!saveProfile(profile)) showToast("시작 도구 선택을 저장하지 못했습니다.");
  renderKitSelect();
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => closeDialog(button.closest("dialog")));
});

elements.soundButton.addEventListener("click", () => {
  settings.soundEnabled = !settings.soundEnabled;
  audio.setEnabled(settings.soundEnabled);
  saveSettings(settings);
  renderSoundSetting();
  if (settings.soundEnabled) {
    audio.play("tap");
    if (!elements.forgeScreen.hidden) audio.startAmbient();
  }
});

elements.vibrationButton.addEventListener("click", () => {
  settings.vibrationEnabled = settings.vibrationEnabled === false;
  saveSettings(settings);
  renderVibrationSetting();
  if (settings.vibrationEnabled) vibrate(20);
});

document.addEventListener("visibilitychange", () => {
  audio.handleVisibility(document.hidden);
});

window.addEventListener("pagehide", () => {
  if (run && run.phase !== "result") saveActiveRun(run);
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const hadController = Boolean(navigator.serviceWorker.controller);
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController || refreshing) return;
      refreshing = true;
      window.location.reload();
    });
    navigator.serviceWorker.register("./sw.js?v=6.0.1").catch(() => {
      // 오프라인 설치가 막혀도 온라인 플레이는 계속됩니다.
    });
  });
}

renderSoundSetting();
renderVibrationSetting();
renderStart();
