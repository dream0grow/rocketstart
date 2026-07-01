"""
파일명 파서 — 공문 파일명 하나만 보고 정보 뽑기 (파일을 열기도 전에!)

왜 중요한가 (설계서 근거):
    실제 공문 파일명이 이런 규칙적인 구조였습니다.

        (무릉초등학교-2974 (첨부) 제주특별자치도교육청 체육건강과) 2026년 전국초등교원체육연수 계획.hwp
         └── 수신처 ──┘└문서번호┘└본문/첨부┘└──── 발신기관 ────┘ └──────── 제목 ────────┘ └확장자┘

    → 파일을 열기 전에도 발신기관·문서번호·제목을 정확히 알 수 있습니다.
    → 이건 규칙(정규식)으로 100% 정확하게 뽑습니다. AI에게 맡기지 않습니다.
      (검증 결과: AI는 발신기관을 '교육지원센터'로 지어내는 환각이 있었음)
"""

import os
import re
from dataclasses import dataclass, asdict
from typing import Optional


@dataclass
class ParsedFilename:
    """파일명에서 뽑아낸 정보를 담는 상자."""
    recipient: Optional[str] = None      # 수신처 (예: 무릉초등학교)
    doc_number: Optional[str] = None     # 문서번호 (예: 2974)
    kind: Optional[str] = None           # 본문/첨부 구분 (예: 첨부)
    sender: Optional[str] = None         # 발신기관 (예: 제주특별자치도교육청 체육건강과)
    title: Optional[str] = None          # 제목 (예: 2026년 전국초등교원체육연수 계획)
    extension: Optional[str] = None      # 확장자 (예: hwp)
    matched: bool = False                # 공문 파일명 규칙에 맞았는지 여부

    def to_dict(self) -> dict:
        return asdict(self)


# 공문 파일명 규칙을 표현한 정규식.
#   ( 수신처 - 문서번호  (본문|첨부)  발신기관 )  제목 . 확장자
# - 수신처: '-' 나 '(' 가 나오기 전까지의 글자
# - 문서번호: 숫자(하이픈/붙임표 등이 섞인 경우도 대비해 [\d-]+)
# - 본문/첨부: '본문' 또는 '첨부'
# - 발신기관: 닫는 괄호 ')' 전까지 (제일 마지막 ')' 기준)
# - 제목: 그 뒤 ~ 확장자 앞까지
_OFFICIAL_DOC_PATTERN = re.compile(
    r"""
    ^\s*\(                         # 시작 여는 괄호
    \s*(?P<recipient>[^()\-]+?)     # 수신처 (괄호/하이픈 제외)
    \s*-\s*(?P<doc_number>[\d\-]+)  # - 문서번호
    \s*\(\s*(?P<kind>본문|첨부)\s*\) # (본문) 또는 (첨부)
    \s*(?P<sender>[^()]+?)          # 발신기관
    \s*\)                          # 바깥 닫는 괄호
    \s*(?P<title>.+?)               # 제목
    \s*\.(?P<extension>[A-Za-z0-9]+)$  # .확장자
    """,
    re.VERBOSE,
)


def parse_filename(filename: str) -> ParsedFilename:
    """
    공문 파일명 하나를 받아 정보를 뽑아냅니다.

    규칙에 맞으면 각 항목을 채워 돌려주고,
    규칙에 안 맞는 평범한 파일명이면 matched=False 로 두되
    제목과 확장자만이라도 최대한 채웁니다.
    """
    # 경로가 딸려와도 파일 이름만 사용합니다.
    name = os.path.basename(filename).strip()

    m = _OFFICIAL_DOC_PATTERN.match(name)
    if m:
        return ParsedFilename(
            recipient=_clean(m.group("recipient")),
            doc_number=_clean(m.group("doc_number")),
            kind=_clean(m.group("kind")),
            sender=_clean(m.group("sender")),
            title=_clean(m.group("title")),
            extension=m.group("extension").lower(),
            matched=True,
        )

    # 규칙에 안 맞는 파일명 → 제목/확장자만이라도 뽑아 둡니다.
    root, ext = os.path.splitext(name)
    return ParsedFilename(
        title=_clean(root) or None,
        extension=ext.lstrip(".").lower() or None,
        matched=False,
    )


def _clean(text: Optional[str]) -> Optional[str]:
    """앞뒤 공백과 연속 공백을 정리합니다."""
    if text is None:
        return None
    cleaned = re.sub(r"\s+", " ", text).strip()
    return cleaned or None
