import asyncio
import json
from fastapi import WebSocket
from typing import DefaultDict
from collections import defaultdict


class ConnectionManager:
    def __init__(self):
        # user_id -> list of WebSocket connections
        self.user_connections: DefaultDict[str, list[WebSocket]] = defaultdict(list)
        # channel_id -> set of user_ids
        self.channel_subscribers: DefaultDict[str, set[str]] = defaultdict(set)

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.user_connections[user_id].append(websocket)

    def disconnect(self, user_id: str, websocket: WebSocket):
        if websocket in self.user_connections[user_id]:
            self.user_connections[user_id].remove(websocket)
        if not self.user_connections[user_id]:
            del self.user_connections[user_id]

        for channel_id in list(self.channel_subscribers.keys()):
            self.channel_subscribers[channel_id].discard(user_id)

    def subscribe_channel(self, user_id: str, channel_id: str):
        self.channel_subscribers[channel_id].add(user_id)

    def unsubscribe_channel(self, user_id: str, channel_id: str):
        self.channel_subscribers[channel_id].discard(user_id)

    async def send_to_user(self, user_id: str, data: dict):
        connections = self.user_connections.get(user_id, [])
        dead = []
        for ws in connections:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.user_connections[user_id].remove(ws)

    async def broadcast_to_channel(self, channel_id: str, data: dict, exclude_user_id: str | None = None):
        subscribers = self.channel_subscribers.get(channel_id, set()).copy()
        tasks = []
        for uid in subscribers:
            if uid == exclude_user_id:
                continue
            tasks.append(self.send_to_user(uid, data))
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def broadcast_to_all(self, data: dict):
        tasks = [self.send_to_user(uid, data) for uid in list(self.user_connections.keys())]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    def is_online(self, user_id: str) -> bool:
        return bool(self.user_connections.get(user_id))


manager = ConnectionManager()
