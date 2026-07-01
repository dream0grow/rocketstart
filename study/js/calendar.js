// calendar.js — 달력 화면
//  - 월별 그리드에 '하루 총 공부시간'을 표시
//  - 날짜를 누르면 그날의 '성찰 메모'를 쓰고 저장

window.App = window.App || {};

App.calendar = (function () {
  const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
  let viewYear, viewMonth; // 지금 보고 있는 연/월(0~11)
  let selected = null;     // 선택한 날짜 "YYYY-MM-DD"

  function ensureInit() {
    if (viewYear === undefined) {
      const now = new Date();
      viewYear = now.getFullYear();
      viewMonth = now.getMonth();
    }
  }

  function render() {
    ensureInit();
    const title = App.util.$("#cal-title");
    title.textContent = viewYear + "년 " + (viewMonth + 1) + "월";

    const totals = App.store.dailyTotals(viewYear, viewMonth);
    const first = new Date(viewYear, viewMonth, 1);
    const startDow = first.getDay();               // 1일의 요일
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const todayKey = App.store.dateKey(new Date());

    const grid = App.util.$("#cal-grid");
    grid.innerHTML = "";

    // 요일 머리글
    WEEK.forEach((w) => {
      const h = document.createElement("div");
      h.className = "cal-head";
      h.textContent = w;
      grid.appendChild(h);
    });

    // 1일 앞의 빈 칸
    for (let i = 0; i < startDow; i++) {
      const blank = document.createElement("div");
      blank.className = "cal-cell blank";
      grid.appendChild(blank);
    }

    // 날짜 칸
    for (let d = 1; d <= daysInMonth; d++) {
      const key =
        viewYear +
        "-" +
        String(viewMonth + 1).padStart(2, "0") +
        "-" +
        String(d).padStart(2, "0");
      const cell = document.createElement("button");
      cell.className = "cal-cell";
      if (key === todayKey) cell.classList.add("today");
      if (key === selected) cell.classList.add("selected");

      const sec = totals[key] || 0;
      const badge = sec > 0 ? `<span class="cal-min">${App.util.hm(sec)}</span>` : "";
      const memoMark = App.store.getReflection(key) ? '<span class="memo-mark">✎</span>' : "";
      cell.innerHTML = `<span class="cal-day">${d}</span>${badge}${memoMark}`;
      if (sec > 0) cell.classList.add("studied");
      cell.addEventListener("click", () => selectDay(key));
      grid.appendChild(cell);
    }

    renderMemo();
  }

  // 현재 보는 달을 그대로 다시 그림(데이터 변경 시)
  function refresh() {
    if (viewYear !== undefined) render();
  }

  function selectDay(key) {
    selected = key;
    render();
  }

  function renderMemo() {
    const box = App.util.$("#cal-memo");
    if (!selected) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    App.util.$("#cal-memo-date").textContent = selected;
    App.util.$("#cal-memo-total").textContent =
      "공부 " + App.util.hm(App.store.daySeconds(selected));
    App.util.$("#cal-memo-text").value = App.store.getReflection(selected);
  }

  function init() {
    App.util.$("#cal-prev").addEventListener("click", () => {
      viewMonth--;
      if (viewMonth < 0) {
        viewMonth = 11;
        viewYear--;
      }
      render();
    });
    App.util.$("#cal-next").addEventListener("click", () => {
      viewMonth++;
      if (viewMonth > 11) {
        viewMonth = 0;
        viewYear++;
      }
      render();
    });
    App.util.$("#cal-memo-save").addEventListener("click", () => {
      if (!selected) return;
      App.store.setReflection(selected, App.util.$("#cal-memo-text").value);
      const btn = App.util.$("#cal-memo-save");
      btn.textContent = "저장됨 ✓";
      setTimeout(() => (btn.textContent = "메모 저장"), 1200);
      render();
    });
  }

  return { init, render, refresh };
})();
