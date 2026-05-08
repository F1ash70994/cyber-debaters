from app.schemas import AppSettings, StyleConfig
from app.settings_store import _normalize_settings, default_settings


def test_default_settings_do_not_define_resource_configs():
    settings = default_settings()

    assert settings.models == []
    assert settings.styles == []
    assert settings.skills == []
    assert settings.mcps == []
    assert settings.templates.prompt_template


def test_normalize_settings_preserves_styles_from_settings_file():
    settings = AppSettings(
        styles=[
            StyleConfig(id="style-a", name="自定义风格 A", prompt="A"),
            StyleConfig(id="style-b", name="自定义风格 B", prompt="B"),
        ]
    )

    _normalize_settings(settings)

    assert [style.id for style in settings.styles] == ["style-a", "style-b"]
