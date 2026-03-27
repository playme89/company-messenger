import uuid
from datetime import datetime, date, timezone
from sqlalchemy import String, Boolean, DateTime, Date, ForeignKey, Integer, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class ScheduleTask(Base):
    __tablename__ = "schedule_tasks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="#4F81BD")
    progress: Mapped[int] = mapped_column(Integer, default=0)  # 0~100
    status: Mapped[str] = mapped_column(String(20), default="planned")  # planned | in_progress | done | hold
    parent_task_id: Mapped[str | None] = mapped_column(String, ForeignKey("schedule_tasks.id"), nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user: Mapped["User"] = relationship("User", back_populates="schedule_tasks")  # type: ignore
    subtasks: Mapped[list["ScheduleTask"]] = relationship("ScheduleTask", foreign_keys=[parent_task_id])

    __table_args__ = (
        Index("ix_schedule_user_dates", "user_id", "start_date", "end_date"),
        Index("ix_schedule_dates", "start_date", "end_date"),
    )
