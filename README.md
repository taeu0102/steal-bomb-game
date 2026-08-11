# 마음씨앗 동화책

부모와 아이가 함께 보고, 이야기 속 인물의 마음과 행동을 선택하는 인터랙티브 전래동화입니다. 첫 에피소드는 한국 고전 `흥부와 놀부`를 유아·초등 저학년에게 맞게 안전하게 각색했습니다.

## 실행

```bash
npm install
npm run dev
```

검증 명령은 다음과 같습니다.

```bash
npm run qa
```

## 새 에피소드 추가

1. `public/episodes/<episode-id>/episode.json`을 추가합니다.
2. 같은 폴더의 `images/`에 장면 이미지를 넣습니다.
3. `public/episodes/index.json`에 카드 정보와 `dataPath`를 등록합니다.

플레이어 코드를 수정하지 않아도 `cinematic`, `choice`, `activity`, `ending` 장면을 조합할 수 있습니다. 데이터 유효성 검사는 앱 시작과 테스트에서 모두 실행됩니다.

## 제작 문서

- [역할별 산출물](docs/role-deliverables.md)
- [흥부와 놀부 전체 플로우](docs/story-flow.md)
- [영상·아트·사운드·뮤직 사양](docs/audiovisual-spec.md)
- [UX·접근성·QA 사양](docs/ux-qa-spec.md)

## 주요 기능

- 13개 장면, 8개 선택 장면, 3개 터치 활동
- 비권장 선택에도 벌점 없는 부드러운 피드백과 다시 생각하기
- 자막 기본 켜짐, 음소거, 재생·일시정지, 장면 건너뛰기
- 브라우저 음성 합성 내레이션과 Web Audio 기반의 잔잔한 배경음·효과음
- 장면 단위 자동 저장과 이어보기
- 키보드 조작, 큰 터치 영역, 동작 줄이기, 스크린리더 안내
- 부모용 안전 각색 안내와 대화 질문

## 배포

Vite 정적 빌드 결과물은 `dist/`에 생성되며 Vercel에서 바로 배포할 수 있습니다.
