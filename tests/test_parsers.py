"""형식별 파서 테스트 — 진짜 샘플 파일을 만들어 추출 결과를 확인."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

from src.parsers import extract_xlsx, extract_xls, extract_odt, extract_hwpx, extract_pdf, ImagePdfError
from tests import fixtures


def test_xls_old_binary(tmp_path):
    """구형 이진 .xls 도 xlrd 로 읽혀야 한다 (실제 공문에 섞여 옴)."""
    p = str(tmp_path / "구형.xls")
    fixtures.make_xls(p)
    text = extract_xls(p)

    assert "참가신청" in text     # 시트 이름
    assert "무릉초" in text
    assert "3" in text            # 정수는 3.0 이 아니라 3 으로
    assert "3.0" not in text


def test_xlsx(tmp_path):
    p = str(tmp_path / "sample.xlsx")
    fixtures.make_xlsx(p)
    text = extract_xlsx(p)

    assert "신청현황" in text      # 시트 이름
    assert "3-1" in text
    assert "27" in text           # 숫자도 문자열로
    assert "집계" in text          # 두 번째 시트
    # 완전히 빈 행은 들어가지 않아야 함 → 연속 줄바꿈이 과하지 않아야
    assert "\n\n\n" not in text


def test_odt(tmp_path):
    p = str(tmp_path / "sample.odt")
    fixtures.make_odt(p)
    text = extract_odt(p)

    assert "현장체험학습 운영계획" in text   # 제목(heading)
    assert "학생 안전 확보" in text
    assert "\t" in text                      # 탭이 보존됨
    assert "2026. 3. 6." in text


def test_hwpx(tmp_path):
    p = str(tmp_path / "sample.hwpx")
    fixtures.make_hwpx(p)
    text = extract_hwpx(p)

    assert "2026년 전국초등교원체육연수 계획" in text
    assert "2026. 7. 29." in text


def test_pdf_text(tmp_path):
    p = str(tmp_path / "sample.pdf")
    fixtures.make_pdf_text(p, ["공문 제목 테스트", "신청 기한 2026. 7. 29."])
    text = extract_pdf(p)

    assert "공문 제목 테스트" in text
    assert "2026" in text


def test_pdf_image_raises(tmp_path):
    """글자 없는 이미지 PDF 는 안내용 예외를 던져야 한다."""
    p = str(tmp_path / "image.pdf")
    fixtures.make_pdf_image(p)
    with pytest.raises(ImagePdfError):
        extract_pdf(p)
