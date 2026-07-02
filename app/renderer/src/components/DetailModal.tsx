import type { Card } from "../types";
import { CATEGORY_META, computeDday, ddayText } from "../lib/cards";

interface Props {
  card: Card | null;
  onClose: () => void;
}

// 카드 클릭 상세 모달.
// 발신기관·문서번호·성격·업무유형·마감일은 규칙 추출(정확)값을 그대로 표시하고,
// 한 줄 요약·세부 할 일은 로컬 AI(Ollama) 제안이라 '확인 필요' 문구를 붙입니다.
// 원본 파일 경로가 있으면(들어온 공문에서 넣은 공문) 바로 열 수 있습니다.
export default function DetailModal({ card, onClose }: Props) {
  if (!card) return null;

  const d = computeDday(card.deadline_iso); // 오늘 기준 재계산
  const dl = card.deadline_iso ? (
    <>
      [{card.deadline_label}] {card.deadline_raw}{" "}
      <b style={{ color: d !== null && d < 0 ? "#c0392b" : undefined }}>
        {ddayText(d)}
        {d !== null && d < 0 ? " 지남" : ""}
      </b>
    </>
  ) : (
    "없음 (기한 없는 공문)"
  );

  const others = (card.other_deadlines || [])
    .map((o) => `[${o.label}] ${o.raw}`)
    .join(", ");

  const meta = CATEGORY_META[card.category] ?? CATEGORY_META["참고형"];
  const ai = card.ai;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 22,
          maxWidth: 560,
          width: "90%",
          maxHeight: "80vh",
          overflow: "auto",
        }}
      >
        <h2 style={{ fontSize: 17, marginBottom: 12 }}>{card.title || ""}</h2>

        <Row k="발신기관">
          {card.sender || ""} ({card.sender_level})
        </Row>
        <Row k="문서번호">
          {card.doc_number || ""}
          <span style={{ color: "#95a5a6", fontSize: 12, marginLeft: 8 }}>
            (K-에듀파인에서 이 번호로 검색)
          </span>
        </Row>
        <Row k="공문 성격">
          <span style={{ color: meta.color, fontWeight: 600 }}>
            {meta.icon} {card.category}
          </span>{" "}
          → {card.placement}
        </Row>
        {card.owner && (
          <Row k="처리 주체">
            {card.owner === "부장" ? "👤 부장이 직접 처리" : "📢 담임 선생님들에게 공람"}
          </Row>
        )}
        <Row k="분류 근거">
          <span style={{ fontSize: 13, color: "#7f8c8d" }}>{card.category_reason}</span>
        </Row>
        <Row k="업무 유형">{card.task_type}</Row>
        <Row k="마감일">{dl}</Row>
        {others && <Row k="다른 기한">{others}</Row>}

        {/* 같은 공문 세트의 첨부(서식·붙임) — 별도 카드가 아니라 여기에 묶임 */}
        {card.attachments && card.attachments.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 13, color: "#7f8c8d", marginBottom: 4 }}>
              📎 첨부 {card.attachments.length}건 (같은 공문 세트)
            </div>
            <ul style={{ fontSize: 13, paddingLeft: 18, margin: 0 }}>
              {card.attachments.map((a, i) => (
                <li key={i} style={{ margin: "3px 0" }}>
                  {a.title || "(제목 없음)"}
                  {a.extension && (
                    <span style={{ color: "#95a5a6", fontSize: 11.5 }}>
                      {" "}.{a.extension}
                    </span>
                  )}
                  {a.file_path && (
                    <button
                      onClick={() => window.gyomu.openFile(a.file_path!)}
                      style={{
                        marginLeft: 6, border: "1px solid #d5dbdb",
                        background: "#fff", borderRadius: 6, fontSize: 11,
                        padding: "0 6px", cursor: "pointer",
                      }}
                    >
                      열기
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 원본 파일·첨부 열기 — 들어온 공문에서 넣은 공문부터 경로가 채워집니다 */}
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          {card.file_path ? (
            <button
              onClick={() => window.gyomu.openFile(card.file_path!)}
              style={btnStyle("#2471a3")}
            >
              📄 원본 공문 열기
            </button>
          ) : (
            <span style={{ fontSize: 12, color: "#95a5a6", alignSelf: "center" }}>
              ※ 원본 열기는 '들어온 공문'으로 넣은 공문부터 지원됩니다
              (지금 보이는 것은 연습용 예시 데이터).
            </span>
          )}
        </div>

        {/* 한 줄 요약·세부 할 일 = 로컬 AI(Ollama) 제안. 반드시 확인 필요. */}
        {ai && ai.available ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 8,
              background: "#fef9e7",
              border: "1px solid #f7dc6f",
            }}
          >
            <div style={{ fontSize: 12, color: "#b7950b", marginBottom: 6 }}>
              ⚠ {ai.notice || "AI가 제안한 내용입니다. 반드시 확인해 주세요."}
            </div>
            {ai.summary && (
              <div style={{ fontSize: 14, marginBottom: 6 }}>
                한 줄 요약: {ai.summary}
              </div>
            )}
            {ai.tasks && ai.tasks.length > 0 && (
              <ul style={{ fontSize: 13.5, paddingLeft: 18, margin: 0 }}>
                {ai.tasks.map((t, i) => (
                  <li key={i}>{t.text}</li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div
            style={{
              color: "#95a5a6",
              fontSize: 12.5,
              marginTop: 10,
            }}
          >
            ※ 한 줄 요약·세부 할 일은 로컬 AI(Ollama)가 제안하는 부분입니다 (MVP-4).
            <br />
            <span style={{ fontSize: 12 }}>
              ⚠ AI 제안은 반드시 확인해 주세요. 마감일·발신기관은 규칙 추출(정확)값입니다.
            </span>
          </div>
        )}

        <button onClick={onClose} style={{ ...btnStyle("#34495e"), marginTop: 16 }}>
          닫기
        </button>
      </div>
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: bg,
    color: "#fff",
    border: "none",
    padding: "8px 16px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
  };
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div style={{ margin: "7px 0", fontSize: 14 }}>
      <span style={{ color: "#7f8c8d", display: "inline-block", width: 90 }}>{k}</span>
      {children}
    </div>
  );
}
