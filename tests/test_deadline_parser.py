"""
마감일 추출기 테스트 (MVP-2)

설계서에서 확정된 핵심 시나리오로 검증합니다.
특히 '날짜 2개 함정'(신청기한 vs 행사일)을 제대로 가리는지가 중요합니다.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.extractor import extract_deadlines
from src.extractor.deadline_parser import (
    LABEL_APPLY, LABEL_SUBMIT, LABEL_EVENT, LABEL_DEADLINE,
)


def test_single_application_deadline():
    """'신청' 근처 날짜는 신청기한으로, 마감일로 잡혀야 한다."""
    text = "붙임 서류를 갖추어 2026. 3. 6.까지 신청하시기 바랍니다."
    r = extract_deadlines(text)
    assert r.has_deadline is True
    assert r.primary.iso == "2026-03-06"
    assert r.primary.is_deadline is True


def test_two_date_trap():
    """★핵심★ 연수일(행사) vs 신청기한(마감)을 구분해야 한다.

    설계서 검증에서 3b가 실패한 바로 그 함정.
    연수일 3.10 은 행사일, 신청기한 3.6 이 진짜 마감이어야 한다.
    """
    text = (
        "2026 학교생활기록부 기재요령 안내 연수\n"
        "연수 일시: 2026. 3. 10.(화)\n"
        "신청 기한: 2026. 3. 6.(금)까지 제출\n"
    )
    r = extract_deadlines(text)

    # 대표 마감은 신청기한 3.6 이어야 함 (행사일 3.10 이 아니라!)
    assert r.primary is not None
    assert r.primary.iso == "2026-03-06"

    # 3.10 은 행사일로 분류되어 마감일 목록에는 없어야 함
    iso_of_deadlines = [d.iso for d in r.deadlines]
    assert "2026-03-06" in iso_of_deadlines
    assert "2026-03-10" not in iso_of_deadlines

    # 3.10 은 전체 날짜에는 있고, 행사일 라벨이어야 함
    event = [d for d in r.all_dates if d.iso == "2026-03-10"][0]
    assert event.label == LABEL_EVENT
    assert event.is_deadline is False


def test_earliest_is_primary():
    """마감일이 여러 개면 가장 이른 것이 대표 마감이어야 한다."""
    text = "1차 제출 2026. 5. 20. / 2차 제출 2026. 4. 10. / 최종 접수 2026. 6. 1."
    r = extract_deadlines(text)
    assert r.primary.iso == "2026-04-10"
    assert len(r.deadlines) == 3


def test_event_only_no_deadline():
    """행사일만 있고 액션 기한이 없으면 마감일 없음으로 처리."""
    text = "행사 일시: 2026. 9. 1. 장소: 강당. 많은 참여 바랍니다."
    r = extract_deadlines(text)
    assert r.has_deadline is False
    assert len(r.all_dates) == 1
    assert r.all_dates[0].label == LABEL_EVENT


def test_no_date_reference_document():
    """날짜 없는 규정/참고성 공문은 날짜 0개, 마감 없음."""
    text = "통학구역 안내입니다. 관련 규정을 숙지하시기 바랍니다."
    r = extract_deadlines(text)
    assert r.has_deadline is False
    assert r.all_dates == []


def test_korean_date_format():
    """'2026년 7월 29일' 한글 날짜 형식도 인식해야 한다."""
    text = "2026년 7월 29일까지 제출 바랍니다."
    r = extract_deadlines(text)
    assert r.has_deadline is True
    assert r.primary.iso == "2026-07-29"


def test_invalid_date_ignored():
    """13월·32일 같은 잘못된 날짜는 무시해야 한다."""
    text = "문서번호 2026. 13. 40. 참조. 실제 제출 2026. 7. 1.까지."
    r = extract_deadlines(text)
    isos = [d.iso for d in r.all_dates]
    assert "2026-07-01" in isos
    assert all(not i.startswith("2026-13") for i in isos)


def test_date_range_is_event():
    """'기간: 2026. 7. 29. ~ 7. 31.' 처럼 기간은 행사일(참고)로 본다."""
    text = "연수 기간: 2026. 7. 29.(수) ~ 7. 31.(금) 2박 3일"
    r = extract_deadlines(text)
    # 기간 문맥 → 행사일. 마감일로 잡히면 안 됨.
    assert r.has_deadline is False
    labels = {d.label for d in r.all_dates}
    assert LABEL_EVENT in labels


def test_submission_label():
    """'제출/회신' 근처는 제출기한 라벨."""
    text = "결과를 2026. 8. 15.까지 회신하여 주시기 바랍니다."
    r = extract_deadlines(text)
    assert r.primary.label == LABEL_SUBMIT


def test_application_period_range_end_is_deadline():
    """★'신청기간: A ~ B'는 끝(B)이 마감이어야 한다 (연도 생략된 끝도 인식)."""
    text = "바. 신청기간: 2026. 6. 26.(금) ~ 7. 7.(화) 17:00"
    r = extract_deadlines(text)
    assert r.has_deadline is True
    # 끝 날짜 7.7 이 대표 마감 (시작 6.26 이 아니라)
    assert r.primary.iso == "2026-07-07"
    assert r.primary.label == LABEL_APPLY
    # 시작 6.26 은 참고(기간 시작)로, 마감 아님
    start = [d for d in r.all_dates if d.iso == "2026-06-26"][0]
    assert start.is_deadline is False


def test_document_routing_date_not_deadline():
    """★공문 푸터의 시행일/접수일(기관명-번호 뒤 날짜)은 마감이 아니어야 한다."""
    text = "시행 중등교육과-12985(2026. 6. 29.)접수 무릉초등학교-3015(2026. 6. 29.)"
    r = extract_deadlines(text)
    assert r.has_deadline is False
    # 날짜는 잡히되 모두 참고로
    assert all(not d.is_deadline for d in r.all_dates)


def test_event_period_range_not_deadline():
    """'연수 기간: A ~ B'는 액션어가 없으므로 둘 다 행사일(참고)."""
    text = "연수 기간: 2026. 7. 29.(수) ~ 7. 31.(금)"
    r = extract_deadlines(text)
    assert r.has_deadline is False
    isos = sorted(d.iso for d in r.all_dates)
    assert isos == ["2026-07-29", "2026-07-31"]  # 끝 날짜도 인식됨
    assert all(d.label == LABEL_EVENT for d in r.all_dates)
