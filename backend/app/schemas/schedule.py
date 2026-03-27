from pydantic import BaseModel
from datetime import datetime, date
from app.schemas.user import UserOut


class ScheduleTaskCreate(BaseModel):
    title: str
    description: str | None = None
    start_date: date
    end_date: date
    color: str = "#4F81BD"
    progress: int = 0
    status: str = "planned"
    parent_task_id: str | None = None
    order_index: int = 0


class ScheduleTaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    color: str | None = None
    progress: int | None = None
    status: str | None = None
    order_index: int | None = None


class ScheduleTaskOut(BaseModel):
    id: str
    user_id: str
    title: str
    description: str | None
    start_date: date
    end_date: date
    color: str
    progress: int
    status: str
    parent_task_id: str | None
    order_index: int
    created_at: datetime
    updated_at: datetime
    user: UserOut

    model_config = {"from_attributes": True}


class GanttViewQuery(BaseModel):
    start_date: date
    end_date: date
    department_id: str | None = None
