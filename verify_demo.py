"""
MVP-1 눈으로 확인하기 (데모)

실행:  python verify_demo.py

이 스크립트는 5형식(PDF·HWP는 로직, HWPX·ODT·XLSX는 진짜 파일)의 샘플을
그때그때 만들어 실제 추출 코드를 돌려 결과를 보여줍니다.
→ "파일을 넣으면 이런 결과가 나온다"를 직접 확인하는 용도입니다.

⚠️ 여기 샘플은 자동 생성한 가짜 공문입니다. 진짜 검증은 아래 명령으로
   선생님의 실제 공문 파일에 돌려 보세요:
       python -m src.extract "실제공문.hwp"
"""

import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.extract import extract_file
from tests import fixtures


def show(title, path):
    print("\n" + "█" * 64)
    print("█ " + title)
    print("█" * 64)
    result = extract_file(path)

    info = result.filename_info
    print(f"[파일명] {os.path.basename(path)}")
    if info.get("matched"):
        print("[파일명에서 규칙으로 뽑은 정보]  ← AI 아님, 100% 정확")
        print(f"   발신기관 : {info.get('sender')}")
        print(f"   문서번호 : {info.get('doc_number')}")
        print(f"   제목     : {info.get('title')}")
    if result.ok:
        print(f"[본문 추출 성공]  글자 수 {result.char_count}")
        print("   ┌─ 뽑힌 본문 ─────────────────────────")
        for line in result.text.splitlines():
            print(f"   │ {line}")
        print("   └─────────────────────────────────────")
        # 마감일 추출 결과(MVP-2)도 함께 보여줍니다.
        di = result.deadline_info
        if di.get("has_deadline"):
            p = di["primary"]
            print(f"[마감일]  ★ [{p['label']}] {p['raw']}  ← 규칙으로 추출 (AI 아님)")
        elif di.get("all_dates"):
            print("[마감일]  (액션 기한 없음 — 참고/행사 날짜만 있음)")
    else:
        print(f"[안내] {result.message}")

    # 교무수첩 카드(MVP-3): 성격·D-day·업무유형
    card = result.notebook
    if card:
        dd = f" 《{card.get('d_day_text')}》" if card.get("deadline_iso") else ""
        print(f"[교무수첩] ▣ {card.get('category')} · {card.get('task_type')}"
              f" · 발신 {card.get('sender_level')}{dd}  → {card.get('placement')}")


def main():
    d = tempfile.mkdtemp(prefix="gmb_demo_")

    # 공문 규칙 파일명 + HWPX 본문
    p1 = os.path.join(d, "(무릉초등학교-2974 (첨부) 제주특별자치도교육청 체육건강과) 2026년 전국초등교원체육연수 계획.hwpx")
    fixtures.make_hwpx(p1)
    show("① HWPX (신형 한글) — 파일명 규칙 + 본문", p1)

    # ODT
    p2 = os.path.join(d, "(무릉초등학교-3010 (본문) 제주도교육청 초등교육과) 현장체험학습 운영계획.odt")
    fixtures.make_odt(p2)
    show("② ODT — 파일명 규칙 + 본문(탭 보존)", p2)

    # XLSX
    p3 = os.path.join(d, "학급별 신청 수합.xlsx")
    fixtures.make_xlsx(p3)
    show("③ XLSX (엑셀) — 시트/행/칸 → 텍스트", p3)

    # PDF (텍스트)
    p4 = os.path.join(d, "체육연수 계획.pdf")
    fixtures.make_pdf_text(p4, ["2026년 전국초등교원 체육연수 계획", "신청 기한: 2026. 7. 29.(수)", "장소: 태릉선수촌"])
    show("④ PDF (텍스트) — pdfplumber 추출", p4)

    # PDF (이미지) — 안내로 전환되는지
    p5 = os.path.join(d, "여름캠프 포스터.pdf")
    fixtures.make_pdf_image(p5)
    show("⑤ PDF (이미지 포스터) — 글자 없음 → 안내 처리", p5)

    print("\n" + "=" * 64)
    print("데모 끝. 진짜 검증은 선생님의 실제 공문으로:")
    print('   python -m src.extract "실제공문.hwp"')
    print("=" * 64)


if __name__ == "__main__":
    main()
