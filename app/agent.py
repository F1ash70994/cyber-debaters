from app.llms.base import LLMRequest
from app.llms.factory import get_adapter
from app.schemas import ANSWER_LENGTH_LABELS, AgentConfig, DebateMessage


class SafeFormatDict(dict):
    def __missing__(self, key: str) -> str:
        return "{" + key + "}"


class Agent:
    def __init__(self, config: AgentConfig) -> None:
        self.config = config

    async def stream_speak(
        self,
        *,
        topic: str,
        current_round: int,
        total_rounds: int,
        history: list[DebateMessage],
    ):
        messages = self.build_messages(topic, current_round, total_rounds, history)
        adapter = get_adapter(self.config.provider)
        request = LLMRequest(
            provider=self.config.provider,
            model=self.config.model,
            messages=messages,
            api_key=self.config.api_key,
            base_url=self.config.base_url,
            temperature=self.config.temperature,
            max_tokens=self.config.max_tokens,
        )
        async for chunk in adapter.stream(request):
            yield chunk

    def build_messages(
        self,
        topic: str,
        current_round: int,
        total_rounds: int,
        history: list[DebateMessage],
    ) -> list[dict[str, str]]:
        system_prompt = self._build_system_prompt(topic, current_round, total_rounds)
        user_prompt = self._build_user_prompt(topic, history)
        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

    def build_display_messages(
        self,
        topic: str,
        current_round: int,
        total_rounds: int,
        history: list[DebateMessage],
    ) -> list[dict[str, str]]:
        system_prompt = self._build_system_prompt(topic, current_round, total_rounds)
        user_prompt = self._build_user_prompt(topic, history, redact_history=True)
        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

    def _build_system_prompt(self, topic: str, current_round: int, total_rounds: int) -> str:
        values = SafeFormatDict(
            current_round=current_round,
            total_rounds=total_rounds,
            agent_name=self.config.name,
            role=self.config.role or "未指定",
            topic=topic,
            agent_prompt=self.config.prompt.strip(),
            answer_length=self.config.answer_length,
            answer_length_label=ANSWER_LENGTH_LABELS.get(self.config.answer_length, self.config.answer_length),
        )
        round_prompt = self.config.round_prompt_template.format_map(values)
        answer_length_prompt = ""
        if self.config.answer_length_prompt:
            answer_length_prompt = self.config.answer_length_prompt.format_map(values)

        selected_skills = self._format_plain_items(self.config.selected_skills)
        selected_mcps = self._format_plain_items(self.config.selected_mcps)
        values.update(
            style=self.config.selected_style,
            skills=selected_skills,
            mcps=selected_mcps,
            round_prompt=round_prompt,
            answer_length_prompt=answer_length_prompt,
            style_section=self._format_style_text(self.config.selected_style),
            skills_section=self._format_text("可用 Skills", selected_skills),
            mcps_section=self._format_text("可用 MCPs", selected_mcps),
        )

        return self._clean_prompt(self.config.prompt_template.format_map(values))

    @staticmethod
    def _format_text(title: str, value: str) -> str:
        value = value.strip()
        if not value:
            return ""
        return f"{title}：\n{value}"

    @staticmethod
    def _format_style_text(value: str) -> str:
        value = value.strip()
        if not value:
            return ""
        if value.startswith(("说话风格：", "说话风格:")):
            return value
        return f"说话风格：\n{value}"

    @staticmethod
    def _format_plain_items(values: list[str]) -> str:
        cleaned = [value.strip() for value in values if value.strip()]
        return "\n".join(f"- {value}" for value in cleaned)

    @staticmethod
    def _clean_prompt(prompt: str) -> str:
        lines = [line.rstrip() for line in prompt.splitlines()]
        cleaned: list[str] = []
        blank_count = 0
        for line in lines:
            if line:
                cleaned.append(line)
                blank_count = 0
                continue
            blank_count += 1
            if blank_count <= 1:
                cleaned.append(line)
        return "\n".join(cleaned).strip()

    def _build_user_prompt(self, topic: str, history: list[DebateMessage], redact_history: bool = False) -> str:
        history_text = self._format_history(history, redact_history)

        return (
            f"辩题：{topic}\n\n"
            f"当前辩论历史：\n{history_text}\n\n"
            "请根据你的角色、立场和配置，完成本轮发言。"
        )

    @staticmethod
    def _format_history(history: list[DebateMessage], redact_history: bool) -> str:
        visible_history = [item for item in history if item.content]
        if not visible_history:
            return "暂无历史发言。"
        if not redact_history:
            return "\n".join(f"第 {item.round} 轮 - {item.agent_name}: {item.content}" for item in visible_history)
        return "\n".join(
            f"第 {item.round} 轮 - {item.agent_name}: <turn{item.round}_{item.agent_name}_content>"
            for item in visible_history
        )
