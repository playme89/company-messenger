from pydantic import BaseModel
from datetime import datetime
from app.schemas.user import UserOut


class ChannelCreate(BaseModel):
    name: str
    description: str | None = None
    type: str = "public"  # public | private | dm
    member_ids: list[str] = []


class ChannelUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class ChannelMemberOut(BaseModel):
    user_id: str
    role: str
    last_read_at: datetime | None
    joined_at: datetime
    user: UserOut

    model_config = {"from_attributes": True}


class ChannelOut(BaseModel):
    id: str
    name: str
    description: str | None
    type: str
    created_by: str
    created_at: datetime
    unread_count: int = 0

    model_config = {"from_attributes": True}


class DMCreateRequest(BaseModel):
    target_user_id: str
