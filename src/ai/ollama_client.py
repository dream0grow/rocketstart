"""
Ollama 연동 (로컬 LLM) — 설계서 2·3장

원칙:
    Ollama 는 선생님 PC 안에서(localhost:11434) 도는 로컬 LLM 입니다.
    클라우드 API 가 아니라 **데이터가 PC 밖으로 안 나갑니다**. (핵심 가치)

구현:
    추가 라이브러리 없이 파이썬 표준 urllib 로 REST 호출만 합니다.
    localhost 통신이라 프록시를 타지 않도록 opener 를 따로 만듭니다.
"""

import json
import urllib.request
import urllib.error

DEFAULT_HOST = "http://localhost:11434"
DEFAULT_MODEL = "qwen2.5:3b"   # 설계서: 속도 검증 통과(교무실 표준 PC 즉시 응답)


class OllamaError(Exception):
    """Ollama 호출이 실패했을 때."""
    pass


class OllamaClient:
    """로컬 Ollama 데몬에 요청을 보내는 얇은 클라이언트."""

    def __init__(self, model: str = DEFAULT_MODEL, host: str = DEFAULT_HOST,
                 timeout: int = 120):
        self.model = model
        self.host = host.rstrip("/")
        self.timeout = timeout
        # localhost 통신은 프록시를 타지 않게 (빈 ProxyHandler).
        self._opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def is_available(self) -> bool:
        """Ollama 데몬이 켜져 있는지 짧게 확인합니다."""
        try:
            req = urllib.request.Request(f"{self.host}/api/tags", method="GET")
            with self._opener.open(req, timeout=3) as resp:
                return resp.status == 200
        except Exception:
            return False

    def generate(self, prompt: str) -> str:
        """프롬프트를 보내 생성 결과 문자열을 받습니다. (스트리밍 안 씀)"""
        payload = json.dumps({
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            # 사실 왜곡을 줄이려 창의성(temperature)을 낮춥니다.
            "options": {"temperature": 0.2},
        }).encode("utf-8")

        req = urllib.request.Request(
            f"{self.host}/api/generate",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with self._opener.open(req, timeout=self.timeout) as resp:
                obj = json.loads(resp.read().decode("utf-8"))
        except urllib.error.URLError as e:
            raise OllamaError(
                f"Ollama 에 연결하지 못했습니다({self.host}). "
                f"Ollama 가 켜져 있는지 확인하세요. 원인: {e}"
            )
        except Exception as e:  # noqa: BLE001
            raise OllamaError(f"Ollama 응답 처리 중 오류: {e}")

        return obj.get("response", "")
