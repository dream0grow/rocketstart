// app.js — 앱 전체를 연결하는 진입점
//  - 탭(타이머/진행/달력/설정) 전환
//  - 공용 함수(시간 포맷 등)
//  - 타이머 화면 그리기와 버튼 동작
//  - 서비스워커 등록(오프라인)

window.App = window.App || {};

// ===== 공용 도우미 =====
App.util = {
  // 남은 밀리초 → "MM:SS"
  clock(ms) {
    const total = Math.ceil(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  },
  // 초 → "N시간 M분" (0시간이면 "M분")
  hm(sec) {
    const m = Math.round(sec / 60);
    const h = Math.floor(m / 60);
    const mm = m % 60;
    if (h > 0) return h + "시간 " + mm + "분";
    return mm + "분";
  },
  // 요소 선택 단축
  $(sel) {
    return document.querySelector(sel);
  },
};

// ===== 탭 전환 =====
App.nav = (function () {
  function show(name) {
    document.querySelectorAll(".view").forEach((v) => {
      v.classList.toggle("active", v.id === "view-" + name);
    });
    document.querySelectorAll(".tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.view === name);
    });
    // 탭을 열 때 최신 내용으로 다시 그림
    if (name === "progress") App.progress.render();
    if (name === "calendar") App.calendar.render();
    if (name === "settings") App.settings.render();
  }
  return { show };
})();

// 데이터가 바뀌면(세션 저장 등) 진행/달력 화면을 갱신
App.onDataChanged = function () {
  App.progress.render();
  App.calendar.refresh();
};

// ===== 타이머 화면 =====
App.timerView = (function () {
  const RADIUS = 130;
  const CIRC = 2 * Math.PI * RADIUS;

  function labelText(state) {
    if (state.mode === "focus") return "집중 중";
    if (state.mode === "break") return state.breakIsLong ? "긴 휴식" : "휴식";
    return "준비";
  }

  // 뽀모도로 진행 점 (이번 주기에서 몇 개 채웠는지)
  function cycleDots(state) {
    const done = state.completedPomodoros % state.breakAfterN;
    let html = "";
    for (let i = 0; i < state.breakAfterN; i++) {
      html += `<span class="dot ${i < done ? "on" : ""}"></span>`;
    }
    return html;
  }

  function render(state) {
    state = state || App.timer.getState();
    App.util.$("#timer-time").textContent = App.util.clock(state.remainingMs);
    App.util.$("#timer-label").textContent = labelText(state);
    App.util.$("#timer-cycle").innerHTML = cycleDots(state);

    // 원형 진행률(경과한 만큼 채움)
    const frac =
      state.durationMs > 0
        ? 1 - state.remainingMs / state.durationMs
        : 0;
    const ring = App.util.$("#ring-fill");
    ring.style.strokeDasharray = CIRC;
    ring.style.strokeDashoffset = CIRC * (1 - frac);
    ring.classList.toggle("break", state.mode === "break");

    // 버튼 표시 전환
    const idle = state.mode === "idle";
    const running = state.running;
    App.util.$("#btn-start").hidden = !(idle || !running);
    App.util.$("#btn-start").textContent = idle ? "시작" : "계속";
    App.util.$("#btn-pause").hidden = !running;
    App.util.$("#btn-stop").hidden = idle;

    // 공부 길이 선택은 대기 중일 때만 보이기
    App.util.$("#focus-picker").hidden = !idle;
    updatePickerSelected();
  }

  // 초 → "25분" / "1분 30초" / "50초" 로 읽기 좋게
  function fmtDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m > 0 && s > 0) return m + "분 " + s + "초";
    if (m > 0) return m + "분";
    return s + "초";
  }

  // 공부 시간 선택 만들기: 빠른 선택(5분 단위) + 미세 조절(±30초/±1분)
  function buildPicker() {
    const box = App.util.$("#focus-picker");
    box.innerHTML =
      "<span class='picker-label' id='picker-label'>공부 시간</span>";

    // 빠른 선택 버튼 (누르면 그 시간으로 딱 맞춤)
    [5, 10, 15, 20, 25, 30].forEach((min) => {
      const b = document.createElement("button");
      b.className = "chip";
      b.dataset.min = min;
      b.textContent = min + "분";
      b.addEventListener("click", () => {
        App.store.updateSettings({ focusSeconds: min * 60, focusMinutes: min });
        App.timer.goIdle(); // 대기 시간 새 길이로 갱신
      });
      box.appendChild(b);
    });

    // 미세 조절 버튼 (지금 시간에서 더하거나 빼기 — 예: 25분 → +30초 → 25분 30초)
    const fine = document.createElement("div");
    fine.className = "picker-fine";
    [
      { label: "−1분", delta: -60 },
      { label: "−30초", delta: -30 },
      { label: "+30초", delta: 30 },
      { label: "+1분", delta: 60 },
    ].forEach((item) => {
      const b = document.createElement("button");
      b.className = "chip fine";
      b.textContent = item.label;
      b.addEventListener("click", () => {
        const cur = App.store.getFocusSeconds();
        // 최소 30초, 최대 120분 사이로만 조절되게 막아둡니다.
        const next = Math.min(7200, Math.max(30, cur + item.delta));
        App.store.updateSettings({
          focusSeconds: next,
          focusMinutes: Math.round(next / 60), // 예전 필드도 비슷하게 맞춰둠
        });
        App.timer.goIdle();
      });
      fine.appendChild(b);
    });
    box.appendChild(fine);
  }

  function updatePickerSelected() {
    const cur = App.store.getFocusSeconds();
    // 빠른 선택 버튼 강조: 현재 길이와 정확히 같은 것만 켜짐
    document
      .querySelectorAll("#focus-picker .chip[data-min]")
      .forEach((c) =>
        c.classList.toggle("on", Number(c.dataset.min) * 60 === cur)
      );
    // 라벨에 현재 길이 표시 (예: "공부 시간 · 1분 30초")
    const label = App.util.$("#picker-label");
    if (label) label.textContent = "공부 시간 · " + fmtDuration(cur);
  }

  function init() {
    buildPicker();
    App.timer.on(render);
    App.util.$("#btn-start").addEventListener("click", () => App.timer.resume());
    App.util.$("#btn-pause").addEventListener("click", () => App.timer.pause());
    App.util.$("#btn-stop").addEventListener("click", () => App.timer.stop());
    App.timer.goIdle();
  }

  return { init, render };
})();

// ===== 시작 =====
window.addEventListener("DOMContentLoaded", () => {
  // 탭 버튼 연결
  document.querySelectorAll(".tab").forEach((t) => {
    t.addEventListener("click", () => App.nav.show(t.dataset.view));
  });

  App.timerView.init();
  App.settings.init();
  App.calendar.init();
  App.progress.render();
  App.settings.render();
  App.calendar.render();
  App.nav.show("timer");

  // 서비스워커 등록(오프라인 실행) — file://에서는 조용히 건너뜀
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch((e) =>
      console.warn("오프라인 준비 실패(무시 가능):", e)
    );
  }
});
