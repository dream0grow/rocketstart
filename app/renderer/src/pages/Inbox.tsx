import { useRef, useState } from "react";
import type { Card } from "../types";
import { cn } from "../lib/utils";
import { CATEGORY_META, computeDday, ddayText } from "../lib/cards";

// 처리한 파일 한 건의 결과 줄.
interface RowResult {
  name: string; // 파일 이름
  status: "성공" | "병합" | "이미지" | "실패";
  message: string;
  card?: Card | null;
}

// 📥 들어온 공문 — 공문 파일을 끌어다 놓으면 파이썬 엔진이 읽어서
// 교무수첩 카드로 저장합니다 (같은 공문 세트는 자동으로 묶임).
// 모든 처리는 이 PC 안에서만 일어납니다.
export default function Inbox() {
  const [rows, setRows] = useState<RowResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [withAi, setWithAi] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // 파일들을 순서대로 추출 → 카드로 저장 → 결과 줄 추가.
  async function processFiles(files: FileList | File[]) {
    setBusy(true);
    for (const f of Array.from(files)) {
      let path = "";
      try {
        path = window.gyomu.getFilePath(f);
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
          {
            name: f.name,
            status: "실패",
            message: String(e).slice(0, 300),
          },
          ...prev,
        ]);
      }
    }
    setBusy(false);
  }

  return (
    <div style={{ flex: 1, padding: 20, minWidth: 0 }}>
      {/* 드롭 영역 */}
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
          공문 파일을 여기에 끌어다 놓으세요
        </div>
        <div style={{ fontSize: 13, color: "#7f8c8d" }}>
          (클릭해서 파일을 골라도 됩니다 · 여러 개 한번에 가능)
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

      {/* 처리 결과 목록 */}
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
