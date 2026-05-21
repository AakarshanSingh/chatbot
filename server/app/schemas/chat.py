from pydantic import BaseModel
from datetime import datetime


class CustomerInitRequest(BaseModel):
    name: str
    query: str


class MessageSchema(BaseModel):
    id: str
    conversation_id: str
    sender_type: str
    sender_id: str
    content: str
    sent_at: datetime

    model_config = {"from_attributes": True}


class ConversationSchema(BaseModel):
    id: str
    customer_id: str
    staff_id: str | None = None
    status: str
    started_at: datetime
    ended_at: datetime | None = None

    model_config = {"from_attributes": True}
