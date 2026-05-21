from pydantic import BaseModel


class FeedbackRequest(BaseModel):
    conversation_id: str
    rating: str


class FeedbackResponse(BaseModel):
    id: str
    conversation_id: str
    staff_id: str
    customer_id: str
    rating: str

    model_config = {"from_attributes": True}
