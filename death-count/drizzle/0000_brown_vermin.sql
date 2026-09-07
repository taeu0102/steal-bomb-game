-- table description: 룸별 권위 게임 상태. 비밀 데이터는 서버에서만 읽는다.
-- code description: 기본 키인 6자리 공유 방 코드.
-- state description: 참가자 자격 해시, 함정, 개인 힌트, 판정 창과 승수의 서버 전용 JSON.
-- revision description: CAS 경쟁 갱신 및 클라이언트 역순 응답 차단 버전.
-- expires description: 룸 만료 시각, Unix 밀리초.
CREATE TABLE `death_rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`expires` integer NOT NULL
);
