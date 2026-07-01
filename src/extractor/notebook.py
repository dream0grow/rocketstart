"""
교무수첩 항목 생성 (MVP-3, 규칙 기반)

MVP-1(파일명·본문)·MVP-2(마감일) 결과를 모아 '교무수첩 카드' 하나로 정리합니다.
설계서 6장 + 「교무수첩 양식 v2」 문서를 근거로 합니다.

핵심: 공문을 4가지 성격으로 자동 1차 분류 (부장이 조정 가능).
    ① 할일형 (마감일 O)  → 교무수첩 상단, D-day
    ② 배포형            → 배포함, 대상 지정        (예: 캠프 포스터)
    ③ 참고형 (마감일 X)  → 자료실 보관             (예: 통학구역)
    ④ 규정형 (마감일 X)  → 읽음표시, 보관          (예: 복무규정 개정)

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

# ── 공문 4성격 라벨 ───────────────────────────────────────
CATEGORY_TASK = "할일형"       # ① 마감일 있음
CATEGORY_DISTRIBUTE = "배포형"  # ② 배포/전달
CATEGORY_REFERENCE = "참고형"   # ③ 참고/보관 (마감 없음)
CATEGORY_RULE = "규정형"        # ④ 규정/숙지 (마감 없음)

# 성격 → 교무수첩에서 놓일 위치 (설계서)
_PLACEMENT = {
    CATEGORY_TASK: "교무수첩 상단(할 일·D-day)",
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
    category: str = CATEGORY_REFERENCE   # 할일형/배포형/참고형/규정형
    category_reason: str = ""            # 왜 그렇게 분류했는지
    placement: str = ""                  # 교무수첩 내 위치
    task_type: str = "기타"              # 업무 유형(추정)

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

    # ★ 4성격 분류
    entry.category, entry.category_reason = _classify_category(
        has_deadline=has_deadline, title=title, is_image=entry.is_image,
    )
    entry.placement = _PLACEMENT.get(entry.category, "")

    return entry


def _classify_category(has_deadline: bool, title: str, is_image: bool):
    """공문 4성격을 규칙으로 정합니다. (마감일 유무 우선, 그다음 제목 키워드)"""
    # ① 마감일이 있으면 할 일이 있는 공문 → 할일형
    if has_deadline:
        return CATEGORY_TASK, "마감일(액션 기한)이 있어 할일형으로 분류"

    # 마감일이 없는 공문을 배포/규정/참고로 나눕니다.
    # ② 배포형: 이미지 포스터이거나 홍보/배부성 제목
    if is_image:
        return CATEGORY_DISTRIBUTE, "이미지 공문(포스터 등) → 배포형"
    if _contains_any(title, _DISTRIBUTE_WORDS):
        return CATEGORY_DISTRIBUTE, f"제목에 배포성 키워드 → 배포형"

    # ④ 규정형: 규정·법령·예규 숙지성
    if _contains_any(title, _RULE_WORDS):
        return CATEGORY_RULE, "제목에 규정·법령·예규 키워드 → 규정형"

    # ③ 그 외 마감 없는 것은 참고형
    return CATEGORY_REFERENCE, "마감일 없고 규정·배포도 아님 → 참고형"


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
