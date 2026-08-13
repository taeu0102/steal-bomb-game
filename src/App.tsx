import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { storyAudio } from "./lib/audio";
import {
  getCaptionSpeaker,
  getCompletionVisual,
  getSpeakerPosition,
  loadEpisode,
  loadManifest,
} from "./lib/story";
import {
  activityFeedbackVoiceKey,
  captionVoiceKey,
  failureVoiceText,
  getVoiceEntry,
  hasGeneratedVoice,
  optionFailureVoiceKey,
  optionFeedbackVoiceKey,
} from "./lib/voice";
import {
  clearProgress,
  loadProgress,
  loadSettings,
  saveProgress,
  saveSettings,
} from "./lib/storage";
import type {
  ActivityParticipation,
  ChoiceInteraction,
  ChoiceOption,
  Episode,
  EpisodeManifestItem,
  SelectionRecord,
  StoryProgress,
  StorySettings,
} from "./types/story";

type AppView = "library" | "intro" | "player" | "complete";
type PlayerPhase =
  | "playing"
  | "paused"
  | "choice"
  | "feedback"
  | "failed"
  | "activity"
  | "activityFeedback";

const makeProgress = (
  episode: Episode,
  sceneId = episode.startSceneId,
  selections: SelectionRecord[] = [],
  completed = false,
  resumePhase: "playing" | "choice" = "playing",
): StoryProgress => ({
  schemaVersion: 1,
  episodeId: episode.id,
  contentVersion: episode.contentVersion,
  sceneId,
  selections,
  resumePhase,
  completed,
  updatedAt: new Date().toISOString(),
});

function IconButton({
  label,
  icon,
  pressed,
  disabled,
  onClick,
}: {
  label: string;
  icon: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="icon-button"
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      title={label}
      onClick={onClick}
    >
      <span aria-hidden="true">{icon}</span>
      <span className="icon-button__label">{label}</span>
    </button>
  );
}

function Brand() {
  return (
    <div className="brand" aria-label="마음씨앗 동화책">
      <span className="brand__mark" aria-hidden="true">
        <span>●</span>
        <span>⌁</span>
      </span>
      <span>
        <strong>마음씨앗</strong>
        <small>함께 고르는 우리 이야기</small>
      </span>
    </div>
  );
}

function ParentGuide({ episode, onClose }: { episode: Episode; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-card parent-guide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="parent-guide-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button ref={closeRef} className="modal-close" type="button" onClick={onClose}>
          <span aria-hidden="true">×</span>
          <span className="sr-only">부모 가이드 닫기</span>
        </button>
        <p className="eyebrow">부모님과 선생님께</p>
        <h2 id="parent-guide-title">함께 읽을 때 이렇게 해 보세요</h2>
        <p className="guide-lead">
          아이가 고른 이유를 먼저 들어 본 뒤, 실패 결말에서 행동과 결과가 어떻게 이어졌는지 함께 이야기해 주세요.
        </p>
        <div className="guide-grid">
          <article>
            <span aria-hidden="true">🌿</span>
            <h3>안전한 각색</h3>
            <p>{episode.contentSafety.adaptationNote}</p>
          </article>
          <article>
            <span aria-hidden="true">🐦</span>
            <h3>실제 동물 돕기</h3>
            <p>{episode.contentSafety.animalSafetyNote}</p>
          </article>
        </div>
        <h3 className="guide-question-title">이야기 뒤에 나눌 질문</h3>
        <ol className="guide-questions">
          {episode.meta.discussionPrompts.map((prompt) => (
            <li key={prompt}>{prompt}</li>
          ))}
        </ol>
        <button className="button button--primary button--wide" type="button" onClick={onClose}>
          함께 읽으러 가기
        </button>
      </section>
    </div>
  );
}

const participationMeta: Record<
  ActivityParticipation["kind"],
  { icon: string; label: string; lineLabel: string }
> = {
  "parent-read": { icon: "🎭", label: "부모님 목소리 차례", lineLabel: "부모님이 읽을 대사" },
  "child-repeat": { icon: "🗣️", label: "아이 말하기 차례", lineLabel: "아이가 따라 말할 문장" },
  "child-question": { icon: "💬", label: "아이에게 물어보기", lineLabel: "함께 나눌 질문" },
};

function ParticipationGuide({ items }: { items: ActivityParticipation[] }) {
  return (
    <section className="participation-guide" aria-label="부모와 아이의 참여 안내">
      {items.map((item, index) => {
        const meta = participationMeta[item.kind];
        return (
          <article className={`participation-card participation-card--${item.kind}`} key={`${item.kind}:${index}`}>
            <div className="participation-card__heading">
              <span aria-hidden="true">{meta.icon}</span>
              <strong>{item.speaker ? `${item.speaker} 목소리` : meta.label}</strong>
              {item.speaker && <small>{meta.label}</small>}
            </div>
            <p>{item.instruction}</p>
            {item.line && (
              <blockquote>
                <span className="sr-only">{meta.lineLabel}: </span>
                “{item.line}”
              </blockquote>
            )}
          </article>
        );
      })}
    </section>
  );
}

function StoryPlayer({
  episode,
  initialProgress,
  settings,
  narrationAvailable,
  onSettingsChange,
  onExit,
  onComplete,
}: {
  episode: Episode;
  initialProgress: StoryProgress;
  settings: StorySettings;
  narrationAvailable: boolean;
  onSettingsChange: (settings: StorySettings) => void;
  onExit: () => void;
  onComplete: (progress: StoryProgress) => void;
}) {
  const initialScene =
    episode.scenes.find((candidate) => candidate.id === initialProgress.sceneId) ?? episode.scenes[0];
  const canResumeChoice =
    initialProgress.resumePhase === "choice" &&
    initialScene.type === "choice" &&
    initialScene.interaction &&
    "options" in initialScene.interaction;
  const [sceneId, setSceneId] = useState(initialProgress.sceneId);
  const [captionIndex, setCaptionIndex] = useState(
    canResumeChoice ? initialScene.captions.length - 1 : 0,
  );
  const [phase, setPhase] = useState<PlayerPhase>(canResumeChoice ? "choice" : "playing");
  const [phaseBeforePause, setPhaseBeforePause] = useState<PlayerPhase>("playing");
  const [selectedOption, setSelectedOption] = useState<ChoiceOption | null>(null);
  const [selections, setSelections] = useState<SelectionRecord[]>(initialProgress.selections);
  const [activityTaps, setActivityTaps] = useState(0);
  const [elapsedCaptionKey, setElapsedCaptionKey] = useState<string | null>(null);
  const [finishedVoiceKey, setFinishedVoiceKey] = useState<string | null>(null);
  const interactionHeadingRef = useRef<HTMLHeadingElement>(null);
  const failureDialogRef = useRef<HTMLElement>(null);
  const choiceLockedRef = useRef(false);
  const scene = useMemo(
    () => episode.scenes.find((candidate) => candidate.id === sceneId) ?? episode.scenes[0],
    [episode.scenes, sceneId],
  );
  const sceneIndex = episode.scenes.findIndex((candidate) => candidate.id === scene.id);
  const sceneProgress = ((sceneIndex + 1) / episode.scenes.length) * 100;
  const caption = scene.captions[captionIndex] ?? scene.captions[scene.captions.length - 1];
  const captionSpeaker = getCaptionSpeaker(scene, captionIndex);
  const speakerPosition = getSpeakerPosition(scene, captionIndex);
  const isCharacterSpeaking = speakerPosition !== "narrator";
  const currentCaptionKey = captionVoiceKey(scene.id, captionIndex);
  const narrationEnabled = narrationAvailable && settings.narration;

  const playVoice = useCallback(
    (key: string, text: string, onEnded?: () => void) => {
      if (!narrationEnabled) {
        onEnded?.();
        return;
      }
      const entry = getVoiceEntry(episode, key);
      storyAudio.playVoice({
        key: `${episode.id}:${key}`,
        src: entry?.file,
        text,
        onEnded,
      });
    },
    [episode, narrationEnabled],
  );

  const persist = useCallback(
    (
      nextSceneId: string,
      nextSelections: SelectionRecord[],
      completed = false,
      resumePhase: "playing" | "choice" = "playing",
    ) => {
      const progress = makeProgress(episode, nextSceneId, nextSelections, completed, resumePhase);
      saveProgress(progress);
      return progress;
    },
    [episode],
  );

  const moveToScene = useCallback(
    (nextSceneId: string) => {
      storyAudio.playChime("page");
      storyAudio.stopSpeech();
      setSceneId(nextSceneId);
      setCaptionIndex(0);
      setSelectedOption(null);
      setActivityTaps(0);
      choiceLockedRef.current = false;
      setPhase("playing");
      persist(nextSceneId, selections);
    },
    [persist, selections],
  );

  const finishStory = useCallback(
    (nextSelections = selections) => {
      storyAudio.playChime("complete");
      storyAudio.stopSpeech();
      const completed = makeProgress(episode, scene.id, nextSelections, true);
      saveProgress(completed);
      onComplete(completed);
    },
    [episode, onComplete, scene.id, selections],
  );

  const revealInteractionOrAdvance = useCallback(() => {
    if (scene.interaction?.kind === "tap") {
      setPhase("activity");
      return;
    }
    if (scene.interaction && "options" in scene.interaction) {
      setPhase("choice");
      persist(scene.id, selections, false, "choice");
      return;
    }
    if (scene.nextSceneId) moveToScene(scene.nextSceneId);
    else finishStory();
  }, [finishStory, moveToScene, persist, scene, selections]);

  useEffect(() => {
    storyAudio.playTheme(scene.music);
    const nextScene = scene.nextSceneId
      ? episode.scenes.find((candidate) => candidate.id === scene.nextSceneId)
      : undefined;
    if (nextScene) {
      const image = new Image();
      image.src = nextScene.image;
    }
  }, [episode.scenes, scene.id, scene.image, scene.music, scene.nextSceneId]);

  useEffect(() => {
    storyAudio.setMuted(settings.muted);
    storyAudio.setNarrationEnabled(narrationEnabled);
    if (!narrationEnabled) {
      if (finishedVoiceKey !== currentCaptionKey) setFinishedVoiceKey(currentCaptionKey);
      return;
    }
    if (phase !== "playing") {
      return;
    }
    if (finishedVoiceKey === currentCaptionKey) return;

    setFinishedVoiceKey(null);
    playVoice(currentCaptionKey, caption, () => {
      setFinishedVoiceKey(currentCaptionKey);
    });
  }, [
    caption,
    currentCaptionKey,
    finishedVoiceKey,
    narrationEnabled,
    phase,
    playVoice,
    settings.muted,
  ]);

  useEffect(() => {
    if (["choice", "feedback", "failed", "activity", "activityFeedback"].includes(phase)) {
      window.setTimeout(() => interactionHeadingRef.current?.focus({ preventScroll: true }), 80);
    }
    if (phase === "choice") choiceLockedRef.current = false;
  }, [phase]);

  useEffect(() => {
    if (phase !== "failed") return;
    const dialog = failureDialogRef.current;
    if (!dialog) return;

    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>("button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])"),
      );
      if (focusable.length === 0) return;

      const activeIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const shouldWrapBackward = event.shiftKey && activeIndex <= 0;
      const shouldWrapForward = !event.shiftKey && (activeIndex < 0 || activeIndex === focusable.length - 1);
      if (!shouldWrapBackward && !shouldWrapForward) return;

      event.preventDefault();
      focusable[shouldWrapBackward ? focusable.length - 1 : 0].focus();
    };

    dialog.addEventListener("keydown", keepFocusInside);
    return () => dialog.removeEventListener("keydown", keepFocusInside);
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing" || !narrationEnabled) return;
    const perCaption = Math.min(
      12000,
      Math.max(6500, scene.estimatedDurationMs / scene.captions.length),
    );
    const timer = window.setTimeout(() => setElapsedCaptionKey(currentCaptionKey), perCaption);
    return () => window.clearTimeout(timer);
  }, [
    currentCaptionKey,
    narrationEnabled,
    phase,
    scene.captions.length,
    scene.estimatedDurationMs,
  ]);

  useEffect(() => {
    if (
      phase !== "playing" ||
      !narrationEnabled ||
      elapsedCaptionKey !== currentCaptionKey ||
      finishedVoiceKey !== currentCaptionKey
    ) return;
    if (captionIndex < scene.captions.length - 1) setCaptionIndex((index) => index + 1);
    else revealInteractionOrAdvance();
  }, [
    captionIndex,
    currentCaptionKey,
    elapsedCaptionKey,
    finishedVoiceKey,
    narrationEnabled,
    phase,
    revealInteractionOrAdvance,
    scene.captions.length,
  ]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden && phase !== "paused") {
        setPhaseBeforePause(phase);
        setPhase("paused");
        storyAudio.pauseVoice();
        storyAudio.stopMusic();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (phase === "paused") {
        setPhase(phaseBeforePause);
        storyAudio.playTheme(scene.music);
        storyAudio.resumeVoice();
      } else {
        setPhaseBeforePause(phase);
        setPhase("paused");
        storyAudio.pauseVoice();
        storyAudio.stopMusic();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [phase, phaseBeforePause, scene.music]);

  useEffect(
    () => () => {
      storyAudio.stopMusic();
      storyAudio.stopSpeech();
    },
    [],
  );

  const handlePlayPause = () => {
    if (phase === "paused") {
      setPhase(phaseBeforePause);
      storyAudio.playTheme(scene.music);
      storyAudio.resumeVoice();
      return;
    }
    setPhaseBeforePause(phase);
    setPhase("paused");
    storyAudio.pauseVoice();
    storyAudio.stopMusic();
  };

  const handleSoundToggle = async () => {
    const nextMuted = !settings.muted;
    if (!nextMuted) void storyAudio.unlock();
    onSettingsChange({ ...settings, muted: nextMuted });
  };

  const handleCaptionToggle = () => {
    onSettingsChange({ ...settings, captions: !settings.captions });
  };

  const handleNarrationToggle = () => {
    if (!narrationAvailable) return;
    const nextNarration = !settings.narration;
    storyAudio.setNarrationEnabled(nextNarration);
    if (nextNarration && phase === "playing") setFinishedVoiceKey(null);
    if (!nextNarration) setFinishedVoiceKey(currentCaptionKey);
    onSettingsChange({ ...settings, narration: nextNarration });
  };

  const handleNext = () => {
    if (phase !== "playing") return;
    storyAudio.stopVoice();
    if (captionIndex < scene.captions.length - 1) {
      setCaptionIndex((index) => index + 1);
      return;
    }
    revealInteractionOrAdvance();
  };

  const chooseOption = (option: ChoiceOption) => {
    if (phase !== "choice" || choiceLockedRef.current) return;
    choiceLockedRef.current = true;
    setSelectedOption(option);

    if (option.guidance === "reflect" && option.failure) {
      setPhase("failed");
      storyAudio.stopSpeech();
      storyAudio.stopMusic();
      storyAudio.playChime("fail");
      playVoice(
        optionFailureVoiceKey(scene.id, option.id),
        failureVoiceText(option.failure),
      );
      persist(scene.id, selections, false, "choice");
      return;
    }

    const record: SelectionRecord = {
      sceneId: scene.id,
      optionId: option.id,
      label: option.label,
      seed: option.seed,
    };
    const nextSelections = [...selections.filter((item) => item.sceneId !== scene.id), record];
    setSelections(nextSelections);
    setPhase("feedback");
    storyAudio.playChime("choice");
    playVoice(optionFeedbackVoiceKey(scene.id, option.id), option.feedback);
    persist(scene.id, nextSelections);
  };

  const retryChoice = () => {
    storyAudio.stopSpeech();
    setSelectedOption(null);
    choiceLockedRef.current = false;
    setPhase("choice");
    storyAudio.playTheme(scene.music);
    persist(scene.id, selections, false, "choice");
  };

  const restartAfterFailure = () => {
    const firstScene = episode.scenes.find((candidate) => candidate.id === episode.startSceneId);
    storyAudio.stopSpeech();
    setSelections([]);
    setSceneId(episode.startSceneId);
    setCaptionIndex(0);
    setSelectedOption(null);
    setActivityTaps(0);
    choiceLockedRef.current = false;
    setPhase("playing");
    persist(episode.startSceneId, []);
    if (firstScene) storyAudio.playTheme(firstScene.music);
  };

  const continueAfterChoice = () => {
    const nextSceneId = selectedOption?.nextSceneId ?? scene.nextSceneId;
    if (nextSceneId) moveToScene(nextSceneId);
    else finishStory(selections);
  };

  const handleActivityTap = () => {
    if (!scene.interaction || scene.interaction.kind !== "tap") return;
    const nextCount = activityTaps + 1;
    setActivityTaps(nextCount);
    storyAudio.playChime("tap");
    if (nextCount >= scene.interaction.tapsRequired) {
      setPhase("activityFeedback");
      playVoice(activityFeedbackVoiceKey(scene.id), scene.interaction.feedback);
    }
  };

  const continueAfterActivity = () => {
    if (scene.nextSceneId) moveToScene(scene.nextSceneId);
    else finishStory();
  };

  const choiceInteraction =
    scene.interaction && "options" in scene.interaction
      ? (scene.interaction as ChoiceInteraction)
      : null;
  const showInteractionSheet = ["choice", "feedback", "activity", "activityFeedback"].includes(phase);
  const showPanel = showInteractionSheet || phase === "failed";

  return (
    <main className="player-shell">
      <div className={`player-stage${phase === "failed" ? " player-stage--failed" : ""}`}>
        <img
          className={`scene-image scene-image--${scene.motion ?? "still"}${isCharacterSpeaking ? ` scene-image--speaker-${speakerPosition}` : ""}`}
          src={scene.image}
          alt={scene.imageAlt}
          style={{ objectPosition: scene.imagePosition ?? "center" }}
        />
        <div className="scene-scrim" aria-hidden="true" />

        <header className="player-topbar">
          <button className="back-button" type="button" onClick={onExit}>
            <span aria-hidden="true">‹</span> 책장
          </button>
          <div className="scene-count" aria-label={`전체 ${episode.scenes.length}장 중 ${sceneIndex + 1}장`}>
            <span>{String(sceneIndex + 1).padStart(2, "0")}</span>
            <i aria-hidden="true" />
            <span>{String(episode.scenes.length).padStart(2, "0")}</span>
          </div>
          <div className="player-actions">
            <IconButton
              label={settings.captions ? "자막 끄기" : "자막 켜기"}
              icon="자막"
              pressed={settings.captions}
              onClick={handleCaptionToggle}
            />
            <IconButton
              label={
                narrationAvailable
                  ? settings.narration ? "자동 낭독 끄기" : "자동 낭독 켜기"
                  : "이 이야기는 부모 낭독 모드예요"
              }
              icon={narrationAvailable ? narrationEnabled ? "낭독" : "낭독×" : "함께"}
              pressed={narrationEnabled}
              disabled={!narrationAvailable}
              onClick={handleNarrationToggle}
            />
            <IconButton
              label={settings.muted ? "배경음과 효과음 켜기" : "배경음과 효과음 끄기"}
              icon={settings.muted ? "♪×" : "♪"}
              pressed={!settings.muted}
              onClick={() => void handleSoundToggle()}
            />
          </div>
        </header>

        <div className="scene-meta">
          <p>{scene.eyebrow}</p>
          <h1>{scene.title}</h1>
        </div>

        {!showPanel && settings.captions && isCharacterSpeaking && (
          <div
            key={`${scene.id}:${captionIndex}:${captionSpeaker}`}
            className={`character-speech character-speech--${speakerPosition}`}
            aria-hidden="true"
          >
            <strong>{captionSpeaker}</strong>
            <span>{caption}</span>
          </div>
        )}

        {!showPanel && !settings.captions && (
          <div
            className={`speaker-cue speaker-cue--${speakerPosition}`}
            aria-hidden="true"
          >
            <span>{isCharacterSpeaking ? "대사" : "해설"}</span>
            <strong>{captionSpeaker}</strong>
          </div>
        )}

        {!showPanel && (
          <section
            className={`caption-card${isCharacterSpeaking ? " caption-card--character" : ""}${!settings.captions ? " caption-card--visually-hidden" : ""}`}
            aria-live="polite"
            aria-atomic="true"
          >
            {isCharacterSpeaking ? (
              <span className="sr-only">말하는 사람: {captionSpeaker}.</span>
            ) : (
              <div className="caption-card__speaker" aria-label={`말하는 사람: ${captionSpeaker}`}>
                <span aria-hidden="true">◌</span> <span>{captionSpeaker}</span>
              </div>
            )}
            <p className={isCharacterSpeaking ? "sr-only" : undefined}>{caption}</p>
            {scene.soundCaption && <small className={isCharacterSpeaking ? "sr-only" : undefined}>{scene.soundCaption}</small>}
            {scene.safetyNote && <aside>{scene.safetyNote}</aside>}
          </section>
        )}

        {!showPanel && (
          <div className="player-controls">
            <button className="round-control" type="button" onClick={handlePlayPause}>
              <span aria-hidden="true">{phase === "paused" ? "▶" : "Ⅱ"}</span>
              <span className="sr-only">{phase === "paused" ? "이야기 계속 재생" : "이야기 일시정지"}</span>
            </button>
            <button className="next-control" type="button" onClick={handleNext} disabled={phase === "paused"}>
              {captionIndex < scene.captions.length - 1
                ? "다음 문장"
                : scene.interaction
                  ? "함께 골라 보기"
                  : "다음 장면"}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        )}

        {showInteractionSheet && (
          <section className="interaction-sheet">
            <div className="sheet-handle" aria-hidden="true" />
            {phase === "choice" && choiceInteraction && (
              <>
                <p className="eyebrow">같이 생각해 볼까요?</p>
                <h2 ref={interactionHeadingRef} tabIndex={-1}>
                  {choiceInteraction.prompt}
                </h2>
                <div className="choice-list">
                  {choiceInteraction.options.map((option) => (
                    <button
                      className="choice-card"
                      type="button"
                      key={option.id}
                      onClick={() => chooseOption(option)}
                    >
                      <span className="choice-card__emoji" aria-hidden="true">{option.emoji}</span>
                      <span>
                        <strong>{option.label}</strong>
                        {option.description && <small>{option.description}</small>}
                      </span>
                      <i aria-hidden="true">›</i>
                    </button>
                  ))}
                </div>
                {scene.safetyNote && <p className="safety-note">{scene.safetyNote}</p>}
              </>
            )}

            {phase === "feedback" && selectedOption && choiceInteraction && (
              <div className="feedback-panel">
                <span className="feedback-panel__icon" aria-hidden="true">
                  {selectedOption.guidance === "preferred" ? "✦" : selectedOption.guidance === "neutral" ? "🌱" : "💭"}
                </span>
                <p className="eyebrow">
                  {selectedOption.guidance === "preferred"
                    ? "다정한 마음을 발견했어요"
                    : selectedOption.guidance === "neutral"
                      ? "내 마음밭에 심을 씨앗"
                      : "한 번 더 마음을 살펴봐요"}
                </p>
                <h2 ref={interactionHeadingRef} tabIndex={-1}>{selectedOption.label}</h2>
                <p className="feedback-copy">{selectedOption.feedback}</p>
                <div className="sheet-actions">
                  {selectedOption.guidance === "reflect" && (
                    <button className="button button--ghost" type="button" onClick={retryChoice}>
                      {choiceInteraction.retryLabel}
                    </button>
                  )}
                  <button className="button button--primary" type="button" onClick={continueAfterChoice}>
                    {choiceInteraction.continueLabel} <span aria-hidden="true">→</span>
                  </button>
                </div>
              </div>
            )}

            {phase === "activity" && scene.interaction?.kind === "tap" && (
              <div className="activity-panel">
                <p className="eyebrow">손끝으로 이야기를 도와요</p>
                <h2 ref={interactionHeadingRef} tabIndex={-1}>{scene.interaction.prompt}</h2>
                {scene.interaction.participation && (
                  <ParticipationGuide items={scene.interaction.participation} />
                )}
                <button
                  className="activity-target"
                  type="button"
                  aria-label={`${scene.interaction.targetLabel}, 모두 ${scene.interaction.tapsRequired}번 누르기`}
                  onClick={handleActivityTap}
                >
                  <span aria-hidden="true">{scene.interaction.targetEmoji}</span>
                  <strong>{scene.interaction.targetLabel}</strong>
                  <small>{activityTaps} / {scene.interaction.tapsRequired}</small>
                </button>
                <div className="tap-dots" aria-hidden="true">
                  {Array.from({ length: scene.interaction.tapsRequired }, (_, index) => (
                    <i key={index} className={index < activityTaps ? "is-filled" : ""} />
                  ))}
                </div>
                <span className="sr-only" role="status" aria-atomic="true">
                  {activityTaps > 0 && activityTaps < scene.interaction.tapsRequired
                    ? `${scene.interaction.tapsRequired}번 중 ${activityTaps}번 완료`
                    : ""}
                </span>
              </div>
            )}

            {phase === "activityFeedback" && scene.interaction?.kind === "tap" && (
              <div className="feedback-panel">
                <span className="feedback-panel__icon" aria-hidden="true">✦</span>
                <p className="eyebrow">이야기가 한 뼘 자랐어요</p>
                <h2 ref={interactionHeadingRef} tabIndex={-1}>{scene.interaction.targetLabel} 완료!</h2>
                <p className="feedback-copy">{scene.interaction.feedback}</p>
                <div className="sheet-actions">
                  <button className="button button--primary" type="button" onClick={continueAfterActivity}>
                    다음 장면 <span aria-hidden="true">→</span>
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {phase === "failed" && selectedOption?.failure && (
          <section
            ref={failureDialogRef}
            className="failure-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="failure-title"
            aria-describedby="failure-description failure-lesson"
          >
            <span className="failure-overlay__icon" aria-hidden="true">🍂</span>
            <p className="failure-overlay__kicker">새드 엔딩 · 실패</p>
            <h2 id="failure-title" ref={interactionHeadingRef} tabIndex={-1}>
              {selectedOption.failure.title}
            </h2>
            <p id="failure-description" className="failure-overlay__copy">
              {selectedOption.failure.ending}
            </p>
            <article className="failure-lesson" id="failure-lesson">
              <strong>이 장면의 교훈</strong>
              <p>{selectedOption.failure.lesson}</p>
            </article>
            <div className="failure-actions">
              <button className="button button--primary button--large" type="button" onClick={retryChoice}>
                다시 선택하기 <span aria-hidden="true">↺</span>
              </button>
              <button className="button button--ghost button--light" type="button" onClick={restartAfterFailure}>
                처음부터 다시 도전
              </button>
            </div>
          </section>
        )}

        {phase === "paused" && (
          <div className="pause-overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title">
            <span aria-hidden="true">☕</span>
            <p className="eyebrow">잠깐 쉬어 가도 좋아요</p>
            <h2 id="pause-title">이야기가 여기서 기다리고 있어요</h2>
            <button className="button button--primary" type="button" autoFocus onClick={handlePlayPause}>
              계속 읽기 <span aria-hidden="true">▶</span>
            </button>
            <button className="button button--ghost button--light" type="button" onClick={onExit}>
              책장으로 돌아가기
            </button>
          </div>
        )}

        <div className="scene-progress" aria-hidden="true">
          <i style={{ width: `${sceneProgress}%` }} />
        </div>
      </div>
    </main>
  );
}

function CompletionScreen({
  episode,
  progress,
  onRestart,
  onLibrary,
  onGuide,
}: {
  episode: Episode;
  progress: StoryProgress;
  onRestart: () => void;
  onLibrary: () => void;
  onGuide: () => void;
}) {
  const finalSeed = [...progress.selections].reverse().find((selection) => selection.seed)?.seed;
  const uniqueSeeds = [...new Set(progress.selections.map((selection) => selection.seed).filter(Boolean))].slice(-5);
  const completionVisual = getCompletionVisual(episode, progress.sceneId);
  const familyQuestion = episode.meta.discussionPrompts.at(-1) ?? episode.meta.openingQuestion;

  return (
    <main className="completion-screen">
      <div className="completion-visual">
        <img src={completionVisual.image} alt={completionVisual.imageAlt} />
        <div className="completion-visual__scrim" />
        <button className="back-button completion-back" type="button" onClick={onLibrary}>
          <span aria-hidden="true">‹</span> 책장
        </button>
        <div className="completion-heading">
          <span className="completion-seed" aria-hidden="true">🌱</span>
          <p className="eyebrow">이야기 한 권을 함께 읽었어요</p>
          <h1>{finalSeed ?? "따뜻한 마음"} 씨앗이 자랐어요</h1>
        </div>
      </div>
      <section className="completion-content">
        <p className="completion-lesson">“{episode.meta.lesson}”</p>
        <div className="seed-summary" aria-label="우리가 고른 마음 씨앗">
          <p>우리가 이야기에서 만난 마음</p>
          <div>
            {uniqueSeeds.map((seed) => (
              <span key={seed}>✦ {seed}</span>
            ))}
          </div>
        </div>
        <article className="family-card">
          <span aria-hidden="true">💬</span>
          <div>
            <p className="eyebrow">오늘의 가족 질문</p>
            <h2>{familyQuestion}</h2>
          </div>
        </article>
        <div className="completion-actions">
          <button className="button button--primary" type="button" onClick={onRestart}>
            처음부터 다시 읽기
          </button>
          <button className="button button--ghost" type="button" onClick={onGuide}>
            부모 대화 가이드
          </button>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [view, setView] = useState<AppView>("library");
  const [catalog, setCatalog] = useState<EpisodeManifestItem[]>([]);
  const [episodesById, setEpisodesById] = useState<Record<string, Episode>>({});
  const [progressByEpisode, setProgressByEpisode] = useState<
    Record<string, StoryProgress | null>
  >({});
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [progress, setProgress] = useState<StoryProgress | null>(null);
  const [settings, setSettings] = useState<StorySettings>(() => loadSettings());
  const [showParentGuide, setShowParentGuide] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const boot = async () => {
      try {
        const manifest = await loadManifest();
        const enabled = manifest.episodes.filter((item) => item.enabled);
        if (enabled.length === 0) throw new Error("아직 읽을 수 있는 이야기가 없어요.");
        const featured = enabled.find((item) => item.featured) ?? enabled[0];
        const loadedEntries = await Promise.all(
          enabled.map(async (item) => {
            const loaded = await loadEpisode(item.dataPath);
            if (loaded.id !== item.id) {
              throw new Error(`${item.title}의 이야기 ID가 목록과 달라요.`);
            }
            return [item.id, loaded] as const;
          }),
        );
        const loadedEpisodes = Object.fromEntries(loadedEntries) as Record<string, Episode>;
        const loadedEpisode = loadedEpisodes[featured.id];
        const savedProgress = Object.fromEntries(
          loadedEntries.map(([id, loaded]) => [id, loadProgress(loaded)]),
        ) as Record<string, StoryProgress | null>;
        if (!active) return;
        setCatalog(enabled);
        setEpisodesById(loadedEpisodes);
        setProgressByEpisode(savedProgress);
        setEpisode(loadedEpisode);
        setProgress(savedProgress[loadedEpisode.id]);
      } catch (reason) {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "이야기책을 열지 못했어요.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void boot();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [view]);

  const updateSettings = (nextSettings: StorySettings) => {
    setSettings(nextSettings);
    saveSettings(nextSettings);
  };

  const selectEpisode = async (item: EpisodeManifestItem) => {
    setLoading(true);
    setError(null);
    try {
      const loaded = episodesById[item.id] ?? await loadEpisode(item.dataPath);
      if (loaded.id !== item.id) throw new Error(`${item.title}의 이야기 ID가 목록과 달라요.`);
      const saved = loadProgress(loaded);
      setEpisodesById((current) => ({ ...current, [loaded.id]: loaded }));
      setProgressByEpisode((current) => ({ ...current, [loaded.id]: saved }));
      setEpisode(loaded);
      setProgress(saved);
      setView("intro");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "이야기를 열지 못했어요.");
    } finally {
      setLoading(false);
    }
  };

  const beginStory = (resume: boolean) => {
    if (!episode) return;
    // 음향 권한이나 AudioContext 지원 여부가 화면 전환을 막지 않도록 기다리지 않습니다.
    if (!settings.muted) void storyAudio.unlock();
    const saved = resume ? loadProgress(episode) : null;
    const nextProgress = saved && !saved.completed ? saved : makeProgress(episode);
    if (!resume) clearProgress(episode.id);
    saveProgress(nextProgress);
    setProgress(nextProgress);
    setProgressByEpisode((current) => ({ ...current, [episode.id]: nextProgress }));
    setView("player");
  };

  const restartStory = () => {
    if (!episode) return;
    clearProgress(episode.id);
    setProgress(null);
    setProgressByEpisode((current) => ({ ...current, [episode.id]: null }));
    setView("intro");
  };

  if (loading && !episode) {
    return (
      <main className="loading-screen" aria-live="polite">
        <Brand />
        <div className="loading-book" aria-hidden="true"><span /><span /></div>
        <p>이야기책을 펼치고 있어요…</p>
      </main>
    );
  }

  if (error || !episode) {
    return (
      <main className="error-screen">
        <span aria-hidden="true">🍂</span>
        <h1>이야기책을 열지 못했어요</h1>
        <p>{error ?? "잠시 뒤 다시 시도해 주세요."}</p>
        <button className="button button--primary" type="button" onClick={() => window.location.reload()}>
          다시 펼치기
        </button>
      </main>
    );
  }

  const resumeScene = progress
    ? episode.scenes.find((candidate) => candidate.id === progress.sceneId)
    : null;
  const activeManifestItem = catalog.find((item) => item.id === episode.id);
  const narrationAvailable = activeManifestItem?.ttsEnabled !== false;

  return (
    <>
      {view === "library" && (
        <main className="library-screen">
          <header className="library-header">
            <Brand />
            <div className="library-header__actions">
              <a className="hub-link" href="/">
                AI 작업물 허브
              </a>
              <button className="parent-link" type="button" onClick={() => setShowParentGuide(true)}>
                <span aria-hidden="true">◌</span> 부모 가이드
              </button>
            </div>
          </header>

          <section className="library-hero">
            <div className="library-hero__copy">
              <p className="eyebrow">오늘, 아이와 어떤 마음을 키울까요?</p>
              <h1>보고, 듣고,<br /><em>함께 고르는</em><br />우리 이야기</h1>
              <p>
                선택의 결과를 직접 만나고, 실패 뒤에도 다시 도전하는
                <br className="desktop-only" /> 우리 가족의 짧은 동화 시간이에요.
              </p>
              <div className="trust-row" aria-label="서비스 특징">
                <span>✓ 실패 후 재도전</span>
                <span>✓ 자막 기본</span>
                <span>✓ 자동 저장</span>
              </div>
            </div>
            <div className="hero-swallow" aria-hidden="true">⌁</div>
          </section>

          <section className="bookshelf" aria-labelledby="bookshelf-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">오늘의 이야기</p>
                <h2 id="bookshelf-title">마음씨앗 책장</h2>
              </div>
              <span>{catalog.length}권의 이야기</span>
            </div>
            <div className="episode-grid">
              {catalog.map((item, index) => (
                <article className="episode-card" key={item.id}>
                  <button type="button" className="episode-card__cover" onClick={() => void selectEpisode(item)}>
                    <img src={item.cover} alt={`${item.title} 표지`} />
                    <span className="episode-number">{String(index + 1).padStart(2, "0")}</span>
                    <span className="episode-play" aria-hidden="true">▶</span>
                    {item.featured && <span className="featured-badge">추천 이야기</span>}
                  </button>
                  <div className="episode-card__body">
                    <div className="episode-meta">
                      <span>{item.ageRange}</span>
                      <span>{item.estimatedMinutes}분</span>
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.subtitle}</p>
                    {progressByEpisode[item.id] && !progressByEpisode[item.id]?.completed && (
                      <div className="resume-line">
                        <i aria-hidden="true" /> 읽던 장면이 기다리고 있어요
                      </div>
                    )}
                    <button className="text-button" type="button" onClick={() => void selectEpisode(item)}>
                      이야기 살펴보기 <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </article>
              ))}
              <article className="episode-card episode-card--coming">
                <div aria-hidden="true" className="coming-pattern"><span>별</span><span>씨앗</span></div>
                <div className="episode-card__body">
                  <div className="episode-meta"><span>다음 이야기</span></div>
                  <h3>새 마음 씨앗을 준비 중이에요</h3>
                  <p>아이와 함께 나눌 또 다른 이야기가 찾아올 거예요.</p>
                  <span className="coming-label">곧 만나요</span>
                </div>
              </article>
            </div>
          </section>

          <footer className="library-footer">
            <Brand />
            <p>아이의 선택을 판단하지 않고, 그 이유를 함께 들어 주세요.</p>
          </footer>
        </main>
      )}

      {view === "intro" && (
        <main className="intro-screen">
          <img className="intro-background" src={episode.meta.cover} alt="" />
          <div className="intro-scrim" />
          <header className="intro-topbar">
            <button className="back-button" type="button" onClick={() => setView("library")}>
              <span aria-hidden="true">‹</span> 책장
            </button>
            <Brand />
            <button className="parent-link parent-link--light" type="button" onClick={() => setShowParentGuide(true)}>
              부모 가이드
            </button>
          </header>
          <section className="intro-card">
            <div className="intro-card__image">
              <img src={episode.meta.cover} alt={`${episode.meta.title} 동화 표지`} />
            </div>
            <div className="intro-card__content">
              <p className="eyebrow">마음씨앗 이야기</p>
              <h1>{episode.meta.title}</h1>
              <p className="intro-subtitle">{episode.meta.subtitle}</p>
              <div className="intro-tags">
                <span>⌛ 약 {episode.meta.estimatedMinutes}분</span>
                <span>☀ {episode.meta.ageRange}</span>
                <span>▣ {episode.scenes.length}개 장면</span>
              </div>
              <p className="intro-summary">{episode.meta.summary}</p>
              <article className="opening-question">
                <span aria-hidden="true">💬</span>
                <div>
                  <p>시작 전에 함께 물어보세요</p>
                  <strong>{episode.meta.openingQuestion}</strong>
                </div>
              </article>
              <div className="intro-settings" aria-label="이야기 설정">
                <button type="button" aria-pressed={settings.captions} onClick={() => updateSettings({ ...settings, captions: !settings.captions })}>
                  <span aria-hidden="true">자막</span>
                  <strong>자막 {settings.captions ? "켜짐" : "꺼짐"}</strong>
                </button>
                <button
                  type="button"
                  aria-pressed={narrationAvailable && settings.narration}
                  disabled={!narrationAvailable}
                  onClick={() => updateSettings({ ...settings, narration: !settings.narration })}
                >
                  <span aria-hidden="true">낭독</span>
                  <strong>
                    {narrationAvailable
                      ? `자동 낭독 ${settings.narration ? "켜짐" : "꺼짐"}`
                      : "부모가 읽기"}
                  </strong>
                </button>
                <button type="button" aria-pressed={!settings.muted} onClick={() => updateSettings({ ...settings, muted: !settings.muted })}>
                  <span aria-hidden="true">♪</span>
                  <strong>배경음 {settings.muted ? "꺼짐" : "켜짐"}</strong>
                </button>
              </div>
              <div className="intro-actions">
                <button className="button button--primary button--large" type="button" onClick={() => void beginStory(false)}>
                  이야기 시작 <span aria-hidden="true">▶</span>
                </button>
                {progress && !progress.completed && (
                  <button className="button button--ghost" type="button" onClick={() => void beginStory(true)}>
                    {resumeScene ? `${resumeScene.number}장 ${resumeScene.title}부터 이어보기` : "이어서 읽기"}
                  </button>
                )}
              </div>
              <small className="autoplay-note">
                배경음은 시작 버튼을 누른 뒤 재생돼요. 자동 낭독은 기본으로 꺼져 있어 부모님이 직접 읽고 다음 버튼으로 속도를 맞출 수 있어요.
                {settings.narration && hasGeneratedVoice(episode) && " 켜진 내레이션은 GPT-4o mini TTS로 만든 AI 음성입니다."}
              </small>
            </div>
          </section>
        </main>
      )}

      {view === "player" && progress && (
        <StoryPlayer
          key={`${episode.id}:${progress.sceneId}:${progress.updatedAt}`}
          episode={episode}
          initialProgress={progress}
          settings={settings}
          narrationAvailable={narrationAvailable}
          onSettingsChange={updateSettings}
          onExit={() => {
            const saved = loadProgress(episode);
            setProgress(saved);
            setProgressByEpisode((current) => ({ ...current, [episode.id]: saved }));
            setView("library");
          }}
          onComplete={(completed) => {
            setProgress(completed);
            setProgressByEpisode((current) => ({ ...current, [episode.id]: completed }));
            setView("complete");
          }}
        />
      )}

      {view === "complete" && progress && (
        <CompletionScreen
          episode={episode}
          progress={progress}
          onRestart={restartStory}
          onLibrary={() => setView("library")}
          onGuide={() => setShowParentGuide(true)}
        />
      )}

      {showParentGuide && <ParentGuide episode={episode} onClose={() => setShowParentGuide(false)} />}
    </>
  );
}
