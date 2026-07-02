// preload: 렌더러(React)에 안전한 브리지 API 만 노출합니다.
// 네트워크 호출은 없습니다 (절대 원칙: 100% 로컬).
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gyomu", {
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
});
