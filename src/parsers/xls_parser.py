"""
XLS(구형 이진 엑셀) 파서 — xlrd 로 읽습니다.

왜 따로 있나:
    .xlsx(신형)는 openpyxl 로 읽지만, .xls(2003 이전 구형)는 파일 구조가 완전히
    달라 openpyxl 이 못 엽니다. 실제 공문에 아직 .xls 가 섞여 오므로(예: 참가신청서)
    구형 전용 라이브러리 xlrd 로 읽어 줍니다.

출력 형태는 xlsx_parser 와 똑같이 맞춥니다. (시트 이름 + 행/칸)
"""

import xlrd


def extract_xls(path: str) -> str:
    """구형 .xls 파일의 모든 시트를 훑어 텍스트로 만듭니다."""
    book = xlrd.open_workbook(path)

    blocks = []
    for sheet in book.sheets():
        lines = [f"[시트: {sheet.name}]"]
        for row_idx in range(sheet.nrows):
            cells = [_cell_to_str(sheet.cell(row_idx, col_idx))
                     for col_idx in range(sheet.ncols)]
            # 행 전체가 비어 있으면 그 줄은 넣지 않습니다.
            if any(c.strip() for c in cells):
                lines.append("\t".join(cells).rstrip())
        if len(lines) > 1:
            blocks.append("\n".join(lines))

    return "\n\n".join(blocks).strip()


def _cell_to_str(cell) -> str:
    """셀 값을 사람이 읽기 좋은 문자열로 바꿉니다."""
    value = cell.value
    if value is None or value == "":
        return ""
    # 엑셀은 정수도 실수(예: 25.0)로 저장 → 소수부가 0이면 정수로 보기 좋게
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)
