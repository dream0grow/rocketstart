"""
교무수첩 항목(카드) 생성 테스트 (MVP-3)

공문 5성격 분류(할일형/공람형/배포형/참고형/규정형)·처리 주체(owner)·
D-day 계산을 검증합니다. 설계서 6장 + 교무수첩 양식 v2 + 사용자 피드백
(2026-07: 공람형 신설, 서식 제외, 부장 처리 표시) 예시로 확인합니다.
"""

import os
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.extractor import (
    build_notebook_entry,
    CATEGORY_TASK, CATEGORY_CIRCULATE, CATEGORY_DISTRIBUTE,
    CATEGORY_REFERENCE, CATEGORY_RULE,
    OWNER_MANAGER, OWNER_TEACHERS,
)

TODAY = date(2026, 7, 1)  # 테스트 기준 '오늘' (설계 맥락과 동일)


def _fn(title, sender="제주특별자치도교육청 안전관리과", doc="2942", kind="본문"):
    return {"title": title, "sender": sender, "doc_number": doc,
            "kind": kind, "matched": True}


def _deadline(iso, label="신청기한", raw="2026. 7. 3."):
    return {
        "has_deadline": True,
        "primary": {"iso": iso, "label": label, "raw": raw},
        "deadlines": [{"iso": iso, "label": label, "raw": raw}],
        "all_dates": [],
    }


def test_circulate_category_teacher_training():
    """교사 대상 연수 신청 안내는 공람형 — 담임들에게 공람으로 알림."""
    e = build_notebook_entry(
        _fn("2026 다문화교육 지원교사 연수 참가 신청 안내"),
        _deadline("2026-07-03"), "odt", True, "추출 성공", today=TODAY,
    )
    assert e.category == CATEGORY_CIRCULATE
    assert e.owner == OWNER_TEACHERS
    assert e.d_day == 2               # 신청기한 D-day 는 그대로 유지
    assert e.d_day_text == "D-2"
    assert e.task_type == "연수/교육"


def test_task_category_report():
    """'결과 보고'류는 반드시 처리해야 하는 할일형 — 부장 처리."""
    e = build_notebook_entry(
        _fn("2026학년도 상반기 장기미인정결석학생 정기점검 결과 보고"),
        _deadline("2026-07-10", "제출기한"), "hwpx", True, "추출 성공",
        today=TODAY,
    )
    assert e.category == CATEGORY_TASK
    assert e.owner == OWNER_MANAGER


def test_task_category_attend_request_admin_focus():
    """업무 중심(생활기록부·학업성적) 참석 협조는 부장이 직접 처리할 할일형."""
    e = build_notebook_entry(
        _fn("2026 초등 학교생활기록부 기록 및 학업성적관리 시행지침 안내 연수 참석 협조 요청"),
        _deadline("2026-07-08", "행사일"), "hwpx", True, "추출 성공",
        today=TODAY,
    )
    assert e.category == CATEGORY_TASK
    assert e.owner == OWNER_MANAGER


def test_circulate_attend_request_student_focus():
    """학생 지도 중심(기초학력·부진) 참석 요청은 담임 참석 → 공람형."""
    e = build_notebook_entry(
        _fn("2026 기초학력 부진학생 지원 방안 연수 참석 협조 요청"),
        _deadline("2026-07-08", "행사일"), "hwpx", True, "추출 성공",
        today=TODAY,
    )
    assert e.category == CATEGORY_CIRCULATE
    assert e.owner == OWNER_TEACHERS


def test_task_category_admin_training():
    """업무 중심(안전지도 담당자) 연수 안내는 부장이 갈 할일형."""
    e = build_notebook_entry(
        _fn("2026 학교 안전지도 담당자 역량강화 연수 신청 안내"),
        _deadline("2026-07-15", "신청기한"), "hwpx", True, "추출 성공",
        today=TODAY,
    )
    assert e.category == CATEGORY_TASK
    assert e.owner == OWNER_MANAGER


def test_form_attachment_is_not_task():
    """'서식1.' 로 시작하는 첨부 서식은 마감일이 있어도 할 일이 아니다."""
    e = build_notebook_entry(
        _fn("서식1. (초중고 작성용) 2026학년도 상반기 장기미인정결석학생 정기점검 결과 보고",
            kind="첨부"),
        _deadline("2026-07-10", "제출기한"), "hwpx", True, "추출 성공",
        today=TODAY,
    )
    assert e.category == CATEGORY_REFERENCE
    assert e.owner is None
    assert "서식" in e.category_reason


def test_rule_category_regulation():
    """규정·예규 개정 안내(마감 없음)는 규정형."""
    e = build_notebook_entry(
        _fn("국가공무원 복무·징계 관련 예규 개정 안내"),
        {"has_deadline": False, "deadlines": [], "all_dates": []},
        "hwpx", True, "추출 성공", today=TODAY,
    )
    assert e.category == CATEGORY_RULE
    assert e.deadline_iso is None


def test_reference_category_no_deadline():
    """마감 없고 규정·배포도 아니면 참고형 (예: 통학구역 안내)."""
    e = build_notebook_entry(
        _fn("2027학년도 초등학교 통학구역 조정 추진 계획"),
        {"has_deadline": False, "deadlines": [], "all_dates": []},
        "hwp", True, "추출 성공", today=TODAY,
    )
    assert e.category == CATEGORY_REFERENCE


def test_distribute_category_image_poster():
    """이미지 포스터 공문은 배포형 (본문 추출 실패여도 카드 생성)."""
    e = build_notebook_entry(
        _fn("어린이 여름캠프 포스터 및 안내"),
        {}, "pdf", False, "이미지로 된 PDF입니다. 원본을 확인해 주세요", today=TODAY,
    )
    assert e.category == CATEGORY_DISTRIBUTE
    assert e.is_image is True


def test_distribute_category_by_keyword():
    """'배부' 같은 배포성 키워드면 배포형."""
    e = build_notebook_entry(
        _fn("현장체험학습 운영 길라잡이 배부"),
        {"has_deadline": False, "deadlines": [], "all_dates": []},
        "odt", True, "추출 성공", today=TODAY,
    )
    assert e.category == CATEGORY_DISTRIBUTE


def test_d_day_overdue_and_today():
    """지난 마감은 D+n(지남), 오늘 마감은 D-DAY."""
    overdue = build_notebook_entry(
        _fn("보고 제출"), _deadline("2026-06-28", "제출기한"),
        "odt", True, "추출 성공", today=TODAY,
    )
    assert overdue.d_day == -3
    assert "지남" in overdue.d_day_text

    dday = build_notebook_entry(
        _fn("보고 제출"), _deadline("2026-07-01", "제출기한"),
        "odt", True, "추출 성공", today=TODAY,
    )
    assert dday.d_day_text == "D-DAY"


def test_sender_level_upper_org():
    """교육청 발신은 상급기관으로 표시(우선도 힌트)."""
    e = build_notebook_entry(
        _fn("연수 안내", sender="서귀포시교육지원청 교수학습지원과"),
        {"has_deadline": False, "deadlines": [], "all_dates": []},
        "odt", True, "추출 성공", today=TODAY,
    )
    assert e.sender_level == "상급기관"


def test_stale_reference_date_not_task():
    """수년 지난 날짜(근거 법령·예시일)는 실행 마감으로 보지 않는다."""
    di = {
        "has_deadline": True,
        "primary": {"iso": "2019-03-13", "label": "제출기한", "raw": "2019. 3. 13."},
        "deadlines": [{"iso": "2019-03-13", "label": "제출기한", "raw": "2019. 3. 13."}],
        "all_dates": [],
    }
    e = build_notebook_entry(
        _fn("2026학년도 현장체험학습 운영 계획"), di,
        "hwpx", True, "추출 성공", today=TODAY,
    )
    # 옛 날짜는 제외 → 마감 없는 것으로 처리, 할일형 아님
    assert e.deadline_iso is None
    assert e.category != CATEGORY_TASK
    assert e.stale_dropped == 1


def test_recent_overdue_still_task():
    """올해 안에 며칠~몇 달 지난 마감은 여전히 할일형(놓친 것 알려야 함)."""
    di = {
        "has_deadline": True,
        "primary": {"iso": "2026-03-06", "label": "신청기한", "raw": "2026. 3. 6."},
        "deadlines": [{"iso": "2026-03-06", "label": "신청기한", "raw": "2026. 3. 6."}],
        "all_dates": [],
    }
    e = build_notebook_entry(_fn("학교 안전 점검 결과 제출"), di,
                             "odt", True, "추출 성공", today=TODAY)
    assert e.category == CATEGORY_TASK
    assert e.deadline_iso == "2026-03-06"
    assert "지남" in e.d_day_text


def test_other_deadlines_listed():
    """대표 마감 외 다른 기한도 함께 표시되어야 한다."""
    di = {
        "has_deadline": True,
        "primary": {"iso": "2026-07-03", "label": "신청기한", "raw": "2026. 7. 3."},
        "deadlines": [
            {"iso": "2026-07-03", "label": "신청기한", "raw": "2026. 7. 3."},
            {"iso": "2026-07-21", "label": "제출기한", "raw": "2026. 7. 21."},
        ],
        "all_dates": [],
    }
    e = build_notebook_entry(_fn("연수 신청 및 결과 제출"), di,
                             "odt", True, "추출 성공", today=TODAY)
    assert len(e.other_deadlines) == 1
    assert e.other_deadlines[0]["iso"] == "2026-07-21"
