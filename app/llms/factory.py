from app.llms.anthropic_adapter import AnthropicAdapter
from app.llms.mock_adapter import MockAdapter
from app.llms.openai_adapter import OpenAIAdapter
from app.llms.openai_compatible_adapter import OpenAICompatibleAdapter


def get_adapter(provider: str):
    normalized = provider.strip().lower().replace("-", "_")
    if normalized == "anthropic":
        return AnthropicAdapter()
    if normalized == "openai":
        return OpenAIAdapter()
    if normalized == "mock":
        return MockAdapter()
    return OpenAICompatibleAdapter(normalized)
