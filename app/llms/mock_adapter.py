import asyncio
import re

from app.llms.base import LLMRequest


class MockAdapter:
    async def generate(self, request: LLMRequest) -> str:
        topic = "这个辩题"
        current_round = "当前轮"
        for message in request.messages:
            content = message.get("content", "")
            if "辩题：" in content:
                topic = content.split("辩题：", 1)[1].split("\n", 1)[0].strip()
            for pattern in (r"当前是第\s*(\d+)\s*轮", r"当前轮次[：:]\s*(\d+)", r"第\s*(\d+)\s*轮"):
                match = re.search(pattern, content)
                if match:
                    current_round = match.group(1)
                    break
        return (
            f"这是 {request.model or 'mock-model'} 的模拟发言。"
            f"我会围绕「{topic}」在第 {current_round} 轮提出一个清晰观点，"
            "并针对已有发言给出简短回应。"
        )

    async def stream(self, request: LLMRequest):
        text = await self.generate(request)
        for index in range(0, len(text), 4):
            await asyncio.sleep(0.03)
            yield text[index : index + 4]
