from fastapi.testclient import TestClient

import app.main as main
from app.schemas import AppSettings, ModelConfig, StyleConfig, TemplateSettings


def test_prompt_preview_uses_current_template_settings(monkeypatch):
    settings = AppSettings(
        templates=TemplateSettings(
            prompt_template=(
                "整体模板：{agent_name}|{role}|{topic}|{round_prompt}|"
                "{answer_length_prompt}|{style_section}|{skills_section}|{mcps_section}"
            ),
            round_prompt_template="自定义轮次模板：{agent_name} 在 {current_round}/{total_rounds} 回应「{topic}」。",
            answer_length_prompts={
                "medium": "自定义长度模板：{answer_length_label} / {answer_length}。",
            },
        ),
        models=[
            ModelConfig(
                id="mock-model",
                name="Mock",
                provider="mock",
                model="mock-pro",
            )
        ],
    )
    monkeypatch.setattr(main, "load_settings", lambda: settings)

    response = TestClient(main.app).post(
        "/api/prompt/preview",
        json={
            "topic": "测试模板是否生效",
            "total_rounds": 3,
            "answer_length": "medium",
            "current_round": 2,
            "agent_index": 0,
            "agents": [
                {
                    "name": "正方",
                    "role": "支持",
                    "model_config_id": "mock-model",
                }
            ],
        },
    )

    assert response.status_code == 200
    system_prompt = response.json()["messages"][0]["content"]
    assert "整体模板：正方|支持|测试模板是否生效|" in system_prompt
    assert "自定义轮次模板：正方 在 2/3 回应「测试模板是否生效」。" in system_prompt
    assert "自定义长度模板：适中 / medium。" in system_prompt


def test_prompt_preview_does_not_duplicate_style_label(monkeypatch):
    settings = AppSettings(
        models=[
            ModelConfig(
                id="mock-model",
                name="Mock",
                provider="mock",
                model="mock-pro",
            )
        ],
        styles=[
            StyleConfig(
                id="style-vivid",
                name="幽默风趣",
                prompt="说话风格：幽默风趣，善于引用网络梗和真实事件论证自己的观点",
            )
        ],
    )
    monkeypatch.setattr(main, "load_settings", lambda: settings)

    response = TestClient(main.app).post(
        "/api/prompt/preview",
        json={
            "topic": "测试风格提示词",
            "total_rounds": 2,
            "answer_length": "medium",
            "current_round": 1,
            "agent_index": 0,
            "agents": [
                {
                    "name": "正方",
                    "role": "支持",
                    "model_config_id": "mock-model",
                    "style_id": "style-vivid",
                }
            ],
        },
    )

    assert response.status_code == 200
    system_prompt = response.json()["messages"][0]["content"]
    assert "说话风格：幽默风趣，善于引用网络梗和真实事件论证自己的观点" in system_prompt
    assert "幽默风趣：说话风格：幽默风趣" not in system_prompt
    assert system_prompt.count("说话风格：") == 1


def test_prompt_preview_respects_empty_template_settings(monkeypatch):
    settings = AppSettings(
        templates=TemplateSettings(
            prompt_template="",
            round_prompt_template="",
            answer_length_prompts={
                "medium": "",
            },
        ),
        models=[
            ModelConfig(
                id="mock-model",
                name="Mock",
                provider="mock",
                model="mock-pro",
            )
        ],
    )
    monkeypatch.setattr(main, "load_settings", lambda: settings)

    response = TestClient(main.app).post(
        "/api/prompt/preview",
        json={
            "topic": "空模板测试",
            "total_rounds": 1,
            "answer_length": "medium",
            "current_round": 1,
            "agent_index": 0,
            "agents": [
                {
                    "name": "正方",
                    "role": "支持",
                    "model_config_id": "mock-model",
                }
            ],
        },
    )

    assert response.status_code == 200
    assert response.json()["messages"][0]["content"] == ""
