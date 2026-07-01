"""
PDF 파서 — pdfplumber 로 텍스트를 읽습니다. (설계서 3장: 검증 완료 ✅)

주의 (설계서 부록):
    포스터·그림처럼 '이미지로만 된 PDF'는 글자가 없어 추출이 안 됩니다.
    MVP에서는 OCR을 넣지 않고, "이미지 PDF입니다. 원본을 확인하세요"라고
    안내만 합니다. (OCR은 2차 기능)
"""

import pdfplumber

# 이 정도 글자도 안 나오면 '이미지 PDF'로 판단합니다.
_MIN_TEXT_LENGTH = 10


def extract_pdf(path: str) -> str:
    """PDF 파일에서 텍스트를 뽑습니다. 이미지 PDF면 안내 문구를 돌려줍니다."""
    pages_text = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            if text.strip():
                pages_text.append(text)

    joined = "\n".join(pages_text).strip()

    if len(joined) < _MIN_TEXT_LENGTH:
        # 글자가 거의 없음 → 이미지 PDF로 간주 (OCR은 2차 기능)
        raise ImagePdfError(
            "이미지로 된 PDF입니다. 글자를 읽을 수 없어 원본을 직접 확인해 주세요. "
            "(글자 인식/OCR 기능은 다음 단계에서 추가됩니다)"
        )

    return joined


class ImagePdfError(Exception):
    """이미지로만 이루어져 텍스트를 뽑을 수 없는 PDF일 때 발생."""
    pass
