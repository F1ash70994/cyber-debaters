import pytest

from app.llms.base import LLMError
from app.llms.openai_adapter import OpenAIAdapter


def test_extract_stream_content_from_standard_delta():
    payload = {"choices": [{"delta": {"content": "你好"}}]}

    assert OpenAIAdapter._extract_stream_content(payload) == "你好"


def test_extract_stream_content_skips_empty_choices_usage_chunk():
    payload = {"choices": [], "usage": {"prompt_tokens": 10, "completion_tokens": 2}}

    assert OpenAIAdapter._extract_stream_content(payload) == ""


def test_extract_stream_content_skips_non_choice_metadata_chunk():
    payload = {"id": "chatcmpl-123", "object": "chat.completion.chunk"}

    assert OpenAIAdapter._extract_stream_content(payload) == ""


def test_extract_stream_content_handles_list_content_parts():
    payload = {
        "choices": [
            {
                "delta": {
                    "content": [
                        {"type": "text", "text": "第一段"},
                        {"type": "text", "text": "第二段"},
                    ]
                }
            }
        ]
    }

    assert OpenAIAdapter._extract_stream_content(payload) == "第一段第二段"


def test_extract_stream_content_raises_provider_error():
    payload = {"error": {"message": "模型不存在"}}

    with pytest.raises(LLMError, match="模型不存在"):
        OpenAIAdapter._extract_stream_content(payload)
