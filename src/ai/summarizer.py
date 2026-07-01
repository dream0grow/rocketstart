"""
요약·할일 제안 (MVP-4) — 로컬 LLM 이 '제안', 사람이 '확인'

설계 원칙:
    - AI 출력은 참고용 제안입니다. 마감일·기관은 규칙 추출(MVP-2)이 정답.
    - 각 항목엔 [근거]를 붙여 환각을 즉시 발각.
    - 출력엔 항상 "AI가 제안한 내용입니다. 확인해 주세요" 표시.

테스트를 위해 LLM 호출부(generate_fn)를 주입할 수 있게 했습니다.
    (실제로는 Ollama, 테스트에서는 가짜 함수)
"""

import re
from dataclasses import dataclass, field, asdict
from typing import Callable, List, Optional

from .prompt import build_prompt
from .ollama_client import OllamaClient, OllamaError, DEFAULT_MODEL

# 모든 AI 출력에 붙는 안내 (설계서: 항상 '확인 필요' 표시)
NOTICE = "AI가 제안한 내용입니다. 반드시 확인해 주세요. (마감일·기관명은 규칙 추출이 정답)"

# [근거: ...] 부분을 떼어내는 정규식
_EVIDENCE_RE = re.compile(r"\[\s*근거\s*[:：]\s*(.*?)\s*\]\s*$")


@dataclass
class Task:
    text: str
    evidence: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class AiSuggestion:
    """AI 요약·할일 제안 한 덩어리."""
    available: bool = False               # AI(Ollama)가 실제로 쓰였나
    model: str = ""
    summary: str = ""                     # 한 줄 요약
    summary_evidence: str = ""            # 요약의 근거
    tasks: List[Task] = field(default_factory=list)  # 해야 할 일
    notice: str = NOTICE
    raw: str = ""                         # LLM 원문(디버그·검토용)
    message: str = ""                     # 안내/오류 메시지

    def to_dict(self) -> dict:
        return {
            "available": self.available,
            "model": self.model,
            "summary": self.summary,
            "summary_evidence": self.summary_evidence,
            "tasks": [t.to_dict() for t in self.tasks],
            "notice": self.notice,
            "raw": self.raw,
            "message": self.message,
        }


def summarize(text: str, title: str = "",
              generate_fn: Optional[Callable[[str], str]] = None,
              model: str = DEFAULT_MODEL) -> AiSuggestion:
    """
    공문 본문으로 AI 요약·할일 제안을 만듭니다.

    generate_fn 을 주면 그 함수로 LLM 을 호출합니다(테스트용 가짜 가능).
    안 주면 로컬 Ollama 를 씁니다. Ollama 가 없으면 친절히 안내만 하고 끝냅니다.
    """
    body = (text or "").strip()
    if not body:
        return AiSuggestion(
            available=False, model=model,
            message="본문 텍스트가 없어 요약할 수 없습니다. (이미지 공문 등)",
        )

    # LLM 호출 함수 준비.
    if generate_fn is None:
        client = OllamaClient(model=model)
        if not client.is_available():
            return AiSuggestion(
                available=False, model=model,
                message=("로컬 AI(Ollama)가 실행되어 있지 않습니다. "
                         "요약·할일 제안은 Ollama 실행 시 제공됩니다. "
                         "(설치: https://ollama.com, 모델: `ollama pull qwen2.5:3b`)"),
            )
        generate_fn = client.generate

    prompt = build_prompt(body, title=title)
    try:
        raw = generate_fn(prompt)
    except OllamaError as e:
        return AiSuggestion(available=False, model=model, message=str(e))
    except Exception as e:  # noqa: BLE001
        return AiSuggestion(available=False, model=model,
                            message=f"AI 호출 중 오류: {e}")

    suggestion = _parse(raw)
    suggestion.available = True
    suggestion.model = model
    suggestion.raw = raw
    if not suggestion.summary and not suggestion.tasks:
        suggestion.message = "AI 응답을 형식대로 해석하지 못했습니다. 원문을 확인하세요."
    return suggestion


def _parse(raw: str) -> AiSuggestion:
    """LLM 출력 텍스트를 요약 + 할일 목록으로 해석합니다."""
    result = AiSuggestion()
    lines = [ln.rstrip() for ln in (raw or "").splitlines()]

    in_tasks = False
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        # 한 줄 요약
        m = re.match(r"^[-*\s]*한\s*줄\s*요약\s*[:：]\s*(.*)$", stripped)
        if m:
            content, evidence = _split_evidence(m.group(1))
            result.summary = content
            result.summary_evidence = evidence
            in_tasks = False
            continue

        # 해야 할 일 섹션 시작
        if re.match(r"^[-*\s]*해야\s*할\s*일\s*[:：]?\s*$", stripped):
            in_tasks = True
            continue

        # 번호 매긴 할 일 (1. / 1) / - )
        m = re.match(r"^[-*\s]*(?:\d+[.)]|[-*•])\s*(.+)$", stripped)
        if m and (in_tasks or "[근거" in stripped):
            content, evidence = _split_evidence(m.group(1))
            if content:
                result.tasks.append(Task(text=content, evidence=evidence))

    return result


def _split_evidence(text: str):
    """한 항목에서 본문과 [근거: ...]를 분리합니다."""
    text = text.strip()
    m = _EVIDENCE_RE.search(text)
    if m:
        evidence = m.group(1).strip()
        content = text[:m.start()].strip()
        return content, evidence
    return text, ""
