// wakelock.js — 화면 켜두기 (Screen Wake Lock API)
// 공부 중 화면이 자동으로 꺼지지 않게 합니다. (아이폰/아이패드 사파리 16.4 이상 지원)
//
// 중요한 iOS 특성:
//  - 화면 잠금 요청은 반드시 '사용자가 버튼을 누른 순간(제스처)' 안에서 해야 합니다.
//  - 홈으로 나갔다가 돌아오면 잠금이 저절로 풀립니다 → 돌아올 때 다시 요청해야 합니다.

window.App = window.App || {};

App.wakelock = (function () {
  let sentinel = null;   // 현재 잡고 있는 화면 잠금 객체
  let wanted = false;    // 지금 '켜두고 싶은' 상태인가?

  // 이 기기가 화면 켜두기를 지원하는지
  function isSupported() {
    return "wakeLock" in navigator;
  }

  // 화면 켜두기 요청 (반드시 버튼 클릭 등 제스처 안에서 호출)
  async function request() {
    wanted = true;
    if (!isSupported()) return;
    try {
      sentinel = await navigator.wakeLock.request("screen");
      // OS가 저절로 풀면 알림 → 상태 정리
      sentinel.addEventListener("release", () => {
        sentinel = null;
      });
    } catch (e) {
      // 배터리 부족 등으로 실패할 수 있음 — 공부 자체는 계속 진행됩니다.
      console.warn("화면 켜두기를 켜지 못했습니다.", e);
    }
  }

  // 화면 켜두기 해제
  async function release() {
    wanted = false;
    if (sentinel) {
      try {
        await sentinel.release();
      } catch (e) {
        /* 무시 */
      }
      sentinel = null;
    }
  }

  // 화면이 다시 보일 때 재요청 (iOS 필수)
  document.addEventListener("visibilitychange", () => {
    if (wanted && !sentinel && document.visibilityState === "visible") {
      request();
    }
  });

  return { isSupported, request, release };
})();
