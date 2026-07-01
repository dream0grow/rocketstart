"""
HWP(구형) 해독 로직 단위 테스트.

HWP 파일 전체(OLE+zlib)를 코드로 만들긴 어려워서,
가장 핵심인 '레코드 해독'과 '노이즈 필터' 로직을 직접 검증합니다.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.parsers.hwp_parser import (
    _read_paragraphs, _decode_para_text, _filter_noise, _has_hangul_or_digit,
)
from tests import fixtures


def test_read_paragraphs_plain():
    """PARA_TEXT 레코드 안의 한글이 그대로 나와야 한다."""
    data = fixtures.build_para_text_record("연수 신청 안내")
    paras = _read_paragraphs(data)
    assert paras == ["연수 신청 안내"]


def test_read_paragraphs_skips_control_chars():
    """확장 제어문자(표/그림 표시)는 8글자를 건너뛰고 진짜 글자만 남겨야 한다."""
    data = fixtures.build_para_text_record("마감 2026", with_controls=True)
    paras = _read_paragraphs(data)
    assert paras == ["마감 2026"]


def test_multiple_records():
    """여러 문단 레코드를 이어서 읽을 수 있어야 한다."""
    data = (
        fixtures.build_para_text_record("첫째 줄")
        + fixtures.build_para_text_record("둘째 줄 2026")
    )
    paras = _read_paragraphs(data)
    assert paras == ["첫째 줄", "둘째 줄 2026"]


def test_filter_noise_removes_latin_junk():
    """한글/숫자 없는 라틴 쓰레기 줄은 지워야 한다. (설계서 노이즈 필터)"""
    text = "HYGothic-Medium\nAdobePiStd\n연수 신청 안내\n2026 계획\n\n!!!###"
    cleaned = _filter_noise(text)
    lines = cleaned.splitlines()
    assert "연수 신청 안내" in lines
    assert "2026 계획" in lines
    assert "HYGothic-Medium" not in lines
    assert "AdobePiStd" not in lines
    assert "!!!###" not in lines


def test_has_hangul_or_digit():
    assert _has_hangul_or_digit("안녕") is True
    assert _has_hangul_or_digit("2026") is True
    assert _has_hangul_or_digit("abc-DEF") is False
    assert _has_hangul_or_digit("ㄱㄴㄷ") is True   # 자모도 한글로 인정
