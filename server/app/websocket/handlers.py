import uuid
import logging
from datetime import datetime, timezone

import socketio
from sqlalchemy import select

from app.database import async_session
from app.models.user import User
from app.models.customer import Customer
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.feedback import Feedback
from app.models.connection_event import ConnectionEvent
from app.services.redis_service import redis_service
from app.utils.security import decode_access_token
from app.websocket.events import Events
from app.websocket.manager import manager

logger = logging.getLogger(__name__)


def register_handlers(sio: socketio.AsyncServer):

    async def notify_admins(event: str, data: dict):

        for admin_sid in manager.get_admin_sids():
            await sio.emit(event, data, to=admin_sid)

    async def flush_messages(conversation_id: str):
        from sqlalchemy.dialects.postgresql import insert

        messages = await redis_service.get_buffered_messages(conversation_id)
        if not messages:
            return

        async with async_session() as db:
            for msg in messages:
                stmt = (
                    insert(Message)
                    .values(
                        id=uuid.UUID(msg["id"]),
                        conversation_id=uuid.UUID(msg["conversation_id"]),
                        sender_type=msg["sender_type"],
                        sender_id=uuid.UUID(msg["sender_id"]),
                        content=msg["content"],
                        sent_at=datetime.fromisoformat(msg["sent_at"]),
                    )
                    .on_conflict_do_nothing(index_elements=["id"])
                )
                await db.execute(stmt)
            await db.commit()

        await redis_service.clear_message_buffer(conversation_id)
        logger.info(
            f"Flushed {len (messages )} messages for conversation {conversation_id }"
        )

    async def mark_conversation_closed(
        conversation_id: str,
        actor: str,
        disconnect_type: str,
        message: str,
        release_staff: bool = True,
        customer_session_token: str | None = None,
    ):
        await flush_messages(conversation_id)

        conv_data = await redis_service.get_active_conversation(conversation_id)
        staff_id = conv_data.get("staff_id") if conv_data else None
        customer_id = conv_data.get("customer_id") if conv_data else None

        async with async_session() as db:
            conv_uuid = uuid.UUID(conversation_id)
            result = await db.execute(
                select(Conversation).where(Conversation.id == conv_uuid)
            )
            conversation = result.scalar_one_or_none()
            if not conversation or conversation.status == "closed":
                return

            conversation.status = "closed"
            conversation.ended_at = datetime.now(timezone.utc)

            event = ConnectionEvent(
                conversation_id=conversation.id,
                actor=actor,
                disconnect_type=disconnect_type,
            )
            db.add(event)
            await db.commit()
            await db.refresh(event)

            if not staff_id and conversation.staff_id:
                staff_id = str(conversation.staff_id)
            if not customer_id and conversation.customer_id:
                customer_id = str(conversation.customer_id)

        room = f"chat:{conversation_id }"
        await sio.emit(
            Events.CHAT_ENDED,
            {"conversation_id": conversation_id, "message": message},
            room=room,
        )

        await notify_admins(
            Events.ADMIN_CONVERSATION_ENDED,
            {
                "conversation_id": conversation_id,
                "ended_by": actor,
                "end_type": disconnect_type,
                "ended_at": datetime.now(timezone.utc).isoformat(),
            },
        )

        await redis_service.delete_conversation(conversation_id)

        if customer_session_token:
            await redis_service.delete_customer_session(customer_session_token)
        elif customer_id:
            customer_sid = manager.get_customer_sid(customer_id)
            if customer_sid:
                customer_data = manager.get_customer_data(customer_sid)
                if customer_data:
                    session_token = customer_data.get("session_token")
                    if session_token:
                        await redis_service.delete_customer_session(session_token)

        if staff_id and release_staff:
            await redis_service.set_staff_status(staff_id, "free")
            await notify_admins(
                Events.ADMIN_STAFF_STATUS, {"staff_id": staff_id, "status": "free"}
            )
            await try_assign_from_queue(staff_id)

    async def try_assign_from_queue(staff_id: str):

        queued = await redis_service.pop_from_queue()
        if not queued:
            return

        staff_sid = manager.get_staff_sid(staff_id)
        if not staff_sid:

            await redis_service.add_to_queue(queued)
            return

        customer_sid = manager.get_customer_sid(queued["customer_id"])
        if not customer_sid:

            await try_assign_from_queue(staff_id)
            return

        staff_data = manager.get_staff_data(staff_sid)
        staff_name = staff_data["name"] if staff_data else "Support"

        async with async_session() as db:
            conversation = Conversation(
                customer_id=uuid.UUID(queued["customer_id"]),
                staff_id=uuid.UUID(staff_id),
                status="active",
            )
            db.add(conversation)
            await db.commit()
            await db.refresh(conversation)
            conv_id = str(conversation.id)

        await redis_service.set_active_conversation(
            conv_id,
            {
                "customer_id": queued["customer_id"],
                "staff_id": staff_id,
                "status": "active",
            },
        )
        await redis_service.set_customer_session(
            queued["session_token"],
            {
                "customer_id": queued["customer_id"],
                "conversation_id": conv_id,
            },
        )
        await redis_service.set_staff_status(staff_id, "busy")

        manager.set_customer_conversation(customer_sid, conv_id)

        room = f"chat:{conv_id }"
        await sio.enter_room(customer_sid, room)
        await sio.enter_room(staff_sid, room)

        await sio.emit(
            Events.CHAT_ASSIGNED,
            {
                "conversation_id": conv_id,
                "staff_name": staff_name,
                "message": f"{staff_name } will be helping you today!",
            },
            to=customer_sid,
        )

        await sio.emit(
            Events.CHAT_ASSIGNED,
            {
                "conversation_id": conv_id,
                "customer_name": queued["name"],
                "customer_query": queued["query"],
            },
            to=staff_sid,
        )

        sys_msg = {
            "id": str(uuid.uuid4()),
            "conversation_id": conv_id,
            "sender_type": "system",
            "sender_id": str(uuid.UUID(int=0)),
            "content": f"{staff_name } joined the chat.",
            "sent_at": datetime.now(timezone.utc).isoformat(),
        }
        await redis_service.buffer_message(conv_id, sys_msg)
        await sio.emit(Events.CHAT_MESSAGE, sys_msg, room=room)

        await notify_admins(
            Events.ADMIN_NEW_CONVERSATION,
            {
                "conversation_id": conv_id,
                "customer_name": queued["name"],
                "staff_name": staff_name,
                "staff_id": staff_id,
            },
        )
        await notify_admins(
            Events.ADMIN_STAFF_STATUS, {"staff_id": staff_id, "status": "busy"}
        )
        await notify_admins(
            Events.ADMIN_QUEUE_UPDATE,
            {"queue_length": await redis_service.get_queue_length()},
        )

    @sio.on(Events.CUSTOMER_JOIN)
    async def handle_customer_join(sid, data):

        name = data.get("name", "").strip()
        query = data.get("query", "").strip()

        if not name or not query:
            await sio.emit(
                Events.ERROR, {"message": "Name and query are required."}, to=sid
            )
            return

        session_token = str(uuid.uuid4())

        async with async_session() as db:
            customer = Customer(name=name, session_token=session_token)
            db.add(customer)
            await db.commit()
            await db.refresh(customer)
            customer_id = str(customer.id)

        manager.add_customer(sid, customer_id, session_token)

        free_staff = await redis_service.get_free_staff()

        if free_staff:

            staff_id = free_staff[0]
            staff_sid = manager.get_staff_sid(staff_id)

            if not staff_sid:

                await redis_service.set_staff_status(staff_id, "offline")
                free_staff = await redis_service.get_free_staff()

            if staff_sid:

                staff_data = manager.get_staff_data(staff_sid)
                staff_name = staff_data["name"] if staff_data else "Support"

                async with async_session() as db:
                    conversation = Conversation(
                        customer_id=uuid.UUID(customer_id),
                        staff_id=uuid.UUID(staff_id),
                        status="active",
                    )
                    db.add(conversation)
                    await db.commit()
                    await db.refresh(conversation)
                    conv_id = str(conversation.id)

                await redis_service.set_active_conversation(
                    conv_id,
                    {
                        "customer_id": customer_id,
                        "staff_id": staff_id,
                        "status": "active",
                    },
                )
                await redis_service.set_customer_session(
                    session_token,
                    {"customer_id": customer_id, "conversation_id": conv_id},
                )
                await redis_service.set_staff_status(staff_id, "busy")

                manager.set_customer_conversation(sid, conv_id)

                room = f"chat:{conv_id }"
                await sio.enter_room(sid, room)
                await sio.enter_room(staff_sid, room)

                await sio.emit(
                    Events.CHAT_ASSIGNED,
                    {
                        "conversation_id": conv_id,
                        "staff_name": staff_name,
                        "session_token": session_token,
                        "message": f"{staff_name } will be helping you today!",
                    },
                    to=sid,
                )

                await sio.emit(
                    Events.CHAT_ASSIGNED,
                    {
                        "conversation_id": conv_id,
                        "customer_name": name,
                        "customer_query": query,
                    },
                    to=staff_sid,
                )

                sys_msg = {
                    "id": str(uuid.uuid4()),
                    "conversation_id": conv_id,
                    "sender_type": "system",
                    "sender_id": str(uuid.UUID(int=0)),
                    "content": f"{staff_name } joined the chat.",
                    "sent_at": datetime.now(timezone.utc).isoformat(),
                }
                await redis_service.buffer_message(conv_id, sys_msg)
                await sio.emit(Events.CHAT_MESSAGE, sys_msg, room=room)

                await notify_admins(
                    Events.ADMIN_NEW_CONVERSATION,
                    {
                        "conversation_id": conv_id,
                        "customer_name": name,
                        "staff_name": staff_name,
                        "staff_id": staff_id,
                    },
                )
                await notify_admins(
                    Events.ADMIN_STAFF_STATUS,
                    {"staff_id": staff_id, "status": "busy"},
                )
                return

        await redis_service.add_to_queue(
            {
                "customer_id": customer_id,
                "session_token": session_token,
                "name": name,
                "query": query,
            }
        )
        queue_pos = await redis_service.get_queue_length()

        await sio.emit(
            Events.CHAT_QUEUE_POSITION,
            {
                "position": queue_pos,
                "session_token": session_token,
                "message": "All support staff are currently busy. You're in the queue.",
            },
            to=sid,
        )

        await notify_admins(Events.ADMIN_QUEUE_UPDATE, {"queue_length": queue_pos})

    @sio.on(Events.CUSTOMER_MESSAGE)
    async def handle_customer_message(sid, data):

        customer_data = manager.get_customer_data(sid)
        if not customer_data or not customer_data.get("conversation_id"):
            await sio.emit(Events.ERROR, {"message": "No active conversation."}, to=sid)
            return

        conv_id = customer_data["conversation_id"]
        msg = {
            "id": str(uuid.uuid4()),
            "conversation_id": conv_id,
            "sender_type": "customer",
            "sender_id": customer_data["customer_id"],
            "content": data.get("content", ""),
            "sent_at": datetime.now(timezone.utc).isoformat(),
        }

        await redis_service.buffer_message(conv_id, msg)

        from app.config import settings

        buffer_size = await redis_service.get_buffer_size(conv_id)
        if buffer_size >= settings.message_flush_size:
            await flush_messages(conv_id)

        room = f"chat:{conv_id }"
        await sio.emit(Events.CHAT_MESSAGE, msg, room=room)

    @sio.on(Events.CUSTOMER_TYPING)
    async def handle_customer_typing(sid, data):

        customer_data = manager.get_customer_data(sid)
        if not customer_data or not customer_data.get("conversation_id"):
            return

        conv_id = customer_data["conversation_id"]
        room = f"chat:{conv_id }"
        await sio.emit(
            Events.CHAT_TYPING,
            {"sender_type": "customer", "is_typing": data.get("is_typing", False)},
            room=room,
            skip_sid=sid,
        )

    @sio.on(Events.CUSTOMER_END_CHAT)
    async def handle_customer_end_chat(sid, data):

        customer_data = manager.get_customer_data(sid)
        if not customer_data or not customer_data.get("conversation_id"):
            return

        conv_id = customer_data["conversation_id"]
        session_token = customer_data["session_token"]
        await mark_conversation_closed(
            conv_id,
            "customer",
            "end_connection",
            "Chat ended by customer.",
            customer_session_token=session_token,
        )

    @sio.on(Events.CUSTOMER_FEEDBACK)
    async def handle_customer_feedback(sid, data):

        rating = data.get("rating", "").strip()
        conv_id = data.get("conversation_id", "")

        if rating not in ("good", "bad") or not conv_id:
            await sio.emit(
                Events.ERROR,
                {"message": "Invalid feedback. Must be 'good' or 'bad'."},
                to=sid,
            )
            return

        async with async_session() as db:
            result = await db.execute(
                select(Conversation).where(Conversation.id == conv_id)
            )
            conversation = result.scalar_one_or_none()
            if not conversation or not conversation.staff_id:
                return

            feedback = Feedback(
                conversation_id=conversation.id,
                staff_id=conversation.staff_id,
                customer_id=conversation.customer_id,
                rating=rating,
            )
            db.add(feedback)
            await db.commit()

        await notify_admins(
            Events.ADMIN_NEW_FEEDBACK,
            {
                "conversation_id": conv_id,
                "rating": rating,
                "staff_id": str(conversation.staff_id),
            },
        )

    @sio.on(Events.CUSTOMER_RECONNECT)
    async def handle_customer_reconnect(sid, data):

        session_token = data.get("session_token", "")
        if not session_token:
            await sio.emit(Events.ERROR, {"message": "Session token required."}, to=sid)
            return

        session_data = await redis_service.get_customer_session(session_token)
        if not session_data:
            await sio.emit(
                Events.ERROR,
                {"message": "Session expired. Please start a new chat."},
                to=sid,
            )
            return

        customer_id = session_data["customer_id"]
        conv_id = session_data.get("conversation_id")

        manager.add_customer(sid, customer_id, session_token)

        if conv_id:
            conv_data = await redis_service.get_active_conversation(conv_id)
            if conv_data and conv_data["status"] == "active":
                manager.set_customer_conversation(sid, conv_id)

                room = f"chat:{conv_id }"
                await sio.enter_room(sid, room)

                staff_id = conv_data.get("staff_id")
                staff_name = "Support"
                if staff_id:
                    staff_sid = manager.get_staff_sid(staff_id)
                    if staff_sid:
                        staff_data = manager.get_staff_data(staff_sid)
                        staff_name = staff_data["name"] if staff_data else "Support"

                buffered = await redis_service.get_buffered_messages(conv_id)

                await sio.emit(
                    Events.CHAT_RECONNECTED,
                    {
                        "conversation_id": conv_id,
                        "staff_name": staff_name,
                        "messages": buffered,
                    },
                    to=sid,
                )
                return

        await sio.emit(
            Events.ERROR,
            {"message": "Previous conversation has ended. Please start a new chat."},
            to=sid,
        )

    @sio.on(Events.STAFF_CONNECT)
    async def handle_staff_connect(sid, data):

        token = data.get("token", "")
        payload = decode_access_token(token)
        if not payload:
            await sio.emit(Events.ERROR, {"message": "Invalid token."}, to=sid)
            return

        user_id = payload.get("sub")
        role = payload.get("role")

        async with async_session() as db:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if not user:
                await sio.emit(Events.ERROR, {"message": "User not found."}, to=sid)
                return

            user.is_online = True
            await db.commit()

        if role == "admin":
            manager.add_admin(sid)
        else:
            manager.add_staff(sid, user_id, user.name)
            await redis_service.set_staff_status(user_id, "free")
            await notify_admins(
                Events.ADMIN_STAFF_STATUS, {"staff_id": user_id, "status": "free"}
            )
            await try_assign_from_queue(user_id)

    @sio.on(Events.STAFF_MESSAGE)
    async def handle_staff_message(sid, data):

        staff_data = manager.get_staff_data(sid)
        if not staff_data:
            await sio.emit(Events.ERROR, {"message": "Not authenticated."}, to=sid)
            return

        conv_id = data.get("conversation_id", "")
        content = data.get("content", "")

        if not conv_id or not content:
            return

        msg = {
            "id": str(uuid.uuid4()),
            "conversation_id": conv_id,
            "sender_type": "staff",
            "sender_id": staff_data["user_id"],
            "content": content,
            "sent_at": datetime.now(timezone.utc).isoformat(),
        }

        await redis_service.buffer_message(conv_id, msg)

        from app.config import settings

        buffer_size = await redis_service.get_buffer_size(conv_id)
        if buffer_size >= settings.message_flush_size:
            await flush_messages(conv_id)

        room = f"chat:{conv_id }"
        await sio.emit(Events.CHAT_MESSAGE, msg, room=room)

    @sio.on(Events.STAFF_DISCONNECT)
    async def handle_staff_disconnect(sid, data):

        staff_data = manager.get_staff_data(sid)
        if not staff_data:
            return

        user_id = staff_data["user_id"]
        async with async_session() as db:
            staff_uuid = uuid.UUID(user_id)
            result = await db.execute(
                select(Conversation.id).where(
                    Conversation.staff_id == staff_uuid,
                    Conversation.status == "active",
                )
            )
            active_conversations = [str(row[0]) for row in result.all()]

        for conv_id in active_conversations:
            await mark_conversation_closed(
                conv_id,
                "staff",
                "end_connection",
                "Chat ended by staff.",
            )

    @sio.on(Events.STAFF_TYPING)
    async def handle_staff_typing(sid, data):

        conv_id = data.get("conversation_id", "")
        if not conv_id:
            return

        room = f"chat:{conv_id }"
        await sio.emit(
            Events.CHAT_TYPING,
            {"sender_type": "staff", "is_typing": data.get("is_typing", False)},
            room=room,
            skip_sid=sid,
        )

    @sio.on("disconnect")
    async def handle_disconnect(sid):

        customer_data = manager.remove_customer(sid)
        if customer_data:
            conv_id = customer_data.get("conversation_id")
            if conv_id:
                session_token = customer_data.get("session_token")
                await mark_conversation_closed(
                    conv_id,
                    "customer",
                    "network_interruption",
                    "Chat ended because customer lost connection.",
                    customer_session_token=session_token,
                )
            return

        staff_data = manager.remove_staff(sid)
        if staff_data:
            user_id = staff_data["user_id"]

            async with async_session() as db:
                staff_uuid = uuid.UUID(user_id)
                result = await db.execute(
                    select(Conversation.id).where(
                        Conversation.staff_id == staff_uuid,
                        Conversation.status == "active",
                    )
                )
                active_conversations = [str(row[0]) for row in result.all()]

            for conv_id in active_conversations:
                await mark_conversation_closed(
                    conv_id,
                    "staff",
                    "network_interruption",
                    "Chat ended because staff lost connection.",
                    release_staff=False,
                )

            async with async_session() as db:
                result = await db.execute(select(User).where(User.id == user_id))
                user = result.scalar_one_or_none()
                if user:
                    user.is_online = False
                    await db.commit()

            await redis_service.set_staff_status(user_id, "offline")

            await notify_admins(
                Events.ADMIN_STAFF_STATUS,
                {"staff_id": user_id, "status": "offline"},
            )

        manager.remove_admin(sid)
