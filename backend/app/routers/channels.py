from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.channel import Channel, ChannelMember
from app.models.message import Message
from app.schemas.channel import ChannelCreate, ChannelUpdate, ChannelOut, ChannelMemberOut, DMCreateRequest

router = APIRouter()


async def get_unread_count(db: AsyncSession, channel_id: str, user_id: str) -> int:
    # last_read_at 이후 메시지 수 조회
    member_result = await db.execute(
        select(ChannelMember).where(
            ChannelMember.channel_id == channel_id,
            ChannelMember.user_id == user_id,
        )
    )
    member = member_result.scalar_one_or_none()
    if not member or not member.last_read_at:
        return 0

    result = await db.execute(
        select(func.count()).where(
            Message.channel_id == channel_id,
            Message.created_at > member.last_read_at,
            Message.user_id != user_id,
            Message.is_deleted == False,
        )
    )
    return result.scalar() or 0


@router.get("", response_model=list[ChannelOut])
async def list_channels(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Channel)
        .join(ChannelMember, (Channel.id == ChannelMember.channel_id) & (ChannelMember.user_id == current_user.id))
        .order_by(Channel.name)
    )
    channels = result.scalars().all()

    channel_list = []
    for ch in channels:
        unread = await get_unread_count(db, ch.id, current_user.id)
        channel_out = ChannelOut.model_validate(ch)
        channel_out.unread_count = unread
        channel_list.append(channel_out)

    return channel_list


@router.post("", response_model=ChannelOut, status_code=201)
async def create_channel(
    req: ChannelCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    channel = Channel(
        name=req.name,
        description=req.description,
        type=req.type,
        created_by=current_user.id,
    )
    db.add(channel)
    await db.flush()

    # 생성자를 owner로 추가
    member_ids = set(req.member_ids) | {current_user.id}
    for uid in member_ids:
        role = "owner" if uid == current_user.id else "member"
        member = ChannelMember(
            channel_id=channel.id,
            user_id=uid,
            role=role,
            joined_at=datetime.now(timezone.utc),
        )
        db.add(member)

    await db.commit()
    await db.refresh(channel)
    return ChannelOut.model_validate(channel)


@router.get("/{channel_id}", response_model=ChannelOut)
async def get_channel(
    channel_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Channel)
        .join(ChannelMember, (Channel.id == ChannelMember.channel_id) & (ChannelMember.user_id == current_user.id))
        .where(Channel.id == channel_id)
    )
    channel = result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="채널을 찾을 수 없습니다")
    return channel


@router.patch("/{channel_id}", response_model=ChannelOut)
async def update_channel(
    channel_id: str,
    req: ChannelUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Channel).where(Channel.id == channel_id))
    channel = result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="채널을 찾을 수 없습니다")

    if req.name is not None:
        channel.name = req.name
    if req.description is not None:
        channel.description = req.description

    await db.commit()
    await db.refresh(channel)
    return channel


@router.delete("/{channel_id}", status_code=204)
async def delete_channel(
    channel_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ChannelMember).where(
            ChannelMember.channel_id == channel_id,
            ChannelMember.user_id == current_user.id,
            ChannelMember.role == "owner",
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="채널 소유자만 삭제할 수 있습니다")

    result = await db.execute(select(Channel).where(Channel.id == channel_id))
    channel = result.scalar_one_or_none()
    if channel:
        await db.delete(channel)
        await db.commit()


@router.get("/{channel_id}/members", response_model=list[ChannelMemberOut])
async def get_channel_members(
    channel_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ChannelMember)
        .options(selectinload(ChannelMember.user).selectinload(User.department))
        .where(ChannelMember.channel_id == channel_id)
    )
    return result.scalars().all()


@router.post("/{channel_id}/members/{user_id}", status_code=201)
async def add_member(
    channel_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = await db.execute(
        select(ChannelMember).where(
            ChannelMember.channel_id == channel_id,
            ChannelMember.user_id == user_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="이미 채널 멤버입니다")

    member = ChannelMember(
        channel_id=channel_id,
        user_id=user_id,
        joined_at=datetime.now(timezone.utc),
    )
    db.add(member)
    await db.commit()
    return {"message": "멤버 추가 완료"}


@router.delete("/{channel_id}/members/{user_id}", status_code=204)
async def remove_member(
    channel_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ChannelMember).where(
            ChannelMember.channel_id == channel_id,
            ChannelMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if member:
        await db.delete(member)
        await db.commit()


@router.post("/{channel_id}/read", status_code=200)
async def mark_channel_read(
    channel_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ChannelMember).where(
            ChannelMember.channel_id == channel_id,
            ChannelMember.user_id == current_user.id,
        )
    )
    member = result.scalar_one_or_none()
    if member:
        member.last_read_at = datetime.now(timezone.utc)
        await db.commit()
    return {"message": "읽음 처리 완료"}


@router.post("/dm", response_model=ChannelOut, status_code=201)
async def create_dm(
    req: DMCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 기존 DM 채널 확인
    existing = await db.execute(
        select(Channel)
        .join(ChannelMember, Channel.id == ChannelMember.channel_id)
        .where(
            Channel.type == "dm",
            ChannelMember.user_id == current_user.id,
        )
    )
    for channel in existing.scalars().all():
        members_result = await db.execute(
            select(ChannelMember).where(ChannelMember.channel_id == channel.id)
        )
        members = members_result.scalars().all()
        member_ids = {m.user_id for m in members}
        if member_ids == {current_user.id, req.target_user_id}:
            return ChannelOut.model_validate(channel)

    # 새 DM 채널 생성
    target_result = await db.execute(select(User).where(User.id == req.target_user_id))
    target_user = target_result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="대상 사용자를 찾을 수 없습니다")

    channel = Channel(
        name=f"DM_{current_user.id}_{req.target_user_id}",
        type="dm",
        created_by=current_user.id,
    )
    db.add(channel)
    await db.flush()

    for uid in [current_user.id, req.target_user_id]:
        member = ChannelMember(
            channel_id=channel.id,
            user_id=uid,
            role="member",
            joined_at=datetime.now(timezone.utc),
        )
        db.add(member)

    await db.commit()
    await db.refresh(channel)
    return ChannelOut.model_validate(channel)
