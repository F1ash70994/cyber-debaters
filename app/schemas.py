from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field, field_validator


DEFAULT_ROUND_PROMPT_TEMPLATE = """当前是第 {current_round} 轮。
总共 {total_rounds} 轮。
你本轮只能发言一次。
辩论将在第 {total_rounds} 轮结束。"""

DEFAULT_PROMPT_TEMPLATE = """你是辩论 Agent：{agent_name}。
你的角色或立场：{role}。

{agent_prompt}

{style_section}

{mcps_section}

{skills_section}

{round_prompt}

{answer_length_prompt}"""

DEFAULT_ANSWER_LENGTH_PROMPTS = {
    "concise": """回答长度要求：精简。
请用 1-2 个短段落完成本轮发言，优先给出最关键的结论和 1-2 条核心理由。
避免铺陈背景、重复辩题或展开过多例子；如需反驳对方，只抓住最重要的一点。""",
    "medium": """回答长度要求：适中。
请用 2-4 个段落完成本轮发言，包含清晰立场、主要论据、必要例子，以及对已有观点的简要回应。
表达要有结构，但不要写成过长论文；每个观点都应服务于当前轮次的推进。""",
    "detailed": """回答长度要求：详细。
请充分展开本轮发言，建议包含：明确立场、分点论证、事实或例子支撑、对对方关键观点的回应、阶段性小结。
允许使用 Markdown 标题、列表或表格组织内容，但仍需聚焦辩题，避免无关延伸。""",
}

ANSWER_LENGTH_LABELS = {
    "concise": "精简",
    "medium": "适中",
    "detailed": "详细",
}

ANSWER_LENGTH_ALIASES = {
    "concise": "concise",
    "short": "concise",
    "精简": "concise",
    "medium": "medium",
    "normal": "medium",
    "适中": "medium",
    "detailed": "detailed",
    "long": "detailed",
    "详细": "detailed",
}


def normalize_answer_length(value: str) -> str:
    return ANSWER_LENGTH_ALIASES.get(value.strip().lower(), value.strip())


class AgentConfig(BaseModel):
    name: str = Field(..., min_length=1)
    role: str = ""
    model_config_id: str = ""
    provider: str = "mock"
    model: str = ""
    api_key: str = ""
    base_url: str = ""
    prompt: str = ""
    style_id: str = ""
    prompt_template: str = ""
    round_prompt_template: str = ""
    answer_length: str = "medium"
    answer_length_prompt: str = ""
    skill_ids: list[str] = Field(default_factory=list)
    mcp_ids: list[str] = Field(default_factory=list)
    selected_style: str = ""
    selected_skills: list[str] = Field(default_factory=list)
    selected_mcps: list[str] = Field(default_factory=list)
    temperature: float = Field(0.7, ge=0, le=2)
    max_tokens: int = Field(800, ge=1, le=8192)

    @field_validator("provider")
    @classmethod
    def normalize_provider(cls, value: str) -> str:
        return value.strip().lower().replace("-", "_")

    @field_validator("answer_length")
    @classmethod
    def normalize_answer_length_value(cls, value: str) -> str:
        return normalize_answer_length(value)


class ModelConfig(BaseModel):
    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    provider: str = Field("mock", min_length=1)
    model: str = Field(..., min_length=1)
    api_key: str = ""
    base_url: str = ""
    temperature: float = Field(0.7, ge=0, le=2)
    max_tokens: int = Field(800, ge=1, le=8192)

    @field_validator("provider")
    @classmethod
    def normalize_provider(cls, value: str) -> str:
        return value.strip().lower().replace("-", "_")


class SkillConfig(BaseModel):
    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    prompt: str = ""


class StyleConfig(BaseModel):
    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    prompt: str = ""


class McpConfig(BaseModel):
    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    description: str = ""
    config: str = ""


class TemplateSettings(BaseModel):
    prompt_template: str = DEFAULT_PROMPT_TEMPLATE
    round_prompt_template: str = DEFAULT_ROUND_PROMPT_TEMPLATE
    answer_length_prompts: dict[str, str] = Field(default_factory=lambda: DEFAULT_ANSWER_LENGTH_PROMPTS.copy())


class AppSettings(BaseModel):
    templates: TemplateSettings = Field(default_factory=TemplateSettings)
    models: list[ModelConfig] = Field(default_factory=list, max_length=50)
    styles: list[StyleConfig] = Field(default_factory=list, max_length=100)
    skills: list[SkillConfig] = Field(default_factory=list, max_length=100)
    mcps: list[McpConfig] = Field(default_factory=list, max_length=100)


class DebateRequest(BaseModel):
    topic: str = Field(..., min_length=1)
    total_rounds: int = Field(..., ge=1, le=50)
    answer_length: str = "medium"
    agents: list[AgentConfig] = Field(..., min_length=1, max_length=12)
    settings_snapshot: Optional[AppSettings] = None

    @field_validator("answer_length")
    @classmethod
    def normalize_answer_length_value(cls, value: str) -> str:
        return normalize_answer_length(value)


class PromptPreviewRequest(DebateRequest):
    current_round: int = Field(1, ge=1)
    agent_index: int = Field(0, ge=0)


class PromptPreviewResponse(BaseModel):
    agent_name: str
    model_name: str
    provider: str
    topic: str
    current_round: int
    total_rounds: int
    answer_length: str
    answer_length_label: str
    messages: list[dict[str, str]]


class DebateMessage(BaseModel):
    round: int
    agent_name: str
    content: str
    error: Optional[str] = None
    prompt_messages: list[dict[str, str]] = Field(default_factory=list)


class DebateRound(BaseModel):
    round: int
    messages: list[DebateMessage] = Field(default_factory=list)


class DebateResponse(BaseModel):
    status: str
    rounds: list[DebateRound]
    errors: list[str] = Field(default_factory=list)
