"""로컬 AI(Ollama) 연동 — 요약·할일 제안 (MVP-4). 설계서 5장."""

from .summarizer import summarize, AiSuggestion, Task, NOTICE
from .ollama_client import OllamaClient, OllamaError, DEFAULT_MODEL, DEFAULT_HOST
from .prompt import build_prompt

__all__ = [
    "summarize", "AiSuggestion", "Task", "NOTICE",
    "OllamaClient", "OllamaError", "DEFAULT_MODEL", "DEFAULT_HOST",
    "build_prompt",
]
