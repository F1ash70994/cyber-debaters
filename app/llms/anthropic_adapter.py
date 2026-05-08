import json
import os

import httpx

from app.llms.base import LLMError, LLMRequest


class AnthropicAdapter:
    default_base_url = "https://api.anthropic.com/v1"

    def messages_url(self, base_url: str) -> str:
        base_url = base_url.rstrip("/")
        if base_url.endswith("/messages"):
            return base_url
        return f"{base_url}/messages"

    async def generate(self, request: LLMRequest) -> str:
        api_key = request.api_key or os.getenv("ANTHROPIC_API_KEY", "")
        if not api_key:
            raise LLMError("Anthropic API Key 为空，请在 Agent 配置中填写 api_key 或设置 ANTHROPIC_API_KEY。")

        system_parts, anthropic_messages = self._split_messages(request)
        payload = {
            "model": request.model,
            "system": "\n\n".join(part for part in system_parts if part),
            "messages": anthropic_messages,
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
        }
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        base_url = (request.base_url or self.default_base_url).rstrip("/")

        async with httpx.AsyncClient(timeout=90) as client:
            response = await client.post(self.messages_url(base_url), json=payload, headers=headers)

        if response.status_code >= 400:
            raise LLMError(f"Anthropic 请求失败：{response.status_code} {response.text[:500]}")

        data = response.json()
        try:
            blocks = data["content"]
        except KeyError as exc:
            raise LLMError("Anthropic 响应格式无法解析。") from exc

        return "\n".join(block.get("text", "") for block in blocks if block.get("type") == "text").strip()

    async def stream(self, request: LLMRequest):
        api_key = request.api_key or os.getenv("ANTHROPIC_API_KEY", "")
        if not api_key:
            raise LLMError("Anthropic API Key 为空，请在 Agent 配置中填写 api_key 或设置 ANTHROPIC_API_KEY。")

        system_parts, anthropic_messages = self._split_messages(request)
        payload = {
            "model": request.model,
            "system": "\n\n".join(part for part in system_parts if part),
            "messages": anthropic_messages,
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
            "stream": True,
        }
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        base_url = (request.base_url or self.default_base_url).rstrip("/")

        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream("POST", self.messages_url(base_url), json=payload, headers=headers) as response:
                if response.status_code >= 400:
                    body = (await response.aread()).decode("utf-8", errors="replace")
                    raise LLMError(f"Anthropic 请求失败：{response.status_code} {body[:500]}")

                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line.removeprefix("data:").strip()
                    if not data:
                        continue
                    try:
                        payload = json.loads(data)
                    except json.JSONDecodeError as exc:
                        raise LLMError("Anthropic 流式响应格式无法解析。") from exc

                    event_type = payload.get("type")
                    if event_type == "content_block_delta":
                        delta = payload.get("delta", {})
                        text = delta.get("text") if delta.get("type") == "text_delta" else ""
                        if text:
                            yield text
                    elif event_type == "error":
                        error = payload.get("error", {})
                        raise LLMError(f"Anthropic 流式请求失败：{error.get('message', payload)}")

    def _split_messages(self, request: LLMRequest):
        system_parts: list[str] = []
        anthropic_messages = []
        for message in request.messages:
            role = message.get("role", "user")
            content = message.get("content", "")
            if role == "system":
                system_parts.append(content)
            elif role == "assistant":
                anthropic_messages.append({"role": "assistant", "content": content})
            else:
                anthropic_messages.append({"role": "user", "content": content})
        return system_parts, anthropic_messages
