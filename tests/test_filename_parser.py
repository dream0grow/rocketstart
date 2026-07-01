"""파일명 파서 테스트 — 설계서의 실제 공문 파일명 예시로 검증."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.extractor import parse_filename


def test_real_official_filename():
    """설계서에 나온 실제 무릉초 공문 파일명을 정확히 분해해야 한다."""
    name = "(무릉초등학교-2974 (첨부) 제주특별자치도교육청 체육건강과) 2026년 전국초등교원체육연수 계획.hwp"
    r = parse_filename(name)

    assert r.matched is True
    assert r.recipient == "무릉초등학교"
    assert r.doc_number == "2974"
    assert r.kind == "첨부"
    assert r.sender == "제주특별자치도교육청 체육건강과"
    assert r.title == "2026년 전국초등교원체육연수 계획"
    assert r.extension == "hwp"


def test_bonmun_kind():
    """'본문' 종류도 인식해야 한다."""
    name = "(노형초등학교-101 (본문) 노형초등학교) 업무 협조 요청.hwpx"
    r = parse_filename(name)
    assert r.matched is True
    assert r.kind == "본문"
    assert r.sender == "노형초등학교"
    assert r.extension == "hwpx"


def test_path_is_stripped():
    """경로가 붙어 있어도 파일 이름만 보고 판단해야 한다."""
    name = "/home/user/download/(무릉초등학교-2974 (첨부) 제주도교육청) 제목.pdf"
    r = parse_filename(name)
    assert r.matched is True
    assert r.doc_number == "2974"
    assert r.extension == "pdf"


def test_non_official_filename():
    """규칙에 안 맞는 평범한 파일명은 제목/확장자만 뽑고 matched=False."""
    r = parse_filename("그냥_메모.xlsx")
    assert r.matched is False
    assert r.title == "그냥_메모"
    assert r.extension == "xlsx"
    assert r.sender is None


def test_title_with_dots():
    """제목 안에 점이 있어도 마지막 점을 확장자 구분으로 삼아야 한다."""
    name = "(무릉초-1 (본문) 교육청) 2026. 계획 안내.odt"
    r = parse_filename(name)
    assert r.matched is True
    assert r.title == "2026. 계획 안내"
    assert r.extension == "odt"
