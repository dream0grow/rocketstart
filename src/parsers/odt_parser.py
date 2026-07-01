"""
ODT 파서 — zip 안의 content.xml 에서 태그를 걷어내고 글자만 남깁니다.
(설계서 3장: 검증 완료 ✅)

ODT 파일의 정체:
    사실 ODT 는 여러 파일을 묶은 zip 꾸러미입니다.
    그 안의 'content.xml' 에 본문이 들어 있고, XML 태그(<...>)로 둘러싸여 있습니다.
    우리는 문단(<text:p>) 단위로 글자만 뽑아 줄바꿈으로 잇습니다.
"""

import zipfile
from xml.etree import ElementTree as ET

# ODT 본문에서 쓰이는 이름공간(namespace) 주소.
_TEXT_NS = "urn:oasis:names:tc:opendocument:xmlns:text:1.0"
_P_TAG = f"{{{_TEXT_NS}}}p"       # 문단
_H_TAG = f"{{{_TEXT_NS}}}h"       # 제목(heading)
_TAB_TAG = f"{{{_TEXT_NS}}}tab"   # 탭
_BR_TAG = f"{{{_TEXT_NS}}}line-break"  # 줄바꿈


def extract_odt(path: str) -> str:
    """ODT 파일에서 본문 텍스트를 뽑습니다."""
    with zipfile.ZipFile(path) as z:
        with z.open("content.xml") as f:
            tree = ET.parse(f)

    root = tree.getroot()

    lines = []
    # 문단과 제목 요소를 순서대로 돌며 그 안의 모든 글자를 모읍니다.
    for element in root.iter():
        if element.tag in (_P_TAG, _H_TAG):
            text = _collect_text(element)
            if text.strip():
                lines.append(text.strip())

    return "\n".join(lines).strip()


def _collect_text(element) -> str:
    """한 문단 요소 안에 흩어진 글자·탭·줄바꿈을 순서대로 모읍니다."""
    parts = []
    for node in element.iter():
        if node.tag == _TAB_TAG:
            parts.append("\t")
        elif node.tag == _BR_TAG:
            parts.append("\n")
        else:
            # 태그 사이(text)와 태그 뒤(tail)의 글자를 모두 담습니다.
            if node.text:
                parts.append(node.text)
        if node is not element and node.tail:
            parts.append(node.tail)
    return "".join(parts)
