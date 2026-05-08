import json
from pathlib import Path

from app.schemas import (
    AgentConfig,
    AppSettings,
    DebateRequest,
    McpConfig,
    SkillConfig,
    StyleConfig,
)


ROOT_DIR = Path(__file__).resolve().parent.parent
SETTINGS_PATH = ROOT_DIR / "data" / "settings.json"


def default_settings() -> AppSettings:
    return AppSettings()


def load_settings() -> AppSettings:
    if not SETTINGS_PATH.exists():
        return default_settings()

    data = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
    if "templates" not in data:
        data["templates"] = {}
    if "styles" not in data:
        data["styles"] = []
    if data.get("round_prompt_template") and not data["templates"].get("round_prompt_template"):
        data["templates"]["round_prompt_template"] = data["round_prompt_template"]
    settings = AppSettings.model_validate(data)
    _normalize_settings(settings)
    return settings


def _normalize_settings(settings: AppSettings) -> None:
    return None


def save_settings(settings: AppSettings) -> AppSettings:
    _normalize_settings(settings)
    _validate_settings(settings)
    SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(settings.model_dump(), ensure_ascii=False, indent=2)
    SETTINGS_PATH.write_text(payload + "\n", encoding="utf-8")
    return settings


def resolve_debate_request(request: DebateRequest, settings: AppSettings) -> DebateRequest:
    models = {model.id: model for model in settings.models}
    styles = {style.id: style for style in settings.styles}
    skills = {skill.id: skill for skill in settings.skills}
    mcps = {mcp.id: mcp for mcp in settings.mcps}
    answer_length_prompt = settings.templates.answer_length_prompts.get(request.answer_length, "")
    resolved_agents: list[AgentConfig] = []

    for agent in request.agents:
        if not agent.model_config_id:
            raise ValueError(f"{agent.name} 尚未选择模型配置。")
        model_config = models.get(agent.model_config_id)
        if not model_config:
            raise ValueError(f"{agent.name} 选择的模型配置不存在：{agent.model_config_id}")

        selected_skills = _resolve_skill_prompts(agent, skills)
        selected_mcps = _resolve_mcp_prompts(agent, mcps)
        selected_style = _resolve_style_prompt(agent, styles)
        data = agent.model_dump()
        data.update(
            provider=model_config.provider,
            model=model_config.model,
            api_key=model_config.api_key,
            base_url=model_config.base_url,
            temperature=model_config.temperature,
            max_tokens=model_config.max_tokens,
            prompt_template=settings.templates.prompt_template,
            round_prompt_template=settings.templates.round_prompt_template,
            answer_length=request.answer_length,
            answer_length_prompt=answer_length_prompt,
            selected_style=selected_style,
            selected_skills=selected_skills,
            selected_mcps=selected_mcps,
        )
        resolved_agents.append(AgentConfig(**data))

    return request.model_copy(update={"agents": resolved_agents})


def _resolve_style_prompt(agent: AgentConfig, styles: dict[str, StyleConfig]) -> str:
    if not agent.style_id:
        return ""
    style = styles.get(agent.style_id)
    if not style:
        raise ValueError(f"{agent.name} 选择的风格不存在：{agent.style_id}")
    return style.prompt.strip() or style.name


def _resolve_skill_prompts(agent: AgentConfig, skills: dict[str, SkillConfig]) -> list[str]:
    selected = []
    for skill_id in agent.skill_ids:
        skill = skills.get(skill_id)
        if not skill:
            raise ValueError(f"{agent.name} 选择的 Skill 不存在：{skill_id}")
        selected.append(_join_resource_text(skill.name, skill.prompt))
    return selected


def _resolve_mcp_prompts(agent: AgentConfig, mcps: dict[str, McpConfig]) -> list[str]:
    selected = []
    for mcp_id in agent.mcp_ids:
        mcp = mcps.get(mcp_id)
        if not mcp:
            raise ValueError(f"{agent.name} 选择的 MCP 不存在：{mcp_id}")
        selected.append(_join_resource_text(mcp.name, mcp.description))
    return selected


def _join_resource_text(name: str, description: str) -> str:
    description = description.strip()
    if not description:
        return name
    return f"{name}：{description}"


def _validate_settings(settings: AppSettings) -> None:
    model_ids = [model.id for model in settings.models]
    model_names = [model.name for model in settings.models]
    style_ids = [style.id for style in settings.styles]
    style_names = [style.name for style in settings.styles]
    skill_ids = [skill.id for skill in settings.skills]
    mcp_ids = [mcp.id for mcp in settings.mcps]
    if len(model_ids) != len(set(model_ids)):
        raise ValueError("模型配置 ID 不能重复。")
    if len(model_names) != len(set(model_names)):
        raise ValueError("模型配置名称不能重复。")
    if len(style_ids) != len(set(style_ids)):
        raise ValueError("风格 ID 不能重复。")
    if len(style_names) != len(set(style_names)):
        raise ValueError("风格名称不能重复。")
    if len(skill_ids) != len(set(skill_ids)):
        raise ValueError("Skill ID 不能重复。")
    if len(mcp_ids) != len(set(mcp_ids)):
        raise ValueError("MCP ID 不能重复。")
    if not settings.models:
        raise ValueError("至少需要保留一个模型配置。")
