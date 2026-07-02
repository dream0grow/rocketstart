import { useEffect, useState } from "react";
import type { Feedback, FeedbackKind, Outbox } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
}

const KINDS: FeedbackKind[] = ["불편", "문의", "아이디어", "분류문제"];

// 💬 의견 보내기 — 불편·문의·아이디어를 남기고, 분류 수정 내역과 함께
// 관리자에게 보냅니다. 보내기 전에 보낼 내용을 눈으로 확인하고,
// 마지막 전송은 사용자가 메일에서 직접 누릅니다 (앱이 몰래 전송하지 않음).
export default function FeedbackModal({ open, onClose }: Props) {
  const [kind, setKind] = useState<FeedbackKind>("불편");
  const [text, setText] = useState("");
  const [items, setItems] = useState<Feedback[]>([]);
  const [outbox, setOutbox] = useState<Outbox | null>(null); // 보내기 미리보기
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      (async () => {
        setItems(await window.gyomu.listFeedback());
        setOutbox(null);
        setResult(null);
      })();
    }
  }, [open]);

  if (!open) return null;

  async function add() {
    const t = text.trim();
    if (!t) return;
    await window.gyomu.addFeedback(kind, t);
    setText("");
    setItems(await window.gyomu.listFeedback());
  }

  async function remove(id: number) {
    await window.gyomu.removeFeedback(id);
    setItems(await window.gyomu.listFeedback());
  }

  async function preview() {
    setOutbox(await window.gyomu.previewOutbox());
  }

  async function send() {
    const r = await window.gyomu.sendFeedback();
    setResult(r.message || (r.ok ? "보냈습니다." : "보낼 내용이 없습니다."));
    setOutbox(null);
    setItems(await window.gyomu.listFeedback());
  }

  const unsent = items.filter((i) => !i.sent).length;

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.4)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "#fff", borderRadius: 12, padding: 22,
          maxWidth: 620, width: "92%", maxHeight: "85vh", overflow: "auto",
        }}
      >
        <h2 style={{ fontSize: 17, marginBottom: 4 }}>💬 의견 보내기</h2>
        <p style={{ fontSize: 12.5, color: "#7f8c8d", marginBottom: 14 }}>
          불편한 점·문의·아이디어를 남겨 주세요. 분류를 직접 고친 내역과 함께
          관리자에게 보내면 다음 업데이트에서 프로그램이 더 좋아집니다.
          <br />
          <b style={{ color: "#1e8449" }}>
            🔒 공문 원문·학생·교사 개인정보는 절대 포함되지 않습니다
          </b>{" "}
          (의견 글 + 공문 제목 수준의 수정 내역만).
        </p>

        {/* 입력 */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as FeedbackKind)}
            style={{ border: "1px solid #d5dbdb", borderRadius: 8, padding: "0 6px", fontSize: 13 }}
          >
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="예: 캘린더에서 주말 색이 잘 안 보여요"
            style={{
              flex: 1, border: "1px solid #d5dbdb", borderRadius: 8,
              padding: "8px 12px", fontSize: 13.5,
            }}
          />
          <button
            onClick={add}
            style={{
              background: "#1abc9c", color: "#fff", border: "none",
              borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13,
            }}
          >
            남기기
          </button>
        </div>

        {/* 남긴 의견 목록 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
          {items.length === 0 && (
            <div style={{ color: "#bbb", fontSize: 12.5 }}>남긴 의견이 없습니다</div>
          )}
          {items.map((f) => (
            <div
              key={f.id}
              style={{
                display: "flex", gap: 8, alignItems: "center", fontSize: 13,
                border: "1px solid #eee", borderRadius: 8, padding: "6px 10px",
                opacity: f.sent ? 0.55 : 1,
              }}
            >
              <span className="chip mini on">{f.kind}</span>
              <span style={{ flex: 1 }}>{f.text}</span>
              <span style={{ fontSize: 11, color: "#95a5a6" }}>
                {f.sent ? "보냄 ✓" : f.created_at?.slice(5, 10)}
              </span>
              {!f.sent && (
                <button
                  onClick={() => remove(f.id)}
                  style={{ border: "none", background: "none", color: "#d5dbdb", cursor: "pointer" }}
                  title="삭제"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        {/* 보내기 흐름: 미리보기 → 확인 → 보내기 */}
        {!outbox ? (
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              onClick={onClose}
              style={{
                background: "#fff", border: "1px solid #d5dbdb", borderRadius: 8,
                padding: "8px 16px", cursor: "pointer", fontSize: 13,
              }}
            >
              닫기
            </button>
            <button
              onClick={preview}
              title={unsent === 0 ? "분류 수정 내역만 있어도 보낼 수 있습니다" : undefined}
              style={{
                background: "#2471a3", color: "#fff", border: "none", borderRadius: 8,
                padding: "8px 16px", cursor: "pointer", fontSize: 13,
              }}
            >
              보낼 내용 확인하기
            </button>
          </div>
        ) : (
          <div style={{ border: "1px solid #f7dc6f", background: "#fef9e7", borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              📤 아래 내용이 관리자 수합함으로 갑니다 — 확인해 주세요
            </div>
            <div style={{ fontSize: 12.5, maxHeight: 180, overflow: "auto", marginBottom: 8 }}>
              <div style={{ fontWeight: 600 }}>의견 {outbox.feedback.length}건</div>
              {outbox.feedback.map((f) => (
                <div key={`f${f.id}`}>· ({f.kind}) {f.text}</div>
              ))}
              <div style={{ fontWeight: 600, marginTop: 6 }}>
                분류 수정 내역 {outbox.corrections.length}건
              </div>
              {outbox.corrections.map((c) => (
                <div key={`c${c.id}`}>
                  · "{c.card_title}" {c.old_category}
                  {c.old_owner ? `(${c.old_owner})` : ""} → {c.new_category}
                  {c.new_owner ? `(${c.new_owner})` : ""}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setOutbox(null)}
                style={{
                  background: "#fff", border: "1px solid #d5dbdb", borderRadius: 8,
                  padding: "7px 14px", cursor: "pointer", fontSize: 13,
                }}
              >
                취소
              </button>
              <button
                onClick={send}
                style={{
                  background: "#1e8449", color: "#fff", border: "none", borderRadius: 8,
                  padding: "7px 16px", cursor: "pointer", fontSize: 13,
                }}
              >
                확인했어요 — 보내기
              </button>
            </div>
          </div>
        )}

        {result && (
          <div style={{ marginTop: 10, fontSize: 13, color: "#1e8449" }}>✅ {result}</div>
        )}
      </div>
    </div>
  );
}
