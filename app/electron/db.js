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
    -- 부장이 분류를 직접 고친 기록 (제목 수준 — 개인정보 아님).
    -- ① 같은 제목의 공문이 다시 오면 고친 분류를 우선 적용 (로컬 학습)
    -- ② '의견 보내기'로 관리자에게 보내면 규칙 개선 재료가 됨
    CREATE TABLE IF NOT EXISTS class_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_title TEXT,
      old_category TEXT,
      new_category TEXT,
      old_owner TEXT,
      new_owner TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    -- 사용자가 남기는 불편·문의·아이디어 (보내기 전까지 로컬 보관).
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT DEFAULT '불편',      -- 불편 / 문의 / 아이디어 / 분류문제
      text TEXT NOT NULL,
      sent INTEGER DEFAULT 0,        -- 관리자에게 보냈는지
      created_at TEXT DEFAULT (datetime('now'))
    );
    -- 앱 설정 (예: 공문 자동 읽기 폴더 경로).
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    -- 이미 읽어 들인 파일 경로 (폴더 자동 읽기가 같은 파일을 두 번 안 읽게).
    CREATE TABLE IF NOT EXISTS processed_files (
      path TEXT PRIMARY KEY,
      processed_at TEXT DEFAULT (datetime('now'))
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
// 수정 이력은 class_feedback 에 남겨 ① 로컬 학습 ② 규칙 개선 재료로 씁니다.
function updateCardClass(id, category, owner) {
  const before = db.prepare(
    "SELECT title, category, owner FROM cards WHERE id = ?"
  ).get(id);
  if (before && (before.category !== category || (before.owner ?? null) !== (owner ?? null))) {
    db.prepare(`
      INSERT INTO class_feedback
        (card_title, old_category, new_category, old_owner, new_owner)
      VALUES (?, ?, ?, ?, ?)
    `).run(before.title, before.category, category,
           before.owner ?? null, owner ?? null);
  }
  db.prepare(
    "UPDATE cards SET category = ?, owner = ?, category_reason = ? WHERE id = ?"
  ).run(category, owner ?? null, "부장이 직접 수정 (자동 분류 아님)", id);
}

// 같은 제목의 공문에 대해 부장이 고쳐 둔 분류가 있으면 돌려줍니다 (로컬 학습).
function findClassOverride(title) {
  if (!title) return null;
  return db.prepare(`
    SELECT new_category AS category, new_owner AS owner
    FROM class_feedback WHERE card_title = ?
    ORDER BY id DESC LIMIT 1
  `).get(title) || null;
}

function count() {
  return db.prepare("SELECT COUNT(*) AS n FROM cards").get().n;
}

function getCard(id) {
  const r = db.prepare("SELECT * FROM cards WHERE id = ?").get(id);
  return r ? rowToCard(r) : null;
}

// 같은 공문 세트(발신기관 + 문서번호) 카드 찾기 — 들어온 공문 병합용.
function findCardByDoc(sender, docNumber) {
  if (!sender || !docNumber) return null;
  const r = db.prepare(
    "SELECT * FROM cards WHERE sender = ? AND doc_number = ? ORDER BY id LIMIT 1"
  ).get(sender, docNumber);
  return r ? rowToCard(r) : null;
}

// 기존 세트 카드에 첨부 파일을 붙입니다.
// 세트에 마감이 없는데 첨부에 있으면 그 마감을 대표로 씁니다.
function appendAttachment(id, att, deadlineFields) {
  const card = getCard(id);
  if (!card) return;
  const atts = card.attachments || [];
  atts.push(att);
  db.prepare("UPDATE cards SET attachments = ? WHERE id = ?")
    .run(JSON.stringify(atts), id);
  if (!card.deadline_iso && deadlineFields && deadlineFields.deadline_iso) {
    db.prepare(`
      UPDATE cards SET deadline_iso = @deadline_iso,
        deadline_label = @deadline_label, deadline_raw = @deadline_raw,
        d_day = @d_day, d_day_text = @d_day_text
      WHERE id = @id
    `).run({ id, ...deadlineFields });
  }
}

// 본문 파일이 나중에 들어온 경우: 대표를 본문으로 교체하고,
// 원래 대표(첨부였던 것)는 첨부 목록으로 내립니다.
function promoteMain(id, nb, filePath) {
  const card = getCard(id);
  if (!card) return;
  const atts = card.attachments || [];
  atts.push({
    title: card.title, kind: card.kind,
    extension: card.extension, file_path: card.file_path,
  });
  db.prepare(`
    UPDATE cards SET
      title = @title, kind = @kind, extension = @extension,
      sender_level = @sender_level, category = @category,
      category_reason = @category_reason, placement = @placement,
      task_type = @task_type, owner = @owner,
      deadline_iso = @deadline_iso, deadline_label = @deadline_label,
      deadline_raw = @deadline_raw, d_day = @d_day, d_day_text = @d_day_text,
      other_deadlines = @other_deadlines, is_image = @is_image,
      file_path = @file_path, attachments = @attachments
    WHERE id = @id
  `).run({
    id,
    title: nb.title ?? null,
    kind: nb.kind ?? null,
    extension: nb.extension ?? null,
    sender_level: nb.sender_level ?? null,
    category: nb.category ?? null,
    category_reason: nb.category_reason ?? null,
    placement: nb.placement ?? null,
    task_type: nb.task_type ?? null,
    owner: nb.owner ?? null,
    // 본문에 마감이 없으면 기존(첨부에서 온) 마감을 유지
    deadline_iso: nb.deadline_iso ?? card.deadline_iso ?? null,
    deadline_label: nb.deadline_iso ? nb.deadline_label : card.deadline_label,
    deadline_raw: nb.deadline_iso ? nb.deadline_raw : card.deadline_raw,
    d_day: nb.deadline_iso ? nb.d_day : card.d_day,
    d_day_text: nb.deadline_iso ? (nb.d_day_text ?? "") : (card.d_day_text ?? ""),
    other_deadlines: JSON.stringify(nb.other_deadlines ?? []),
    is_image: nb.is_image ? 1 : 0,
    file_path: filePath ?? null,
    attachments: JSON.stringify(atts),
  });
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

// ── 의견 보내기 (불편·문의·아이디어) ───────────────────────
function addFeedback(kind, text) {
  return db.prepare("INSERT INTO feedback (kind, text) VALUES (?, ?)")
    .run(kind || "불편", text).lastInsertRowid;
}

function listFeedback() {
  return db.prepare("SELECT * FROM feedback ORDER BY id DESC").all()
    .map((r) => ({
      id: r.id, kind: r.kind, text: r.text,
      sent: !!r.sent, created_at: r.created_at,
    }));
}

function removeFeedback(id) {
  db.prepare("DELETE FROM feedback WHERE id = ?").run(id);
}

// '보내기'에 담을 내용: 아직 안 보낸 의견 + 분류 수정 내역 전체.
// (공문 제목 수준까지만 — 원문·개인정보는 절대 포함하지 않음)
function collectOutbox() {
  const feedback = db.prepare("SELECT * FROM feedback WHERE sent = 0 ORDER BY id").all();
  const corrections = db.prepare("SELECT * FROM class_feedback ORDER BY id").all();
  return { feedback, corrections };
}

function markFeedbackSent() {
  db.prepare("UPDATE feedback SET sent = 1 WHERE sent = 0").run();
}

// ── 앱 설정 + 처리한 파일 기록 (폴더 자동 읽기) ────────────
function getSetting(key) {
  const r = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return r ? r.value : null;
}

function setSetting(key, value) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) " +
    "ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}

function removeSetting(key) {
  db.prepare("DELETE FROM settings WHERE key = ?").run(key);
}

function isProcessed(filePath) {
  return !!db.prepare("SELECT 1 FROM processed_files WHERE path = ?").get(filePath);
}

function markProcessed(filePath) {
  db.prepare(
    "INSERT OR IGNORE INTO processed_files (path) VALUES (?)"
  ).run(filePath);
}

module.exports = {
  initDb, listCards, insertCard, updateQuadrant, setCardDone, updateCardClass,
  findClassOverride, count, seedCards,
  getCard, findCardByDoc, appendAttachment, promoteMain,
  listTodos, addTodo, toggleTodo, updateTodo, removeTodo,
  addFeedback, listFeedback, removeFeedback, collectOutbox, markFeedbackSent,
  getSetting, setSetting, removeSetting, isProcessed, markProcessed,
};
