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
    from src.extractor import (
        parse_filename, ParsedFilename, extract_deadlines, build_notebook_entry,
    )
    from src.ai import summarize
else:
    from .parsers import (
        extract_pdf, extract_xlsx, extract_xls, extract_odt, extract_hwpx, extract_hwp,
        ImagePdfError,
    )
    from .extractor import (
        parse_filename, ParsedFilename, extract_deadlines, build_notebook_entry,
    )
    from .ai import summarize


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
    deadline_info: dict = field(default_factory=dict)  # 마감일 추출 결과 (MVP-2)
    notebook: dict = field(default_factory=dict)       # 교무수첩 카드 (MVP-3)
    ai: dict = field(default_factory=dict)             # AI 요약·할일 제안 (MVP-4)
    ok: bool = False                                   # 성공 여부
    message: str = ""                                  # 실패/안내 메시지

    def to_dict(self) -> dict:
        return asdict(self)


def _sanitize(text: str) -> str:
    """짝 없는 서로게이트 등 깨진 글자를 제거합니다 (UTF-8 인코딩 안전)."""
    # encode 가 실패하는 문자만 골라 없앱니다.
    return text.encode("utf-8", "ignore").decode("utf-8")


def extract_file(path: str, with_ai: bool = False, ai_model: Optional[str] = None,
                 generate_fn=None) -> ExtractResult:
    """
    파일 1개를 받아 파일명·본문·마감일·교무수첩 카드를 뽑습니다.

    with_ai=True 이면 로컬 Ollama 로 요약·할일도 제안합니다(느릴 수 있음, 선택).
    generate_fn 을 주면 그 함수로 LLM 을 호출합니다(테스트용).
    """
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
        # 이미지 공문(포스터 등)도 교무수첩 카드는 만듭니다 → 보통 '배포형'.
        result.notebook = build_notebook_entry(
            result.filename_info, {}, extension, result.ok, result.message,
        ).to_dict()
        return result
    except Exception as e:  # noqa: BLE001 - 사용자에게 친절한 메시지로 감싸 전달
        result.ok = False
        result.message = f"본문을 읽는 중 문제가 생겼습니다: {e}"
        return result

    # 혹시 남아 있을 깨진 유니코드(외톨이 서로게이트)를 제거 → JSON/화면 출력 안전.
    text = _sanitize(text)

    result.text = text
    result.char_count = len(text)

    # ③ 마감일 추출 (MVP-2, 규칙 기반) — 본문에서 날짜를 뽑아 성격을 가립니다.
    deadlines = extract_deadlines(text)
    result.deadline_info = deadlines.to_dict()

    result.ok = True
    result.message = "추출 성공"

    # ④ 교무수첩 카드 생성 (MVP-3) — 제목·발신·마감·성격을 한 카드로.
    result.notebook = build_notebook_entry(
        result.filename_info, result.deadline_info, extension, result.ok, result.message,
    ).to_dict()

    # ⑤ AI 요약·할일 제안 (MVP-4, 선택) — 로컬 Ollama. 규칙 결과와 별개의 '참고 제안'.
    if with_ai or generate_fn is not None:
        title = (result.filename_info or {}).get("title") or ""
        kwargs = {"title": title, "generate_fn": generate_fn}
        if ai_model:
            kwargs["model"] = ai_model
        result.ai = summarize(text, **kwargs).to_dict()

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
    if result.notebook:
        _print_notebook_card(result.notebook)
        print("-" * 60)
    if result.ok:
        _print_deadlines(result.deadline_info)
        print("-" * 60)
        if result.ai:
            _print_ai(result.ai)
            print("-" * 60)
        print(f"[본문 텍스트]  글자 수: {result.char_count}")
        print()
        print(result.text)
    else:
        print(f"[안내] {result.message}")
    print("=" * 60)


def _print_ai(ai: dict) -> None:
    """AI 요약·할일 제안을 출력합니다 (MVP-4)."""
    print("[AI 제안]  ⚠ " + ai.get("notice", ""))
    if not ai.get("available"):
        print(f"  · {ai.get('message', 'AI 사용 불가')}")
        return
    print(f"  · 모델: {ai.get('model')}")
    if ai.get("summary"):
        print(f"  · 한 줄 요약: {ai['summary']}")
        if ai.get("summary_evidence"):
            print(f"      [근거: {ai['summary_evidence']}]")
    tasks = ai.get("tasks", [])
    if tasks:
        print("  · 해야 할 일(제안):")
        for i, t in enumerate(tasks, 1):
            print(f"      {i}. {t.get('text')}")
            if t.get("evidence"):
                print(f"         [근거: {t['evidence']}]")
    if ai.get("message"):
        print(f"  · 참고: {ai['message']}")


def _print_notebook_card(card: dict) -> None:
    """교무수첩 카드를 사람이 읽기 좋게 출력합니다 (MVP-3)."""
    print("[교무수첩 카드]  ※ 성격·D-day 는 규칙 자동분류 — 부장이 조정 가능")
    print(f"  · 제목     : {card.get('title')}")
    print(f"  · 발신기관 : {card.get('sender')}  ({card.get('sender_level')})")
    print(f"  · 문서번호 : {card.get('doc_number')}")
    print(f"  · 공문성격 : ▣ {card.get('category')}  → {card.get('placement')}")
    print(f"               ({card.get('category_reason')})")
    print(f"  · 업무유형 : {card.get('task_type')}")
    if card.get("deadline_iso"):
        dtext = card.get("d_day_text", "")
        print(f"  · 마감일   : [{card.get('deadline_label')}] "
              f"{card.get('deadline_raw')}  《{dtext}》")
        for od in card.get("other_deadlines", []):
            print(f"               + [{od.get('label')}] {od.get('raw')}")
    else:
        print("  · 마감일   : 없음 (기한 없는 공문)")
    if card.get("is_image"):
        print("  · 비고     : 이미지 공문(포스터 등) — 본문·요약 불가, 원본 확인")


def _meaningful_reference_dates(all_dates: list) -> list:
    """참고 날짜 중 사람에게 의미있는 것만 (문서 처리일 노이즈 제외, iso 중복 제거)."""
    hidden_keywords = {"문서처리일", "기간시작"}
    seen = set()
    out = []
    for d in all_dates:
        if d["is_deadline"]:
            continue
        if d.get("keyword") in hidden_keywords:
            continue
        if d["iso"] in seen:
            continue
        seen.add(d["iso"])
        out.append(d)
    return out


def _print_deadlines(info: dict) -> None:
    """마감일 추출 결과를 사람이 읽기 좋게 출력합니다 (MVP-2)."""
    print("[마감일]  ※ 규칙 기반 — 날짜는 코드로, 사람이 확인")
    if not info.get("has_deadline"):
        refs = _meaningful_reference_dates(info.get("all_dates", []))
        if refs:
            print("  (액션 기한 없음 — 아래는 참고 날짜)")
            for d in refs:
                print(f"    · [{d['label']}] {d['raw']}  (근거: '{d.get('keyword')}')")
        else:
            print("  (기한 없는 참고/규정/배포성 공문으로 보임 — 마감일 없음)")
        return

    primary = info.get("primary")
    if primary:
        print(f"  ★ 대표 마감: [{primary['label']}] {primary['raw']}  ← 가장 이른 기한")
    print("  · 발견된 기한(이른 순):")
    for d in info.get("deadlines", []):
        star = " ★" if primary and d["iso"] == primary["iso"] else ""
        print(f"      [{d['label']}] {d['raw']}{star}  (근거: '{d.get('keyword')}')")
    # 행사일 등 '마감 아닌 의미있는 날짜'만 함께 보여줍니다 (설계서: 날짜 2개 함정 방지).
    # 문서 처리일(시행·접수) 같은 라우팅 메타데이터는 노이즈라 숨깁니다.
    others = _meaningful_reference_dates(info.get("all_dates", []))
    if others:
        print("  · 참고 날짜(행사일 등, 마감 아님):")
        for d in others:
            print(f"      [{d['label']}] {d['raw']}  (근거: '{d.get('keyword')}')")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description="공문 파일 1개에서 텍스트·마감일·교무수첩 카드를 뽑습니다 (교무부장 도우미).",
    )
    parser.add_argument("path", help="공문 파일 경로 (pdf/hwp/hwpx/odt/xlsx/xls)")
    parser.add_argument("--json", action="store_true", help="결과를 JSON 으로 출력")
    parser.add_argument("--ai", action="store_true",
                        help="로컬 Ollama 로 요약·할일도 제안 (Ollama 실행 필요, 느릴 수 있음)")
    parser.add_argument("--model", default=None,
                        help="AI 모델 이름 (기본 qwen2.5:3b)")
    args = parser.parse_args(argv)

    result = extract_file(args.path, with_ai=args.ai, ai_model=args.model)

    if args.json:
        print(json.dumps(result.to_dict(), ensure_ascii=False, indent=2))
    else:
        _print_human(result)

    return 0 if result.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
