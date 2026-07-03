import type { CSSProperties } from "react";
import type { Card, Category, Summary } from "../types";

// ── 오늘 기준 D-day 재계산 ─────────────────────────────────
// DB 에 저장된 d_day 는 저장한 날 기준이라 다음 날이 되면 틀어집니다.
// 그래서 화면은 항상 deadline_iso 로 오늘 기준을 다시 계산합니다.

export function todayDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function computeDday(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d);
  const diff = Math.round((target.getTime() - todayDate().getTime()) / 86400000);
  return diff;
}

export function ddayText(d: number | null): string {
  if (d === null) return "";
  if (d > 0) return `D-${d}`;
  if (d === 0) return "D-DAY";
  return `D+${-d}`;
}

// 기한 지난 배지 색: 지난 날수가 클수록 더 진하고 어두운 빨강.
// (1일 지남 = 밝은 빨강 → 30일 이상 = 아주 진한 빨강)
export function overdueStyle(daysOver: number): CSSProperties {
  const n = Math.min(Math.max(daysOver, 1), 30);
  const sat = Math.min(100, 60 + n * 1.4); // 60% → 100%
  const light = Math.max(28, 52 - n * 0.8); // 52% → 28%
  return { background: `hsl(0, ${sat}%, ${light}%)` };
}

// ── 공문 5성격 표시 메타 (색·아이콘) ───────────────────────
export const CATEGORY_META: Record<
  Category,
  { icon: string; color: string; bg: string }
> = {
  할일형: { icon: "📌", color: "#c0392b", bg: "#fdecea" },
  공람형: { icon: "📢", color: "#2471a3", bg: "#eaf2f8" },
  배포형: { icon: "📦", color: "#1e8449", bg: "#e9f7ef" },
  참고형: { icon: "📁", color: "#7f8c8d", bg: "#f2f3f4" },
  규정형: { icon: "📖", color: "#6c3483", bg: "#f4ecf7" },
};

export const CATEGORIES: Category[] = [
  "할일형", "공람형", "배포형", "참고형", "규정형",
];

// ── 날짜별 칸(컬럼) 분류 ───────────────────────────────────
export type Bucket = "지난 마감" | "오늘" | "이번 주" | "다음 주 이후" | "기한 없음";

export const BUCKETS: { key: Bucket; icon: string; desc: string; cls: string }[] = [
  { key: "지난 마감", icon: "⚠", desc: "놓친 기한 — 먼저 확인!", cls: "left-red" },
  { key: "오늘", icon: "🔥", desc: "오늘 마감", cls: "left-orange" },
  { key: "이번 주", icon: "📅", desc: "7일 이내", cls: "left-yellow" },
  { key: "다음 주 이후", icon: "🗓", desc: "여유 있음", cls: "left-green" },
  { key: "기한 없음", icon: "📂", desc: "공람·배포·참고·규정", cls: "left-gray" },
];

export function bucketOf(card: Card): Bucket {
  const d = computeDday(card.deadline_iso);
  if (d === null) return "기한 없음";
  if (d < 0) return "지난 마감";
  if (d === 0) return "오늘";
  if (d <= 7) return "이번 주";
  return "다음 주 이후";
}

// 칸 안 정렬: 마감 가까운 순 (기한 없음 칸은 성격 순).
export function sortInBucket(a: Card, b: Card): number {
  const da = computeDday(a.deadline_iso);
  const db = computeDday(b.deadline_iso);
  if (da === null && db === null)
    return CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category);
  if (da === null) return 1;
  if (db === null) return -1;
  return da - db;
}

// ── 상단 요약 띠 ───────────────────────────────────────────
export function summarize(cards: Card[]): Summary {
  const active = cards.filter((c) => !c.done);
  const tasks = active.filter((c) => c.category === "할일형");
  const circulate = active.filter((c) => c.category === "공람형");
  const withD = active
    .map((c) => computeDday(c.deadline_iso))
    .filter((d): d is number => d !== null);
  return {
    total: cards.length,
    task_n: tasks.length,
    circulate_n: circulate.length,
    week_n: withD.filter((d) => d >= 0 && d <= 7).length,
    overdue_n: withD.filter((d) => d < 0).length,
  };
}

// ── 미니 캘린더 도우미 ─────────────────────────────────────
export function isoOf(y: number, m0: number, d: number): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${y}-${p(m0 + 1)}-${p(d)}`;
}

// 해당 월의 달력 칸(주 × 7일) 행렬. 빈 칸은 null.
export function monthMatrix(year: number, month0: number): (number | null)[][] {
  const first = new Date(year, month0, 1).getDay(); // 0=일
  const days = new Date(year, month0 + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: first }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
