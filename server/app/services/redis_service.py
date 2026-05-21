import json
import redis.asyncio as redis
from app.config import settings


class RedisService:
    def __init__(self):
        self.client: redis.Redis | None = None

    async def connect(self):
        self.client = redis.from_url(settings.redis_url, decode_responses=True)

    async def disconnect(self):
        if self.client:
            await self.client.close()

    async def set_staff_status(self, staff_id: str, status: str):

        await self.client.set(f"staff:{staff_id }:status", status)
        if status == "free":
            await self.client.sadd("staff:free_list", staff_id)
        else:
            await self.client.srem("staff:free_list", staff_id)

    async def get_staff_status(self, staff_id: str) -> str:
        status = await self.client.get(f"staff:{staff_id }:status")
        return status or "offline"

    async def get_free_staff(self) -> list[str]:
        return list(await self.client.smembers("staff:free_list"))

    async def get_all_staff_statuses(self) -> dict[str, str]:

        keys = await self.client.keys("staff:*:status")
        statuses = {}
        for key in keys:
            staff_id = key.split(":")[1]
            status = await self.client.get(key)
            statuses[staff_id] = status or "offline"
        return statuses

    async def set_active_conversation(self, conversation_id: str, data: dict):
        await self.client.set(
            f"conversation:{conversation_id }",
            json.dumps(data),
            ex=86400,
        )

    async def get_active_conversation(self, conversation_id: str) -> dict | None:
        data = await self.client.get(f"conversation:{conversation_id }")
        return json.loads(data) if data else None

    async def delete_conversation(self, conversation_id: str):
        await self.client.delete(f"conversation:{conversation_id }")

    async def set_customer_session(self, session_token: str, data: dict):
        await self.client.set(
            f"customer_session:{session_token }",
            json.dumps(data),
            ex=86400,
        )

    async def get_customer_session(self, session_token: str) -> dict | None:
        data = await self.client.get(f"customer_session:{session_token }")
        return json.loads(data) if data else None

    async def delete_customer_session(self, session_token: str):
        await self.client.delete(f"customer_session:{session_token }")

    async def buffer_message(self, conversation_id: str, message: dict):

        await self.client.rpush(
            f"message_buffer:{conversation_id }", json.dumps(message)
        )
        await self.client.expire(f"message_buffer:{conversation_id }", 3600)

    async def get_buffered_messages(self, conversation_id: str) -> list[dict]:

        messages = await self.client.lrange(f"message_buffer:{conversation_id }", 0, -1)
        return [json.loads(m) for m in messages]

    async def clear_message_buffer(self, conversation_id: str):

        await self.client.delete(f"message_buffer:{conversation_id }")

    async def get_buffer_size(self, conversation_id: str) -> int:
        return await self.client.llen(f"message_buffer:{conversation_id }")

    async def add_to_queue(self, customer_data: dict):

        await self.client.rpush("customer:queue", json.dumps(customer_data))

    async def pop_from_queue(self) -> dict | None:

        data = await self.client.lpop("customer:queue")
        return json.loads(data) if data else None

    async def get_queue_length(self) -> int:
        return await self.client.llen("customer:queue")

    async def get_queue_items(self) -> list[dict]:

        items = await self.client.lrange("customer:queue", 0, -1)
        return [json.loads(item) for item in items]


redis_service = RedisService()
