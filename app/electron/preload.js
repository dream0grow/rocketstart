// preload: 렌더러(React)에 안전한 브리지 API 만 노출합니다.
// 공문 처리는 전부 로컬 — 네트워크는 사용자가 '의견 보내기'를 눌렀을 때만.
const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("gyomu", {
  // 드래그&드롭된 File 객체의 실제 경로 (Electron 32+ 는 file.path 가 없음)
  getFilePath: (file) => webUtils.getPathForFile(file),
  // 추출 결과를 교무수첩 카드로 저장 (공문 세트 자동 병합)
  addFromExtract: (result) =>
    ipcRenderer.invoke("cards:addFromExtract", { result }),

  // ── 공문 자동 읽기 폴더 ──
  chooseWatchFolder: () => ipcRenderer.invoke("inbox:chooseFolder"),
  getWatchDir: () => ipcRenderer.invoke("inbox:getWatchDir"),
  clearWatchFolder: () => ipcRenderer.invoke("inbox:clearFolder"),
  // 자동 읽기 결과를 화면이 받아보기 (반환값 = 구독 해제 함수)
  onInboxProcessed: (cb) => {
    const listener = (_e, row) => cb(row);
    ipcRenderer.on("inbox:processed", listener);
    return () => ipcRenderer.removeListener("inbox:processed", listener);
  },
  // 저장된 카드 목록
  listCards: () => ipcRenderer.invoke("cards:list"),
  // 카드의 아이젠하워 배치 저장 (구 기능 — 날짜별 보기로 바뀌며 미사용)
  updateQuadrant: (id, quadrant) =>
    ipcRenderer.invoke("cards:updateQuadrant", { id, quadrant }),
  // 카드 처리 완료/해제
  setCardDone: (id, done) => ipcRenderer.invoke("cards:setDone", { id, done }),
  // 성격·처리주체 수동 수정
  updateCardClass: (id, category, owner) =>
    ipcRenderer.invoke("cards:updateClass", { id, category, owner }),
  // DB 가 비어 있으면 시드 데이터 주입 → 넣은 개수 반환
  seedIfEmpty: () => ipcRenderer.invoke("cards:seedIfEmpty"),
  // 파일 1개를 파이썬 엔진으로 추출 (들어온 공문 단계에서 사용)
  extractFile: (filePath, withAi) =>
    ipcRenderer.invoke("engine:extract", { filePath, withAi }),
  // 원본 파일을 OS 기본 프로그램으로 열기
  openFile: (filePath) => ipcRenderer.invoke("shell:openFile", filePath),

  // ── 투두리스트 (홈에서 바로 작성, 중요도 태그) ──
  listTodos: () => ipcRenderer.invoke("todos:list"),
  addTodo: (text, priority, cardId) =>
    ipcRenderer.invoke("todos:add", { text, priority, cardId }),
  toggleTodo: (id, done) => ipcRenderer.invoke("todos:toggle", { id, done }),
  updateTodo: (id, text, priority) =>
    ipcRenderer.invoke("todos:update", { id, text, priority }),
  removeTodo: (id) => ipcRenderer.invoke("todos:remove", { id }),

  // ── 의견 보내기 (개인정보 없는 의견·분류 수정 내역만) ──
  addFeedback: (kind, text) => ipcRenderer.invoke("feedback:add", { kind, text }),
  listFeedback: () => ipcRenderer.invoke("feedback:list"),
  removeFeedback: (id) => ipcRenderer.invoke("feedback:remove", { id }),
  previewOutbox: () => ipcRenderer.invoke("feedback:preview"),
  sendFeedback: () => ipcRenderer.invoke("feedback:send"),
});
