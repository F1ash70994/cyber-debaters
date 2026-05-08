from collections.abc import AsyncIterator

from app.agent import Agent
from app.schemas import DebateMessage, DebateRequest, DebateResponse, DebateRound


class DebateEngine:
    def __init__(self, request: DebateRequest) -> None:
        self.request = request
        self.agents = [Agent(config) for config in request.agents]

    async def run(self) -> DebateResponse:
        rounds: list[DebateRound] = []
        errors: list[str] = []

        async for event in self.iter_events():
            if event["type"] == "message":
                message = DebateMessage(**event["message"])
                if message.error:
                    errors.append(message.error)
                if not rounds or rounds[-1].round != message.round:
                    rounds.append(DebateRound(round=message.round))
                rounds[-1].messages.append(message)

        return DebateResponse(status="completed", rounds=rounds, errors=errors)

    async def iter_events(self) -> AsyncIterator[dict]:
        history: list[DebateMessage] = []
        yield {"type": "status", "status": "running", "message": "辩论开始。"}

        for round_index in range(1, self.request.total_rounds + 1):
            yield {"type": "round_started", "round": round_index}
            for agent in self.agents:
                content_parts: list[str] = []
                prompt_messages = agent.build_display_messages(
                    topic=self.request.topic,
                    current_round=round_index,
                    total_rounds=self.request.total_rounds,
                    history=history,
                )
                yield {
                    "type": "message_started",
                    "message": {
                        "round": round_index,
                        "agent_name": agent.config.name,
                        "prompt_messages": prompt_messages,
                    },
                }
                try:
                    async for chunk in agent.stream_speak(
                        topic=self.request.topic,
                        current_round=round_index,
                        total_rounds=self.request.total_rounds,
                        history=history,
                    ):
                        content_parts.append(chunk)
                        yield {
                            "type": "message_delta",
                            "message": {
                                "round": round_index,
                                "agent_name": agent.config.name,
                                "delta": chunk,
                            },
                        }
                    content = "".join(content_parts)
                    message = DebateMessage(
                        round=round_index,
                        agent_name=agent.config.name,
                        content=content,
                        prompt_messages=prompt_messages,
                    )
                except Exception as exc:
                    error = f"第 {round_index} 轮 {agent.config.name} 调用失败：{exc}"
                    message = DebateMessage(
                        round=round_index,
                        agent_name=agent.config.name,
                        content="",
                        error=error,
                        prompt_messages=prompt_messages,
                    )

                history.append(message)
                yield {"type": "message", "message": message.model_dump()}

        yield {"type": "done", "status": "completed", "message": "辩论结束。"}
