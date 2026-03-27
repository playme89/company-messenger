import asyncio
import json
import redis.asyncio as aioredis
from app.core.config import settings
from app.websocket.manager import manager


SUBSCRIBED_PATTERNS = [
    "chat:channel:*",
    "presence:updates",
    "schedule:department:*",
    "chat:dm:*",
]


async def redis_subscriber():
    """Redis Pub/Sub을 구독하고 WebSocket으로 브로드캐스트"""
    redis = aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
    )
    pubsub = redis.pubsub()
    await pubsub.psubscribe(*SUBSCRIBED_PATTERNS)

    async for message in pubsub.listen():
        if message["type"] not in ("message", "pmessage"):
            continue

        try:
            channel = message.get("channel") or message.get("pattern", "")
            data = json.loads(message["data"])

            if channel.startswith("chat:channel:"):
                channel_id = channel.split("chat:channel:")[1]
                await manager.broadcast_to_channel(channel_id, data)

            elif channel == "presence:updates":
                await manager.broadcast_to_all(data)

            elif channel.startswith("schedule:department:"):
                # 부서원 모두에게 브로드캐스트 (manager가 전체 사용자 연결 관리)
                await manager.broadcast_to_all(data)

            elif channel.startswith("chat:dm:"):
                user_id = channel.split("chat:dm:")[1]
                await manager.send_to_user(user_id, data)

        except Exception as e:
            print(f"Redis pubsub error: {e}")


async def start_redis_subscriber():
    asyncio.create_task(redis_subscriber())
