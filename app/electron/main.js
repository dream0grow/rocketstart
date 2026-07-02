// Electron 메인 프로세스.
// - 창을 만들고 React 화면을 로드
// - SQLite(카드 저장) + 파이썬 엔진(추출) IPC 핸들러 등록
// - 절대 원칙: 클라우드 API 금지, 개인정보 비저장. 외부 네트워크 호출 없음.
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
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
  ipcMain.handle("engine:extract", async (_e, { filePath, withAi }) => {
    const result = await engine.extractFile(filePath, !!withAi);
    if (result && result.notebook) {
      result.notebook.quadrant = eisenhower(result.notebook);
    }
    return result;
  });

  // 원본 파일 열기 (OS 기본 프로그램)
  ipcMain.handle("shell:openFile", (_e, filePath) => shell.openPath(filePath));
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
