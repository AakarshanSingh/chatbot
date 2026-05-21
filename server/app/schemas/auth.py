from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "staff"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    is_online: bool

    model_config = {"from_attributes": True}
