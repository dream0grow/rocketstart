"""
XLSX(엑셀) 파서 — openpyxl 로 표의 내용을 읽습니다. (설계서 3장: 검증 완료 ✅)

표는 '줄글'이 아니라 칸(셀)으로 되어 있으므로,
한 줄 = 한 행(row), 칸 사이는 탭으로 이어 붙여 사람이 읽기 좋게 만듭니다.
시트가 여러 개면 시트 이름을 제목처럼 앞에 붙입니다.
"""

import openpyxl


def extract_xlsx(path: str) -> str:
    """엑셀 파일의 모든 시트를 훑어 텍스트로 만듭니다."""
    # data_only=True → 수식 대신 계산된 '값'을 읽습니다.
    #   (예: '=A1+B1' 이 아니라 그 결과 숫자를 읽음)
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)

    blocks = []
    for sheet in wb.worksheets:
        lines = [f"[시트: {sheet.title}]"]
        for row in sheet.iter_rows(values_only=True):
            # 빈 칸은 건너뛰고, 값이 있는 칸만 탭으로 이어 붙입니다.
            cells = ["" if v is None else str(v) for v in row]
            # 행 전체가 비어 있으면 그 줄은 넣지 않습니다.
            if any(c.strip() for c in cells):
                lines.append("\t".join(cells).rstrip())
        # 시트에 실제 내용이 있을 때만 담습니다.
        if len(lines) > 1:
            blocks.append("\n".join(lines))

    wb.close()
    return "\n\n".join(blocks).strip()
