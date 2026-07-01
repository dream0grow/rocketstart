// store.js — 데이터 저장소
// 모든 기록은 브라우저 localStorage 한 곳(키: study.v1)에 JSON 하나로 저장합니다.
// 서버가 전혀 없고 100% 이 기기 안에만 남습니다. (프로젝트 원칙: 로컬 100%)
//
// 설계 결정: '하루 총합'이나 '누적 시간'은 따로 저장하지 않습니다.
//   대신 sessions(공부 세션 목록) 하나만 진짜 원본으로 두고, 필요할 때마다 계산합니다.
//   → 데이터가 어긋날 일이 없어 단순하고 안전합니다.

window.App = window.App || {};

App.store = (function () {
  const KEY = "study.v1";

  // 설정 기본값 — 앱에서 바꿀 수 있습니다.
  const DEFAULT_SETTINGS = {
    focusMinutes: 25,     // 한 번 공부(뽀모도로) 길이 (5분 단위 5~30)
    breakAfterN: 4,       // 뽀모도로 몇 회 후 휴식할지
    breakMinutes: 10,     // (짧은) 휴식 길이(분)
    longBreakMinutes: 20, // 긴 휴식 길이(분)
    longBreakEvery: 2,    // 몇 번째 휴식마다 긴 휴식을 줄지 (예: 2 = 두 번째 휴식마다)
    goalHours: 100,       // 목표 시간
    beepEnabled: true,    // 완료음 사용
    keepAwake: true,      // 화면 켜두기 사용
  };

  // 저장소 초기 모양
  function emptyData() {
    return {
      schemaVersion: 1,
      settings: { ...DEFAULT_SETTINGS },
      sessions: [],      // { id, date:"YYYY-MM-DD", startedAt, endedAt, seconds }
      reflections: {},   // { "YYYY-MM-DD": "성찰 메모" }
    };
  }

  // localStorage에서 읽기 (없으면 빈 데이터)
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return emptyData();
      const data = JSON.parse(raw);
      // 예전 데이터에 빠진 설정 항목이 있어도 기본값으로 채워 안전하게.
      data.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
      data.sessions = data.sessions || [];
      data.reflections = data.reflections || {};
      return data;
    } catch (e) {
      console.warn("저장 데이터를 읽지 못했습니다. 새로 시작합니다.", e);
      return emptyData();
    }
  }

  // localStorage에 쓰기
  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  // --- 설정 ---
  function getSettings() {
    return load().settings;
  }
  function updateSettings(patch) {
    const data = load();
    data.settings = { ...data.settings, ...patch };
    save(data);
    return data.settings;
  }

  // --- 공부 세션 ---
  // 공부 한 번(뽀모도로)이 끝나면 실제 공부한 '초'를 기록합니다.
  function addSession(seconds, endedAtMs) {
    if (!seconds || seconds <= 0) return;
    const data = load();
    const end = endedAtMs || Date.now();
    data.sessions.push({
      id: String(end),
      date: dateKey(new Date(end)),      // 끝난 시각의 '그 날' 기준
      startedAt: end - seconds * 1000,
      endedAt: end,
      seconds: Math.round(seconds),
    });
    save(data);
  }

  // --- 성찰 메모 ---
  function getReflection(dateStr) {
    return load().reflections[dateStr] || "";
  }
  function setReflection(dateStr, text) {
    const data = load();
    if (text && text.trim()) {
      data.reflections[dateStr] = text;
    } else {
      delete data.reflections[dateStr];
    }
    save(data);
  }

  // --- 집계(세션에서 계산) ---
  // 전체 누적 공부 초
  function totalSeconds() {
    return load().sessions.reduce((sum, s) => sum + s.seconds, 0);
  }
  // 특정 날짜(YYYY-MM-DD) 총 공부 초
  function daySeconds(dateStr) {
    return load()
      .sessions.filter((s) => s.date === dateStr)
      .reduce((sum, s) => sum + s.seconds, 0);
  }
  // 특정 연/월의 '날짜별 총 초' { "YYYY-MM-DD": 초 }  (달력용)
  function dailyTotals(year, month /* 0~11 */) {
    const prefix =
      year + "-" + String(month + 1).padStart(2, "0") + "-";
    const out = {};
    for (const s of load().sessions) {
      if (s.date.startsWith(prefix)) {
        out[s.date] = (out[s.date] || 0) + s.seconds;
      }
    }
    return out;
  }

  // --- 백업(내보내기/가져오기) ---
  function exportJSON() {
    return JSON.stringify(load(), null, 2);
  }
  // 문자열(JSON)을 받아 통째로 덮어씁니다. 성공하면 true.
  function importJSON(text) {
    const parsed = JSON.parse(text); // 형식이 틀리면 여기서 예외 → 호출부에서 처리
    const data = emptyData();
    data.settings = { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) };
    data.sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
    data.reflections = parsed.reflections || {};
    save(data);
    return true;
  }

  // 기록 전체 초기화
  function reset() {
    save(emptyData());
  }

  // 날짜 → "YYYY-MM-DD" (로컬 시간 기준)
  function dateKey(d) {
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  return {
    DEFAULT_SETTINGS,
    load,
    save,
    getSettings,
    updateSettings,
    addSession,
    getReflection,
    setReflection,
    totalSeconds,
    daySeconds,
    dailyTotals,
    exportJSON,
    importJSON,
    reset,
    dateKey,
  };
})();
