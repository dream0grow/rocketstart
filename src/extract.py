"""
텍스트 추출 총괄 (MVP-1의 입구)

역할:
    파일 1개를 받아 →
      ① 파일명에서 발신기관·문서번호·제목 등을 규칙으로 뽑고 (extractor)
      ② 확장자에 맞는 파서로 본문 텍스트를 뽑아 (parsers)
    하나의 결과로 묶어 돌려줍니다.

설계 원칙 (검증 완료):
    정확한 사실(발신기관·문서번호)은 '규칙'으로, 본문은 형식별 파서로.
    AI 는 이 단계에서 전혀 쓰지 않습니다. (환각 원천 차단)

명령줄 사용:
    python -m src.extract "공문파일.hwp"
    python -m src.extract "공문파일.pdf" --json
"""

import argparse
import json
import os
import sys
from dataclasses import dataclass, field, asdict
from typing import Optional

# 이 파일을 'python src/extract.py' 로 직접 실행할 때도 import 가 되도록 경로를 잡아줍니다.
if __package__ in (None, ""):
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from src.parsers import (
        extract_pdf, extract_xlsx, extract_xls, extract_odt, extract_hwpx, extract_hwp,
        ImagePdfError,
    )
    from src.extractor import parse_filename, ParsedFilename
else:
    from .parsers import (
        extract_pdf, extract_xlsx, extract_xls, extract_odt, extract_hwpx, extract_hwp,
        ImagePdfError,
    )
    from .extractor import parse_filename, ParsedFilename


# 확장자 → 어떤 파서를 쓸지 연결한 표.
_PARSERS = {
    "pdf": extract_pdf,
    "hwp": extract_hwp,
    "hwpx": extract_hwpx,
    "odt": extract_odt,
    "xlsx": extract_xlsx,
    "xls": extract_xls,    # 구형 이진 엑셀은 xlrd 로 (openpyxl 은 못 읽음)
}


@dataclass
class ExtractResult:
    """추출 결과 한 덩어리."""
    file_path: str
    extension: Optional[str] = None
    filename_info: dict = field(default_factory=dict)  # 파일명에서 뽑은 정보
    text: str = ""                                     # 본문 텍스트
    char_count: int = 0                                # 본문 글자 수
    ok: bool = False                                   # 성공 여부
    message: str = ""                                  # 실패/안내 메시지

    def to_dict(self) -> dict:
        return asdict(self)


def extract_file(path: str) -> ExtractResult:
    """파일 1개를 받아 파일명 정보 + 본문 텍스트를 뽑습니다."""
    if not os.path.isfile(path):
        return ExtractResult(
            file_path=path, ok=False,
            message=f"파일을 찾을 수 없습니다: {path}",
        )

    # ① 파일명 파싱 (규칙 기반, 항상 시도)
    fname = parse_filename(path)
    extension = fname.extension

    result = ExtractResult(
        file_path=path,
        extension=extension,
        filename_info=fname.to_dict(),
    )

    # ② 본문 파싱 (확장자에 맞는 파서 선택)
    parser = _PARSERS.get((extension or "").lower())
    if parser is None:
        result.ok = False
        result.message = (
            f"아직 지원하지 않는 형식입니다: .{extension} "
            f"(지원: pdf, hwp, hwpx, odt, xlsx)"
        )
        return result

    try:
        text = parser(path)
    except ImagePdfError as e:
        # 이미지 PDF: 실패가 아니라 '안내'로 취급합니다. (OCR 은 2차)
        result.ok = False
        result.message = str(e)
        return result
    except Exception as e:  # noqa: BLE001 - 사용자에게 친절한 메시지로 감싸 전달
        result.ok = False
        result.message = f"본문을 읽는 중 문제가 생겼습니다: {e}"
        return result

    result.text = text
    result.char_count = len(text)
    result.ok = True
    result.message = "추출 성공"
    return result


def _print_human(result: ExtractResult) -> None:
    """사람이 읽기 좋은 형태로 결과를 출력합니다."""
    info = result.filename_info
    print("=" * 60)
    print(f"파일: {os.path.basename(result.file_path)}")
    print(f"형식: {result.extension}")
    print("-" * 60)
    print("[파일명에서 뽑은 정보]  ※ 규칙 기반 — 정확")
    if info.get("matched"):
        print(f"  · 발신기관 : {info.get('sender')}")
        print(f"  · 문서번호 : {info.get('doc_number')}")
        print(f"  · 수신처   : {info.get('recipient')}")
        print(f"  · 본문/첨부: {info.get('kind')}")
        print(f"  · 제목     : {info.get('title')}")
    else:
        print("  (공문 파일명 규칙에 맞지 않아 제목만 추출)")
        print(f"  · 제목     : {info.get('title')}")
    print("-" * 60)
    if result.ok:
        print(f"[본문 텍스트]  글자 수: {result.char_count}")
        print()
        print(result.text)
    else:
        print(f"[안내] {result.message}")
    print("=" * 60)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description="공문 파일 1개에서 텍스트를 뽑습니다 (교무부장 도우미 MVP-1).",
    )
    parser.add_argument("path", help="공문 파일 경로 (pdf/hwp/hwpx/odt/xlsx)")
    parser.add_argument("--json", action="store_true", help="결과를 JSON 으로 출력")
    args = parser.parse_args(argv)

    result = extract_file(args.path)

    if args.json:
        print(json.dumps(result.to_dict(), ensure_ascii=False, indent=2))
    else:
        _print_human(result)

    return 0 if result.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
