from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select
from datetime import datetime, timezone
import json

from app.core.security import decode_token
from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.websocket.manager import manager
from app.services.presence_service import set_online, set_offline, refresh_presence
from app.core.redis import get_redis

router = APIRouter()


async def get_user_from_token(token: str) -> User | None:
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
        return result.scalar_one_or_none()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    user = await get_user_from_token(token)
    if not user:
        await websocket.close(code=4001)
        return

    await manager.connect(user.id, websocket)
    await set_online(user.id)

    # 연결 성공 알림
    await websocket.send_json({"type": "connected", "payload": {"user_id": user.id}})

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            event_type = data.get("type")
            payload = data.get("payload", {})

            if event_type == "ping":
                await refresh_presence(user.id)
                await websocket.send_json({"type": "pong", "payload": {"timestamp": payload.get("timestamp")}})

            elif event_type == "join_channel":
                channel_id = payload.get("channel_id")
                if channel_id:
                    manager.subscribe_channel(user.id, channel_id)

            elif event_type == "leave_channel":
                channel_id = payload.get("channel_id")
                if channel_id:
                    manager.unsubscribe_channel(user.id, channel_id)

            elif event_type == "typing_start":
                channel_id = payload.get("channel_id")
                if channel_id:
                    await manager.broadcast_to_channel(
                        channel_id,
                        {"type": "user_typing", "payload": {"channel_id": channel_id, "user_id": user.id, "is_typing": True}},
                        exclude_user_id=user.id,
                    )

            elif event_type == "typing_stop":
                channel_id = payload.get("channel_id")
                if channel_id:
                    await manager.broadcast_to_channel(
                        channel_id,
                        {"type": "user_typing", "payload": {"channel_id": channel_id, "user_id": user.id, "is_typing": False}},
                        exclude_user_id=user.id,
                    )

            elif event_type == "mark_read":
                channel_id = payload.get("channel_id")
                if channel_id:
                    async with AsyncSessionLocal() as db:
                        from app.models.channel import ChannelMember
                        result = await db.execute(
                            select(ChannelMember).where(
                                ChannelMember.channel_id == channel_id,
                                ChannelMember.user_id == user.id,
                            )
                        )
                        member = result.scalar_one_or_none()
                        if member:
                            member.last_read_at = datetime.now(timezone.utc)
                            await db.commit()

    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(user.id, websocket)
        if not manager.is_online(user.id):
            await set_offline(user.id)
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(User).where(User.id == user.id))
                u = result.scalar_one_or_none()
                if u:
                    u.last_seen_at = datetime.now(timezone.utc)
                    await db.commit()
