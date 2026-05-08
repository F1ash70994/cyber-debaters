import os

from app.llms.openai_adapter import OpenAIAdapter


OPENAI_COMPATIBLE_DEFAULTS = {
    "deepseek": "https://api.deepseek.com/v1",
    "moonshot": "https://api.moonshot.cn/v1",
    "qwen": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "local": "http://localhost:8000/v1",
}


class OpenAICompatibleAdapter(OpenAIAdapter):
    def __init__(self, provider: str = "openai_compatible") -> None:
        super().__init__(OPENAI_COMPATIBLE_DEFAULTS.get(provider, "https://api.openai.com/v1"))
        self.provider = provider

    async def generate(self, request):
        if not request.api_key:
            env_name = f"{self.provider.upper()}_API_KEY"
            request.api_key = os.getenv(env_name, "")
        return await super().generate(request)

    async def stream(self, request):
        if not request.api_key:
            env_name = f"{self.provider.upper()}_API_KEY"
            request.api_key = os.getenv(env_name, "")
        async for chunk in super().stream(request):
            yield chunk
