# 마음씨앗 동화책

부모와 아이가 함께 보고, 이야기 속 인물의 마음과 행동을 선택하는 인터랙티브 동화책입니다. 한국 고전 `흥부와 놀부`를 안전하게 각색한 첫 이야기와, 실수를 인정하고 함께 고치는 용기를 다룬 창작 동화 `깨진 달을 고치는 아이`를 담았습니다.

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

- JSON 데이터만으로 확장되는 전래동화·창작동화 에피소드
- `깨진 달을 고치는 아이`: 13개 장면, 평가 선택 4회, 즉시 실패 결말 8개, 터치 활동 2회
- 비권장 선택은 즉시 새드 엔딩·실패로 전환하고 같은 질문에서 다시 도전
- 자막 기본 켜짐, 음소거, 재생·일시정지, 장면 건너뛰기
- GPT-4o mini TTS로 미리 만든 정적 내레이션과 Web Audio 기반의 잔잔한 배경음·효과음
- 음성 파일 오류 시에만 브라우저 음성으로 이어지는 안전한 폴백
- 장면 단위 자동 저장과 이어보기
- 키보드 조작, 큰 터치 영역, 동작 줄이기, 스크린리더 안내
- 부모용 안전 각색 안내와 대화 질문

## 내레이션 생성

음성 생성 계획은 다음 명령으로 확인합니다.

```bash
npm run tts:plan
```

실제 MP3 생성에는 로컬 환경의 `OPENAI_API_KEY`가 필요합니다. 키를 프런트엔드 코드나 `VITE_` 환경 변수에 넣지 마세요. 생성기는 첫 문장으로 모델 접근을 확인한 뒤 세 에피소드의 165개 문장을 `gpt-4o-mini-tts`, `marin`, MP3 형식으로 생성합니다.

```bash
npm run tts:generate
```

현재 게임에는 마이크를 통한 자유 대화가 없으므로 Realtime API를 사용하지 않습니다. 이후 자유 대화 기능을 추가할 때는 `gpt-realtime-2.1`과 서버에서 발급한 WebRTC 세션을 사용해야 합니다.

## 배포

단독 배포용 결과물은 `npm run build`로 `dist/`에 생성합니다.

AI 작업물 허브 하위 경로용 결과물은 다음 명령으로 `.hub-dist/`에 생성합니다.

```bash
npm run build:hub
```

- AI 작업물 허브: https://taeu0102-ai.vercel.app/
- 마음씨앗 체험형 동화: https://taeu0102-ai.vercel.app/interactive-story/
