import type { Card } from "../types";
import { cn } from "../lib/utils";
import {
  CATEGORY_META, computeDday, ddayText, overdueStyle,
} from "../lib/cards";

interface Props {
  card: Card;
  onClick: () => void;
  onToggleDone: (done: boolean) => void;
}

// 투두리스트로 끌어다 놓을 때 쓰는 드래그 데이터 형식.
export const CARD_DRAG_TYPE = "application/x-gyomu-card";

// 공문 카드 한 장 (= 공문 세트: 본문 + 첨부 묶음).
// 완료 체크 + 제목 + D-day 배지(지날수록 진한 빨강) + 성격·처리주체·첨부 태그.
// 투두리스트에 끌어다 놓으면 할 일로 추가됩니다.
export default function OfficialCard({ card, onClick, onToggleDone }: Props) {
  const d = computeDday(card.deadline_iso); // 오늘 기준 재계산
  const meta = CATEGORY_META[card.category] ?? CATEGORY_META["참고형"];
  const attachN = card.attachments?.length ?? 0;

  return (
    <div
      className={cn("card", card.done && "done")}
      onClick={onClick}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          CARD_DRAG_TYPE,
          JSON.stringify({
            id: card.id,
            title: card.title,
            category: card.category,
          })
        );
        e.dataTransfer.effectAllowed = "copy";
      }}
      title="투두리스트로 끌어다 놓으면 할 일로 추가됩니다"
    >
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        {/* 완료 체크 — 카드 클릭(상세)과 분리 */}
        <input
          type="checkbox"
          checked={!!card.done}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onToggleDone(e.target.checked)}
          title="처리 완료 표시"
          style={{ marginTop: 2, cursor: "pointer" }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t">{card.title || "(제목 없음)"}</div>
          <div className="m">
            {d !== null &&
              (d < 0 ? (
                <span className="badge" style={overdueStyle(-d)}>
                  {ddayText(d)} 지남
                </span>
              ) : (
                <span className={cn("badge", d <= 7 ? "dday soon" : "dday ok")}>
                  {ddayText(d)}
                </span>
              ))}
            <span
              className="tag"
              style={{ background: meta.bg, color: meta.color, fontWeight: 600 }}
            >
              {meta.icon} {card.category}
            </span>
            {card.owner && (
              <span className={cn("tag", card.owner === "부장" ? "owner-me" : "owner-teachers")}>
                {card.owner === "부장" ? "👤 부장 처리" : "📢 담임 공람"}
              </span>
            )}
            {attachN > 0 && <span className="tag">📎 첨부 {attachN}</span>}
            <span className="tag">{card.task_type}</span>
            <span className="sender">{card.sender || ""}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
