import json
import os

import httpx

from app.llms.base import LLMError, LLMRequest


class OpenAIAdapter:
    def __init__(self, default_base_url: str = "https://api.openai.com/v1") -> None:
        self.default_base_url = default_base_url.rstrip("/")

    def completions_url(self, base_url: str) -> str:
        base_url = base_url.rstrip("/")
        if base_url.endswith("/chat/completions"):
            return base_url
        return f"{base_url}/chat/completions"

    @staticmethod
    def _format_provider_error(payload: dict) -> str:
        error = payload.get("error")
        if isinstance(error, dict):
            return str(error.get("message") or error)
        if error:
            return str(error)
        return ""

    @classmethod
    def _normalize_content(cls, content) -> str:
        if content is None:
            return ""
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, str):
                    parts.append(item)
                elif isinstance(item, dict):
                    text = item.get("text") or item.get("content")
                    if isinstance(text, str):
                        parts.append(text)
            return "".join(parts)
        return str(content)

    @classmethod
    def _extract_stream_content(cls, payload: dict) -> str:
        error_message = cls._format_provider_error(payload)
        if error_message:
            raise LLMError(f"OpenAI 流式请求失败：{error_message}")

        choices = payload.get("choices")
        if choices is None:
            return ""
        if not isinstance(choices, list):
            raise LLMError("OpenAI 流式响应格式无法解析。")
        if not choices:
            return ""

        choice = choices[0] or {}
        if not isinstance(choice, dict):
            raise LLMError("OpenAI 流式响应格式无法解析。")

        delta = choice.get("delta") or {}
        if isinstance(delta, dict):
            return cls._normalize_content(delta.get("content"))

        return cls._normalize_content(choice.get("text"))

    async def generate(self, request: LLMRequest) -> str:
        api_key = request.api_key or os.getenv("OPENAI_API_KEY", "")
        if not api_key:
            raise LLMError("OpenAI API Key 为空，请在 Agent 配置中填写 api_key 或设置 OPENAI_API_KEY。")

        base_url = (request.base_url or self.default_base_url).rstrip("/")
        payload = {
            "model": request.model,
            "messages": request.messages,
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
        }
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=90) as client:
            response = await client.post(self.completions_url(base_url), json=payload, headers=headers)

        if response.status_code >= 400:
            raise LLMError(f"OpenAI 请求失败：{response.status_code} {response.text[:500]}")

        data = response.json()
        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise LLMError("OpenAI 响应格式无法解析。") from exc

        return content or ""

    async def stream(self, request: LLMRequest):
        api_key = request.api_key or os.getenv("OPENAI_API_KEY", "")
        if not api_key:
            raise LLMError("OpenAI API Key 为空，请在 Agent 配置中填写 api_key 或设置 OPENAI_API_KEY。")

        base_url = (request.base_url or self.default_base_url).rstrip("/")
        payload = {
            "model": request.model,
            "messages": request.messages,
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
            "stream": True,
        }
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream("POST", self.completions_url(base_url), json=payload, headers=headers) as response:
                if response.status_code >= 400:
                    body = (await response.aread()).decode("utf-8", errors="replace")
                    raise LLMError(f"OpenAI 请求失败：{response.status_code} {body[:500]}")

                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line.removeprefix("data:").strip()
                    if data == "[DONE]":
                        break
                    if not data:
                        continue
                    try:
                        payload = json.loads(data)
                    except json.JSONDecodeError as exc:
                        raise LLMError("OpenAI 流式响应格式无法解析。") from exc
                    content = self._extract_stream_content(payload)
                    if content:
                        yield content
