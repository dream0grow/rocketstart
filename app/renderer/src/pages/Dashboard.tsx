import { useEffect, useMemo, useState } from "react";
import type { Card, Category, Todo, TodoPriority } from "../types";
import {
  BUCKETS, CATEGORIES, CATEGORY_META, bucketOf, computeDday, sortInBucket,
  summarize,
} from "../lib/cards";
import { cn } from "../lib/utils";
import OfficialCard from "../components/OfficialCard";
import DetailModal from "../components/DetailModal";
import MiniCalendar from "../components/MiniCalendar";
import TodoPanel from "../components/TodoPanel";

// 마감 임박/지남 필터 (상단 요약 띠 클릭으로 켜고 끔)
type UrgencyFilter = "week" | "overdue" | null;

// 홈 대시보드 — 날짜별 보기 (2026-07 사용자 피드백 반영).
//   · 상단 요약 띠: 항목을 누르면 아래 목록이 그 조건으로 필터링
//   · 캘린더: 클릭 = 그 날짜만, Shift+클릭 = 여러 날짜 선택
//   · 투두리스트: 직접 입력 + 카드 드래그 추가 + 클릭 상세/이름 편집
//   · 카드 1장 = 공문 세트 (본문 + 서식·붙임 첨부 묶음)
export default function Dashboard() {
  const [cards, setCards] = useState<Card[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [selected, setSelected] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);

  // 필터 상태 (요약 띠·칩·캘린더·검색이 모두 여기로 모입니다)
  const [catFilter, setCatFilter] = useState<Category | null>(null);
  const [urgFilter, setUrgFilter] = useState<UrgencyFilter>(null);
  const [days, setDays] = useState<string[]>([]); // 캘린더 선택 날짜들
  const [query, setQuery] = useState("");
  const [showDone, setShowDone] = useState(false);

  // 최초 로드: 저장된 카드가 없으면 시드 주입 후 카드·투두를 불러옵니다.
  useEffect(() => {
    (async () => {
      await window.gyomu.seedIfEmpty();
      const [list, tds] = await Promise.all([
        window.gyomu.listCards(),
        window.gyomu.listTodos(),
      ]);
      setCards(list);
      setTodos(tds);
      setLoading(false);
    })();
  }, []);

  const summary = useMemo(() => summarize(cards), [cards]);
  const hasFilter = !!(catFilter || urgFilter || days.length || query);

  // 화면에 보일 카드 (모든 필터 적용)
  const visible = useMemo(() => {
    const q = query.trim();
    return cards.filter((c) => {
      if (!showDone && c.done) return false;
      if (catFilter && c.category !== catFilter) return false;
      if (days.length && !days.includes(c.deadline_iso ?? "")) return false;
      if (urgFilter) {
        const d = computeDday(c.deadline_iso);
        if (urgFilter === "week" && !(d !== null && d >= 0 && d <= 7)) return false;
        if (urgFilter === "overdue" && !(d !== null && d < 0)) return false;
      }
      if (q && !(c.title || "").includes(q) && !(c.sender || "").includes(q))
        return false;
      return true;
    });
  }, [cards, catFilter, urgFilter, days, query, showDone]);

  function clearFilters() {
    setCatFilter(null);
    setUrgFilter(null);
    setDays([]);
    setQuery("");
  }

  // 캘린더 날짜 선택: 일반 클릭 = 단일 토글, Shift/Ctrl+클릭 = 다중 선택
  function toggleDay(iso: string, additive: boolean) {
    setDays((prev) => {
      if (additive) {
        return prev.includes(iso)
          ? prev.filter((d) => d !== iso)
          : [...prev, iso];
      }
      return prev.length === 1 && prev[0] === iso ? [] : [iso];
    });
  }

  // 카드 완료 체크 → 상태 갱신 + SQLite 저장
  async function toggleDone(card: Card, done: boolean) {
    setCards((prev) =>
      prev.map((c) => (c.id === card.id ? { ...c, done } : c))
    );
    if (card.id !== undefined) await window.gyomu.setCardDone(card.id, done);
  }

  // 상세 창에서 성격·처리주체를 직접 고친 경우 반영
  function cardUpdated(updated: Card) {
    setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setSelected(updated);
  }

  // 투두 CRUD (저장 후 다시 읽어 목록 동기화)
  async function addTodo(text: string, priority: TodoPriority, cardId?: number | null) {
    await window.gyomu.addTodo(text, priority, cardId ?? null);
    setTodos(await window.gyomu.listTodos());
  }
  async function toggleTodo(id: number, done: boolean) {
    await window.gyomu.toggleTodo(id, done);
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done } : t)));
  }
  async function updateTodo(id: number, text: string, priority: TodoPriority) {
    await window.gyomu.updateTodo(id, text, priority);
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, text, priority } : t))
    );
  }
  async function removeTodo(id: number) {
    await window.gyomu.removeTodo(id);
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }

  if (loading) {
    return <div style={{ padding: 20, color: "#7f8c8d" }}>불러오는 중…</div>;
  }

  return (
    <div style={{ flex: 1, padding: 20, minWidth: 0 }}>
      {/* 상단 요약 띠 — 항목 클릭 = 아래 목록 필터링 */}
      <div className="strip">
        <button className={cn("strip-item", !hasFilter && "on")} onClick={clearFilters}>
          전체 공문 <b>{summary.total}</b>건
        </button>
        <button
          className={cn("strip-item", catFilter === "할일형" && "on")}
          onClick={() => { setUrgFilter(null); setCatFilter(catFilter === "할일형" ? null : "할일형"); }}
        >
          📌 할 일 <b>{summary.task_n}</b>건
        </button>
        <button
          className={cn("strip-item", catFilter === "공람형" && "on")}
          onClick={() => { setUrgFilter(null); setCatFilter(catFilter === "공람형" ? null : "공람형"); }}
        >
          📢 공람 <b>{summary.circulate_n}</b>건
        </button>
        <button
          className={cn("strip-item", urgFilter === "week" && "on")}
          onClick={() => { setCatFilter(null); setUrgFilter(urgFilter === "week" ? null : "week"); }}
        >
          이번 주 마감 <b>{summary.week_n}</b>건
        </button>
        <button
          className={cn("strip-item over", urgFilter === "overdue" && "on")}
          onClick={() => { setCatFilter(null); setUrgFilter(urgFilter === "overdue" ? null : "overdue"); }}
        >
          지난 마감 <b>{summary.overdue_n}</b>건 ⚠
        </button>
      </div>

      {/* 캘린더 + 투두리스트 (크게) */}
      <div style={{ display: "flex", gap: 14, marginBottom: 14, alignItems: "stretch" }}>
        <MiniCalendar cards={cards} selectedDays={days} onToggleDay={toggleDay} />
        <TodoPanel
          todos={todos}
          onAdd={addTodo}
          onToggle={toggleTodo}
          onUpdate={updateTodo}
          onRemove={removeTodo}
          onOpenCard={(cardId) => {
            const c = cards.find((x) => x.id === cardId);
            if (c) setSelected(c);
          }}
        />
      </div>

      {/* 성격 필터 칩 + 검색 (한 줄 — 칩·검색·날짜가 함께 걸리는 상세 검색) */}
      <div className="filter-bar">
        <div className="chips">
          <button
            className={cn("chip", catFilter === null && "on")}
            onClick={() => setCatFilter(null)}
          >
            전체
          </button>
          {CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat];
            const n = cards.filter((c) => c.category === cat && !c.done).length;
            return (
              <button
                key={cat}
                className={cn("chip", catFilter === cat && "on")}
                style={catFilter === cat ? { background: meta.color, color: "#fff" } : undefined}
                onClick={() => setCatFilter(catFilter === cat ? null : cat)}
              >
                {meta.icon} {cat} {n}
              </button>
            );
          })}
        </div>
        <input
          className="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 제목·발신기관 검색"
        />
        <label style={{ fontSize: 12.5, color: "#7f8c8d", whiteSpace: "nowrap" }}>
          <input
            type="checkbox"
            checked={showDone}
            onChange={(e) => setShowDone(e.target.checked)}
          />{" "}
          완료된 것도 보기
        </label>
        {days.length > 0 && (
          <span className="chip mini on" title="캘린더에서 선택한 날짜">
            📅 {days.map((d) => d.slice(5).replace("-", "/")).join(", ")}
          </span>
        )}
        {hasFilter && (
          <button className="chip mini" onClick={clearFilters}>
            필터 모두 해제 ✕
          </button>
        )}
      </div>

      {/* 날짜별 칸반 (전체 폭) */}
      <div className="board">
        {BUCKETS.map((b) => {
          const items = visible.filter((c) => bucketOf(c) === b.key).sort(sortInBucket);
          return (
            <div key={b.key} className={cn("q", b.cls)}>
              <h3>
                {b.icon} {b.key}{" "}
                <span className="desc">{b.desc} · {items.length}건</span>
              </h3>
              {items.length > 0 ? (
                items.map((c) => (
                  <OfficialCard
                    key={c.id}
                    card={c}
                    onClick={() => setSelected(c)}
                    onToggleDone={(done) => toggleDone(c, done)}
                  />
                ))
              ) : (
                <div style={{ color: "#bbb", fontSize: 12 }}>(없음)</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="note">
        ※ 카드 1장 = 공문 세트(본문+첨부). 마감일·발신기관은 규칙 추출(정확),
        성격·처리주체는 자동 초안 — 틀리면 상세 창에서 직접 바꿀 수 있습니다.
        체크박스 = 처리 완료, 카드 클릭 = 상세, 카드를 투두리스트로 드래그 = 할 일 추가.
      </div>

      <DetailModal
        card={selected}
        onClose={() => setSelected(null)}
        onUpdated={cardUpdated}
      />
    </div>
  );
}
