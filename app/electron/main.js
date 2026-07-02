// Electron 메인 프로세스.
// - 창을 만들고 React 화면을 로드
// - SQLite(카드 저장) + 파이썬 엔진(추출) IPC 핸들러 등록
// - 절대 원칙: 공문 원문·개인정보는 PC 밖으로 안 나감. 처리는 전부 로컬.
//   (개인정보 아닌 의견·분류 수정 내역만, 사용자가 '보내기'를 눌렀을 때 전송)
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

// 의견·분류 개선 데이터를 받을 관리자 메일 (환경변수로 바꿀 수 있음)
const ADMIN_EMAIL = process.env.GYOMU_ADMIN_EMAIL || "leehg0211@gmail.com";

// 게시판식 의견 수합함(구글 폼) 설정 — 관리자가 채우면 온라인 제출로 전환.
function loadFeedbackConfig() {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(__dirname, "feedback_config.json"), "utf-8")
    );
  } catch (_e) {
    return null;
  }
}
const db = require("./db");
const engine = require("./engine");
const { loadSeed } = require("./seed");
const { eisenhower } = require("./eisenhower.cjs");

const isDev = process.env.NODE_ENV === "development";

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    title: "교무부장 도우미",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

function registerIpc() {
  // 저장된 카드 목록
  ipcMain.handle("cards:list", () => db.listCards());

  // 드래그 이동 결과 저장 (구 아이젠하워 — 남겨둠)
  ipcMain.handle("cards:updateQuadrant", (_e, { id, quadrant }) => {
    db.updateQuadrant(id, quadrant);
    return true;
  });

  // 카드 처리 완료/해제
  ipcMain.handle("cards:setDone", (_e, { id, done }) => {
    db.setCardDone(id, done);
    return true;
  });

  // 성격·처리주체 수동 수정 (자동 분류가 틀렸을 때 부장이 직접)
  ipcMain.handle("cards:updateClass", (_e, { id, category, owner }) => {
    db.updateCardClass(id, category, owner);
    return true;
  });

  // ── 투두리스트 (홈에서 바로 작성, 중요도 태그) ──
  ipcMain.handle("todos:list", () => db.listTodos());
  ipcMain.handle("todos:add", (_e, { text, priority, cardId }) =>
    db.addTodo(text, priority, cardId)
  );
  ipcMain.handle("todos:toggle", (_e, { id, done }) => {
    db.toggleTodo(id, done);
    return true;
  });
  ipcMain.handle("todos:update", (_e, { id, text, priority }) => {
    db.updateTodo(id, text, priority);
    return true;
  });
  ipcMain.handle("todos:remove", (_e, { id }) => {
    db.removeTodo(id);
    return true;
  });

  // 비어 있으면 시드 주입. quadrant 가 없으면 규칙(§4)으로 계산해 채웁니다.
  ipcMain.handle("cards:seedIfEmpty", () => {
    if (db.count() > 0) return 0;
    const seed = loadSeed().map((c) => ({
      ...c,
      quadrant: c.quadrant || eisenhower(c),
    }));
    return db.seedCards(seed);
  });

  // 파일 추출 (파이썬 엔진 자식 프로세스). 결과에 quadrant 를 붙여 반환.
  // ★ 로컬 학습: 같은 제목을 부장이 이전에 고쳐 뒀으면 그 분류를 우선 적용.
  ipcMain.handle("engine:extract", async (_e, { filePath, withAi }) => {
    const result = await engine.extractFile(filePath, !!withAi);
    if (result && result.notebook) {
      const learned = db.findClassOverride(result.notebook.title);
      if (learned) {
        result.notebook.category = learned.category;
        result.notebook.owner = learned.owner;
        result.notebook.category_reason =
          "부장이 이전에 직접 고친 분류를 적용 (로컬 학습)";
      }
      result.notebook.quadrant = eisenhower(result.notebook);
    }
    return result;
  });

  // ── 의견 보내기 (불편·문의·아이디어 + 분류 수정 내역) ──
  ipcMain.handle("feedback:add", (_e, { kind, text }) => db.addFeedback(kind, text));
  ipcMain.handle("feedback:list", () => db.listFeedback());
  ipcMain.handle("feedback:remove", (_e, { id }) => {
    db.removeFeedback(id);
    return true;
  });

  // 보낼 내용 미리보기 (사용자가 눈으로 확인한 뒤에만 보냄)
  ipcMain.handle("feedback:preview", () => db.collectOutbox());

  // '보내기': 게시판처럼 한 번에 온라인 제출 (구글 폼 수합함).
  // feedback_config.json 에 폼이 설정돼 있으면 → 앱이 바로 제출 (파일·메일 불필요).
  // 설정 전이면 → 예전 방식(파일 + 메일 초안)으로 안내.
  // 어느 쪽이든 보내는 내용은 의견 글 + 공문 제목 수준의 수정 내역뿐입니다.
  ipcMain.handle("feedback:send", async () => {
    const outbox = db.collectOutbox();
    const n = outbox.feedback.length + outbox.corrections.length;
    if (n === 0) return { ok: false, message: "보낼 내용이 없습니다." };

    // ① 게시판식 제출 (구글 폼) — 설정돼 있으면 이걸로 끝.
    const cfg = loadFeedbackConfig();
    if (cfg && cfg.formUrl && cfg.fields && cfg.fields.text) {
      const lines = outbox.feedback
        .map((f) => `(${f.kind}) ${f.text}`)
        .join("\n") || "(의견 없음 — 분류 수정 내역만)";
      const body = new URLSearchParams();
      if (cfg.fields.sender) body.append(cfg.fields.sender, "교무부장 도우미 앱");
      body.append(cfg.fields.text, lines);
      if (cfg.fields.data) {
        body.append(cfg.fields.data, JSON.stringify(outbox.corrections));
      }
      try {
        const res = await fetch(cfg.formUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        });
        if (res.ok) {
          db.markFeedbackSent();
          return {
            ok: true, count: n,
            message: `수합함(게시판)으로 바로 보냈습니다 — ${n}건. 감사합니다!`,
          };
        }
      } catch (_e) {
        /* 네트워크 실패 → 아래 메일 방식으로 넘어감 */
      }
    }

    // ② 아직 수합함이 없거나 실패 → 파일 + 메일 초안 (예전 방식)
    const dir = path.join(app.getPath("userData"), "outbox");
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 10);
    const file = path.join(dir, `교무도우미-의견-${stamp}.json`);
    fs.writeFileSync(file, JSON.stringify(outbox, null, 2), "utf-8");
    shell.showItemInFolder(file);
    const mailto =
      `mailto:${ADMIN_EMAIL}` +
      `?subject=${encodeURIComponent("[교무부장 도우미] 사용 의견")}` +
      `&body=${encodeURIComponent("방금 열린 폴더의 JSON 파일을 첨부해 보내주세요.")}`;
    shell.openExternal(mailto);
    db.markFeedbackSent();
    return {
      ok: true, file, count: n,
      message: "온라인 수합함이 아직 설정되지 않아, 파일 + 메일 초안으로 준비했습니다.",
    };
  });

  // 원본 파일 열기 (OS 기본 프로그램)
  ipcMain.handle("shell:openFile", (_e, filePath) => shell.openPath(filePath));

  // 추출 결과를 교무수첩 카드로 저장 (들어온 공문 → 홈/교무수첩).
  // 같은 공문 세트(발신기관+문서번호)가 이미 있으면 낱장을 만들지 않고 병합:
  //   · 새 파일이 첨부(서식 등) → 기존 카드의 첨부 목록에 붙임
  //   · 새 파일이 본문 → 대표를 본문으로 교체 (기존 대표는 첨부로)
  ipcMain.handle("cards:addFromExtract", (_e, { result }) => {
    const nb = result && result.notebook;
    if (!nb) return { card: null, merged: false };

    const existing = db.findCardByDoc(nb.sender, nb.doc_number);
    if (existing && existing.id !== undefined) {
      if ((nb.kind || "") === "본문") {
        db.promoteMain(existing.id, nb, result.file_path);
      } else {
        db.appendAttachment(
          existing.id,
          {
            title: nb.title, kind: nb.kind,
            extension: nb.extension, file_path: result.file_path,
          },
          {
            deadline_iso: nb.deadline_iso, deadline_label: nb.deadline_label,
            deadline_raw: nb.deadline_raw, d_day: nb.d_day,
            d_day_text: nb.d_day_text ?? "",
          }
        );
      }
      return { card: db.getCard(existing.id), merged: true };
    }

    const id = db.insertCard({
      ...nb,
      quadrant: eisenhower(nb),
      file_path: result.file_path ?? null,
      attachments: [],
    });
    return { card: db.getCard(id), merged: false };
  });
}

app.whenReady().then(() => {
  const userDataDir = path.join(app.getPath("userData"), "data");
  db.initDb(userDataDir);
  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
