import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

from app.agent import Agent
from app.debate_engine import DebateEngine
from app.schemas import ANSWER_LENGTH_LABELS, AppSettings, DebateRequest, DebateResponse, PromptPreviewRequest, PromptPreviewResponse
from app.settings_store import load_settings, resolve_debate_request, save_settings

ROOT_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = ROOT_DIR / "static"

app = FastAPI(title="赛博喷客", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/settings", response_model=AppSettings)
async def get_settings() -> AppSettings:
    return load_settings()


@app.put("/api/settings", response_model=AppSettings)
async def update_settings(settings: AppSettings) -> AppSettings:
    try:
        return save_settings(settings)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/debate/start", response_model=DebateResponse)
async def start_debate(request: DebateRequest) -> DebateResponse:
    try:
        resolved_request = resolve_debate_request(request, load_settings())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return await DebateEngine(resolved_request).run()


@app.post("/api/debate/stream")
async def stream_debate(request: DebateRequest) -> StreamingResponse:
    try:
        resolved_request = resolve_debate_request(request, load_settings())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    async def event_stream():
        async for event in DebateEngine(resolved_request).iter_events():
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/api/prompt/preview", response_model=PromptPreviewResponse)
async def preview_prompt(request: PromptPreviewRequest) -> PromptPreviewResponse:
    try:
        resolved_request = resolve_debate_request(request, load_settings())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if request.agent_index >= len(resolved_request.agents):
        raise HTTPException(status_code=400, detail="Agent 序号超出范围。")

    current_round = min(request.current_round, request.total_rounds)
    agent_config = resolved_request.agents[request.agent_index]
    messages = Agent(agent_config).build_messages(
        topic=resolved_request.topic,
        current_round=current_round,
        total_rounds=resolved_request.total_rounds,
        history=[],
    )

    return PromptPreviewResponse(
        agent_name=agent_config.name,
        model_name=agent_config.model,
        provider=agent_config.provider,
        topic=resolved_request.topic,
        current_round=current_round,
        total_rounds=resolved_request.total_rounds,
        answer_length=resolved_request.answer_length,
        answer_length_label=ANSWER_LENGTH_LABELS.get(resolved_request.answer_length, resolved_request.answer_length),
        messages=messages,
    )


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
