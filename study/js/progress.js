// progress.js — 진행 화면
// 100시간 목표 대비: 누적 공부시간 / 남은 시간 / 진행률 / 오늘 공부시간

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
  }
  return { render };
})();
