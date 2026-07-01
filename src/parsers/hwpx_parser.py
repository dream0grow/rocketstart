"""
HWPX(신형 한글) 파서 — zip 안의 section*.xml 에서 <hp:t> 글자만 뽑습니다.
(설계서 3장: 검증 완료 ✅ — "깔끔하게 추출됨")

HWPX 파일의 정체:
    ODT 처럼 zip 꾸러미입니다. 본문은 'Contents/section0.xml, section1.xml ...'
    안에 들어 있고, 실제 글자는 <hp:t> ... </hp:t> 태그 사이에 있습니다.
"""

import re
import zipfile
from xml.etree import ElementTree as ET

# 본문 section 파일 경로를 알아보는 규칙 (Contents/section0.xml 등)
_SECTION_RE = re.compile(r"(^|/)section\d+\.xml$", re.IGNORECASE)

# 글자가 담기는 태그 이름. HWPX 의 이름공간이 버전마다 달라질 수 있어
# 태그의 '끝부분'이 't' 인지로 느슨하게 확인합니다. (예: {..hml..}t)
def _is_text_tag(tag: str) -> bool:
    return tag.rsplit("}", 1)[-1] == "t"


def extract_hwpx(path: str) -> str:
    """HWPX 파일에서 본문 텍스트를 뽑습니다."""
    with zipfile.ZipFile(path) as z:
        # section 파일들을 번호 순서대로 정렬합니다. (section0, section1, ...)
        section_names = sorted(
            (n for n in z.namelist() if _SECTION_RE.search(n)),
            key=_section_sort_key,
        )

        paragraphs = []
        for name in section_names:
            with z.open(name) as f:
                root = ET.parse(f).getroot()
            for element in root.iter():
                if _is_text_tag(element.tag):
                    # <hp:t> 안의 글자(자식 태그에 흩어진 것 포함)를 모읍니다.
                    text = "".join(element.itertext())
                    if text.strip():
                        paragraphs.append(text)

    return "\n".join(paragraphs).strip()


def _section_sort_key(name: str):
    """'section12.xml' 에서 숫자 12 를 뽑아 정렬 기준으로 씁니다."""
    m = re.search(r"section(\d+)\.xml$", name, re.IGNORECASE)
    return int(m.group(1)) if m else 0
