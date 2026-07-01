"""
AI 요약·할일(MVP-4) 테스트

Ollama 없이도 검증할 수 있게, LLM 호출부를 '가짜 함수'로 주입해
프롬프트 생성·응답 파싱·안내 처리를 확인합니다.
(실제 Ollama 연동은 선생님 PC에서 verify_ai.py 로 검증)
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.ai import summarize, build_prompt, NOTICE
from src.ai.summarizer import _split_evidence, _parse


# 3b 가 형식대로 낸다고 가정한 가짜 응답
FAKE_RESPONSE = """- 한 줄 요약: 2026년 전국초등교원 체육연수 신청 안내 [근거: 제목 및 1. 목적]
- 해야 할 일:
  1. 연수 계획 확인 [근거: 2. 연수개요]
  2. 신청 희망자 취합 [근거: 신청 기한: 2026. 7. 29.]
  3. 신청서 제출 [근거: 신청 기한: 2026. 7. 29.]
"""


def test_prompt_contains_rules_and_body():
    """프롬프트에 환각 억제 규칙과 근거표시 지시가 들어가야 한다."""
    p = build_prompt("공문 본문 내용", title="체육연수 안내")
    assert "공문에 없는 내용은 절대 추가하지 마라" in p
    assert "[근거:" in p
    assert "체육연수 안내" in p
    assert "공문 본문 내용" in p


def test_prompt_truncates_long_text():
    """아주 긴 본문은 잘라서 넣어야 한다(3b 안정성)."""
    long_text = "가" * 10000
    p = build_prompt(long_text)
    assert "이하 생략" in p
    assert len(p) < 6000


def test_split_evidence():
    """[근거: ...] 를 본문과 분리해야 한다."""
    content, ev = _split_evidence("신청서 제출 [근거: 신청 기한 2026. 7. 29.]")
    assert content == "신청서 제출"
    assert ev == "신청 기한 2026. 7. 29."

    content, ev = _split_evidence("근거 없는 항목")
    assert content == "근거 없는 항목"
    assert ev == ""


def test_summarize_with_fake_llm():
    """가짜 LLM 응답을 요약 1개 + 할일 3개로 파싱해야 한다."""
    result = summarize("어떤 공문 본문", title="체육연수",
                       generate_fn=lambda prompt: FAKE_RESPONSE)
    assert result.available is True
    assert "체육연수" in result.summary
    assert result.summary_evidence != ""
    assert len(result.tasks) == 3
    assert result.tasks[0].text == "연수 계획 확인"
    assert result.tasks[0].evidence == "2. 연수개요"
    # 항상 '확인 필요' 안내가 붙어야 함
    assert result.notice == NOTICE


def test_summarize_empty_text():
    """본문이 없으면 AI 를 부르지 않고 안내만."""
    result = summarize("   ", generate_fn=lambda p: "should not be called")
    assert result.available is False
    assert "본문" in result.message


def test_summarize_ollama_unavailable():
    """Ollama 가 없으면(기본 경로) 친절한 안내와 함께 available=False."""
    # generate_fn 을 주지 않으면 OllamaClient 를 쓰는데, 데몬이 없으면 is_available False.
    result = summarize("본문 있음")
    assert result.available is False
    assert "Ollama" in result.message


def test_summarize_handles_llm_error():
    """LLM 호출이 예외를 던져도 크래시하지 않고 메시지로."""
    def boom(prompt):
        raise RuntimeError("모델 로딩 실패")
    result = summarize("본문", generate_fn=boom)
    assert result.available is False
    assert "오류" in result.message


def test_parse_alternate_bullets():
    """번호 대신 '-' 나 '1)' 형식도 할일로 인식."""
    raw = ("한 줄 요약: 요약문 [근거: 본문]\n"
           "해야 할 일:\n"
           "- 첫째 [근거: 가]\n"
           "1) 둘째 [근거: 나]\n")
    r = _parse(raw)
    assert r.summary == "요약문"
    assert len(r.tasks) == 2
