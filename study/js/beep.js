// beep.js — 완료음 (Web Audio)
// 공부/휴식이 끝나면 짧은 '삐' 소리를 냅니다.
//
// iOS 특성: 소리는 사용자가 버튼을 누른 뒤에야 재생할 수 있습니다.
//   그래서 '시작' 버튼을 누를 때 unlock()을 한 번 호출해 오디오를 깨워둡니다.
//   (아이폰 무음 스위치가 켜져 있으면 소리가 안 날 수 있습니다.)

window.App = window.App || {};

App.beep = (function () {
  let ctx = null;

  // 시작 버튼 제스처에서 호출 — 오디오 잠금 해제
  function unlock() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
      }
      if (ctx.state === "suspended") ctx.resume();
    } catch (e) {
      /* 오디오 미지원 — 무시 */
    }
  }

  // 짧은 알림음 재생
  function play() {
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      // '삐-삐' 두 번
      [0, 0.18].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880; // 라(A5)
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.3, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.15);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.16);
      });
    } catch (e) {
      /* 무시 */
    }
  }

  return { unlock, play };
})();
