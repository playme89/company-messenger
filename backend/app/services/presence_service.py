import json
from datetime import datetime, timezone
from app.core.redis import get_redis

PRESENCE_TTL = 35  # 35초 TTL (클라이언트는 30초마다 ping)
PRESENCE_KEY = "user:{}:presence"


async def set_online(user_id: str):
    redis = await get_redis()
    data = {"status": "online", "last_ping": datetime.now(timezone.utc).isoformat()}
    await redis.setex(PRESENCE_KEY.format(user_id), PRESENCE_TTL, json.dumps(data))
    await redis.publish("presence:updates", json.dumps({"user_id": user_id, "status": "online"}))


async def set_offline(user_id: str):
    redis = await get_redis()
    await redis.delete(PRESENCE_KEY.format(user_id))
    await redis.publish("presence:updates", json.dumps({"user_id": user_id, "status": "offline"}))


async def refresh_presence(user_id: str):
    redis = await get_redis()
    key = PRESENCE_KEY.format(user_id)
    exists = await redis.exists(key)
    if exists:
        data = {"status": "online", "last_ping": datetime.now(timezone.utc).isoformat()}
        await redis.setex(key, PRESENCE_TTL, json.dumps(data))
    else:
        await set_online(user_id)


async def get_presence(user_id: str) -> str:
    redis = await get_redis()
    data = await redis.get(PRESENCE_KEY.format(user_id))
    if data:
        parsed = json.loads(data)
        return parsed.get("status", "offline")
    return "offline"


async def get_multiple_presence(user_ids: list[str]) -> dict[str, str]:
    redis = await get_redis()
    keys = [PRESENCE_KEY.format(uid) for uid in user_ids]
    if not keys:
        return {}
    values = await redis.mget(*keys)
    result = {}
    for uid, val in zip(user_ids, values):
        if val:
            parsed = json.loads(val)
            result[uid] = parsed.get("status", "offline")
        else:
            result[uid] = "offline"
    return result
