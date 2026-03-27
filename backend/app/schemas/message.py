from pydantic import BaseModel
from datetime import datetime
from app.schemas.user import UserOut


class MessageFileOut(BaseModel):
    id: str
    file_name: str
    file_size: int
    mime_type: str
    storage_path: str
    thumbnail_path: str | None

    model_config = {"from_attributes": True}


class ReactionOut(BaseModel):
    emoji: str
    user_id: str
    count: int = 1


class MessageOut(BaseModel):
    id: str
    channel_id: str
    user_id: str
    parent_id: str | None
    content: str
    content_type: str
    is_edited: bool
    is_deleted: bool
    created_at: datetime
    updated_at: datetime
    user: UserOut
    files: list[MessageFileOut] = []
    reactions: list[ReactionOut] = []
    reply_count: int = 0

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    content: str
    parent_id: str | None = None
    file_ids: list[str] = []


class MessageUpdate(BaseModel):
    content: str


class MessageSearchResult(BaseModel):
    messages: list[MessageOut]
    total: int
