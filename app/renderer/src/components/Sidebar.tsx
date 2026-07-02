import { cn } from "../lib/utils";

// 좌측 고정 메뉴. prototype/dashboard.html 의 .side 를 그대로 옮긴 것.
// 지금 동작: 홈 · 들어온 공문 · 의견 보내기. 나머지는 이후 단계에서 연결.
const TOP = [
  { key: "home", label: "🏠 홈" },
  { key: "inbox", label: "📥 들어온 공문" },
  { key: "notebook", label: "📒 교무수첩" },
  { key: "write", label: "✍ 공문 작성" },
  { key: "minutes", label: "📝 회의록" },
  { key: "distribute", label: "📤 배포·수합" },
];
const BOTTOM = [
  { key: "past", label: "📚 과거 공문" },
  { key: "feedback", label: "💬 의견 보내기" },
  { key: "settings", label: "⚙ 설정" },
];

const ENABLED = new Set(["home", "inbox", "feedback"]);

interface Props {
  active?: string;
  onSelect?: (key: string) => void;
}

export default function Sidebar({ active = "home", onSelect }: Props) {
  function render(m: { key: string; label: string }) {
    const enabled = ENABLED.has(m.key);
    return (
      <a
        key={m.key}
        className={cn("side-item", m.key === active && "active", !enabled && "disabled")}
        onClick={() => enabled && onSelect?.(m.key)}
        title={enabled ? undefined : "다음 단계에서 만들 화면입니다"}
      >
        {m.label}
      </a>
    );
  }
  return (
    <div
      className="flex-shrink-0"
      style={{ width: 170, background: "#2c3e50", color: "#ecf0f1", padding: "16px 0" }}
    >
      {TOP.map(render)}
      <div className="side-sep" />
      {BOTTOM.map(render)}
    </div>
  );
}
