from dataclasses import dataclass


Message = dict[str, str]


@dataclass
class LLMRequest:
    provider: str
    model: str
    messages: list[Message]
    api_key: str
    base_url: str
    temperature: float
    max_tokens: int


class LLMError(RuntimeError):
    pass
