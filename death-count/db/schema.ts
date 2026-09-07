import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/** description: 룸별 권위 게임 상태. 공개 응답은 서버에서 비밀 필드를 제거한다. */
export const rooms = sqliteTable('death_rooms', {
  /** description: 공유하는 6자리 방 코드, 기본 키. */
  code: text('code').primaryKey(),
  /** description: 참가자 자격 해시·함정·힌트·입력 창·누적 점수·모드·팀·연속 성공 기록을 담는 서버 전용 JSON. */
  state: text('state').notNull(),
  /** description: 경쟁 갱신 방지 및 클라이언트 역순 응답 차단 버전. */
  revision: integer('revision').notNull().default(0),
  /** description: 룸 만료 시각, Unix 밀리초. */
  expires: integer('expires').notNull(),
});
