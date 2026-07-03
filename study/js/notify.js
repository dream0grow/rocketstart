// notify.js — 타이머 종료 '예약 알림' (아이폰 앱 전용)
//
// ★ 이 파일이 하는 일을 한 문장으로:
//   "타이머를 시작할 때, 아이폰(iOS)에게 '○시 ○분에 알림을 울려줘'라고 미리 부탁해 둡니다."
//
// 왜 필요한가요?
//   웹(사파리)은 화면이 잠기면 소리를 낼 수 없습니다. 하지만 iOS의 '로컬 알림'은
//   운영체제가 대신 울려주는 것이라, 화면이 잠겨 있어도 정확한 시각에 소리·배너가 나옵니다.
//   (카카오톡 알림이 화면 잠금 중에도 오는 것과 같은 원리입니다.)
//
// 어디서 동작하나요?
//   - Capacitor로 포장한 아이폰 앱 안에서만 진짜로 동작합니다. (ios-app/ 폴더 참고)
//   - 일반 웹 브라우저에서는 window.Capacitor가 없으므로 조용히 아무 일도 하지 않습니다.
//     → 웹 버전은 예전과 완전히 똑같이 동작합니다. (이런 걸 '안전한 빈 껍데기'라고 불러요.)

window.App = window.App || {};

App.notify = (function () {
  // 알림에 붙이는 번호표. 같은 번호로 예약하면 나중에 그 번호로 취소할 수 있습니다.
  // 타이머 종료 알림은 한 번에 하나뿐이라 번호 하나(1)면 충분합니다.
  const NOTI_ID = 1;

  // 지금 아이폰 앱 안에서 실행 중인지 확인하고, 맞으면 알림 도구를 돌려줍니다.
  // 웹 브라우저라면 null을 돌려줘서 아래 함수들이 전부 조용히 끝나게 합니다.
  function plugin() {
    const C = window.Capacitor;
    if (!C || !C.isNativePlatform || !C.isNativePlatform()) return null;
    return (C.Plugins && C.Plugins.LocalNotifications) || null;
  }

  // 지금 네이티브 앱 안인가? (다른 부품이 물어볼 때 사용)
  function isNative() {
    return !!plugin();
  }

  // 알림 권한 요청 — 시작 버튼을 처음 누를 때 한 번 물어봅니다.
  // iOS는 "이 앱이 알림을 보내도 될까요?"라고 사용자에게 허락을 받아야 하기 때문입니다.
  // (이미 허락/거절했다면 팝업 없이 그냥 지나갑니다.)
  async function init() {
    const p = plugin();
    if (!p) return;
    try {
      await p.requestPermissions();
    } catch (e) {
      /* 권한 요청 실패 — 앱은 계속 동작해야 하므로 무시 */
    }
  }

  // 종료 알림 예약하기
  //   endTime : 이번 구간이 끝나는 시각 (Date.now() 기준 밀리초)
  //   mode    : "focus"(공부) 또는 "break"(휴식) — 문구를 다르게 보여주려고 받습니다.
  async function schedule(endTime, mode) {
    const p = plugin();
    if (!p) return;
    try {
      // 혹시 남아 있을지 모를 예전 예약을 먼저 지우고 새로 예약합니다.
      await cancel();
      const isFocus = mode === "focus";
      await p.schedule({
        notifications: [
          {
            id: NOTI_ID,
            title: isFocus ? "집중 끝! 🎉" : "휴식 끝!",
            body: isFocus
              ? "수고했어요. 잠깐 쉬면서 물 한 잔 어때요?"
              : "충전 완료! 다시 집중해 볼까요?",
            // 언제 울릴지: 끝나는 시각을 그대로 전달 (화면이 잠겨 있어도 iOS가 울려줍니다)
            schedule: { at: new Date(endTime) },
            // sound를 따로 정하지 않으면 iOS 기본 알림음이 울립니다.
          },
        ],
      });
    } catch (e) {
      /* 예약 실패 — 앱 안에서는 완료음(beep.js)이 따로 울리므로 무시 */
    }
  }

  // 예약 취소하기 — 일시정지·정지를 누르면 알림도 함께 취소해야
  // "멈췄는데 알림이 울리는" 이상한 일이 생기지 않습니다.
  async function cancel() {
    const p = plugin();
    if (!p) return;
    try {
      await p.cancel({ notifications: [{ id: NOTI_ID }] });
    } catch (e) {
      /* 무시 */
    }
  }

  return { isNative, init, schedule, cancel };
})();
