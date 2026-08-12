const buildingGroups = [
  {
    id: "cityhall",
    title: "시청",
    role: "도시의 중심. 자본 규모와 성장 단계를 가장 먼저 보여주는 랜드마크.",
    palette: ["#d8ae61", "#8f6840", "#f4df9c", "#7fa35f"],
  },
  {
    id: "reserve",
    title: "예금/국채",
    role: "안정형 자산. 낮은 변동성과 방어력을 상징하는 금고, 은행, 보관소.",
    palette: ["#caa665", "#7b6749", "#f3df9f", "#6e8b71"],
  },
  {
    id: "etf",
    title: "ETF 지구",
    role: "여러 섹터를 묶어 보여주는 복합 상업 지구와 바스켓 구조.",
    palette: ["#66a96b", "#4a91a0", "#7d95d6", "#e1c068"],
  },
  {
    id: "dividend",
    title: "배당 정원",
    role: "꾸준한 현금 흐름을 나타내는 정원, 온실, 물길이 있는 안정 구역.",
    palette: ["#7fbf70", "#5b8d61", "#e8c96b", "#98cfc0"],
  },
  {
    id: "semiconductor",
    title: "반도체 팹",
    role: "첨단 생산성과 성장성을 보여주는 클린룸, 칩 코어, 회로 패턴.",
    palette: ["#68bac6", "#2f8f86", "#d4f1ee", "#4c6f9d"],
  },
  {
    id: "manufacturing",
    title: "제조업 공장",
    role: "자동차와 일반 제조업. 넓은 공장동, 컨베이어, 출하 동선.",
    palette: ["#78a5dd", "#4d73a8", "#d6e7f8", "#9c7242"],
  },
  {
    id: "heavy",
    title: "중공업/제철소",
    role: "원자재와 설비 사이클. 굴뚝, 용광로, 철골 구조가 핵심.",
    palette: ["#9a6952", "#6f4a3b", "#f0a542", "#56535a"],
  },
  {
    id: "shipyard",
    title: "조선 도크",
    role: "수주와 해운 사이클. 도크, 선체, 대형 크레인으로 즉시 인지.",
    palette: ["#6faec5", "#456e88", "#f2efe3", "#d79b3a"],
  },
  {
    id: "energy",
    title: "에너지 시설",
    role: "전력망, 태양광, 배터리, 발전소를 아우르는 인프라 건물.",
    palette: ["#d8a448", "#7a8a5a", "#5f95d0", "#f0d24c"],
  },
  {
    id: "platform",
    title: "데이터센터",
    role: "플랫폼과 성장주. 서버랙, 통신 안테나, 유리 타워로 표현.",
    palette: ["#6d9fb0", "#4a7185", "#c4e8ee", "#8b87d7"],
  },
];

const variants = [
  { id: "A", name: "A. 저층 상가형", note: "작은 부지에서도 읽히는 플랫 건물 컬렉션 톤" },
  { id: "B", name: "B. 코너 빌딩형", note: "측면과 지붕을 분리한 서울 도심 블록형" },
  { id: "C", name: "C. 복합 시설형", note: "건물 기능과 업종 아이콘을 입면에 크게 노출" },
  { id: "D", name: "D. 고층 랜드마크형", note: "높은 투자금 단계에서 쓸 수 있는 확장형 타워" },
];

function rect(x, y, width, height, className, radius = 4) {
  return `<rect class="${className}" x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" />`;
}

function path(d, className) {
  return `<path class="${className}" d="${d}" />`;
}

function circle(cx, cy, r, className) {
  return `<circle class="${className}" cx="${cx}" cy="${cy}" r="${r}" />`;
}

function windowGrid(x, y, columns, rows, options = {}) {
  const width = options.width ?? 7;
  const height = options.height ?? 7;
  const gapX = options.gapX ?? 7;
  const gapY = options.gapY ?? 8;
  const className = options.className || "window";
  const windows = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      windows.push(rect(x + column * (width + gapX), y + row * (height + gapY), width, height, className, 1.5));
    }
  }

  return windows.join("");
}

function baseTile() {
  return `
    <ellipse class="shadow" cx="100" cy="143" rx="66" ry="14" />
    ${path("M24 128 L100 90 L176 128 L100 164 Z", "tile")}
    ${path("M28 136 C56 123 77 144 103 132 C130 118 147 125 174 112 V126 C148 138 132 132 105 146 C78 159 57 139 29 151 Z", "mini-han-river")}
    ${path("M86 151 L100 127 L114 151 L100 162 Z", "tile-road")}
  `;
}

function roof(x, y, width, depth, className = "roof") {
  return path(`M${x} ${y} L${x + depth} ${y - depth} H${x + width + depth} L${x + width} ${y} Z`, className);
}

function side(x, y, width, height, depth, className = "side") {
  return path(`M${x + width} ${y} L${x + width + depth} ${y + depth} V${y + height} H${x + width} Z`, className);
}

function commonBuilding(group, variant, body) {
  const [primary, sideColor, accent, extra] = group.palette;
  return `
    <svg class="building-svg theme-${group.id}" viewBox="0 0 200 170" aria-hidden="true" style="--primary:${primary};--side:${sideColor};--accent:${accent};--extra:${extra}">
      ${baseTile()}
      ${body}
    </svg>
  `;
}

function renderCityhall(variant, group) {
  if (variant.id === "A") {
    return commonBuilding(
      group,
      variant,
      `
        ${rect(46, 82, 108, 47, "body")}
        ${rect(84, 54, 32, 75, "body tall")}
        ${roof(40, 82, 112, 18)}
        ${roof(78, 54, 34, 14)}
        ${circle(100, 75, 8, "clock")}
        ${path("M116 55 V31", "thin")}
        ${path("M118 33 H148 L140 46 H118 Z", "flag")}
        ${windowGrid(55, 94, 3, 2)}
        ${windowGrid(121, 94, 2, 2)}
      `,
    );
  }
  if (variant.id === "B") {
    return commonBuilding(
      group,
      variant,
      `
        ${rect(51, 78, 91, 52, "body")}
        ${side(51, 78, 91, 52, 18)}
        ${roof(51, 78, 91, 18)}
        ${rect(82, 46, 35, 84, "body tall")}
        ${side(82, 46, 35, 84, 13)}
        ${roof(78, 46, 38, 13)}
        ${circle(100, 68, 9, "clock")}
        ${path("M100 68 V62 M100 68 H106", "thin")}
        ${windowGrid(60, 91, 3, 2)}
        ${windowGrid(122, 91, 2, 2)}
      `,
    );
  }
  if (variant.id === "C") {
    return commonBuilding(
      group,
      variant,
      `
        ${rect(40, 86, 120, 43, "body")}
        ${path("M38 86 L100 45 L162 86 Z", "roof")}
        ${rect(78, 63, 44, 66, "body tall")}
        ${circle(100, 83, 12, "clock")}
        ${path("M59 97 V126 M76 91 V126 M124 91 V126 M141 97 V126", "columns")}
        ${path("M122 63 V32", "thin")}
        ${path("M124 34 H158 L148 48 H124 Z", "flag")}
      `,
    );
  }
  return commonBuilding(
    group,
    variant,
    `
      ${rect(35, 87, 42, 42, "body wing")}
      ${rect(123, 87, 42, 42, "body wing")}
      ${rect(58, 70, 84, 60, "body")}
      ${side(58, 70, 84, 60, 18)}
      ${roof(49, 70, 92, 20)}
      ${rect(82, 37, 36, 93, "body tall")}
      ${roof(76, 37, 40, 16)}
      ${circle(100, 61, 9, "clock")}
      ${path("M74 84 V126 M88 76 V126 M112 76 V126 M126 84 V126", "columns")}
      ${path("M119 38 V18", "thin")}
      ${path("M121 20 H155 L146 35 H121 Z", "flag")}
    `,
  );
}

function renderReserve(variant, group) {
  if (variant.id === "A") {
    return commonBuilding(group, variant, `${path("M45 84 L100 50 L155 84 Z", "roof")}${rect(48, 84, 104, 45, "body")}${path("M64 94 V123 M82 94 V123 M118 94 V123 M136 94 V123", "columns")}${circle(100, 69, 9, "coin")}${rect(91, 105, 18, 24, "door")}`);
  }
  if (variant.id === "B") {
    return commonBuilding(group, variant, `${rect(48, 80, 96, 49, "body")}${side(48, 80, 96, 49, 17)}${roof(48, 80, 96, 17)}${rect(78, 61, 44, 30, "vault")}${circle(100, 76, 11, "coin")}${path("M43 130 H157 M56 137 H144", "thin")}`);
  }
  if (variant.id === "C") {
    return commonBuilding(group, variant, `${rect(52, 73, 96, 56, "body")}${roof(52, 73, 96, 15)}${rect(77, 88, 46, 41, "vault")}${circle(100, 108, 12, "coin")}${path("M62 86 H75 M126 86 H139 M62 101 H75 M126 101 H139", "thin")}`);
  }
  return commonBuilding(group, variant, `${path("M43 86 C50 56 150 56 157 86 Z", "roof dome")}${rect(43, 86, 114, 43, "body")}${side(43, 86, 114, 43, 13)}${path("M61 92 V124 M80 92 V124 M100 92 V124 M120 92 V124 M139 92 V124", "columns")}${circle(100, 66, 10, "coin")}`);
}

function renderEtf(variant, group) {
  const towers = variant.id === "D" ? `${rect(39, 77, 35, 53, "body a")}${rect(77, 49, 42, 81, "body b")}${rect(122, 66, 34, 64, "body c")}` : `${rect(48, 75, 31, 54, "body a")}${rect(82, 58, 36, 71, "body b")}${rect(121, 83, 28, 46, "body c")}`;
  const roofs = variant.id === "A" ? "" : `${roof(48, 75, 31, 10)}${roof(82, 58, 36, 12)}${roof(121, 83, 28, 9)}`;
  const arc = variant.id === "C" || variant.id === "D" ? path("M48 133 C72 112 128 112 152 133", "connector") : "";
  return commonBuilding(group, variant, `${path("M38 91 C45 123 154 123 162 91 H38 Z", "basket")}${towers}${roofs}${windowGrid(56, 86, 2, 3)}${windowGrid(91, 69, 2, 4)}${windowGrid(128, 94, 2, 2)}${arc}`);
}

function renderDividend(variant, group) {
  if (variant.id === "A") {
    return commonBuilding(group, variant, `${rect(48, 85, 104, 44, "greenhouse")}${path("M48 85 C65 59 135 59 152 85 Z", "glass")}${path("M62 85 V128 M100 63 V128 M138 85 V128", "thin")}${circle(100, 104, 13, "tree")}`);
  }
  if (variant.id === "B") {
    return commonBuilding(group, variant, `${rect(46, 90, 94, 39, "greenhouse")}${side(46, 90, 94, 39, 18, "glass-side")}${roof(46, 90, 94, 18, "glass")}${circle(73, 92, 12, "tree")}${circle(125, 101, 14, "tree")}${path("M63 120 C78 109 119 109 136 120", "water")}`);
  }
  if (variant.id === "C") {
    return commonBuilding(group, variant, `${path("M50 104 C58 80 142 80 150 104 V130 H50 Z", "greenhouse")}${path("M64 99 H136 M73 86 V130 M100 80 V130 M127 86 V130", "thin")}${circle(82, 112, 10, "coin")}${circle(118, 112, 10, "coin")}`);
  }
  return commonBuilding(group, variant, `${rect(43, 88, 114, 41, "greenhouse")}${path("M43 88 C59 54 141 54 157 88 Z", "glass")}${side(43, 88, 114, 41, 14, "glass-side")}${circle(68, 103, 12, "tree")}${circle(100, 93, 15, "tree")}${circle(133, 105, 11, "tree")}${path("M54 132 C75 118 125 118 146 132", "water")}`);
}

function renderSemiconductor(variant, group) {
  if (variant.id === "A") {
    return commonBuilding(group, variant, `${rect(46, 68, 108, 61, "body")}${roof(46, 68, 108, 16, "glass")}${rect(76, 85, 48, 32, "chip")}${path("M76 94 H62 M76 108 H62 M124 94 H138 M124 108 H138 M88 85 V71 M104 85 V71", "thin")}${windowGrid(56, 78, 3, 2)}`);
  }
  if (variant.id === "B") {
    return commonBuilding(group, variant, `${rect(48, 64, 86, 65, "body")}${side(48, 64, 86, 65, 18)}${roof(48, 64, 86, 18, "glass")}${rect(72, 82, 42, 34, "chip")}${path("M136 68 V36 M128 43 L136 36 L145 43", "thin")}${windowGrid(56, 76, 2, 4)}`);
  }
  if (variant.id === "C") {
    return commonBuilding(group, variant, `${rect(52, 61, 96, 68, "body")}${rect(75, 78, 50, 38, "chip")}${path("M75 87 H58 M75 97 H55 M75 107 H58 M125 87 H142 M125 97 H145 M125 107 H142 M88 78 V60 M100 78 V55 M112 78 V60", "thin")}${path("M84 94 H97 V86 H116 M84 106 H105 V114 H119", "circuit")}`);
  }
  return commonBuilding(group, variant, `${rect(39, 77, 32, 52, "body")}${rect(74, 45, 52, 84, "body")}${rect(129, 70, 29, 59, "body")}${roof(74, 45, 52, 16, "glass")}${rect(84, 72, 32, 32, "chip")}${path("M100 44 V24 M90 31 L100 24 L110 31", "thin")}${windowGrid(82, 55, 3, 4)}`);
}

function renderManufacturing(variant, group) {
  const saw = path("M36 83 H57 L57 64 L78 83 H94 L94 64 L116 83 H148 V130 H36 Z", "body");
  if (variant.id === "A") return commonBuilding(group, variant, `${saw}${rect(72, 102, 34, 28, "door")}${path("M45 96 H64 M116 96 H137 M42 135 H147", "thin")}`);
  if (variant.id === "B") return commonBuilding(group, variant, `${path("M36 83 H57 L57 64 L78 83 H94 L94 64 L116 83 H148 V93 L130 83 H36 Z", "roof")}${rect(40, 88, 91, 42, "body")}${side(40, 88, 91, 42, 17)}${rect(70, 101, 35, 29, "door")}${windowGrid(50, 98, 2, 2)}`);
  if (variant.id === "C") return commonBuilding(group, variant, `${saw}${rect(43, 114, 37, 16, "vehicle")}${circle(54, 130, 5, "wheel")}${circle(72, 130, 5, "wheel")}${path("M60 114 L84 103 M113 79 L143 58 L152 67 L130 92", "thin")}${rect(94, 100, 34, 30, "door")}`);
  return commonBuilding(group, variant, `${path("M32 82 H55 L55 58 L78 82 H96 L96 58 L120 82 H153 V130 H32 Z", "body")}${side(32, 82, 121, 48, 14)}${rect(63, 96, 42, 34, "door")}${rect(116, 98, 26, 32, "bay")}${path("M39 135 H155 M45 94 H58 M118 91 H140", "thin")}`);
}

function renderHeavy(variant, group) {
  if (variant.id === "A") return commonBuilding(group, variant, `${rect(42, 87, 93, 43, "body")}${path("M67 48 H106 L116 130 H55 Z", "furnace")}${rect(126, 48, 20, 82, "chimney")}${path("M88 98 C99 92 109 102 119 96 V129 H88 Z", "molten")}`);
  if (variant.id === "B") return commonBuilding(group, variant, `${rect(39, 87, 91, 43, "body")}${side(39, 87, 91, 43, 17)}${path("M68 47 H105 L116 130 H55 Z", "furnace")}${rect(124, 42, 22, 88, "chimney")}${path("M48 87 L130 130 M130 87 L48 130", "girder")}`);
  if (variant.id === "C") return commonBuilding(group, variant, `${rect(38, 89, 112, 41, "body")}${rect(48, 59, 18, 71, "chimney")}${rect(125, 42, 22, 88, "chimney")}${path("M76 58 H113 L123 130 H65 Z", "furnace")}${path("M84 104 C98 95 110 107 122 99 V129 H84 Z", "molten")}${path("M56 51 C47 43 55 36 66 41 M134 35 C124 27 137 20 148 27", "smoke")}`);
  return commonBuilding(group, variant, `${rect(32, 91, 122, 39, "body")}${side(32, 91, 122, 39, 14)}${rect(43, 61, 18, 69, "chimney")}${path("M70 42 H112 L125 130 H57 Z", "furnace")}${path("M39 91 L154 130 M154 91 L39 130 M45 105 H146", "girder")}${path("M79 100 C94 90 112 105 125 96 V130 H79 Z", "molten")}`);
}

function renderShipyard(variant, group) {
  if (variant.id === "A") return commonBuilding(group, variant, `${path("M31 119 H165 L151 143 H46 Z", "dock")}${path("M47 99 H139 L123 126 H64 Z", "ship")}${path("M67 83 H108 L120 99 H55 Z", "deck")}${path("M42 42 V119 M42 47 H133 M107 47 V85", "crane")}`);
  if (variant.id === "B") return commonBuilding(group, variant, `${path("M30 118 H162 L150 142 H46 Z", "dock")}${side(46, 118, 104, 24, 12, "dock-side")}${path("M47 99 H139 L123 126 H64 Z", "ship")}${path("M42 42 V119 M42 47 H133 M108 47 V85 M133 47 L120 59", "crane")}`);
  if (variant.id === "C") return commonBuilding(group, variant, `${path("M31 119 H165 L151 143 H46 Z", "dock")}${path("M42 96 H145 L128 126 H62 Z", "ship")}${path("M64 78 H111 L125 96 H52 Z", "deck")}${path("M95 78 L134 62", "crane")}${windowGrid(70, 85, 4, 1)}`);
  return commonBuilding(group, variant, `${path("M26 117 H170 L154 144 H43 Z", "dock")}${path("M43 96 H146 L128 128 H61 Z", "ship")}${path("M67 76 H112 L128 96 H52 Z", "deck")}${path("M37 34 V119 M37 40 H151 M118 40 V87 M151 40 L134 57", "crane")}${path("M34 149 C48 141 62 154 76 148 C90 141 104 154 118 148 C132 141 146 154 160 148", "water")}`);
}

function renderEnergy(variant, group) {
  if (variant.id === "A") return commonBuilding(group, variant, `${rect(44, 86, 66, 43, "body")}${path("M44 86 L61 70 H127 L110 86 Z", "roof")}${path("M116 52 H152 C145 80 145 101 156 130 H112 C124 101 124 80 116 52 Z", "tower")}${path("M75 52 L61 85 H78 L68 114 L101 73 H84 Z", "bolt")}`);
  if (variant.id === "B") return commonBuilding(group, variant, `${rect(45, 87, 63, 42, "body")}${side(45, 87, 63, 42, 16)}${roof(45, 87, 63, 16)}${path("M116 50 H151 C145 80 145 101 157 130 H112 C124 101 124 80 116 50 Z", "tower")}${path("M28 105 L78 88 L101 104 L51 122 Z", "solar")}`);
  if (variant.id === "C") return commonBuilding(group, variant, `${path("M32 105 L82 88 L105 104 L55 122 Z M45 109 L92 95 M61 99 L82 116", "solar")}${rect(88, 82, 51, 47, "body")}${path("M115 44 L98 79 H114 L103 110 L136 68 H119 Z", "bolt")}${path("M148 63 V130 M138 78 H158 M141 94 H155", "grid")}`);
  return commonBuilding(group, variant, `${rect(39, 91, 70, 38, "body")}${side(39, 91, 70, 38, 17)}${roof(39, 91, 70, 17)}${path("M115 48 H153 C146 78 146 101 158 130 H111 C123 101 123 78 115 48 Z", "tower")}${path("M29 108 L82 89 L108 107 L55 125 Z", "solar")}${path("M79 48 L61 82 H79 L68 115 L104 71 H86 Z", "bolt")}`);
}

function renderPlatform(variant, group) {
  if (variant.id === "A") return commonBuilding(group, variant, `${rect(54, 64, 92, 65, "body")}${roof(54, 64, 92, 15, "glass")}${windowGrid(64, 77, 5, 4, { width: 7, height: 6 })}${path("M100 62 V35 M90 43 L100 35 L110 43", "thin")}`);
  if (variant.id === "B") return commonBuilding(group, variant, `${rect(51, 61, 81, 68, "body")}${side(51, 61, 81, 68, 18)}${roof(51, 61, 81, 18, "glass")}${windowGrid(61, 75, 4, 4, { width: 7, height: 6 })}${path("M134 65 V39 M126 47 L134 39 L143 47", "thin")}`);
  if (variant.id === "C") return commonBuilding(group, variant, `${rect(45, 80, 28, 49, "body")}${rect(78, 50, 43, 79, "body")}${rect(126, 72, 30, 57, "body")}${windowGrid(86, 63, 3, 5, { width: 6, height: 5 })}${path("M99 50 V28 M87 37 L99 28 L112 37 M59 80 V61 M50 68 L59 61 L68 68", "thin")}`);
  return commonBuilding(group, variant, `${rect(38, 83, 34, 46, "body")}${rect(75, 48, 50, 81, "body")}${side(75, 48, 50, 81, 18)}${rect(130, 68, 30, 61, "body")}${roof(75, 48, 50, 18, "glass")}${windowGrid(84, 62, 3, 5, { width: 7, height: 5 })}${path("M100 47 V22 M88 31 L100 22 L113 31", "thin")}`);
}

function storefront(x, y, width) {
  return `
    ${rect(x, y, width, 13, "storefront", 2)}
    ${path(`M${x - 3} ${y} H${x + width + 3} L${x + width - 2} ${y + 9} H${x + 2} Z`, "awning")}
    ${path(`M${x + 8} ${y + 1} V${y + 10} M${x + 22} ${y + 1} V${y + 10} M${x + width - 22} ${y + 1} V${y + 10} M${x + width - 8} ${y + 1} V${y + 10}`, "awning-line")}
  `;
}

function streetDetails(variant) {
  const lampX = variant.id === "D" ? 45 : 36;
  return `
    ${rect(31, 117, 6, 15, "tree-trunk", 2)}
    ${circle(34, 111, 10, "street-tree")}
    ${rect(162, 119, 5, 13, "tree-trunk", 2)}
    ${circle(164, 114, 9, "street-tree")}
    ${path(`M${lampX} 100 V131 M${lampX - 5} 101 H${lampX + 5}`, "street-lamp")}
  `;
}

function referenceShell(variant) {
  if (variant.id === "A") {
    return `
      ${rect(47, 78, 106, 52, "body facade")}
      ${path("M43 78 L58 62 H145 L158 78 Z", "roof")}
      ${rect(62, 68, 46, 12, "sign", 3)}
      ${windowGrid(58, 88, 5, 2, { width: 8, height: 8, gapX: 8, gapY: 10 })}
      ${storefront(66, 115, 68)}
    `;
  }

  if (variant.id === "B") {
    return `
      ${rect(50, 68, 86, 62, "body facade")}
      ${side(50, 68, 86, 62, 20)}
      ${roof(50, 68, 86, 20)}
      ${rect(66, 55, 43, 13, "sign", 3)}
      ${windowGrid(61, 80, 4, 3, { width: 8, height: 7, gapX: 8, gapY: 8 })}
      ${windowGrid(140, 85, 1, 3, { width: 8, height: 7, gapY: 8 })}
      ${storefront(67, 116, 57)}
    `;
  }

  if (variant.id === "C") {
    return `
      ${rect(41, 88, 48, 42, "body facade secondary")}
      ${rect(88, 60, 72, 70, "body facade")}
      ${roof(41, 88, 48, 12)}
      ${roof(88, 60, 72, 16)}
      ${rect(100, 70, 42, 13, "sign", 3)}
      ${windowGrid(51, 99, 2, 2, { width: 8, height: 8, gapX: 8, gapY: 9 })}
      ${windowGrid(100, 88, 4, 3, { width: 8, height: 7, gapX: 7, gapY: 8 })}
      ${storefront(96, 116, 56)}
    `;
  }

  return `
    ${rect(37, 90, 41, 40, "body facade secondary")}
    ${rect(78, 45, 55, 85, "body facade tall")}
    ${side(78, 45, 55, 85, 18)}
    ${rect(133, 78, 35, 52, "body facade tertiary")}
    ${roof(37, 90, 41, 12)}
    ${roof(78, 45, 55, 18)}
    ${roof(133, 78, 35, 11)}
    ${rect(91, 56, 29, 13, "sign", 3)}
    ${windowGrid(49, 100, 2, 2, { width: 7, height: 7, gapX: 7, gapY: 8 })}
    ${windowGrid(89, 76, 3, 5, { width: 7, height: 6, gapX: 7, gapY: 7 })}
    ${windowGrid(140, 90, 2, 3, { width: 6, height: 6, gapX: 6, gapY: 8 })}
  `;
}

function groupSymbol(group, variant) {
  switch (group.id) {
    case "cityhall":
      return `
        ${circle(100, variant.id === "D" ? 82 : 93, 9, "clock")}
        ${path("M100 93 V87 M100 93 H106", "thin")}
        ${path("M126 50 V30", "thin")}
        ${path("M128 32 H157 L149 45 H128 Z", "flag")}
        ${path("M68 108 V129 M82 102 V129 M118 102 V129 M132 108 V129", "columns")}
      `;
    case "reserve":
      return `
        ${circle(100, variant.id === "D" ? 65 : 74, 10, "coin")}
        ${rect(86, 101, 28, 29, "vault", 4)}
        ${circle(100, 116, 7, "coin")}
        ${path("M59 92 V124 M75 92 V124 M125 92 V124 M141 92 V124", "columns")}
      `;
    case "etf":
      return `
        ${path("M46 97 C56 126 146 126 156 97 H46 Z", "basket")}
        ${rect(63, 82, 18, 34, "a", 3)}
        ${rect(89, 68, 22, 48, "b", 3)}
        ${rect(119, 86, 18, 30, "c", 3)}
        ${path("M58 134 C76 118 124 118 142 134", "connector")}
      `;
    case "dividend":
      return `
        ${path("M51 107 C61 86 139 86 149 107 V130 H51 Z", "glass")}
        ${circle(78, 114, 10, "coin")}
        ${circle(122, 114, 10, "coin")}
        ${circle(101, 99, 13, "street-tree")}
        ${path("M62 132 C82 119 118 119 138 132", "water")}
      `;
    case "semiconductor":
      return `
        ${rect(78, 86, 45, 34, "chip", 5)}
        ${path("M78 95 H62 M78 108 H58 M123 95 H140 M123 108 H144 M91 86 V69 M108 86 V69", "thin")}
        ${path("M87 99 H99 V93 H114 M87 110 H105 V117 H117", "circuit")}
        ${path("M136 73 V43 M127 51 L136 43 L146 51", "thin")}
      `;
    case "manufacturing":
      return `
        ${path("M43 83 H60 L60 66 L80 83 H96 L96 66 L117 83 H151", "factory-saw")}
        ${rect(75, 101, 36, 29, "bay", 3)}
        ${rect(45, 119, 34, 13, "vehicle", 4)}
        ${circle(55, 132, 4, "wheel")}
        ${circle(71, 132, 4, "wheel")}
      `;
    case "heavy":
      return `
        ${rect(45, 60, 17, 70, "chimney", 6)}
        ${rect(133, 48, 21, 82, "chimney", 6)}
        ${path("M75 58 H113 L124 130 H64 Z", "furnace")}
        ${path("M82 104 C96 94 111 107 124 98 V130 H82 Z", "molten")}
        ${path("M45 91 L154 130 M154 91 L45 130", "girder")}
      `;
    case "shipyard":
      return `
        ${path("M30 120 H170 L154 145 H46 Z", "dock")}
        ${path("M48 99 H142 L126 128 H62 Z", "ship")}
        ${path("M68 81 H113 L127 99 H54 Z", "deck")}
        ${path("M39 38 V123 M39 43 H151 M116 43 V88 M151 43 L135 60", "crane")}
      `;
    case "energy":
      return `
        ${path("M119 52 H153 C146 79 146 101 158 130 H113 C125 101 125 79 119 52 Z", "tower")}
        ${path("M31 109 L83 90 L108 107 L55 125 Z M45 112 L94 97 M62 101 L84 118", "solar")}
        ${path("M79 48 L62 83 H79 L68 114 L104 72 H86 Z", "bolt")}
      `;
    case "platform":
      return `
        ${path("M101 58 V29 M89 38 L101 29 L114 38", "thin")}
        ${rect(82, 80, 39, 47, "glass", 4)}
        ${path("M91 91 H112 M91 102 H112 M91 113 H112", "thin")}
        ${path("M48 88 V70 M40 78 L48 70 L57 78 M151 91 V70 M143 78 L151 70 L160 78", "thin")}
      `;
    default:
      return "";
  }
}

function renderReferenceBuilding(variant, group) {
  return commonBuilding(
    group,
    variant,
    `
      ${referenceShell(variant)}
      ${groupSymbol(group, variant)}
      ${streetDetails(variant)}
    `,
  );
}

const renderers = {
  cityhall: renderReferenceBuilding,
  reserve: renderReferenceBuilding,
  etf: renderReferenceBuilding,
  dividend: renderReferenceBuilding,
  semiconductor: renderReferenceBuilding,
  manufacturing: renderReferenceBuilding,
  heavy: renderReferenceBuilding,
  shipyard: renderReferenceBuilding,
  energy: renderReferenceBuilding,
  platform: renderReferenceBuilding,
};

function renderBoard() {
  const board = document.querySelector("#artBoard");
  board.innerHTML = buildingGroups
    .map((group) => {
      const cards = variants
        .map(
          (variant) => `
            <article class="variant-card">
              <div class="art-frame">${renderers[group.id](variant, group)}</div>
              <div class="variant-copy">
                <strong>${variant.name}</strong>
                <span>${variant.note}</span>
              </div>
            </article>
          `,
        )
        .join("");

      return `
        <section class="building-section">
          <div class="section-heading">
            <span>${group.id}</span>
            <h2>${group.title}</h2>
            <p>${group.role}</p>
          </div>
          <div class="variant-grid">${cards}</div>
        </section>
      `;
    })
    .join("");
}

renderBoard();
