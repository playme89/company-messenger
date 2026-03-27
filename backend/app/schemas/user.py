from pydantic import BaseModel
from datetime import datetime


class DepartmentOut(BaseModel):
    id: str
    name: str
    parent_id: str | None
    order_index: int

    model_config = {"from_attributes": True}


class DepartmentCreate(BaseModel):
    name: str
    parent_id: str | None = None
    order_index: int = 0


class UserOut(BaseModel):
    id: str
    email: str
    username: str
    display_name: str
    avatar_url: str | None
    department_id: str | None
    department: DepartmentOut | None
    role: str
    is_active: bool
    last_seen_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    display_name: str | None = None
    avatar_url: str | None = None
    department_id: str | None = None


class UserPresence(BaseModel):
    user_id: str
    status: str  # online | away | offline
