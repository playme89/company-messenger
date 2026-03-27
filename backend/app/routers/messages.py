from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone
import json

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.redis import get_redis
from app.models.user import User
from app.models.channel import Channel, ChannelMember
from app.models.message import Message, MessageFile, MessageReaction
from app.schemas.message import MessageCreate, MessageUpdate, MessageOut, MessageSearchResult, ReactionOut

router = APIRouter()


async def check_channel_member(db: AsyncSession, channel_id: str, user_id: str):
    result = await db.execute(
        select(ChannelMember).where(
            ChannelMember.channel_id == channel_id,
            ChannelMember.user_id == user_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="채널 멤버가 아닙니다")


def build_message_query(channel_id: str):
    return (
        select(Message)
        .options(
            selectinload(Message.user).selectinload(User.department),
            selectinload(Message.files),
            selectinload(Message.reactions).selectinload(MessageReaction.user),
        )
        .where(Message.channel_id == channel_id, Message.parent_id == None)
        .order_by(desc(Message.created_at))
    )


def to_message_out(msg: Message) -> MessageOut:
    reactions_grouped: dict[str, ReactionOut] = {}
    for r in msg.reactions:
        if r.emoji not in reactions_grouped:
            reactions_grouped[r.emoji] = ReactionOut(emoji=r.emoji, user_id=r.user_id, count=0)
        reactions_grouped[r.emoji].count += 1

    out = MessageOut(
        id=msg.id,
        channel_id=msg.channel_id,
        user_id=msg.user_id,
        parent_id=msg.parent_id,
        content=msg.content,
        content_type=msg.content_type,
        is_edited=msg.is_edited,
        is_deleted=msg.is_deleted,
        created_at=msg.created_at,
        updated_at=msg.updated_at,
        user=msg.user,
        files=msg.files,
        reactions=list(reactions_grouped.values()),
    )
    return out


@router.get("/channels/{channel_id}/messages", response_model=list[MessageOut])
async def get_messages(
    channel_id: str,
    before: str | None = Query(None, description="커서 기반 페이지네이션: 이 메시지 ID 이전"),
    limit: int = Query(50, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await check_channel_member(db, channel_id, current_user.id)

    query = build_message_query(channel_id)
    if before:
        before_msg = await db.execute(select(Message).where(Message.id == before))
        before_obj = before_msg.scalar_one_or_none()
        if before_obj:
            query = query.where(Message.created_at < before_obj.created_at)

    query = query.limit(limit)
    result = await db.execute(query)
    messages = result.scalars().all()
    return [to_message_out(m) for m in reversed(messages)]


@router.post("/channels/{channel_id}/messages", response_model=MessageOut, status_code=201)
async def send_message(
    channel_id: str,
    req: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await check_channel_member(db, channel_id, current_user.id)

    msg = Message(
        channel_id=channel_id,
        user_id=current_user.id,
        content=req.content,
        parent_id=req.parent_id,
    )
    db.add(msg)
    await db.flush()

    # 파일 연결
    if req.file_ids:
        file_result = await db.execute(
            select(MessageFile).where(MessageFile.id.in_(req.file_ids))
        )
        for f in file_result.scalars().all():
            f.message_id = msg.id

    await db.commit()

    # 전체 로드
    result = await db.execute(
        select(Message)
        .options(
            selectinload(Message.user).selectinload(User.department),
            selectinload(Message.files),
            selectinload(Message.reactions),
        )
        .where(Message.id == msg.id)
    )
    full_msg = result.scalar_one()

    msg_out = to_message_out(full_msg)

    # WebSocket 브로드캐스트
    redis = await get_redis()
    await redis.publish(
        f"chat:channel:{channel_id}",
        json.dumps({"type": "new_message", "payload": msg_out.model_dump(mode="json")}),
    )

    return msg_out


@router.patch("/messages/{message_id}", response_model=MessageOut)
async def update_message(
    message_id: str,
    req: MessageUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Message).where(Message.id == message_id))
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="메시지를 찾을 수 없습니다")
    if msg.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인 메시지만 수정할 수 있습니다")

    msg.content = req.content
    msg.is_edited = True
    msg.updated_at = datetime.now(timezone.utc)
    await db.commit()

    redis = await get_redis()
    await redis.publish(
        f"chat:channel:{msg.channel_id}",
        json.dumps({"type": "message_updated", "payload": {"message_id": message_id, "content": req.content}}),
    )

    result = await db.execute(
        select(Message)
        .options(
            selectinload(Message.user).selectinload(User.department),
            selectinload(Message.files),
            selectinload(Message.reactions),
        )
        .where(Message.id == message_id)
    )
    return to_message_out(result.scalar_one())


@router.delete("/messages/{message_id}", status_code=204)
async def delete_message(
    message_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Message).where(Message.id == message_id))
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="메시지를 찾을 수 없습니다")
    if msg.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인 메시지만 삭제할 수 있습니다")

    msg.is_deleted = True
    msg.content = "삭제된 메시지입니다"
    await db.commit()

    redis = await get_redis()
    await redis.publish(
        f"chat:channel:{msg.channel_id}",
        json.dumps({"type": "message_deleted", "payload": {"message_id": message_id, "channel_id": msg.channel_id}}),
    )


@router.get("/channels/{channel_id}/threads/{message_id}", response_model=list[MessageOut])
async def get_thread_replies(
    channel_id: str,
    message_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await check_channel_member(db, channel_id, current_user.id)

    result = await db.execute(
        select(Message)
        .options(
            selectinload(Message.user).selectinload(User.department),
            selectinload(Message.files),
            selectinload(Message.reactions),
        )
        .where(Message.parent_id == message_id, Message.is_deleted == False)
        .order_by(Message.created_at)
    )
    return [to_message_out(m) for m in result.scalars().all()]


@router.post("/messages/{message_id}/reactions/{emoji}", status_code=201)
async def add_reaction(
    message_id: str,
    emoji: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = await db.execute(
        select(MessageReaction).where(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == current_user.id,
            MessageReaction.emoji == emoji,
        )
    )
    if existing.scalar_one_or_none():
        return {"message": "이미 반응을 추가했습니다"}

    reaction = MessageReaction(
        message_id=message_id,
        user_id=current_user.id,
        emoji=emoji,
    )
    db.add(reaction)
    await db.commit()

    result = await db.execute(select(Message).where(Message.id == message_id))
    msg = result.scalar_one_or_none()
    if msg:
        redis = await get_redis()
        await redis.publish(
            f"chat:channel:{msg.channel_id}",
            json.dumps({
                "type": "new_reaction",
                "payload": {"message_id": message_id, "emoji": emoji, "user_id": current_user.id},
            }),
        )
    return {"message": "반응 추가 완료"}


@router.delete("/messages/{message_id}/reactions/{emoji}", status_code=204)
async def remove_reaction(
    message_id: str,
    emoji: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(MessageReaction).where(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == current_user.id,
            MessageReaction.emoji == emoji,
        )
    )
    reaction = result.scalar_one_or_none()
    if reaction:
        await db.delete(reaction)
        await db.commit()


@router.get("/messages/search", response_model=MessageSearchResult)
async def search_messages(
    q: str = Query(..., min_length=1),
    channel_id: str | None = Query(None),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(Message)
        .options(
            selectinload(Message.user).selectinload(User.department),
            selectinload(Message.files),
            selectinload(Message.reactions),
        )
        .join(ChannelMember, (Message.channel_id == ChannelMember.channel_id) & (ChannelMember.user_id == current_user.id))
        .where(Message.content.ilike(f"%{q}%"), Message.is_deleted == False)
    )
    if channel_id:
        query = query.where(Message.channel_id == channel_id)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0

    query = query.order_by(desc(Message.created_at)).offset(offset).limit(limit)
    result = await db.execute(query)
    messages = [to_message_out(m) for m in result.scalars().all()]

    return MessageSearchResult(messages=messages, total=total)
