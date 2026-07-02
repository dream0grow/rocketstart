"""
교무수첩 항목 생성 (MVP-3, 규칙 기반)

MVP-1(파일명·본문)·MVP-2(마감일) 결과를 모아 '교무수첩 카드' 하나로 정리합니다.
설계서 6장 + 「교무수첩 양식 v2」 문서를 근거로 합니다.

핵심: 공문을 5가지 성격으로 자동 1차 분류 (부장이 조정 가능).
    ① 할일형 (보고·제출 필수) → 교무수첩 상단, D-day (예: 결과 보고, 참석 협조)
    ② 공람형 (교사 대상 안내) → 담임·교사에게 공람    (예: 직무연수 신청 안내)
    ③ 배포형                → 배포함, 대상 지정      (예: 캠프 포스터)
    ④ 참고형 (마감일 X)      → 자료실 보관           (예: 통학구역, 첨부 서식)
    ⑤ 규정형 (마감일 X)      → 읽음표시, 보관        (예: 복무규정 개정)

추가로 '처리 주체(owner)'를 힌트로 붙입니다 (부장이 조정 가능).
    · "부장"       — 보고·제출·참석 협조 등 부장이 직접 처리
    · "담임(공람)" — 담임·교사들에게 공람으로 알릴 것

첨부 서식(제목이 "서식1." "양식2" 등으로 시작)은 할 일이 아니라 본문 공문에
딸린 재료이므로, 마감일이 있어도 할일형으로 올리지 않고 참고형으로 둡니다.

분류 기준(설계서): 마감일 유무 + 발신기관 + 제목 키워드. 규칙 우선, AI는 보조.
※ 한줄요약·세부 할일(AI 제안)은 MVP-4 에서 채웁니다. 여기까진 AI 안 씀.
"""

import re
from dataclasses import dataclass, field, asdict
from datetime import date
from typing import List, Optional

# 이보다 더 오래 지난 마감은 '실행 기한'이 아니라 근거·예시 날짜로 봅니다.
#   (첨부 서식·계획서에 든 관련 법령일·예시일 등이 마감으로 오인되는 것 방지)
STALE_DAYS = 365

# ── 공문 5성격 라벨 ───────────────────────────────────────
CATEGORY_TASK = "할일형"        # ① 보고·제출 등 부장이 반드시 처리
CATEGORY_CIRCULATE = "공람형"   # ② 담임·교사 대상 안내 → 공람
CATEGORY_DISTRIBUTE = "배포형"  # ③ 학생·가정 배포/전달
CATEGORY_REFERENCE = "참고형"   # ④ 참고/보관 (마감 없음, 첨부 서식 포함)
CATEGORY_RULE = "규정형"        # ⑤ 규정/숙지 (마감 없음)

# 처리 주체 힌트 (부장이 조정 가능)
OWNER_MANAGER = "부장"          # 부장이 직접 처리 (보고·제출·참석 협조)
OWNER_TEACHERS = "담임(공람)"   # 담임·교사들에게 공람

# 성격 → 교무수첩에서 놓일 위치 (설계서)
_PLACEMENT = {
    CATEGORY_TASK: "교무수첩 상단(할 일·D-day)",
    CATEGORY_CIRCULATE: "공람(담임·교사 안내)",
    CATEGORY_DISTRIBUTE: "배포함(대상 지정)",
    CATEGORY_REFERENCE: "자료실 보관",
    CATEGORY_RULE: "읽음표시·보관",
}

# ── 성격 판별 키워드 (제목 기준) ──────────────────────────
# 규정형: 규정·법령·지침 숙지성
_RULE_WORDS = ["규정", "법령", "예규", "조례", "훈령", "복무", "징계", "개정령"]
# 배포형: 학생·가정에 뿌리는 홍보/안내성
_DISTRIBUTE_WORDS = ["포스터", "홍보", "캠프", "가정통신", "배부", "배포",
                     "리플릿", "웹자보", "안내문", "공모전"]
# 할일형(보고·제출): 부장이 반드시 처리해서 보내야 하는 것
_REPORT_WORDS = ["보고", "제출", "조사", "수합", "현황", "실적", "점검 결과",
                 "결과 회신", "회신"]
# 참석·협조 요청 — 내용에 따라 부장이 갈 수도, 담임에게 알릴 수도 있음
_ATTEND_WORDS = ["참석 협조", "협조 요청", "참석 요청", "참석 안내"]
# 공람형: 담임·교사 대상 연수/교육/공모 신청 안내 → 공람으로 알림
_CIRCULATE_WORDS = ["연수", "직무연수", "역량강화", "교원 연수", "교사 연수",
                    "연수 신청", "교육 신청", "공모전 참여", "공모 안내",
                    "신청 안내", "참가 신청", "모집 안내", "참여 안내"]

# ── 연수·참석의 '내용'으로 처리 주체 가리기 (사용자 피드백 2026-07) ──
# 업무 중심(부장이 직접): 안전지도·교무학사·평가·기록 관리 등 행정 업무
_ADMIN_FOCUS_WORDS = ["안전지도", "안전관리", "교무", "학사", "평가", "성적",
                      "학업성적", "생활기록부", "학교생활기록부", "시행지침",
                      "담당자", "부장", "관리자", "감사", "복무", "예산",
                      "정보공시", "나이스", "학적"]
# 학생 지도 중심(담임이 참석·숙지): 기초학력·부진학생·상담 등 수업/학생 지도
_STUDENT_FOCUS_WORDS = ["기초학력", "부진", "학습지원", "생활지도", "상담",
                        "인성", "다문화", "정서", "심리", "진로", "독서",
                        "수업", "교과", "수학교육", "과학교육", "영어교육",
                        "국어교육", "체육", "음악", "미술", "학생 지도"]

# 첨부 서식 제목: "서식1." "양식 2" "(서식)" 등으로 시작 → 할 일 아님
_FORM_TITLE_RE = re.compile(r"^\s*[\[(（【]?\s*(서식|양식|붙임)\s*\d*\s*[\])）】.:]?")

# ── 업무 유형 키워드 (설계서: 추정, 부장이 조정) ───────────
_TASK_TYPE_RULES = [
    ("연수/교육", ["연수", "워크숍", "워크숖", "역량강화", "직무연수", "교육과정"]),
    ("복무/근무", ["복무", "근무", "인사", "징계", "겸직"]),
    ("행사/사업", ["행사", "축전", "대회", "체험학습", "축제", "캠프", "공모전"]),
    ("보고/제출", ["보고", "제출", "현황", "조사", "수합", "결과", "실적", "점검"]),
    ("예산", ["예산", "집행", "지원금", "교부금"]),
    ("규정/법령", ["규정", "법령", "예규", "지침", "조례"]),
]

# ── 발신기관 등급 (설계서 4장: 발신기관 기반 1차 중요도 힌트) ──
_UPPER_ORG_WORDS = ["교육청", "교육지원청", "교육원", "연구원", "교육부"]
_SCHOOL_WORDS = ["초등학교", "중학교", "고등학교", "유치원"]


@dataclass
class NotebookEntry:
    """교무수첩 카드 하나."""
    # 파일명에서 (규칙, 정확)
    title: Optional[str] = None
    sender: Optional[str] = None
    doc_number: Optional[str] = None
    kind: Optional[str] = None          # 본문/첨부
    extension: Optional[str] = None
    sender_level: str = "단체/기타"      # 상급기관/타학교/단체·기타 (힌트)

    # 성격 분류 (규칙)
    category: str = CATEGORY_REFERENCE   # 할일형/공람형/배포형/참고형/규정형
    category_reason: str = ""            # 왜 그렇게 분류했는지
    placement: str = ""                  # 교무수첩 내 위치
    task_type: str = "기타"              # 업무 유형(추정)
    owner: Optional[str] = None          # 처리 주체 힌트: 부장 / 담임(공람)

    # 마감일 (MVP-2 결과에서)
    deadline_iso: Optional[str] = None
    deadline_label: Optional[str] = None
    deadline_raw: Optional[str] = None
    d_day: Optional[int] = None          # 오늘로부터 남은 일수 (음수=지남)
    d_day_text: str = ""                 # "D-7" / "D-DAY" / "D+3(지남)"
    other_deadlines: List[dict] = field(default_factory=list)
    stale_dropped: int = 0               # 근거·예시로 보고 제외한 옛 날짜 수

    # 상태
    is_image: bool = False               # 이미지 PDF (요약·본문 불가)
    needs_review: bool = True            # 사람 확인 필요(항상 True — 설계 원칙)

    def to_dict(self) -> dict:
        return asdict(self)


def build_notebook_entry(filename_info: dict, deadline_info: dict,
                         extension: Optional[str], ok: bool, message: str,
                         today: Optional[date] = None) -> NotebookEntry:
    """추출 결과 조각들을 모아 교무수첩 카드를 만듭니다."""
    filename_info = filename_info or {}
    deadline_info = deadline_info or {}

    title = filename_info.get("title") or ""
    sender = filename_info.get("sender")

    entry = NotebookEntry(
        title=filename_info.get("title"),
        sender=sender,
        doc_number=filename_info.get("doc_number"),
        kind=filename_info.get("kind"),
        extension=extension,
        sender_level=_sender_level(sender),
        task_type=_task_type(title),
    )

    # 이미지 PDF 인지 (본문 추출 실패 + '이미지' 안내)
    entry.is_image = (not ok) and ("이미지" in (message or ""))

    if today is None:
        today = date.today()

    # 마감일 정보 채우기 (MVP-2 결과에서, 단 '실행 가능한' 마감만).
    #   아주 오래 지난 날짜(STALE_DAYS 초과)는 근거·예시로 보고 제외합니다.
    actionable = []
    stale_count = 0
    for d in deadline_info.get("deadlines", []):
        d_day, _ = _d_day(d.get("iso"), today)
        if d_day is not None and d_day < -STALE_DAYS:
            stale_count += 1
            continue
        actionable.append(d)
    entry.stale_dropped = stale_count

    has_deadline = bool(actionable)
    primary = actionable[0] if actionable else None  # deadlines 는 이미 이른 순 정렬
    if primary:
        entry.deadline_iso = primary.get("iso")
        entry.deadline_label = primary.get("label")
        entry.deadline_raw = primary.get("raw")
        entry.d_day, entry.d_day_text = _d_day(primary.get("iso"), today)
    # 대표 외의 다른 실행 마감도 함께 (설계서: 여러 마감 함께 표시)
    for d in actionable:
        if d.get("iso") != (primary.get("iso") if primary else None):
            entry.other_deadlines.append({
                "label": d.get("label"), "raw": d.get("raw"), "iso": d.get("iso"),
            })

    # ★ 5성격 분류 + 처리 주체
    entry.category, entry.category_reason, entry.owner = _classify_category(
        has_deadline=has_deadline, title=title, is_image=entry.is_image,
        kind=entry.kind,
    )
    entry.placement = _PLACEMENT.get(entry.category, "")

    return entry


def _classify_category(has_deadline: bool, title: str, is_image: bool,
                       kind: Optional[str] = None):
    """공문 5성격 + 처리 주체를 규칙으로 정합니다.

    우선순위 (앞 규칙이 이깁니다):
      ⓪ 첨부 서식(서식1./양식2 …) → 참고형. 마감일이 있어도 할 일 아님.
         (서식 안의 날짜는 본문 공문의 마감이지 서식 자체의 할 일이 아니므로)
      ① 참석 협조·협조 요청       → 할일형·부장  (부장이 직접 가거나 지정)
      ② 보고·제출·조사·수합       → 할일형·부장  (반드시 처리해서 보내야 함)
      ③ 이미지 포스터             → 배포형       (학생·가정용 홍보물)
      ④ 연수·교육 신청 안내       → 공람형·담임  (담임들에게 공람으로 알림)
      ⑤ 그 외 마감일 있음         → 할일형·부장  (기한이 있으니 액션 필요)
      ⑥ 마감 없음: 배포/규정/참고 (기존 규칙)
    """
    # ⓪ 첨부 서식은 성격과 무관하게 할 일이 아닙니다.
    if title and _FORM_TITLE_RE.match(title):
        return (CATEGORY_REFERENCE,
                "첨부 서식(작성용 양식) → 할 일 아님, 본문 공문에서 확인",
                None)

    # ① 참석 협조 — 연수 '내용'에 따라 처리 주체가 갈립니다.
    #    업무 중심(안전지도·교무학사·평가 등) → 부장이 직접 참석 (할일형)
    #    학생 지도 중심(기초학력·부진학생 등) → 담임이 참석 → 공람으로 알림
    if _contains_any(title, _ATTEND_WORDS):
        if _contains_any(title, _STUDENT_FOCUS_WORDS):
            return (CATEGORY_CIRCULATE,
                    "학생 지도 중심 참석 요청 → 담임 참석 대상, 공람으로 알림",
                    OWNER_TEACHERS)
        return (CATEGORY_TASK,
                "업무 중심 참석·협조 요청 → 부장이 직접 처리할 할일형",
                OWNER_MANAGER)

    # ② 보고·제출 — 반드시 작성해서 보내야 하는 공문.
    if _contains_any(title, _REPORT_WORDS):
        return (CATEGORY_TASK,
                "보고·제출·조사 → 반드시 처리해야 하는 할일형",
                OWNER_MANAGER)

    # ③ 이미지 포스터는 '참여 안내'류 제목이어도 배포형 (학생·가정용 홍보물).
    if is_image:
        return CATEGORY_DISTRIBUTE, "이미지 공문(포스터 등) → 배포형", None

    # ④ 연수/신청 안내 — 역시 내용으로 가립니다.
    #    업무 중심 연수는 부장이 갈 것(할일형), 그 외는 담임·교사 공람.
    if _contains_any(title, _CIRCULATE_WORDS):
        if _contains_any(title, _ADMIN_FOCUS_WORDS):
            return (CATEGORY_TASK,
                    "업무 중심 연수·안내 → 부장이 직접 처리할 할일형",
                    OWNER_MANAGER)
        return (CATEGORY_CIRCULATE,
                "교사 대상 연수·신청 안내 → 담임 선생님들에게 공람",
                OWNER_TEACHERS)

    # ⑤ 그 외 마감일이 있으면 액션이 필요한 할일형.
    if has_deadline:
        return (CATEGORY_TASK,
                "마감일(액션 기한)이 있어 할일형으로 분류",
                OWNER_MANAGER)

    # ⑥ 마감일 없는 공문: 배포/규정/참고 (기존 규칙 그대로).
    if _contains_any(title, _DISTRIBUTE_WORDS):
        return CATEGORY_DISTRIBUTE, "제목에 배포성 키워드 → 배포형", None
    if _contains_any(title, _RULE_WORDS):
        return CATEGORY_RULE, "제목에 규정·법령·예규 키워드 → 규정형", None
    return CATEGORY_REFERENCE, "마감일 없고 규정·배포도 아님 → 참고형", None


def _task_type(title: str) -> str:
    """업무 유형(추정)을 제목 키워드로 정합니다."""
    for label, words in _TASK_TYPE_RULES:
        if _contains_any(title, words):
            return label
    return "기타"


def _sender_level(sender: Optional[str]) -> str:
    """발신기관 등급 힌트 (설계서: 우선도 1차 분류에 사용)."""
    if not sender:
        return "단체/기타"
    if _contains_any(sender, _UPPER_ORG_WORDS):
        return "상급기관"
    if _contains_any(sender, _SCHOOL_WORDS):
        return "타학교"
    return "단체/기타"


def _d_day(iso: Optional[str], today: Optional[date]):
    """오늘로부터 마감까지 남은 일수와 표시 문구."""
    if not iso:
        return None, ""
    if today is None:
        today = date.today()
    try:
        y, m, d = (int(x) for x in iso.split("-"))
        target = date(y, m, d)
    except (ValueError, AttributeError):
        return None, ""
    diff = (target - today).days
    if diff > 0:
        return diff, f"D-{diff}"
    if diff == 0:
        return 0, "D-DAY"
    return diff, f"D+{-diff}(지남)"


def _contains_any(text: str, words) -> bool:
    """text 안에 words 중 하나라도 들어 있으면 True (공백 무시)."""
    if not text:
        return False
    compact = re.sub(r"\s+", "", text)
    return any(re.sub(r"\s+", "", w) in compact for w in words)
