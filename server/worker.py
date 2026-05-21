import asyncio
import logging
from app.config import settings
from app.services.redis_service import redis_service
from app.database import async_session
from app.models.message import Message
from datetime import datetime
import uuid as uuid_mod
from sqlalchemy.dialects.postgresql import insert

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("queue_worker")


async def worker_loop():
    await redis_service.connect()
    logger.info("Worker started...")
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
                logger.info(f"Worker flushed: {len(messages)} msgs for {conv_id}")
        except Exception as e:
            logger.error(f"Worker error: {e}")


if __name__ == "__main__":
    asyncio.run(worker_loop())
