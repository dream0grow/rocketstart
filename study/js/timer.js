// timer.js — 뽀모도로 타이머 엔진 (집중 ↔ 휴식)
//
// ★ 핵심 아이디어: 남은 시간을 'setInterval 횟수'로 세지 않습니다.
//   대신 '끝나는 시각(endTarget)'을 기록해 두고, 매번 (endTarget - 지금시각)으로 계산합니다.
//   → 아이폰에서 화면이 잠기거나 다른 앱을 보다 돌아와도 시간이 정확합니다.
//
// 상태:
//   mode    : 'idle'(대기) | 'focus'(공부) | 'break'(휴식)
//   running : 지금 카운트다운 중인가
//   실제 공부한 시간(accumulatedSec)만 기록에 저장합니다. (휴식은 저장 안 함)

window.App = window.App || {};

App.timer = (function () {
  let mode = "idle";
  let running = false;
  let endTarget = 0;        // 이번 구간이 끝나는 시각(ms)
  let remainingMs = 0;      // 일시정지 중 남은 시간 보관
  let durationMs = 0;       // 이번 구간 전체 길이(원형 진행률용)
  let segStart = 0;         // 지금 '켜져서' 공부를 시작한 시각(실측용)
  let accumulatedSec = 0;   // 이번 공부 세션에서 실제 공부한 초
  let completedPomodoros = 0; // 휴식 주기 판단용 (앱을 새로 열면 0으로)
  let ticker = null;
  let renderCb = null;      // 화면 갱신 콜백

  function on(cb) {
    renderCb = cb;
  }
  function render() {
    if (renderCb) renderCb(getState());
  }

  function getState() {
    const s = App.store.getSettings();
    return {
      mode,
      running,
      remainingMs: running ? Math.max(0, endTarget - Date.now()) : remainingMs,
      durationMs,
      completedPomodoros,
      breakAfterN: s.breakAfterN,
    };
  }

  // 250ms마다 화면만 갱신 (시간 계산은 endTarget 기준이라 오차 없음)
  function startTicking() {
    stopTicking();
    ticker = setInterval(() => {
      if (Date.now() >= endTarget) {
        complete();
      } else {
        render();
      }
    }, 250);
  }
  function stopTicking() {
    if (ticker) {
      clearInterval(ticker);
      ticker = null;
    }
  }

  // 공부 세션 시작 (대기 상태에서 '시작' 버튼)
  function startFocus() {
    const s = App.store.getSettings();
    mode = "focus";
    durationMs = s.focusMinutes * 60 * 1000;
    remainingMs = durationMs;
    accumulatedSec = 0;
    resume();
  }

  // 휴식 시작
  function startBreak() {
    const s = App.store.getSettings();
    mode = "break";
    durationMs = s.breakMinutes * 60 * 1000;
    remainingMs = durationMs;
    resume();
  }

  // 일시정지 → 다시 시작
  function resume() {
    if (mode === "idle") return startFocus();
    running = true;
    segStart = Date.now();
    endTarget = Date.now() + remainingMs;
    // 시작 제스처 안에서 오디오/화면잠금 준비
    App.beep.unlock();
    const s = App.store.getSettings();
    if (s.keepAwake) App.wakelock.request();
    startTicking();
    render();
  }

  // 일시정지
  function pause() {
    if (!running) return;
    running = false;
    remainingMs = Math.max(0, endTarget - Date.now());
    // 공부 중이었다면 실제 공부한 만큼 적립
    if (mode === "focus") {
      accumulatedSec += (Date.now() - segStart) / 1000;
    }
    stopTicking();
    App.wakelock.release();
    render();
  }

  // 정지(세션 종료) — 공부 중이었다면 그때까지 공부한 시간은 기록에 저장
  function stop() {
    if (running && mode === "focus") {
      accumulatedSec += (Date.now() - segStart) / 1000;
    }
    if (mode === "focus" && accumulatedSec >= 1) {
      App.store.addSession(accumulatedSec);
      if (App.onDataChanged) App.onDataChanged();
    }
    goIdle();
  }

  // 구간이 끝났을 때(시간 도달)
  function complete() {
    stopTicking();
    App.wakelock.release();

    if (mode === "focus") {
      // 남은 마지막 구간까지 실제 공부시간에 더해 기록 저장
      accumulatedSec += Math.max(0, (endTarget - segStart) / 1000);
      App.store.addSession(accumulatedSec);
      completedPomodoros += 1;
      App.beep.play();
      if (App.onDataChanged) App.onDataChanged();

      const s = App.store.getSettings();
      // 정해진 횟수만큼 공부했으면 → 휴식으로
      if (completedPomodoros % s.breakAfterN === 0) {
        startBreak();
        return;
      }
    } else if (mode === "break") {
      App.beep.play();
    }
    goIdle();
  }

  // 대기 상태로 되돌리기
  function goIdle() {
    mode = "idle";
    running = false;
    const s = App.store.getSettings();
    durationMs = s.focusMinutes * 60 * 1000;
    remainingMs = durationMs;
    accumulatedSec = 0;
    render();
  }

  return {
    on,
    getState,
    startFocus,
    startBreak,
    resume,
    pause,
    stop,
    goIdle,
  };
})();
