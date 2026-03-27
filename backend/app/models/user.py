import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    parent_id: Mapped[str | None] = mapped_column(String, ForeignKey("departments.id"), nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    parent: Mapped["Department | None"] = relationship("Department", remote_side="Department.id", back_populates="children")
    children: Mapped[list["Department"]] = relationship("Department", back_populates="parent")
    users: Mapped[list["User"]] = relationship("User", back_populates="department")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    department_id: Mapped[str | None] = mapped_column(String, ForeignKey("departments.id"), nullable=True)
    role: Mapped[str] = mapped_column(String(20), default="member")  # admin | member
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    department: Mapped["Department | None"] = relationship("Department", back_populates="users")
    channel_memberships: Mapped[list["ChannelMember"]] = relationship("ChannelMember", back_populates="user")  # type: ignore
    messages: Mapped[list["Message"]] = relationship("Message", back_populates="user", foreign_keys="Message.user_id")  # type: ignore
    schedule_tasks: Mapped[list["ScheduleTask"]] = relationship("ScheduleTask", back_populates="user")  # type: ignore
