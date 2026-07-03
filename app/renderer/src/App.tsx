import { useState } from "react";
import TopBar from "./components/TopBar";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Inbox from "./pages/Inbox";
import FeedbackModal from "./components/FeedbackModal";

// 지금 동작하는 페이지: 홈(home) · 들어온 공문(inbox). 나머지는 이후 단계.
type Page = "home" | "inbox";

// 전체 셸: 상단 바 + (좌측 메뉴 | 우측 작업영역).
// prototype/dashboard.html 의 .top / .layout(.side + .main) 구조 그대로.
export default function App() {
  const today = todayIso();
  const [page, setPage] = useState<Page>("home");
  const [showFeedback, setShowFeedback] = useState(false);
  return (
    <div style={{ minHeight: "100vh" }}>
      <TopBar today={today} />
      <div style={{ display: "flex", minHeight: "calc(100vh - 48px)" }}>
        <Sidebar
          active={page}
          onSelect={(key) => {
            if (key === "home" || key === "inbox") setPage(key);
            if (key === "feedback") setShowFeedback(true);
          }}
        />
        {/* key 로 페이지 전환 시 다시 로드 → 들어온 공문에서 넣은 카드가 홈에 반영 */}
        {page === "home" ? <Dashboard key="home" /> : <Inbox key="inbox" />}
      </div>
      <FeedbackModal open={showFeedback} onClose={() => setShowFeedback(false)} />
    </div>
  );
}

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
