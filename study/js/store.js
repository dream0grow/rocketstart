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
    focusMinutes: 25,     // 한 번 공부(뽀모도로) 길이(분) — 예전 버전과의 호환용
    // focusSeconds: 초 단위 공부 길이. 미세 조절(+30초 등)을 쓰면 여기에 저장됩니다.
    // 기본값을 두지 않는 이유: 예전 사용자의 focusMinutes 설정을 덮어쓰지 않기 위해서예요.
    // 읽을 때는 항상 getFocusSeconds()를 쓰세요. (focusSeconds가 없으면 focusMinutes×60)
    breakAfterN: 4,       // 뽀모도로 몇 회 후 휴식할지
    breakMinutes: 10,     // (짧은) 휴식 길이(분)
    longBreakMinutes: 20, // 긴 휴식 길이(분)
    longBreakEvery: 2,    // 몇 번째 휴식마다 긴 휴식을 줄지 (예: 2 = 두 번째 휴식마다)
    goalHours: 100,       // 목표 시간
    beepEnabled: true,    // 완료음 사용
    beepType: "beep",     // 완료음 종류: "beep"(삐삐) | "bell"(맑은 종) | "chime"(차임)
    beepVolume: 1,        // 완료음 크기 (0.1 ~ 1, 1이 최대)
    vibrateEnabled: true, // 진동 사용 (지원 기기만)
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

  // 공부 길이를 '초'로 돌려줍니다.
  // 미세 조절로 저장된 focusSeconds가 있으면 그걸 쓰고,
  // 없으면 예전 방식(focusMinutes×60)을 씁니다. → 예전 사용자 설정도 그대로 동작.
  function getFocusSeconds() {
    const s = getSettings();
    if (typeof s.focusSeconds === "number" && s.focusSeconds >= 30) {
      return s.focusSeconds;
    }
    return (s.focusMinutes || 25) * 60;
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

  // 특정 연/월의 총 공부 초 (월간 통계용)
  // month는 0~11 (자바스크립트 Date 기준)
  function monthSeconds(year, month) {
    const totals = dailyTotals(year, month);
    return Object.values(totals).reduce((sum, sec) => sum + sec, 0);
  }

  // 전체 공부한 날 수 (1초 이상 공부한 날만 카운트)
  function totalStudyDays() {
    const sessions = load().sessions;
    // Set으로 날짜 중복 제거
    const uniqueDates = new Set(sessions.map((s) => s.date));
    return uniqueDates.size;
  }

  // 연속 공부일(streak) 계산
  // 오늘부터 거슬러 올라가며 하루도 빠짐없이 공부한 날 수를 셉니다.
  // 오늘 아직 공부 안 했으면 어제부터 시작해서 셉니다.
  // (오늘 공부를 시작하지 않았다고 streak이 끊기면 억울하니까요)
  function currentStreak() {
    const today = new Date();
    const todayKey = dateKey(today);
    const todaySec = daySeconds(todayKey);

    let streak = 0;
    // 오늘 공부했으면 오늘(i=0)부터, 아직 안 했으면 어제(i=1)부터 시작
    const startOffset = todaySec > 0 ? 0 : 1;

    for (let i = startOffset; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = dateKey(d);
      if (daySeconds(key) > 0) {
        streak++;
      } else {
        break; // 공부 안 한 날이 나오면 연속이 끊김
      }
    }
    return streak;
  }

  // 최근 N일간 하루 평균 공부 초를 계산합니다.
  // - 오늘 포함 최근 lookbackDays일 범위를 봅니다.
  // - 공부한 날(1초 이상)이 minDays일 미만이면 null을 반환합니다.
  //   → 호출부에서 null이면 "데이터가 더 쌓이면 알려드려요"를 표시합니다.
  // - 평균은 '공부한 날의 합 ÷ 공부한 날 수'로 계산합니다.
  //   (공부 안 한 날을 0으로 포함하면 평균이 너무 낮게 나와 예측이 부정확해집니다.)
  function avgDailySeconds(lookbackDays, minDays) {
    lookbackDays = lookbackDays || 14; // 기본: 최근 14일
    minDays = minDays || 3;            // 기본: 최소 3일치 데이터 필요

    const today = new Date();
    let totalSec = 0;
    let studiedDays = 0;

    for (let i = 0; i < lookbackDays; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = dateKey(d);
      const sec = daySeconds(key);
      if (sec > 0) {
        totalSec += sec;
        studiedDays++;
      }
    }

    // 공부한 날이 너무 적으면 예측 불가 신호로 null 반환
    if (studiedDays < minDays) return null;

    return totalSec / studiedDays; // 공부한 날 기준 하루 평균 초
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
    getFocusSeconds,
    updateSettings,
    addSession,
    getReflection,
    setReflection,
    totalSeconds,
    daySeconds,
    dailyTotals,
    monthSeconds,
    totalStudyDays,
    currentStreak,
    avgDailySeconds,
    exportJSON,
    importJSON,
    reset,
    dateKey,
  };
})();
