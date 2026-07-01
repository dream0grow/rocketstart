"""
테스트용 샘플 공문 파일을 코드로 만들어 주는 도우미.

실제 공문에는 개인정보가 있어 저장소에 넣지 않습니다(보안 원칙).
대신 각 형식의 '진짜 파일'을 테스트 순간에 만들어 파서를 검증합니다.
"""

import struct
import zipfile
import zlib


def make_xlsx(path: str) -> None:
    """openpyxl 로 시트 2개짜리 엑셀 샘플을 만듭니다."""
    import openpyxl

    wb = openpyxl.Workbook()
    ws1 = wb.active
    ws1.title = "신청현황"
    ws1.append(["학급", "인원", "비고"])
    ws1.append(["3-1", 25, "완료"])
    ws1.append([None, None, None])   # 빈 줄은 걸러져야 함
    ws1.append(["5-2", 27, ""])

    ws2 = wb.create_sheet("집계")
    ws2.append(["합계", 52])

    wb.save(path)


def make_xls(path: str) -> None:
    """xlwt 로 구형 이진 .xls 샘플을 만듭니다."""
    import xlwt

    wb = xlwt.Workbook()
    ws = wb.add_sheet("참가신청")
    rows = [
        ["학교명", "신청 인원", "종목"],
        ["무릉초", 3, "축구"],
        ["노형초", 5, "농구"],
    ]
    for r, row in enumerate(rows):
        for c, value in enumerate(row):
            ws.write(r, c, value)
    wb.save(path)


def make_odt(path: str) -> None:
    """최소 구조의 ODT(zip + content.xml) 샘플을 만듭니다."""
    content = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<office:document-content '
        'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" '
        'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">'
        '<office:body><office:text>'
        '<text:h>현장체험학습 운영계획</text:h>'
        '<text:p>가. 목적: 학생 안전 확보<text:tab/>끝.</text:p>'
        '<text:p>나. 신청 기한: 2026. 3. 6.</text:p>'
        '<text:p></text:p>'
        '</office:text></office:body></office:document-content>'
    )
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        # mimetype 은 압축 없이 맨 앞에 두는 것이 규칙이지만, 파싱에는 영향 없음
        z.writestr("mimetype", "application/vnd.oasis.opendocument.text")
        z.writestr("content.xml", content)


def make_hwpx(path: str) -> None:
    """최소 구조의 HWPX(zip + Contents/section0.xml) 샘플을 만듭니다."""
    section = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" '
        'xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">'
        '<hp:p><hp:run><hp:t>2026년 전국초등교원체육연수 계획</hp:t></hp:run></hp:p>'
        '<hp:p><hp:run><hp:t>신청 기한: 2026. 7. 29.(수)</hp:t></hp:run></hp:p>'
        '</hs:sec>'
    )
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("mimetype", "application/hwp+zip")
        z.writestr("Contents/section0.xml", section)


def make_pdf_text(path: str, text_lines) -> None:
    """reportlab 로 한글 텍스트가 들어간 진짜 PDF 를 만듭니다."""
    from reportlab.pdfgen import canvas
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.cidfonts import UnicodeCIDFont

    pdfmetrics.registerFont(UnicodeCIDFont("HYSMyeongJo-Medium"))
    c = canvas.Canvas(path)
    c.setFont("HYSMyeongJo-Medium", 12)
    y = 800
    for line in text_lines:
        c.drawString(50, y, line)
        y -= 20
    c.showPage()
    c.save()


def make_pdf_image(path: str) -> None:
    """글자가 전혀 없는(그림만 있는) PDF 를 만듭니다 → 이미지 PDF 로 판정되어야 함."""
    from reportlab.pdfgen import canvas

    c = canvas.Canvas(path)
    c.rect(100, 100, 200, 200, fill=1)   # 사각형 하나만, 글자 없음
    c.showPage()
    c.save()


def build_para_text_record(text: str, with_controls: bool = False) -> bytes:
    """
    HWP 의 PARA_TEXT(태그 67) 레코드 하나를 손으로 만들어 줍니다.
    (HWP 파일 전체를 만들긴 어려워, 파서의 '해독 로직'만 이 바이트로 검증)
    """
    payload = bytearray()
    if with_controls:
        # 확장 제어문자(코드 2) 하나 = 자기 포함 8글자(16바이트) → 걸러져야 함
        payload += struct.pack("<H", 2)
        payload += b"\x00" * 14  # 나머지 7글자(14바이트) 채움

    payload += text.encode("utf-16-le")

    tag_id = 67
    level = 0
    size = len(payload)
    header = (tag_id & 0x3FF) | ((level & 0x3FF) << 10) | ((size & 0xFFF) << 20)
    return struct.pack("<I", header) + bytes(payload)
