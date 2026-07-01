"""
MVP-4 (AI 요약·할일) — 선생님 PC에서 실제 Ollama로 검증하기

실행:
    python verify_ai.py "공문파일.hwp"      # 특정 공문으로
    python verify_ai.py                      # 예시 샘플로

준비 (선생님 PC, 딱 두 번):
    1) https://ollama.com 에서 Ollama 설치
    2) 터미널에서:  ollama pull qwen2.5:3b
    (Ollama 는 100% 로컬입니다. 공문이 PC 밖으로 나가지 않습니다.)

이 스크립트는 Ollama 가 켜져 있는지 먼저 확인하고, 실제로 요약·할일을
생성해 '근거표시'가 붙는지 눈으로 보여줍니다. 지어낸 내용은 근거로 즉시 발각됩니다.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.ai import OllamaClient, DEFAULT_MODEL
from src.extract import extract_file, _print_ai
from tests import fixtures


def main():
    model = os.environ.get("GMB_MODEL", DEFAULT_MODEL)
    client = OllamaClient(model=model)

    print("=" * 64)
    print(f"Ollama 상태 확인 (모델: {model})")
    print("=" * 64)
    if not client.is_available():
        print("✗ Ollama 가 실행되어 있지 않습니다.\n")
        print("준비 방법:")
        print("  1) https://ollama.com 에서 Ollama 설치")
        print("  2) 터미널:  ollama pull qwen2.5:3b")
        print("  3) 다시 이 스크립트 실행:  python verify_ai.py")
        return 1
    print("✓ Ollama 실행 중 — 실제 로컬 LLM 으로 요약합니다.\n")

    # 대상 파일: 인자로 받거나, 없으면 예시 샘플을 만들어 씀
    if len(sys.argv) > 1:
        path = sys.argv[1]
        if not os.path.isfile(path):
            print(f"✗ 파일을 찾을 수 없습니다:\n    {path}\n")
            print("확인하세요:")
            print("  · 그 공문 파일이 지금 이 폴더 안에 실제로 있는지")
            print("  · 파일 이름이 정확히 같은지 (띄어쓰기·괄호까지)")
            print("  · 팁: 파일 이름을 test.hwp 처럼 간단히 바꾼 뒤")
            print("        python verify_ai.py test.hwp  로 실행하면 쉽습니다.")
            print("  · 또는 파일 이름 없이  python verify_ai.py  만 실행하면 예시로 확인됩니다.")
            return 1
    else:
        # 운영체제에 맞는 임시 폴더에 예시 파일을 만듭니다 (윈도우/맥 모두 안전).
        import tempfile
        path = os.path.join(tempfile.gettempdir(), "gmb_ai_sample.hwpx")
        _make_sample(path)
        print(f"(예시 샘플로 진행합니다: {os.path.basename(path)})\n")

    result = extract_file(path, with_ai=True, ai_model=model)
    if not result.ok and not result.text:
        # 본문을 못 읽은 경우(이미지 PDF 등) 안내
        print(f"[안내] {result.message}")

    print("-" * 64)
    print(f"제목(규칙): {result.filename_info.get('title')}")
    di = result.deadline_info
    if di.get("has_deadline"):
        p = di["primary"]
        print(f"마감일(규칙): [{p['label']}] {p['raw']}   ← 규칙 추출이 정답")
    print("-" * 64)
    _print_ai(result.ai)
    print("-" * 64)
    print("확인 포인트: 각 항목에 [근거]가 붙었는지, 마감일·기관명을 지어내지 않았는지 보세요.")
    return 0


def _make_sample(path):
    """예시용 체육연수 공문(HWPX)을 만듭니다."""
    import zipfile
    section = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" '
        'xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">'
        '<hp:p><hp:run><hp:t>2026년 전국초등교원체육연수 운영 계획</hp:t></hp:run></hp:p>'
        '<hp:p><hp:run><hp:t>1. 목적: 초등교원의 체육 지도력 향상</hp:t></hp:run></hp:p>'
        '<hp:p><hp:run><hp:t>2. 기간: 2026. 7. 29.(수) ~ 7. 31.(금)</hp:t></hp:run></hp:p>'
        '<hp:p><hp:run><hp:t>3. 장소: 대한체육회 태릉선수촌</hp:t></hp:run></hp:p>'
        '<hp:p><hp:run><hp:t>4. 참가대상: 전국 초등교원 40명</hp:t></hp:run></hp:p>'
        '<hp:p><hp:run><hp:t>5. 신청기한: 2026. 7. 3.(금)까지 신청서 제출</hp:t></hp:run></hp:p>'
        '</hs:sec>'
    )
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("mimetype", "application/hwp+zip")
        z.writestr("Contents/section0.xml", section)


if __name__ == "__main__":
    raise SystemExit(main())
