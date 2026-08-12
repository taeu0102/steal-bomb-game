const defaultWorks = [
  {
    id: "ghost-forge",
    title: "귀화로: 악마의 계약",
    type: "게임",
    status: "공개",
    date: "2026-08-12",
    description: "악마의 검을 강화해 복수 원정을 떠나고, 강화 단계마다 달라지는 실패 결말을 모으는 3~5분 게임입니다.",
    url: "/ghost-forge/",
    color: "#18120f",
  },
  {
    id: "portfolio-city",
    title: "Portfolio City",
    type: "게임",
    status: "공개",
    date: "2026-08-12",
    description: "실제 시장 흐름에 따라 투자 도시가 성장하는 10종목 포트폴리오 시뮬레이션입니다.",
    url: "/portfolio-city/",
    color: "#dce8da",
  },
  {
    id: "heungbu-nolbu",
    title: "마음씨앗 체험형 동화",
    type: "게임",
    status: "공개",
    date: "2026-08-12",
    description: "부모와 아이가 함께 읽고 선택하며, 토리의 감정 표현 이야기 등 네 편의 교훈을 경험하는 가족 동화 게임입니다.",
    url: "/interactive-story/",
    color: "#dcebd8",
  },
  {
    id: "steal-bomb-game",
    title: "Steal & Bomb",
    type: "게임",
    status: "공개",
    date: "2026-08-04",
    description: "AI 봇과 1인 연습을 하거나 3~8인이 함께 즐기는 실시간 심리 카드게임입니다. 폭탄은 5장 등장하고, 3장 이상 모으면 최종 승리합니다.",
    url: "/steal-bomb-game/",
    color: "#e7e9fb",
  },
];

const storageKey = "ai-work-hub-items-v2";
let works = loadWorks();
let query = "";

const workGrid = document.querySelector("#workGrid");
const uploadForm = document.querySelector("#uploadForm");
const searchInput = document.querySelector("#searchInput");
const resetButton = document.querySelector("#resetButton");

function loadWorks() {
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return defaultWorks;

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.length ? mergeDefaultWorkUpdates(parsed) : defaultWorks;
  } catch {
    return defaultWorks;
  }
}

function mergeDefaultWorkUpdates(items) {
  const defaults = new Map(defaultWorks.map((work) => [work.id, work]));
  const seen = new Set();
  const merged = items.map((work) => {
    if (!defaults.has(work.id)) return work;
    seen.add(work.id);
    return { ...work, ...defaults.get(work.id) };
  });
  const missing = defaultWorks.filter((work) => !seen.has(work.id));
  return [...missing, ...merged];
}

function saveWorks() {
  window.localStorage.setItem(storageKey, JSON.stringify(works));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function filteredWorks() {
  const lowered = query.trim().toLowerCase();
  if (!lowered) return works;

  return works.filter((work) =>
    [work.title, work.type, work.status, work.description].join(" ").toLowerCase().includes(lowered),
  );
}

function render() {
  const list = filteredWorks();
  document.querySelector("#totalCount").textContent = works.length;
  document.querySelector("#interactiveCount").textContent = works.filter((work) =>
    ["게임", "데모"].includes(work.type),
  ).length;
  document.querySelector("#monthCount").textContent = works.filter((work) => work.date.startsWith("2026-08")).length;

  if (!list.length) {
    workGrid.innerHTML = `<div class="empty-state">검색 결과가 없습니다.</div>`;
    return;
  }

  workGrid.innerHTML = list
    .map(
      (work) => `
        <a class="work-card" href="${escapeHtml(work.url)}">
          <div class="work-thumb" style="--thumb-bg: ${escapeHtml(work.color)}"></div>
          <div>
            <span class="type-chip">${escapeHtml(work.type)} · ${escapeHtml(work.status)}</span>
            <h3>${escapeHtml(work.title)}</h3>
            <p>${escapeHtml(work.description)}</p>
          </div>
          <div class="card-meta">
            <span>${escapeHtml(work.date)}</span>
          </div>
          <span class="card-link">열기</span>
        </a>
      `,
    )
    .join("");
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function pickColor(type) {
  return {
    게임: "#e7e9fb",
    문서: "#e5eff7",
    프롬프트: "#ddf0ec",
    자동화: "#fff0d8",
    데모: "#ffe1e4",
  }[type] || "#edf3ef";
}

uploadForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(uploadForm);
  const file = formData.get("file");
  const type = formData.get("type");
  const url = formData.get("url").trim();
  const title = formData.get("title").trim();

  works = [
    {
      id: `work-${Date.now()}`,
      title,
      type,
      status: formData.get("status"),
      date: getToday(),
      description: formData.get("description").trim() || (file?.name ? `${file.name} 파일` : "설명 없음"),
      url: url || "#works",
      color: pickColor(type),
    },
    ...works,
  ];

  saveWorks();
  uploadForm.reset();
  render();
  document.querySelector("#works").scrollIntoView({ behavior: "smooth", block: "start" });
});

searchInput.addEventListener("input", (event) => {
  query = event.target.value;
  render();
});

resetButton.addEventListener("click", () => {
  works = defaultWorks;
  saveWorks();
  searchInput.value = "";
  query = "";
  render();
});

render();
