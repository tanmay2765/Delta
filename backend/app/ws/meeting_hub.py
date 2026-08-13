import asyncio
from typing import Any

from fastapi import WebSocket


class MeetingHub:
    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    @staticmethod
    def _room_key(meeting_id: str) -> str:
        return "".join(char for char in meeting_id if char.isdigit()) or meeting_id

    async def connect(self, meeting_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        key = self._room_key(meeting_id)
        async with self._lock:
            self._rooms.setdefault(key, set()).add(websocket)

    async def disconnect(self, meeting_id: str, websocket: WebSocket) -> None:
        key = self._room_key(meeting_id)
        async with self._lock:
            if key in self._rooms:
                self._rooms[key].discard(websocket)
                if not self._rooms[key]:
                    del self._rooms[key]

    async def broadcast(self, meeting_id: str, message: dict[str, Any]) -> None:
        key = self._room_key(meeting_id)
        async with self._lock:
            sockets = list(self._rooms.get(key, set()))

        stale: list[WebSocket] = []
        for websocket in sockets:
            try:
                await websocket.send_json(message)
            except Exception:
                stale.append(websocket)

        if stale:
            async with self._lock:
                room = self._rooms.get(key)
                if room:
                    for websocket in stale:
                        room.discard(websocket)


meeting_hub = MeetingHub()
