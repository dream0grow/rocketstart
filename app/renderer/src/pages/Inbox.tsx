import { useEffect, useRef, useState } from "react";
import type { InboxRow } from "../types";
import { cn } from "../lib/utils";
import { CATEGORY_META, computeDday, ddayText } from "../lib/cards";

// 📥 공문 집어넣기 — 공문을 카드로 만드는 두 가지 방법:
//   ① 자동: 폴더를 지정하면, 그 폴더에 저장되는 공문을 알아서 읽음
//   ② 수동: 드롭 영역에 파일을 끌어다 놓음 (메신저로 받은 것 등)
// 모든 처리는 이 PC 안에서만 일어납니다.
export default function Inbox() {
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [withAi, setWithAi] = useState(false);
  const [watchDir, setWatchDir] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // 자동 읽기 폴더 정보 + 자동 처리 결과 구독
  useEffect(() => {
    window.gyomu.getWatchDir().then(setWatchDir);
    const unsubscribe = window.gyomu.onInboxProcessed((row) => {
      setRows((prev) => [row, ...prev]);
    });
    return unsubscribe;
  }, []);

  async function chooseFolder() {
    const dir = await window.gyomu.chooseWatchFolder();
    setWatchDir(dir);
  }

  async function clearFolder() {
    await window.gyomu.clearWatchFolder();
    setWatchDir(null);
  }

  // ② 수동: 파일들을 순서대로 추출 → 카드로 저장 → 결과 줄 추가.
  async function processFiles(files: FileList | File[]) {
    setBusy(true);
    for (const f of Array.from(files)) {
      try {
        const path = window.gyomu.getFilePath(f);
        const result = await window.gyomu.extractFile(path, withAi);
        const { card, merged } = await window.gyomu.addFromExtract(result);
        const isImage = result.notebook?.is_image;
        setRows((prev) => [
          {
            name: f.name,
            status: merged ? "병합" : isImage ? "이미지" : "성공",
            message: merged
              ? "같은 공문 세트에 합쳤습니다 (첨부/본문 자동 정리)"
              : isImage
                ? "이미지 공문(포스터 등) — 글자를 읽을 수 없어 원본 확인 필요"
                : result.message || "추출 성공",
            card,
          },
          ...prev,
        ]);
      } catch (e) {
        setRows((prev) => [
          { name: f.name, status: "실패", message: String(e).slice(0, 300) },
          ...prev,
        ]);
      }
    }
    setBusy(false);
  }

  return (
    <div style={{ flex: 1, padding: 20, minWidth: 0 }}>
      {/* ① 자동: 공문 폴더 지정 */}
      <div className="watch-box">
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
          ① 공문 폴더 자동 읽기
        </div>
        {watchDir ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 13 }}>
              👀 감시 중: <b style={{ color: "#1e8449" }}>{watchDir}</b>
            </span>
            <span style={{ fontSize: 12, color: "#7f8c8d" }}>
              이 폴더에 공문을 저장(다운로드)하기만 하면 자동으로 읽어 카드로 만듭니다.
            </span>
            <button className="chip" onClick={chooseFolder}>폴더 바꾸기</button>
            <button className="chip" onClick={clearFolder}>자동 읽기 끄기</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "#7f8c8d" }}>
              공문을 내려받는 폴더(예: 400_학교 다운로드)를 지정해 두면,
              앞으로 거기에 저장되는 공문을 앱이 알아서 읽습니다.
            </span>
            <button
              className="chip on"
              style={{ fontSize: 13, padding: "6px 14px" }}
              onClick={chooseFolder}
            >
              📁 폴더 지정하기
            </button>
          </div>
        )}
      </div>

      {/* ② 수동: 드롭 영역 */}
      <div
        className={cn("dropzone", dragOver && "over")}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInput.current?.click()}
      >
        <div style={{ fontSize: 40 }}>📥</div>
        <div style={{ fontSize: 16, fontWeight: 600, margin: "6px 0" }}>
          ② 공문 파일을 여기에 끌어다 놓으세요
        </div>
        <div style={{ fontSize: 13, color: "#7f8c8d" }}>
          다른 폴더에 받은 것, 메신저로 받은 것은 여기로 (클릭해서 골라도 됨 · 여러 개 가능)
          <br />
          지원 형식: PDF · HWP · HWPX · ODT · XLSX · XLS
        </div>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept=".pdf,.hwp,.hwpx,.odt,.xlsx,.xls"
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files?.length) processFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "center", margin: "10px 0 16px" }}>
        <label style={{ fontSize: 13, color: "#7f8c8d" }}>
          <input
            type="checkbox"
            checked={withAi}
            onChange={(e) => setWithAi(e.target.checked)}
          />{" "}
          🤖 AI 요약·할일 제안도 함께 (Ollama 설치된 경우 — 조금 느려짐)
        </label>
        {busy && <span style={{ fontSize: 13, color: "#2471a3" }}>⏳ 읽는 중…</span>}
        <span style={{ fontSize: 12, color: "#95a5a6" }}>
          🔒 모든 처리는 이 PC 안에서만 — 공문이 밖으로 나가지 않습니다
        </span>
      </div>

      {/* 처리 결과 목록 (자동 + 수동 공용) */}
      {rows.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h3 style={{ fontSize: 15 }}>처리 결과 {rows.length}건</h3>
          {rows.map((r, i) => {
            const c = r.card;
            const d = c ? computeDday(c.deadline_iso) : null;
            const meta = c ? CATEGORY_META[c.category] ?? CATEGORY_META["참고형"] : null;
            return (
              <div
                key={i}
                style={{
                  background: "#fff", borderRadius: 10, padding: "10px 14px",
                  boxShadow: "0 1px 3px rgba(0,0,0,.08)",
                  borderLeft: `4px solid ${
                    r.status === "실패" ? "#e74c3c"
                    : r.status === "이미지" ? "#e67e22"
                    : r.status === "병합" ? "#2471a3" : "#1abc9c"
                  }`,
                }}
              >
                <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 3 }}>
                  {r.status === "성공" && "✅ "}
                  {r.status === "병합" && "🔗 "}
                  {r.status === "이미지" && "🖼 "}
                  {r.status === "실패" && "❌ "}
                  {r.name}
                </div>
                <div style={{ fontSize: 12.5, color: "#7f8c8d", marginBottom: c ? 5 : 0 }}>
                  {r.message}
                </div>
                {c && meta && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 12 }}>
                    <span className="tag" style={{ background: meta.bg, color: meta.color, fontWeight: 600 }}>
                      {meta.icon} {c.category}
                    </span>
                    {c.owner && (
                      <span className={cn("tag", c.owner === "부장" ? "owner-me" : "owner-teachers")}>
                        {c.owner === "부장" ? "👤 부장 처리" : "📢 담임 공람"}
                      </span>
                    )}
                    {d !== null && (
                      <span className={cn("badge", d < 0 ? "dday over" : d <= 7 ? "dday soon" : "dday ok")}>
                        {ddayText(d)}{d !== null && d < 0 ? " 지남" : ""}
                      </span>
                    )}
                    {(c.attachments?.length ?? 0) > 0 && (
                      <span className="tag">📎 첨부 {c.attachments!.length}</span>
                    )}
                    <span style={{ color: "#95a5a6" }}>{c.sender}</span>
                  </div>
                )}
              </div>
            );
          })}
          <div className="note">
            ※ 저장된 카드는 🏠 홈 대시보드에 자동으로 나타납니다.
            분류가 틀렸으면 홈에서 카드를 눌러 직접 고쳐 주세요 — 고친 내용은
            기억되어 다음번 같은 공문에 자동 적용됩니다.
          </div>
        </div>
      )}
    </div>
  );
}
