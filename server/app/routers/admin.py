from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.middleware.auth import require_admin
from app.models.user import User
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.feedback import Feedback
from app.models.connection_event import ConnectionEvent
from app.services.redis_service import redis_service

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/staff")
async def get_all_staff(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.role == "staff"))
    staff_list = result.scalars().all()
    statuses = await redis_service.get_all_staff_statuses()

    return [
        {
            "id": str(s.id),
            "name": s.name,
            "email": s.email,
            "status": statuses.get(str(s.id), "offline"),
            "is_online": s.is_online,
        }
        for s in staff_list
    ]


@router.get("/conversations")
async def get_all_conversations(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(
        select(Conversation)
        .options(
            selectinload(Conversation.customer),
            selectinload(Conversation.staff),
        )
        .order_by(Conversation.started_at.desc())
    )
    conversations = result.scalars().all()
    conversation_ids = [c.id for c in conversations]

    latest_events: dict[str, ConnectionEvent] = {}
    if conversation_ids:
        events_result = await db.execute(
            select(ConnectionEvent)
            .where(ConnectionEvent.conversation_id.in_(conversation_ids))
            .order_by(ConnectionEvent.created_at.desc())
        )
        for event in events_result.scalars().all():
            conv_id = str(event.conversation_id)
            if conv_id not in latest_events:
                latest_events[conv_id] = event

    return [
        {
            "id": str(c.id),
            "customer_name": c.customer.name if c.customer else "Unknown",
            "staff_name": c.staff.name if c.staff else "Unassigned",
            "status": c.status,
            "started_at": c.started_at.isoformat() if c.started_at else None,
            "ended_at": c.ended_at.isoformat() if c.ended_at else None,
            "last_disconnect_by": (
                latest_events[str(c.id)].actor if str(c.id) in latest_events else None
            ),
            "last_disconnect_type": (
                latest_events[str(c.id)].disconnect_type
                if str(c.id) in latest_events
                else None
            ),
            "last_disconnect_at": (
                latest_events[str(c.id)].created_at.isoformat()
                if str(c.id) in latest_events
                else None
            ),
        }
        for c in conversations
    ]


@router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.sent_at.asc())
    )
    messages = result.scalars().all()

    return [
        {
            "id": str(m.id),
            "sender_type": m.sender_type,
            "sender_id": str(m.sender_id),
            "content": m.content,
            "sent_at": m.sent_at.isoformat(),
        }
        for m in messages
    ]


@router.get("/feedback")
async def get_all_feedback(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(
        select(Feedback)
        .options(
            selectinload(Feedback.staff),
            selectinload(Feedback.conversation),
        )
        .order_by(Feedback.created_at.desc())
    )
    feedbacks = result.scalars().all()

    return [
        {
            "id": str(f.id),
            "conversation_id": str(f.conversation_id),
            "staff_name": f.staff.name if f.staff else "Unknown",
            "staff_id": str(f.staff_id),
            "rating": f.rating,
            "created_at": f.created_at.isoformat(),
        }
        for f in feedbacks
    ]


@router.get("/queue")
async def get_queue_status(_: User = Depends(require_admin)):
    queue_items = await redis_service.get_queue_items()
    queue_length = await redis_service.get_queue_length()
    return {"queue_length": queue_length, "items": queue_items}
