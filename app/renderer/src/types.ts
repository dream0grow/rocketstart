// 파이썬 코어(python -m src.extract "파일" --json)가 돌려주는 JSON 계약.
// 빌드 가이드 §2 데이터 계약을 그대로 타입으로 옮긴 것입니다.
// UI 는 이 형태만 알면 되고, 추출 로직은 절대 다시 만들지 않습니다.

// (구) 아이젠하워 배치 — 날짜별 보기로 바뀌면서 화면에서는 안 쓰지만
// DB 호환을 위해 타입은 남겨둡니다.
export type Quadrant =
  | "안급하지만 중요"
  | "급함+중요"
  | "급함(덜중요)"
  | "해야할일"
  | "기타";

// 공문 5성격 (2026-07 개편: 공람형 신설)
export type Category = "할일형" | "공람형" | "배포형" | "참고형" | "규정형";

// 처리 주체 힌트
export type Owner = "부장" | "담임(공람)" | null;

export interface OtherDeadline {
  label: string | null;
  raw: string | null;
  iso: string | null;
}

// 같은 공문 세트에 딸린 첨부(서식·붙임 등) — 별도 카드로 만들지 않고 묶습니다.
export interface Attachment {
  title: string | null;
  kind: string | null;
  extension: string | null;
  file_path?: string | null;
}

// notebook = 교무수첩 카드 (MVP-3). 화면 카드의 원천 데이터.
export interface NotebookEntry {
  title: string | null;
  sender: string | null;
  doc_number: string | null;
  kind: string | null;
  extension: string | null;
  sender_level: string; // 상급기관 / 타학교 / 단체/기타
  category: Category;
  category_reason: string;
  placement: string;
  task_type: string;
  owner?: Owner; // 처리 주체: 부장 / 담임(공람)
  deadline_iso: string | null;
  deadline_label: string | null;
  deadline_raw: string | null;
  d_day: number | null; // 음수 = 지남 (저장 시점 값 — 화면은 오늘 기준 재계산)
  d_day_text: string; // "D-7" / "D-DAY" / "D+3(지남)"
  other_deadlines: OtherDeadline[];
  stale_dropped: number;
  is_image: boolean;
  needs_review: boolean;
}

export interface AiSuggestion {
  available: boolean;
  model?: string;
  summary?: string;
  summary_evidence?: string;
  tasks?: { text: string; evidence?: string }[];
  notice?: string;
  message?: string;
}

export interface ExtractResult {
  file_path: string;
  extension: string | null;
  filename_info: Record<string, unknown>;
  text: string;
  char_count: number;
  deadline_info: Record<string, unknown>;
  notebook: NotebookEntry;
  ai?: AiSuggestion;
  ok: boolean;
  message: string;
}

// 화면에서 쓰는 카드 = notebook 카드 + 로컬 상태(id·완료·원본 경로).
export interface Card extends NotebookEntry {
  id?: number; // SQLite 행 id (저장된 카드)
  quadrant: Quadrant; // (구) DB 호환용
  done?: boolean; // 처리 완료 표시
  file_path?: string | null; // 원본 공문 파일 경로 (들어온 공문에서 채움)
  attachments?: Attachment[]; // 같은 공문 세트의 첨부(서식 등)
  ai?: AiSuggestion;
}

// 홈에서 바로 쓰는 투두 한 줄.
export type TodoPriority = "중요" | "보통" | "낮음";

export interface Todo {
  id: number;
  text: string;
  priority: TodoPriority;
  done: boolean;
  card_id: number | null;
  created_at: string;
}

// 상단 요약 띠 수치.
export interface Summary {
  total: number;
  task_n: number;
  circulate_n: number;
  week_n: number;
  overdue_n: number;
}

// preload 로 노출되는 브리지 API. (Electron ↔ React)
export interface GyomuApi {
  listCards(): Promise<Card[]>;
  updateQuadrant(id: number, quadrant: Quadrant): Promise<void>;
  setCardDone(id: number, done: boolean): Promise<void>;
  seedIfEmpty(): Promise<number>;
  extractFile(filePath: string, withAi?: boolean): Promise<ExtractResult>;
  openFile(filePath: string): Promise<void>;
  listTodos(): Promise<Todo[]>;
  addTodo(text: string, priority: TodoPriority, cardId?: number | null): Promise<number>;
  toggleTodo(id: number, done: boolean): Promise<void>;
  removeTodo(id: number): Promise<void>;
}

declare global {
  interface Window {
    gyomu: GyomuApi;
  }
}
