from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import uuid
from app.database import get_db
from app.middleware.auth import require_staff
from app.models.user import User
from app.models.conversation import Conversation
from app.models.feedback import Feedback
from app.models.message import Message
from app.services.redis_service import redis_service

router = APIRouter(prefix="/api/staff", tags=["staff"])


@router.get("/conversations")
async def get_my_conversations(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_staff),
):
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.customer))
        .where(Conversation.staff_id == user.id, Conversation.status == "active")
        .order_by(Conversation.started_at.desc())
    )
    conversations = result.scalars().all()

    return [
        {
            "id": str(c.id),
            "customer_name": c.customer.name if c.customer else "Unknown",
            "status": c.status,
            "started_at": c.started_at.isoformat() if c.started_at else None,
            "ended_at": c.ended_at.isoformat() if c.ended_at else None,
        }
        for c in conversations
    ]


@router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_staff),
):
    conv_uuid = uuid.UUID(conversation_id)

    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conv_uuid, Conversation.staff_id == user.id
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=403, detail="Forbidden")

    buffered = await redis_service.get_buffered_messages(conversation_id)
    if buffered:
        return buffered

    msg_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv_uuid)
        .order_by(Message.sent_at.asc())
    )
    messages = msg_result.scalars().all()
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
async def get_my_feedback(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_staff),
):
    result = await db.execute(
        select(Feedback)
        .where(Feedback.staff_id == user.id)
        .order_by(Feedback.created_at.desc())
    )
    feedbacks = result.scalars().all()

    return [
        {
            "id": str(f.id),
            "conversation_id": str(f.conversation_id),
            "rating": f.rating,
            "created_at": f.created_at.isoformat(),
        }
        for f in feedbacks
    ]
