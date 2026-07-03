import { useState } from "react";
import type { Todo, TodoPriority } from "../types";
import { cn } from "../lib/utils";
import { CARD_DRAG_TYPE } from "./OfficialCard";

interface Props {
  todos: Todo[];
  onAdd: (text: string, priority: TodoPriority, cardId?: number | null) => void;
  onToggle: (id: number, done: boolean) => void;
  onUpdate: (id: number, text: string, priority: TodoPriority) => void;
  onRemove: (id: number) => void;
  onOpenCard: (cardId: number) => void; // 공문에서 온 투두 → 공문 상세 열기
}

// 중요도 태그 정의 (색·아이콘). 태그 클릭으로 필터/변경.
const PRIORITIES: { key: TodoPriority; icon: string; cls: string }[] = [
  { key: "중요", icon: "🔴", cls: "p-high" },
  { key: "보통", icon: "🟡", cls: "p-mid" },
  { key: "낮음", icon: "⚪", cls: "p-low" },
];

function nextPriority(p: TodoPriority): TodoPriority {
  const order: TodoPriority[] = ["중요", "보통", "낮음"];
  return order[(order.indexOf(p) + 1) % order.length];
}

// 홈 화면 투두리스트 — 직접 입력 + 공문 카드를 끌어다 놓으면 할 일로 추가.
// 항목의 중요도 태그 클릭 = 중요→보통→낮음 순환 변경.
// 항목 글자 클릭 = 상세 창(이름 편집·중요도·연결 공문).
export default function TodoPanel({
  todos, onAdd, onToggle, onUpdate, onRemove, onOpenCard,
}: Props) {
  const [text, setText] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("보통");
  const [filter, setFilter] = useState<TodoPriority | null>(null);
  const [dropReady, setDropReady] = useState(false);
  const [detail, setDetail] = useState<Todo | null>(null); // 상세/편집 대상

  const shown = filter ? todos.filter((t) => t.priority === filter) : todos;
  // 중요도 순(중요→낮음), 같은 중요도면 최신 먼저. 완료는 맨 아래.
  const order = (p: TodoPriority) => PRIORITIES.findIndex((x) => x.key === p);
  const sorted = [...shown].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (order(a.priority) !== order(b.priority))
      return order(a.priority) - order(b.priority);
    return b.id - a.id;
  });

  function submit() {
    const t = text.trim();
    if (!t) return;
    onAdd(t, priority);
    setText("");
  }

  // 공문 카드를 끌어다 놓으면: 제목으로 투두 생성, 할일형은 자동 '중요'.
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDropReady(false);
    const raw = e.dataTransfer.getData(CARD_DRAG_TYPE);
    if (!raw) return;
    try {
      const c = JSON.parse(raw) as { id?: number; title?: string; category?: string };
      if (!c.title) return;
      const p: TodoPriority = c.category === "할일형" ? "중요" : "보통";
      onAdd(c.title, p, c.id ?? null);
    } catch {
      /* 카드가 아닌 것을 떨어뜨린 경우 무시 */
    }
  }

  return (
    <div
      className={cn("todo-panel", dropReady && "drop-ready")}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(CARD_DRAG_TYPE)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setDropReady(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDropReady(false);
      }}
      onDrop={handleDrop}
    >
      <h3>
        ✅ 투두리스트
        <span className="hint">공문 카드를 여기로 끌어다 놓으면 할 일로 추가</span>
      </h3>

      {/* 입력 줄: 내용 + 중요도 선택 + 추가 */}
      <div className="todo-input">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="할 일을 직접 입력하고 엔터 (예: 체험학습 계획서 결재 올리기)"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as TodoPriority)}
          title="중요도 태그"
        >
          {PRIORITIES.map((p) => (
            <option key={p.key} value={p.key}>
              {p.icon} {p.key}
            </option>
          ))}
        </select>
        <button onClick={submit}>추가</button>
      </div>

      {/* 중요도 태그 필터 */}
      <div className="todo-filters">
        <button
          className={cn("chip", filter === null && "on")}
          onClick={() => setFilter(null)}
        >
          전체 {todos.length}
        </button>
        {PRIORITIES.map((p) => {
          const n = todos.filter((t) => t.priority === p.key).length;
          return (
            <button
              key={p.key}
              className={cn("chip", p.cls, filter === p.key && "on")}
              onClick={() => setFilter(filter === p.key ? null : p.key)}
            >
              {p.icon} {p.key} {n}
            </button>
          );
        })}
      </div>

      {/* 목록 */}
      <div className="todo-list">
        {sorted.length === 0 && (
          <div className="todo-empty">
            {filter
              ? "이 태그의 할 일이 없습니다"
              : "아직 할 일이 없습니다 — 직접 입력하거나, 아래 공문 카드를 끌어다 놓아 보세요"}
          </div>
        )}
        {sorted.map((t) => {
          const p = PRIORITIES.find((x) => x.key === t.priority);
          return (
            <div key={t.id} className={cn("todo-item", t.done && "done")}>
              <input
                type="checkbox"
                checked={t.done}
                onChange={(e) => onToggle(t.id, e.target.checked)}
              />
              {/* 글자 클릭 → 상세/편집 */}
              <span
                className="txt clickable"
                onClick={() => setDetail(t)}
                title="클릭하면 상세 보기·이름 편집"
              >
                {t.card_id != null && <span title="공문에서 추가됨">📄 </span>}
                {t.text}
              </span>
              {/* 중요도 클릭 → 중요→보통→낮음 순환 변경 */}
              <button
                className={cn("chip mini", p?.cls, "on")}
                onClick={() => onUpdate(t.id, t.text, nextPriority(t.priority))}
                title="클릭하면 중요도가 바뀝니다 (중요→보통→낮음)"
              >
                {p?.icon} {p?.key}
              </button>
              <button className="del" title="삭제" onClick={() => onRemove(t.id)}>
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {detail && (
        <TodoDetailModal
          todo={todos.find((t) => t.id === detail.id) ?? detail}
          onClose={() => setDetail(null)}
          onUpdate={onUpdate}
          onToggle={onToggle}
          onRemove={(id) => { onRemove(id); setDetail(null); }}
          onOpenCard={(cardId) => { setDetail(null); onOpenCard(cardId); }}
        />
      )}
    </div>
  );
}

// ── 투두 상세/편집 모달 ─────────────────────────────────────
function TodoDetailModal({
  todo, onClose, onUpdate, onToggle, onRemove, onOpenCard,
}: {
  todo: Todo;
  onClose: () => void;
  onUpdate: (id: number, text: string, priority: TodoPriority) => void;
  onToggle: (id: number, done: boolean) => void;
  onRemove: (id: number) => void;
  onOpenCard: (cardId: number) => void;
}) {
  const [text, setText] = useState(todo.text);
  const [priority, setPriority] = useState<TodoPriority>(todo.priority);

  function save() {
    const t = text.trim();
    if (t && (t !== todo.text || priority !== todo.priority)) {
      onUpdate(todo.id, t, priority);
    }
    onClose();
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.4)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) save(); }}
    >
      <div
        style={{
          background: "#fff", borderRadius: 12, padding: 22,
          maxWidth: 460, width: "90%",
        }}
      >
        <h2 style={{ fontSize: 16, marginBottom: 14 }}>✅ 할 일 상세</h2>

        {/* 이름 직접 편집 */}
        <label style={{ fontSize: 12.5, color: "#7f8c8d" }}>내용 (직접 수정 가능)</label>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          style={{
            width: "100%", border: "1px solid #d5dbdb", borderRadius: 8,
            padding: "9px 12px", fontSize: 14, margin: "4px 0 12px",
          }}
          autoFocus
        />

        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 12 }}>
          <label style={{ fontSize: 13 }}>
            중요도{" "}
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TodoPriority)}
              style={{ border: "1px solid #d5dbdb", borderRadius: 6, padding: "3px 6px" }}
            >
              {PRIORITIES.map((p) => (
                <option key={p.key} value={p.key}>{p.icon} {p.key}</option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 13 }}>
            <input
              type="checkbox"
              checked={todo.done}
              onChange={(e) => onToggle(todo.id, e.target.checked)}
            />{" "}
            완료
          </label>
          <span style={{ fontSize: 12, color: "#95a5a6" }}>
            만든 날: {todo.created_at?.slice(0, 10) || "-"}
          </span>
        </div>

        {/* 공문에서 온 투두면 원래 공문 상세로 이동 */}
        {todo.card_id != null && (
          <button
            onClick={() => onOpenCard(todo.card_id!)}
            style={{
              background: "#2471a3", color: "#fff", border: "none",
              padding: "7px 14px", borderRadius: 8, cursor: "pointer",
              fontSize: 13, marginBottom: 12,
            }}
          >
            📄 연결된 공문 상세 보기
          </button>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={() => onRemove(todo.id)}
            style={{
              background: "#fff", color: "#c0392b", border: "1px solid #e6b0aa",
              padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13,
            }}
          >
            삭제
          </button>
          <button
            onClick={save}
            style={{
              background: "#1abc9c", color: "#fff", border: "none",
              padding: "7px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13,
            }}
          >
            저장하고 닫기
          </button>
        </div>
      </div>
    </div>
  );
}
