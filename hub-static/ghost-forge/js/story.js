export const PROLOGUE = Object.freeze({
  title: "악마가 검의 이름을 말했다",
  paragraphs: Object.freeze([
    "왕실의 거짓 판결로 부모를 잃은 날, 무영은 세상을 용서하지 않기로 했다.",
    "원수 몇 명으로는 모자랐다. 이 부당한 세상 전부를 피로 물들이리라 맹세했다.",
    "그때 꺼진 화로 속 악마가 속삭였다. “한 자루의 검에 네 번 귀화를 봉인해라. +100에 닿으면 신도, 세상도 벨 수 있다.”",
    "무영은 망치를 들었다. 계약서 맨 아래의 아주 작은 글씨는 읽지 못한 채.",
  ]),
});

export const GRADE_MILESTONES = Object.freeze([
  Object.freeze({ grade: 0, title: "녹슨 원한", whisper: "세상은커녕 무도 삐뚤게 썰겠군." }),
  Object.freeze({ grade: 10, title: "솥뚜껑을 넘은 자", whisper: "좋아. 이제 떡집 주인이 솥뚜껑을 두 손으로 들겠어." }),
  Object.freeze({ grade: 20, title: "관청의 수배자", whisper: "관청이 네 이름으로 서류철을 만들었다." }),
  Object.freeze({ grade: 30, title: "관문을 넘은 자", whisper: "이제 반역 신청서 없이도 들어갈 수 있겠군." }),
  Object.freeze({ grade: 40, title: "궁문의 흠집", whisper: "왕이 창고 문짝을 전부 방패로 징발했다." }),
  Object.freeze({ grade: 50, title: "왕실의 악몽", whisper: "한 나라가 흔들린다. 여기서 멈출 생각은 아니겠지?" }),
  Object.freeze({ grade: 60, title: "전설을 깨운 자", whisper: "네가 너무 시끄러워서 전설의 방패가 깨어났다." }),
  Object.freeze({ grade: 70, title: "방패 앞의 야차", whisper: "전설은 맞다. 아쉽게도 네 검 말고 저 방패 쪽이." }),
  Object.freeze({ grade: 80, title: "하늘문을 흔든 자", whisper: "하늘문이 흔들린다. 방패는 여전히 멀쩡하지만." }),
  Object.freeze({ grade: 90, title: "신좌의 문턱", whisper: "신좌까지 열 걸음. 계약서를 다시 읽기엔 늦었어." }),
  Object.freeze({ grade: 100, title: "멸세검의 주인", whisper: "됐다. 방패는 벨 수 있다. 이제 신은… 계약서에 있었나?" }),
]);

export const GRADE_WHISPERS = Object.freeze(GRADE_MILESTONES.map((entry) => entry.whisper));

export const REVENGE_ENDINGS = Object.freeze([
  Object.freeze({
    id: "broken_blades",
    kicker: "멸망 실패 기록 · 화로 앞",
    title: "멸망한 것은 검뿐",
    body: "세상을 없애기도 전에 검이 화로에서 먼저 사라졌다. 남은 것은 그을린 손잡이와 지나치게 당당한 자세뿐이었다.",
    demon: "계약상 폭발도 ‘힘의 방출’이다.",
  }),
  Object.freeze({
    id: "pot_lid",
    kicker: "멸망 실패 기록 · 마을 어귀",
    title: "복수의 첫 상대",
    body: "떡집 주인이 솥뚜껑으로 무영의 검을 막았다. 그는 검을 빼앗은 뒤, 밀린 외상값까지 받아냈다.",
    demon: "저 사람은 일반인 중 최상위야.",
  }),
  Object.freeze({
    id: "closed_office",
    kicker: "멸망 실패 기록 · 관청 문 앞",
    title: "복수 신청 반려",
    body: "관청 문지기는 검보다 무서운 서류 네 장을 내밀었다. 반란 접수 시간이 끝나 무영은 번호표만 들고 돌아왔다.",
    demon: "반역에도 인감이 필요할 줄은 몰랐군.",
  }),
  Object.freeze({
    id: "palace_closed",
    kicker: "멸망 실패 기록 · 왕궁 정문",
    title: "왕궁은 오늘 휴무",
    body: "궁문 하나는 멋지게 갈랐다. 하지만 당직 장군은 창고 문짝으로 다음 일격을 막고 내일 다시 오라 했다.",
    demon: "다음에는 영업시간부터 확인하자.",
  }),
  Object.freeze({
    id: "legendary_shield",
    kicker: "멸망 실패 기록 · 신좌 아래",
    title: "전설의 방패",
    body: "+60을 넘긴 일격 앞에 전설의 방패가 나타났다. 검의 빛은 사라졌지만 방패에는 흠집 하나 없었다.",
    demon: "그게 아직 남아 있었나….",
  }),
  Object.freeze({
    id: "god_two_fingers",
    kicker: "멸망 실패 기록 · 신의 자리",
    title: "신은 강화 수치를 읽지 않는다",
    body: "+100 멸세검은 전설의 방패를 깨고 신좌에 닿았다. 신은 두 손가락으로 칼끝을 잡아 멈췄고, 세상은 평소처럼 아침을 맞았다.",
    demon: "그날부터 계약서 맨 아래에 ‘신 제외’가 추가되었다.",
  }),
]);

export function getForgeWhisper(grade) {
  const value = Math.max(0, Math.min(100, Math.floor(Number(grade) || 0)));
  return GRADE_MILESTONES[Math.min(10, Math.floor(value / 10))].whisper;
}

export function getGradeMilestone(grade) {
  const value = Math.max(0, Math.min(100, Math.floor(Number(grade) || 0)));
  return GRADE_MILESTONES[Math.min(10, Math.floor(value / 10))];
}

export function getNextGradeMilestone(grade) {
  const value = Math.max(0, Math.min(100, Math.floor(Number(grade) || 0)));
  return GRADE_MILESTONES.find((entry) => entry.grade > value) ?? null;
}

export function getRevengeEnding(view) {
  const result = view?.result ?? {};
  const highestGrade = Math.max(0, Number(result.highestGrade) || 0);
  const explosions = Math.max(0, Number(result.explosions) || 0);
  const sealedCount = Math.max(0, Number(result.sealedCount) || 0);

  if (highestGrade >= 100) return REVENGE_ENDINGS[5];
  if (sealedCount === 0 || explosions >= 3) return REVENGE_ENDINGS[0];
  if (highestGrade < 10) return REVENGE_ENDINGS[1];
  if (highestGrade < 30) return REVENGE_ENDINGS[2];
  if (highestGrade < 60) return REVENGE_ENDINGS[3];
  return REVENGE_ENDINGS[4];
}
