// 로컬 저장소 (SQLite via better-sqlite3).
// 절대 원칙: 카드 메타·상태·투두만 저장.
// 원문 본문(text)·학생/교사 식별정보는 저장하지 않습니다.
const path = require("node:path");
const fs = require("node:fs");
const Database = require("better-sqlite3");

let db;

// 스키마 버전. 분류 규칙·컬럼이 바뀌면 올립니다.
//   v2: 5성격(공람형) 도입, owner/done/file_path 컬럼, todos 테이블.
//   v3: 공문 세트 묶기 — 본문+첨부(서식 등)를 카드 1장으로, attachments 컬럼.
//       시드가 바뀌므로 카드를 지우고 새 시드로 다시 채웁니다.
const SCHEMA_VERSION = 3;

function initDb(userDataDir) {
  fs.mkdirSync(userDataDir, { recursive: true });
  const file = path.join(userDataDir, "gyomu.db");
  db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      sender TEXT,
      doc_number TEXT,
      kind TEXT,
      extension TEXT,
      sender_level TEXT,
      category TEXT,
      category_reason TEXT,
      placement TEXT,
      task_type TEXT,
      deadline_iso TEXT,
      deadline_label TEXT,
      deadline_raw TEXT,
      d_day INTEGER,
      d_day_text TEXT,
      other_deadlines TEXT,   -- JSON 문자열
      stale_dropped INTEGER DEFAULT 0,
      is_image INTEGER DEFAULT 0,
      needs_review INTEGER DEFAULT 1,
      quadrant TEXT,          -- (구) 아이젠하워 배치 — 날짜별 보기로 바뀌며 미사용
      owner TEXT,             -- 처리 주체 힌트: 부장 / 담임(공람)
      file_path TEXT,         -- 원본 공문 파일 경로 (들어온 공문에서 채움)
      attachments TEXT,       -- 같은 공문 세트의 첨부(서식 등) JSON 목록
      done INTEGER DEFAULT 0, -- 처리 완료 표시
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      priority TEXT DEFAULT '보통',  -- 중요 / 보통 / 낮음
      done INTEGER DEFAULT 0,
      card_id INTEGER,               -- 공문에서 만든 투두면 연결 (없으면 NULL)
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  migrate();
  return db;
}

// 옛 버전 DB 를 현재 스키마로 끌어올립니다.
function migrate() {
  const v = db.pragma("user_version", { simple: true });
  if (v >= SCHEMA_VERSION) return;

  // 컬럼 추가 (이미 있으면 무시).
  for (const ddl of [
    "ALTER TABLE cards ADD COLUMN owner TEXT",
    "ALTER TABLE cards ADD COLUMN file_path TEXT",
    "ALTER TABLE cards ADD COLUMN done INTEGER DEFAULT 0",
    "ALTER TABLE cards ADD COLUMN attachments TEXT",
  ]) {
    try { db.exec(ddl); } catch (_e) { /* 새 DB 는 이미 컬럼 보유 */ }
  }
  // 옛 분류/낱개 카드 시드는 새 시드(공문 세트)로 교체합니다.
  // (아직 시드 데이터 단계라 사용자 데이터 손실이 없습니다.
  //  '들어온 공문'으로 실제 파일을 넣기 시작하면 이 방식은 쓰지 않습니다.)
  db.exec("DELETE FROM cards");

  db.pragma(`user_version = ${SCHEMA_VERSION}`);
}

// 카드를 화면용 객체로 되돌립니다 (JSON 필드 복원, boolean 변환).
function rowToCard(r) {
  return {
    id: r.id,
    title: r.title,
    sender: r.sender,
    doc_number: r.doc_number,
    kind: r.kind,
    extension: r.extension,
    sender_level: r.sender_level,
    category: r.category,
    category_reason: r.category_reason,
    placement: r.placement,
    task_type: r.task_type,
    deadline_iso: r.deadline_iso,
    deadline_label: r.deadline_label,
    deadline_raw: r.deadline_raw,
    d_day: r.d_day,
    d_day_text: r.d_day_text,
    other_deadlines: r.other_deadlines ? JSON.parse(r.other_deadlines) : [],
    stale_dropped: r.stale_dropped,
    is_image: !!r.is_image,
    needs_review: !!r.needs_review,
    quadrant: r.quadrant,
    owner: r.owner,
    file_path: r.file_path,
    attachments: r.attachments ? JSON.parse(r.attachments) : [],
    done: !!r.done,
  };
}

function listCards() {
  const rows = db.prepare("SELECT * FROM cards ORDER BY id ASC").all();
  return rows.map(rowToCard);
}

function insertCard(c) {
  const stmt = db.prepare(`
    INSERT INTO cards (
      title, sender, doc_number, kind, extension, sender_level,
      category, category_reason, placement, task_type,
      deadline_iso, deadline_label, deadline_raw, d_day, d_day_text,
      other_deadlines, stale_dropped, is_image, needs_review, quadrant,
      owner, file_path, attachments, done
    ) VALUES (
      @title, @sender, @doc_number, @kind, @extension, @sender_level,
      @category, @category_reason, @placement, @task_type,
      @deadline_iso, @deadline_label, @deadline_raw, @d_day, @d_day_text,
      @other_deadlines, @stale_dropped, @is_image, @needs_review, @quadrant,
      @owner, @file_path, @attachments, @done
    )
  `);
  return stmt.run({
    title: c.title ?? null,
    sender: c.sender ?? null,
    doc_number: c.doc_number ?? null,
    kind: c.kind ?? null,
    extension: c.extension ?? null,
    sender_level: c.sender_level ?? null,
    category: c.category ?? null,
    category_reason: c.category_reason ?? null,
    placement: c.placement ?? null,
    task_type: c.task_type ?? null,
    deadline_iso: c.deadline_iso ?? null,
    deadline_label: c.deadline_label ?? null,
    deadline_raw: c.deadline_raw ?? null,
    d_day: c.d_day ?? null,
    d_day_text: c.d_day_text ?? "",
    other_deadlines: JSON.stringify(c.other_deadlines ?? []),
    stale_dropped: c.stale_dropped ?? 0,
    is_image: c.is_image ? 1 : 0,
    needs_review: c.needs_review === false ? 0 : 1,
    quadrant: c.quadrant ?? "기타",
    owner: c.owner ?? null,
    file_path: c.file_path ?? null,
    attachments: JSON.stringify(c.attachments ?? []),
    done: c.done ? 1 : 0,
  }).lastInsertRowid;
}

function updateQuadrant(id, quadrant) {
  db.prepare("UPDATE cards SET quadrant = ? WHERE id = ?").run(quadrant, id);
}

// 카드 처리 완료/해제.
function setCardDone(id, done) {
  db.prepare("UPDATE cards SET done = ? WHERE id = ?").run(done ? 1 : 0, id);
}

// 부장이 직접 성격·처리주체를 고칩니다 (자동 분류가 틀렸을 때).
// 수정 이력은 분류 근거에 남겨서, 나중에 규칙 개선 재료로 씁니다.
function updateCardClass(id, category, owner) {
  db.prepare(
    "UPDATE cards SET category = ?, owner = ?, category_reason = ? WHERE id = ?"
  ).run(category, owner ?? null, "부장이 직접 수정 (자동 분류 아님)", id);
}

function count() {
  return db.prepare("SELECT COUNT(*) AS n FROM cards").get().n;
}

// 시드: 비어 있으면 카드들을 한 번에 넣습니다 (트랜잭션).
function seedCards(cards) {
  const insertMany = db.transaction((rows) => {
    for (const c of rows) insertCard(c);
  });
  insertMany(cards);
  return cards.length;
}

// ── 투두리스트 ────────────────────────────────────────────
function listTodos() {
  return db
    .prepare("SELECT * FROM todos ORDER BY done ASC, id DESC")
    .all()
    .map((r) => ({
      id: r.id,
      text: r.text,
      priority: r.priority,
      done: !!r.done,
      card_id: r.card_id,
      created_at: r.created_at,
    }));
}

function addTodo(text, priority, cardId) {
  const id = db
    .prepare("INSERT INTO todos (text, priority, card_id) VALUES (?, ?, ?)")
    .run(text, priority || "보통", cardId ?? null).lastInsertRowid;
  return id;
}

function toggleTodo(id, done) {
  db.prepare("UPDATE todos SET done = ? WHERE id = ?").run(done ? 1 : 0, id);
}

// 투두 내용·중요도 수정 (이름 편집, 중요도 클릭 변경).
function updateTodo(id, text, priority) {
  db.prepare("UPDATE todos SET text = ?, priority = ? WHERE id = ?")
    .run(text, priority, id);
}

function removeTodo(id) {
  db.prepare("DELETE FROM todos WHERE id = ?").run(id);
}

module.exports = {
  initDb, listCards, insertCard, updateQuadrant, setCardDone, updateCardClass,
  count, seedCards,
  listTodos, addTodo, toggleTodo, updateTodo, removeTodo,
};
