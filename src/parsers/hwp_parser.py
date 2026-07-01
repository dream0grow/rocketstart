"""
HWP(구형 5.0) 파서 — 가장 까다로운 형식. (설계서 3장: 검증 완료 ✅)

방법 (설계서에 확정된 것):
    olefile + zlib + 레코드 파싱(tag 67 = PARA_TEXT) + 노이즈 필터

HWP 5.0 파일의 정체 (조금 어렵습니다):
    - 옛 MS 오피스처럼 여러 '저장 공간(stream)'을 담은 꾸러미(OLE)입니다.
    - 본문은 'BodyText/Section0, Section1 ...' 저장 공간에 들어 있습니다.
    - 이 내용은 보통 zlib 으로 '압축'되어 있어 먼저 풀어야 합니다.
    - 푼 내용은 '레코드(record)'들의 연속입니다. 각 레코드 앞에는
      4바이트 머리표(tag/level/size)가 붙습니다.
    - 우리가 원하는 글자는 tag 번호 67(PARA_TEXT) 레코드 안에 UTF-16 으로 있습니다.
    - 글자 사이에 '조판 제어문자'(표/그림/각주 표시용 특수코드)가 섞여 있어 걸러냅니다.
"""

import struct
import zlib

import olefile

# 우리가 찾는 문단 텍스트 레코드의 태그 번호.
#   HWPTAG_BEGIN(0x10=16) + 51 = 67
HWPTAG_PARA_TEXT = 67

# HWP 조판 제어문자 분류 (UTF-16 코드값 기준).
#   - 이 코드들은 '글자'가 아니라 표/그림/각주 등을 가리키는 표시입니다.
#   - '확장·인라인' 제어문자는 자기 자신 포함 8글자(16바이트)를 통째로 차지합니다.
#   - '문자' 제어문자는 1글자만 차지합니다.
_INLINE_CONTROLS = {4, 5, 6, 7, 8, 9, 19, 20}
_EXTENDED_CONTROLS = {1, 2, 3, 11, 12, 14, 15, 16, 17, 18, 21, 22, 23}
_CHAR_CONTROLS = {0, 10, 13, 24, 25, 26, 27, 28, 29, 30, 31}


def extract_hwp(path: str) -> str:
    """HWP 5.0 파일에서 본문 텍스트를 뽑고 노이즈를 걸러 돌려줍니다."""
    if not olefile.isOleFile(path):
        raise ValueError(
            "한글(HWP) 5.0 형식이 아닙니다. 아주 옛날 버전이거나 손상된 파일일 수 있습니다."
        )

    ole = olefile.OleFileIO(path)
    try:
        compressed = _is_compressed(ole)
        section_paths = _find_body_sections(ole)

        paragraphs = []
        for entry in section_paths:
            raw = ole.openstream(entry).read()
            data = _maybe_decompress(raw, compressed)
            paragraphs.extend(_read_paragraphs(data))
    finally:
        ole.close()

    text = "\n".join(paragraphs)
    return _filter_noise(text)


def _is_compressed(ole: "olefile.OleFileIO") -> bool:
    """FileHeader 를 보고 본문이 압축되어 있는지 확인합니다."""
    header = ole.openstream("FileHeader").read()
    # 36번째 바이트부터 4바이트가 속성 플래그. 그 0번 비트가 '압축' 여부.
    properties = struct.unpack("<I", header[36:40])[0]
    return bool(properties & 0x01)


def _find_body_sections(ole: "olefile.OleFileIO") -> list:
    """BodyText 아래의 Section0, Section1 ... 을 번호 순서대로 찾습니다."""
    sections = []
    for entry in ole.listdir():
        # entry 예: ['BodyText', 'Section0']
        if len(entry) == 2 and entry[0] == "BodyText" and entry[1].startswith("Section"):
            sections.append(entry)

    def sort_key(entry):
        digits = "".join(ch for ch in entry[1] if ch.isdigit())
        return int(digits) if digits else 0

    return sorted(sections, key=sort_key)


def _maybe_decompress(raw: bytes, compressed: bool) -> bytes:
    """필요하면 zlib 압축을 풉니다. (HWP 는 머리글 없는 raw deflate → wbits=-15)"""
    if not compressed:
        return raw
    return zlib.decompress(raw, -15)


def _read_paragraphs(data: bytes) -> list:
    """
    한 Section 의 바이트 뭉치를 레코드 단위로 훑으며
    PARA_TEXT(태그 67) 안의 글자를 뽑아 문단 리스트로 만듭니다.
    """
    paragraphs = []
    pos = 0
    size = len(data)

    while pos + 4 <= size:
        # 4바이트 머리표를 읽어 tag / level / 데이터길이 를 풉니다.
        header = struct.unpack("<I", data[pos:pos + 4])[0]
        pos += 4
        tag_id = header & 0x3FF            # 아래 10비트 = 태그 번호
        data_len = (header >> 20) & 0xFFF  # 위 12비트 = 데이터 길이

        # 길이가 0xFFF(4095)면 "진짜 길이는 다음 4바이트에 있다"는 신호.
        if data_len == 0xFFF:
            if pos + 4 > size:
                break
            data_len = struct.unpack("<I", data[pos:pos + 4])[0]
            pos += 4

        if pos + data_len > size:
            break

        chunk = data[pos:pos + data_len]
        pos += data_len

        if tag_id == HWPTAG_PARA_TEXT:
            paragraphs.append(_decode_para_text(chunk))

    return paragraphs


def _decode_para_text(chunk: bytes) -> str:
    """
    PARA_TEXT 조각(UTF-16 글자들 + 제어문자)에서 진짜 글자만 골라냅니다.
    제어문자는 종류에 따라 1글자 또는 8글자를 건너뜁니다.
    """
    out = []
    i = 0
    n = len(chunk)

    while i + 2 <= n:
        code = struct.unpack("<H", chunk[i:i + 2])[0]

        if code in _INLINE_CONTROLS or code in _EXTENDED_CONTROLS:
            # 이런 제어문자는 자기 포함 8글자(16바이트)를 통째로 차지 → 건너뜀
            i += 16
            continue
        if code in _CHAR_CONTROLS:
            # 문단 안 줄바꿈(10,13 등)만 살려 두고 나머지는 버립니다.
            if code in (10, 13):
                out.append("\n")
            i += 2
            continue

        # BMP 밖 글자(이모지 등)는 UTF-16 에서 '서로게이트 쌍'(2개 코드)으로 옵니다.
        # 높은 서로게이트면 다음 낮은 서로게이트와 합쳐 한 글자로 만듭니다.
        if 0xD800 <= code <= 0xDBFF:
            if i + 4 <= n:
                low = struct.unpack("<H", chunk[i + 2:i + 4])[0]
                if 0xDC00 <= low <= 0xDFFF:
                    combined = 0x10000 + ((code - 0xD800) << 10) + (low - 0xDC00)
                    out.append(chr(combined))
                    i += 4
                    continue
            # 짝이 없는 외톨이 서로게이트 → 깨진 글자이므로 버립니다.
            i += 2
            continue
        if 0xDC00 <= code <= 0xDFFF:
            # 짝 없는 낮은 서로게이트도 버립니다.
            i += 2
            continue

        # 평범한 글자.
        out.append(chr(code))
        i += 2

    return "".join(out).strip()


def _filter_noise(text: str) -> str:
    """
    노이즈 필터 (설계서: "한글/숫자 없는 라틴 덩어리 라인 제거").

    구형 HWP 를 풀면 폰트 이름·내부 코드 같은 '라틴 문자 쓰레기 줄'이 섞여 나옵니다.
    한글도 숫자도 전혀 없이 라틴 알파벳·기호로만 된 줄은 지웁니다.
    """
    kept = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        # 한글 또는 숫자가 하나라도 있으면 '진짜 내용'으로 보고 남깁니다.
        if _has_hangul_or_digit(stripped):
            kept.append(stripped)
    return "\n".join(kept).strip()


def _has_hangul_or_digit(text: str) -> bool:
    """한글 음절/자모 또는 숫자가 하나라도 들어 있으면 True."""
    for ch in text:
        if ch.isdigit():
            return True
        code = ord(ch)
        # 한글 음절(가~힣), 한글 자모, 호환 자모 범위
        if 0xAC00 <= code <= 0xD7A3 or 0x1100 <= code <= 0x11FF or 0x3130 <= code <= 0x318F:
            return True
    return False
