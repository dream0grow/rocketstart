import { useState } from "react";
import type { Todo, TodoPriority } from "../types";
import { cn } from "../lib/utils";
import { CARD_DRAG_TYPE } from "./OfficialCard";

interface Props {
  todos: Todo[];
  onAdd: (text: string, priority: TodoPriority, cardId?: number | null) => void;
  onToggle: (id: number, done: boolean) => void;
  onRemove: (id: number) => void;
}

// 중요도 태그 정의 (색·아이콘). 태그 클릭으로 필터.
const PRIORITIES: { key: TodoPriority; icon: string; cls: string }[] = [
  { key: "중요", icon: "🔴", cls: "p-high" },
  { key: "보통", icon: "🟡", cls: "p-mid" },
  { key: "낮음", icon: "⚪", cls: "p-low" },
];

// 홈 화면 투두리스트 — 직접 입력 + 공문 카드를 끌어다 놓으면 할 일로 추가.
// 중요도 태그(중요/보통/낮음)·태그별 필터·완료 체크.
export default function TodoPanel({ todos, onAdd, onToggle, onRemove }: Props) {
  const [text, setText] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("보통");
  const [filter, setFilter] = useState<TodoPriority | null>(null);
  const [dropReady, setDropReady] = useState(false);

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
              <span className="txt">
                {t.card_id != null && <span title="공문에서 추가됨">📄 </span>}
                {t.text}
              </span>
              <span className={cn("chip mini", p?.cls)}>{p?.icon} {p?.key}</span>
              <button className="del" title="삭제" onClick={() => onRemove(t.id)}>
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
