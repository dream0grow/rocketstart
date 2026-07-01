// progress.js — 진행 화면
// 100시간 목표 대비: 누적 공부시간 / 남은 시간 / 진행률 / 오늘 공부시간
// + 월간·전체 통계 / 연속 공부일(streak)

window.App = window.App || {};

App.progress = (function () {
  function render() {
    const s = App.store.getSettings();
    const goalSec = s.goalHours * 3600;
    const total = App.store.totalSeconds();
    const remain = Math.max(0, goalSec - total);
    const pct = Math.min(100, (total / goalSec) * 100);
    const todaySec = App.store.daySeconds(App.store.dateKey(new Date()));

    App.util.$("#pg-goal").textContent = s.goalHours + "시간";
    App.util.$("#pg-total").textContent = App.util.hm(total);
    App.util.$("#pg-remain").textContent = App.util.hm(remain);
    App.util.$("#pg-today").textContent = App.util.hm(todaySec);
    App.util.$("#pg-percent").textContent = pct.toFixed(1) + "%";
    App.util.$("#pg-bar-fill").style.width = pct + "%";

    renderEta(remain);
    renderStats();
    renderWeek();
  }

  // 목표 종료 예상일 계산 및 표시
  // 로직: 하루 평균 공부 초를 구하고, 남은 초 ÷ 평균 = 남은 일수 → 오늘 + 남은 일수 = 예상 완료일
  function renderEta(remainSec) {
    const el = App.util.$("#pg-eta");
    if (!el) return;

    // 이미 목표를 달성했으면 축하 메시지
    if (remainSec <= 0) {
      el.textContent = "목표 달성! 수고하셨습니다.";
      return;
    }

    // 최근 14일 중 3일 이상 공부한 날이 있어야 예측 가능
    const avg = App.store.avgDailySeconds();
    if (avg === null) {
      el.textContent = "데이터가 더 쌓이면 알려드려요";
      return;
    }

    // 남은 일수 계산: 올림을 써서 올라올림 (1일 미만이면 '1일')
    const daysLeft = Math.ceil(remainSec / avg);

    // 예상 완료일 = 오늘 + daysLeft일
    const eta = new Date();
    eta.setDate(eta.getDate() + daysLeft);

    const month = eta.getMonth() + 1; // getMonth()는 0부터 시작하므로 +1
    const day   = eta.getDate();
    el.textContent = "이 속도면 " + month + "월 " + day + "일 완료";
  }

  // 월간·전체 통계 및 연속 공부일(streak) 표시
  function renderStats() {
    const now = new Date();

    // 이번 달 공부시간
    const thisMonthSec = App.store.monthSeconds(now.getFullYear(), now.getMonth());
    const monthEl = App.util.$("#pg-month");
    if (monthEl) monthEl.textContent = App.util.hm(thisMonthSec);

    // 전체 공부한 날 수
    const studyDaysEl = App.util.$("#pg-study-days");
    if (studyDaysEl) studyDaysEl.textContent = App.store.totalStudyDays() + "일";

    // 연속 공부일(streak)
    const streak = App.store.currentStreak();
    const streakEl = App.util.$("#pg-streak");
    if (streakEl) {
      // streak이 0이면 '공부를 시작하면 불꽃이 켜져요', 1 이상이면 일수 표시
      streakEl.textContent = streak > 0 ? streak + "일 연속" : "-";
    }

    // streak 불꽃 아이콘: 3일 이상이면 강조색으로 변경
    const streakCard = App.util.$("#pg-streak-card");
    if (streakCard) {
      streakCard.classList.toggle("streak-hot", streak >= 3);
    }
  }

  // 최근 7일 막대그래프 (하루 공부시간)
  const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
  function renderWeek() {
    const box = App.util.$("#pg-week");
    if (!box) return;

    // 오늘 포함 최근 7일 데이터 모으기
    const today = new Date();
    const todayKey = App.store.dateKey(today);
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = App.store.dateKey(d);
      days.push({ key, dow: WEEK[d.getDay()], day: d.getDate(), sec: App.store.daySeconds(key) });
    }
    const maxSec = Math.max(1, ...days.map((d) => d.sec)); // 0으로 나누기 방지

    box.innerHTML = days
      .map((d) => {
        const h = Math.round((d.sec / maxSec) * 100); // 막대 높이 %
        // 좁은 막대라 '분' 단위로 짧게 표시 (예: 75분)
        const val = d.sec > 0 ? Math.round(d.sec / 60) + "분" : "";
        const isToday = d.key === todayKey ? " today" : "";
        return (
          `<div class="wk-col${isToday}">` +
          `<div class="wk-val">${val}</div>` +
          `<div class="wk-track"><div class="wk-bar" style="height:${d.sec > 0 ? Math.max(6, h) : 0}%"></div></div>` +
          `<div class="wk-label">${d.dow}<br>${d.day}</div>` +
          `</div>`
        );
      })
      .join("");
  }

  return { render };
})();
