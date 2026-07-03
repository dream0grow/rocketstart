// beep.js — 완료음 (Web Audio) + 진동
//
// 완료음 3종:
//   "beep"  — 삐삐 (기존 기본음, 880Hz 사인파 두 번)
//   "bell"  — 맑은 종 (고음 사인파 + 빠른 감쇠, 청량한 느낌)
//   "chime" — 부드러운 차임 (낮은 주파수 + 긴 여운)
//
// 진동:
//   navigator.vibrate() 를 지원하는 기기(안드로이드 크롬 등)에서만 동작합니다.
//   아이폰 사파리는 진동 API를 지원하지 않으므로 조용히 건너뜁니다.
//
// iOS 특성: 소리는 사용자가 버튼을 누른 뒤에야 재생할 수 있습니다.
//   그래서 '시작' 버튼을 누를 때 unlock()을 한 번 호출해 오디오를 깨워둡니다.
//   또한 화면이 잠기거나 다른 앱을 보다 돌아오면 오디오가 저절로 멈추므로,
//   앱으로 돌아올 때와 완료음을 재생하기 직전에 한 번 더 깨웁니다.
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
      // iOS는 "suspended" 외에 "interrupted"(전화·화면잠금 뒤) 상태도 있어서
      // "running이 아니면 전부 깨운다"로 판단합니다.
      if (ctx.state !== "running") ctx.resume();
      // 무음 버퍼를 한 번 실제로 재생 — iOS가 이 컨텍스트를
      // '사용자가 허락한 소리'로 확실히 기억하게 만드는 관용 처리입니다.
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch (e) {
      /* 오디오 미지원 — 무시 */
    }
  }

  // 앱으로 돌아왔을 때 오디오 다시 깨우기 (iOS 필수)
  // 화면 잠금·앱 전환 후에는 오디오가 저절로 멈추는데, 여기서 미리 깨워 두면
  // 돌아온 직후 타이머가 끝나도 완료음이 바로 납니다. (wakelock.js와 같은 방식)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && ctx && ctx.state !== "running") {
      ctx.resume().catch(() => {
        /* 실패해도 play()에서 한 번 더 시도합니다 */
      });
    }
  });

  // 설정에서 현재 선택된 완료음 종류와 진동 여부를 가져옵니다.
  function getOptions() {
    const s = App.store.getSettings();
    return {
      type: s.beepType || "beep",
      vibrate: !!s.vibrateEnabled,
    };
  }

  // --- 음색별 재생 함수 ---

  // 삐삐 (기본): 880Hz 사인파 두 번
  function playBeep(now) {
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
  }

  // 맑은 종: 1320Hz(E6) 사인파, 빠른 공격 + 긴 감쇠
  function playBell(now) {
    [0, 0.35].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 1320; // 미(E6) — 맑고 높은 종소리
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.35, now + offset + 0.01); // 빠른 공격
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.5); // 긴 여운
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.52);
    });
  }

  // 부드러운 차임: 528Hz(도#) 삼각파, 느린 공격 + 매우 긴 여운
  function playChime(now) {
    [0, 0.55, 1.1].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle"; // 삼각파 — 사인파보다 따뜻하고 부드러운 음색
      // 세 음을 화음으로: 528Hz, 660Hz, 792Hz (도, 미, 솔 느낌)
      const freqs = [528, 660, 792];
      osc.frequency.value = freqs[Math.round(offset / 0.55)] || 528;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.2, now + offset + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.8); // 긴 여운
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.85);
    });
  }

  // 진동: 지원 기기에서만 동작, 미지원이면 조용히 건너뜀
  function vibrate() {
    try {
      if (navigator.vibrate) {
        // 짧게-짧게-길게 패턴 (ms: 진동, 쉬기, 진동, 쉬기, 진동)
        navigator.vibrate([100, 80, 100, 80, 200]);
      }
    } catch (e) {
      /* 진동 미지원 — 무시 */
    }
  }

  // 설정된 음색으로 실제 소리를 스케줄합니다. (컨텍스트가 깨어 있다는 전제)
  function playTones(type) {
    try {
      const now = ctx.currentTime;
      if (type === "bell") {
        playBell(now);
      } else if (type === "chime") {
        playChime(now);
      } else {
        playBeep(now); // 기본: "beep"
      }
    } catch (e) {
      /* 무시 */
    }
  }

  // 완료음 재생 (설정에 따라 음색 선택 + 진동)
  function play() {
    const opts = getOptions();

    // 진동 먼저 (소리보다 즉각적인 피드백)
    if (opts.vibrate) vibrate();

    // 오디오 컨텍스트가 없으면 소리 없이 종료
    if (!ctx) return;

    // ★ 핵심: iOS에서 화면이 잠기거나 다른 앱을 보다 오면 오디오가 멈춰 있습니다.
    //   멈춘 컨텍스트에 소리를 걸면 조용히 사라지므로, 먼저 깨운 뒤 재생합니다.
    if (ctx.state !== "running") {
      ctx
        .resume()
        .then(() => playTones(opts.type))
        .catch(() => {
          /* 못 깨우면 이번 완료음은 포기 — 진동은 이미 울렸습니다 */
        });
    } else {
      playTones(opts.type);
    }
  }

  // 진동 지원 여부 (설정 화면에서 토글 표시 여부 결정용)
  function isVibrateSupported() {
    return !!navigator.vibrate;
  }

  return { unlock, play, isVibrateSupported };
})();
