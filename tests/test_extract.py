"""전체 흐름 테스트 — extract_file() 하나로 파일명 정보 + 본문이 함께 나오는지."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.extract import extract_file
from tests import fixtures


def test_extract_hwpx_end_to_end(tmp_path):
    """공문 규칙 파일명 + HWPX 본문이 한 번에 추출되어야 한다."""
    name = "(무릉초등학교-2974 (첨부) 제주특별자치도교육청 체육건강과) 2026년 전국초등교원체육연수 계획.hwpx"
    p = str(tmp_path / name)
    fixtures.make_hwpx(p)

    result = extract_file(p)

    assert result.ok is True
    assert result.extension == "hwpx"
    # 파일명에서 규칙으로 뽑은 정보
    assert result.filename_info["sender"] == "제주특별자치도교육청 체육건강과"
    assert result.filename_info["doc_number"] == "2974"
    # 본문에서 뽑은 내용
    assert "체육연수" in result.text
    assert result.char_count > 0


def test_extract_xlsx(tmp_path):
    p = str(tmp_path / "수합.xlsx")
    fixtures.make_xlsx(p)
    result = extract_file(p)
    assert result.ok is True
    assert "신청현황" in result.text


def test_unsupported_extension(tmp_path):
    """지원하지 않는 형식은 친절한 안내와 함께 ok=False."""
    p = str(tmp_path / "메모.txt")
    with open(p, "w", encoding="utf-8") as f:
        f.write("아무 내용")
    result = extract_file(p)
    assert result.ok is False
    assert "지원하지 않는" in result.message


def test_missing_file():
    result = extract_file("/없는/파일.pdf")
    assert result.ok is False
    assert "찾을 수 없" in result.message


def test_image_pdf_is_guidance_not_crash(tmp_path):
    """이미지 PDF 는 크래시가 아니라 안내 메시지로 처리되어야 한다."""
    p = str(tmp_path / "포스터.pdf")
    fixtures.make_pdf_image(p)
    result = extract_file(p)
    assert result.ok is False
    assert "이미지" in result.message
