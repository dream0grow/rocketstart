"""
마감일 추출기 (★MVP-2 핵심 로직 — 규칙 기반)

설계서 4장 정의:
    마감일 = 부장이 '액션(신청·제출·회신)' 해야 하는 기한. **행사일이 아님.**

왜 AI를 안 쓰나 (검증으로 확정):
    3b 모델이 마감일을 7.29 → 7.15 로 지어내는 환각이 있었고,
    날짜가 둘일 때(연수일 3.10 vs 신청기한 3.6) 핵심을 못 집었습니다.
    → 날짜는 정규식으로 뽑고, 앞뒤 문맥의 '액션 단어'로 성격을 가립니다.

추출 규칙 (설계서 4장):
    1) 날짜 패턴 정규식으로 모든 날짜를 찾는다.
    2) 각 날짜의 앞뒤 문맥(약 25자)에서 가장 가까운 '단어'를 본다.
    3) 액션 단어(신청·제출·회신·마감·기한·까지 …) 근처 → 마감일,
       행사 단어(일시·행사·실시·개최·기간) 근처 → 행사일(참고).
    4) 여러 마감일이면 가장 이른 것을 대표 마감으로, 나머지는 함께 표시.
    5) 라벨 구분: [신청기한] [제출기한] [마감] [행사일] [참고]

⚠️ 알려진 한계 (설계서): '까지'가 앞 문장에 걸쳐 오판할 수 있음 → 이후 정교화.
"""

import re
from dataclasses import dataclass, field, asdict
from datetime import date
from typing import List, Optional

# 앞뒤로 몇 글자까지 문맥으로 볼지 (설계서: 약 25자)
CONTEXT_WINDOW = 25

# ── 라벨을 결정하는 단어들 ─────────────────────────────────
# (단어, 라벨) — 가까이 있으면 그 라벨을 붙입니다.
_APPLY_WORDS = ["신청", "접수", "등록", "응모", "공모", "모집"]        # → 신청기한
_SUBMIT_WORDS = ["제출", "회신", "보고", "납부", "송부", "제출마감"]   # → 제출기한
_GENERIC_DEADLINE_WORDS = ["마감", "기한", "까지", "완료"]            # → 마감
_EVENT_WORDS = ["일시", "행사", "실시", "개최", "기간", "운영일", "연수일", "예정일"]  # → 행사일

# 라벨 이름 상수 (오타 방지)
LABEL_APPLY = "신청기한"
LABEL_SUBMIT = "제출기한"
LABEL_DEADLINE = "마감"
LABEL_EVENT = "행사일"
LABEL_REFERENCE = "참고"

# 마감일로 치는 라벨들 (행사일·참고는 액션이 아님)
_DEADLINE_LABELS = {LABEL_APPLY, LABEL_SUBMIT, LABEL_DEADLINE}

# ── 날짜 패턴 ─────────────────────────────────────────────
# ① 점 형식: 2026. 7. 29.  /  2026.7.29  /  2026. 7. 29.(수)
#    (뒤에 숫자가 바로 오면 날짜가 아니므로 (?!\d) 로 막음)
_DATE_DOT = re.compile(r"(\d{4})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})\s*\.?(?!\d)")
# ② 한글 형식: 2026년 7월 29일
_DATE_KOR = re.compile(r"(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일")

# 공문서 푸터의 '문서 처리 날짜'를 알아보는 패턴.
#   모든 공문 하단에는 「시행 중등교육과-12985 (2026. 6. 29.)」,
#   「접수 무릉초등학교-3015 (2026. 6. 29.)」 같은 라우팅 정보가 있습니다.
#   또 본문 중 「관련: … 교원정책과-4175(2026. 6. 24.)」 같은 근거문서 참조도 있습니다.
#   → 날짜 바로 앞에 '기관명-숫자(' 형태가 있으면 그 날짜는 마감일이 아니라
#      문서 처리·참조 날짜(메타데이터)입니다. 마감으로 오인하면 안 됩니다.
_DOC_ROUTING_BEFORE = re.compile(r"[가-힣]{2,}\s*-\s*\d+\s*\(?\s*$")

# 범위(기간) 처리용:  「2026. 6. 26.(금) ~ 7. 7.(화)」
_DOW = re.compile(r"\s*\([일월화수목금토]\)")        # 요일 표시 (금)
_TIME = re.compile(r"\s*\d{1,2}\s*:\s*\d{2}")         # 시각 표시 09:00
_RANGE_SEP = re.compile(r"\s*[~∼〜–—]\s*")            # 물결표 등 범위 이음
# 연도가 생략될 수 있는 부분 날짜: 「7. 7.」 또는 「2026. 7. 7.」
_PARTIAL_DATE = re.compile(r"(?:(\d{4})\s*\.\s*)?(\d{1,2})\s*\.\s*(\d{1,2})\s*\.?(?!\d)")

# 범위 앞에 이 액션어가 있으면 '신청기간/제출기간' → 범위의 끝이 마감.
_RANGE_ACTION_WORDS = _APPLY_WORDS + _SUBMIT_WORDS


@dataclass
class DateMention:
    """공문에서 찾은 날짜 하나와, 그 성격."""
    iso: str                      # 정렬·D-day 계산용 (예: 2026-07-29)
    raw: str                      # 공문에 적힌 그대로 (예: 2026. 7. 29.)
    year: int
    month: int
    day: int
    label: str                    # 신청기한/제출기한/마감/행사일/참고
    is_deadline: bool             # 부장이 액션해야 하는 기한인가
    keyword: Optional[str] = None # 라벨을 정하게 한 단어 (근거)
    context: str = ""             # 앞뒤 문맥 (사람이 확인용)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class DeadlineResult:
    """마감일 추출 결과 한 덩어리."""
    all_dates: List[DateMention] = field(default_factory=list)   # 찾은 모든 날짜
    deadlines: List[DateMention] = field(default_factory=list)   # 마감일만 (이른 순)
    primary: Optional[DateMention] = None                        # 대표 마감(가장 이른 것)
    has_deadline: bool = False                                   # 마감일이 하나라도 있나

    def to_dict(self) -> dict:
        return {
            "all_dates": [d.to_dict() for d in self.all_dates],
            "deadlines": [d.to_dict() for d in self.deadlines],
            "primary": self.primary.to_dict() if self.primary else None,
            "has_deadline": self.has_deadline,
        }


def extract_deadlines(text: str) -> DeadlineResult:
    """본문 텍스트에서 날짜를 모두 찾아 성격을 가리고, 대표 마감을 정합니다."""
    mentions = []
    consumed = set()  # 이미 처리한 글자 위치 (범위 끝 날짜 중복 방지)

    # 점 형식·한글 형식 날짜를 위치 순으로 모두 찾습니다.
    matches = sorted(
        list(_DATE_DOT.finditer(text)) + list(_DATE_KOR.finditer(text)),
        key=lambda m: m.start(),
    )

    for m in matches:
        if m.start() in consumed:
            continue
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if not _valid_date(y, mo, d):
            continue  # 13월·32일 같은 잘못된 날짜는 버림
        consumed.add(m.start())

        # 이 날짜가 '범위(A ~ B)'의 시작인지 살펴봅니다.
        end_info = _try_range_end(text, m.end(), y)

        if end_info is not None:
            # 범위입니다. 시작 문맥에 '신청/제출' 액션어가 있으면 → 끝이 마감.
            ey, emo, ed, end_span, end_raw = end_info
            consumed.add(end_span[0])
            action = _range_action_keyword(text, m.start(), m.end())

            if action is not None:
                label, _is_apply, word = action
                # 시작 날짜 = 기간 시작(참고), 끝 날짜 = 마감
                mentions.append(_mk(text, m, y, mo, d, LABEL_REFERENCE, "기간시작", False))
                mentions.append(_mk_raw(
                    text, end_span[0], end_span[1], ey, emo, ed, end_raw,
                    label, word, True,
                ))
            else:
                # 연수기간·행사기간 등 → 둘 다 행사일(참고)
                mentions.append(_mk(text, m, y, mo, d, LABEL_EVENT, "기간", False))
                mentions.append(_mk_raw(
                    text, end_span[0], end_span[1], ey, emo, ed, end_raw,
                    LABEL_EVENT, "기간", False,
                ))
            continue

        # 범위가 아닌 단독 날짜: 앞뒤 문맥으로 성격 판별.
        label, keyword, is_deadline = _classify(text, m.start(), m.end())
        mentions.append(_mk(text, m, y, mo, d, label, keyword, is_deadline))

    # 날짜 순으로 정렬 (이른 것부터)
    mentions.sort(key=lambda x: x.iso)

    deadlines = [d for d in mentions if d.is_deadline]
    deadlines.sort(key=lambda x: x.iso)

    result = DeadlineResult(
        all_dates=mentions,
        deadlines=deadlines,
        primary=deadlines[0] if deadlines else None,
        has_deadline=bool(deadlines),
    )
    return result


def _try_range_end(text: str, pos: int, start_year: int):
    """
    날짜 바로 뒤가 '~ 끝날짜' 형태(범위)인지 확인합니다.
    있으면 (연,월,일,(시작,끝)위치,원문) 을 돌려주고, 없으면 None.
    끝날짜에 연도가 없으면 시작 날짜의 연도를 물려받습니다.
    """
    # 요일 표시 「(금)」·시각 「09:00」이 있으면 건너뜁니다.
    dow = _DOW.match(text, pos)
    if dow:
        pos = dow.end()
    tm = _TIME.match(text, pos)
    if tm:
        pos = tm.end()
    # 물결표(~)가 있어야 범위입니다.
    sep = _RANGE_SEP.match(text, pos)
    if not sep:
        return None
    pos = sep.end()
    # 끝 날짜(부분 날짜 허용) 파싱.
    pm = _PARTIAL_DATE.match(text, pos)
    if not pm:
        return None
    ey = int(pm.group(1)) if pm.group(1) else start_year
    emo, ed = int(pm.group(2)), int(pm.group(3))
    if not _valid_date(ey, emo, ed):
        return None
    # 연도가 생략됐으면 시작 날짜의 연도를 붙여 보기 좋게 만듭니다. (7. 7. → 2026. 7. 7.)
    if pm.group(1):
        raw = pm.group(0).strip()
    else:
        raw = f"{ey}. {emo}. {ed}."
    return ey, emo, ed, (pm.start(), pm.end()), raw


def _range_action_keyword(text: str, start: int, end: int):
    """
    범위의 시작 문맥에 '신청/제출' 류 액션어가 있으면 (라벨, is_apply, 단어)를 돌려줍니다.
    없으면 None (→ 행사/연수 기간으로 봄).
    """
    left = max(0, start - CONTEXT_WINDOW)
    window = text[left:end]
    # 신청류를 먼저(더 흔함), 그다음 제출류.
    for word in _APPLY_WORDS:
        if word in window:
            return (LABEL_APPLY, True, word)
    for word in _SUBMIT_WORDS:
        if word in window:
            return (LABEL_SUBMIT, False, word)
    return None


def _mk(text, m, y, mo, d, label, keyword, is_deadline) -> DateMention:
    """정규식 매치로부터 DateMention 을 만듭니다."""
    return _mk_raw(text, m.start(), m.end(), y, mo, d, m.group(0).strip(),
                   label, keyword, is_deadline)


def _mk_raw(text, start, end, y, mo, d, raw, label, keyword, is_deadline) -> DateMention:
    """위치·값으로부터 DateMention 을 만듭니다."""
    return DateMention(
        iso=f"{y:04d}-{mo:02d}-{d:02d}",
        raw=raw, year=y, month=mo, day=d,
        label=label, is_deadline=is_deadline,
        keyword=keyword, context=_context_of(text, start, end),
    )


def _valid_date(y: int, mo: int, d: int) -> bool:
    """실제로 존재하는 날짜인지 확인 (예: 2026-13-40 은 거짓)."""
    if not (2000 <= y <= 2099):
        return False
    try:
        date(y, mo, d)
        return True
    except ValueError:
        return False


def _context_of(text: str, start: int, end: int) -> str:
    """날짜 앞뒤 문맥을 잘라 옵니다 (사람이 확인할 수 있게)."""
    left = max(0, start - CONTEXT_WINDOW)
    right = min(len(text), end + CONTEXT_WINDOW)
    snippet = text[left:right].replace("\n", " ")
    return re.sub(r"\s+", " ", snippet).strip()


def _classify(text: str, start: int, end: int):
    """
    날짜 앞뒤 문맥에서 단어들의 거리를 재어 라벨을 정합니다.
    돌려주는 값: (라벨, 근거단어, 마감일여부)

    판단 순서:
      1) '액션어(신청·제출·마감 …)'와 '행사어(일시·기간 …)' 중 어느 쪽이 더
         가까운가로 '마감일 vs 행사일'을 먼저 가른다.
      2) 마감일이면, 일반어(마감·기한·까지)보다 구체적 액션어(신청/제출)가
         창 안에 있으면 그것으로 세부 라벨을 올린다. (예: '까지 회신' → 제출기한)
    """
    left = max(0, start - CONTEXT_WINDOW)
    right = min(len(text), end + CONTEXT_WINDOW)
    before = text[left:start]
    after = text[end:right]

    # 문서 처리 날짜(시행일·접수일·근거문서일)면 마감이 아니라 메타데이터.
    if _DOC_ROUTING_BEFORE.search(before):
        return LABEL_REFERENCE, "문서처리일", False

    def nearest(words):
        """words 중 날짜에 가장 가까운 (거리, 단어). 없으면 None."""
        best = None
        for word in words:
            idx_b = before.rfind(word)
            if idx_b != -1:
                dist = len(before) - (idx_b + len(word))
                if best is None or dist < best[0]:
                    best = (dist, word)
            idx_a = after.find(word)
            if idx_a != -1:
                if best is None or idx_a < best[0]:
                    best = (idx_a, word)
        return best

    n_apply = nearest(_APPLY_WORDS)
    n_submit = nearest(_SUBMIT_WORDS)
    n_generic = nearest(_GENERIC_DEADLINE_WORDS)
    n_event = nearest(_EVENT_WORDS)

    # 가장 가까운 '액션어'(신청/제출/일반 통틀어)
    action_candidates = [c for c in (n_apply, n_submit, n_generic) if c]
    nearest_action = min(action_candidates, key=lambda x: x[0]) if action_candidates else None

    # 액션어도 행사어도 없으면 → 참고 날짜
    if nearest_action is None and n_event is None:
        return LABEL_REFERENCE, None, False

    # 행사어가 액션어보다 더 가까우면 → 행사일 (마감 아님)
    if n_event is not None and (nearest_action is None or n_event[0] < nearest_action[0]):
        return LABEL_EVENT, n_event[1], False

    # 여기부터는 마감일. 세부 라벨은 구체적 액션어(신청/제출)를 우선.
    specific = [c for c in (n_apply, n_submit) if c]
    if specific:
        best_specific = min(specific, key=lambda x: x[0])
        if best_specific is n_apply:
            return LABEL_APPLY, n_apply[1], True
        return LABEL_SUBMIT, best_specific[1], True

    # 구체적 액션어가 없으면 일반 마감.
    return LABEL_DEADLINE, n_generic[1], True
