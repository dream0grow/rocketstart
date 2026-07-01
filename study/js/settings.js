// settings.js — 설정 화면
//  - 휴식 주기(N)·휴식 길이·목표시간·완료음·화면켜두기
//  - 데이터 내보내기/가져오기(백업), 기록 초기화

window.App = window.App || {};

App.settings = (function () {
  function render() {
    const s = App.store.getSettings();
    App.util.$("#set-breakN").value = s.breakAfterN;
    App.util.$("#set-breakMin").value = s.breakMinutes;
    App.util.$("#set-longBreakMin").value = s.longBreakMinutes;
    App.util.$("#set-longBreakEvery").value = s.longBreakEvery;
    App.util.$("#set-goal").value = s.goalHours;
    App.util.$("#set-beep").checked = s.beepEnabled;
    App.util.$("#set-awake").checked = s.keepAwake;

    // 화면 켜두기 미지원 기기 안내
    const note = App.util.$("#set-awake-note");
    if (!App.wakelock.isSupported()) {
      note.textContent = "이 기기/브라우저는 화면 켜두기를 지원하지 않습니다.";
      App.util.$("#set-awake").disabled = true;
    } else {
      note.textContent = "";
    }
  }

  function init() {
    // 숫자/토글 변경 즉시 저장
    App.util.$("#set-breakN").addEventListener("change", (e) =>
      App.store.updateSettings({ breakAfterN: clampInt(e.target.value, 1, 12, 4) })
    );
    App.util.$("#set-breakMin").addEventListener("change", (e) =>
      App.store.updateSettings({ breakMinutes: clampInt(e.target.value, 1, 60, 10) })
    );
    App.util.$("#set-longBreakMin").addEventListener("change", (e) =>
      App.store.updateSettings({ longBreakMinutes: clampInt(e.target.value, 1, 120, 20) })
    );
    App.util.$("#set-longBreakEvery").addEventListener("change", (e) =>
      App.store.updateSettings({ longBreakEvery: clampInt(e.target.value, 1, 10, 2) })
    );
    App.util.$("#set-goal").addEventListener("change", (e) => {
      App.store.updateSettings({ goalHours: clampInt(e.target.value, 1, 10000, 100) });
      App.progress.render();
    });
    App.util.$("#set-beep").addEventListener("change", (e) =>
      App.store.updateSettings({ beepEnabled: e.target.checked })
    );
    App.util.$("#set-awake").addEventListener("change", (e) =>
      App.store.updateSettings({ keepAwake: e.target.checked })
    );

    // 내보내기: JSON 파일로 저장
    App.util.$("#set-export").addEventListener("click", () => {
      const blob = new Blob([App.store.exportJSON()], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "study-backup-" + App.store.dateKey(new Date()) + ".json";
      a.click();
      URL.revokeObjectURL(a.href);
    });

    // 가져오기: JSON 파일 읽어 복원
    App.util.$("#set-import").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          App.store.importJSON(reader.result);
          alert("가져오기 완료! 기록을 복원했습니다.");
          render();
          App.progress.render();
          App.calendar.refresh();
        } catch (err) {
          alert("가져오기 실패: 올바른 백업 파일이 아닙니다.");
        }
      };
      reader.readAsText(file);
      e.target.value = ""; // 같은 파일 다시 선택 가능하게
    });

    // 초기화
    App.util.$("#set-reset").addEventListener("click", () => {
      if (confirm("정말 모든 기록을 지울까요? 되돌릴 수 없습니다.")) {
        App.store.reset();
        render();
        App.progress.render();
        App.calendar.refresh();
      }
    });
  }

  function clampInt(v, min, max, fallback) {
    const n = parseInt(v, 10);
    if (isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  return { init, render };
})();
