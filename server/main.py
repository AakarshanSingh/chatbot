import asyncio
import logging
import socketio
from contextlib import asynccontextmanager
from urllib.parse import urlparse
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base
from app.models.connection_event import ConnectionEvent  # noqa: F401
from app.services.redis_service import redis_service
from app.routers import auth, admin, staff
from app.websocket.handlers import register_handlers

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


def _build_allowed_origins(cors_origins: str) -> list[str]:
    origins = [origin.strip() for origin in cors_origins.split(",") if origin.strip()]
    if "*" in origins:
        return ["*"]

    expanded = set(origins)
    for origin in origins:
        parsed = urlparse(origin)
        host = parsed.hostname
        if not host:
            continue

        port = f":{parsed.port}" if parsed.port else ""
        if host == "localhost":
            expanded.add(f"{parsed.scheme}://127.0.0.1{port}")
        elif host == "127.0.0.1":
            expanded.add(f"{parsed.scheme}://localhost{port}")

    return sorted(expanded)


allowed_origins = _build_allowed_origins(settings.cors_origins)

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=allowed_origins,
    logger=False,
    engineio_logger=False,
)

register_handlers(sio)


async def periodic_message_flush():
    from app.database import async_session
    from app.models.message import Message
    from datetime import datetime
    import uuid as uuid_mod
    from sqlalchemy.dialects.postgresql import insert

    while True:
        await asyncio.sleep(settings.message_flush_interval)
        try:
            keys = await redis_service.client.keys("message_buffer:*")
            for key in keys:
                conv_id = key.replace("message_buffer:", "")
                messages = await redis_service.get_buffered_messages(conv_id)
                if not messages:
                    continue

                async with async_session() as db:
                    for msg in messages:
                        stmt = (
                            insert(Message)
                            .values(
                                id=uuid_mod.UUID(msg["id"]),
                                conversation_id=uuid_mod.UUID(msg["conversation_id"]),
                                sender_type=msg["sender_type"],
                                sender_id=uuid_mod.UUID(msg["sender_id"]),
                                content=msg["content"],
                                sent_at=datetime.fromisoformat(msg["sent_at"]),
                            )
                            .on_conflict_do_nothing(index_elements=["id"])
                        )
                        await db.execute(stmt)
                    await db.commit()

                await redis_service.clear_message_buffer(conv_id)
                logger.info(f"Periodic flush: {len (messages )} msgs for {conv_id }")
        except Exception as e:
            logger.error(f"Periodic flush error: {e }")


@asynccontextmanager
async def lifespan(app: FastAPI):

    logger.info("Starting up...")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created.")

    await redis_service.connect()
    logger.info("Redis connected.")

    flush_task = asyncio.create_task(periodic_message_flush())

    yield

    logger.info("Shutting down...")
    flush_task.cancel()
    await redis_service.disconnect()
    await engine.dispose()


app = FastAPI(
    title="Support Chatbot API",
    description="Real-time customer support chatbot with Socket.IO",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(staff.router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "support-chatbot"}


combined_app = socketio.ASGIApp(sio, other_asgi_app=app)
