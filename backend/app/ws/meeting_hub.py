import asyncio
from typing import Any

from fastapi import WebSocket


class MeetingHub:
    def __init__(self) -> None:
        self._rooms: dict[str, dict[int, WebSocket]] = {}
        self._socket_meta: dict[WebSocket, tuple[str, int]] = {}
        self._pending: dict[tuple[str, int], list[dict[str, Any]]] = {}
        self._lock = asyncio.Lock()

    @staticmethod
    def _room_key(meeting_id: str) -> str:
        return "".join(char for char in meeting_id if char.isdigit()) or meeting_id

    async def connect(self, meeting_id: str, participant_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        key = self._room_key(meeting_id)
        async with self._lock:
            self._rooms.setdefault(key, {})[participant_id] = websocket
            self._socket_meta[websocket] = (key, participant_id)

        await self._flush_pending(meeting_id, participant_id)

    async def _flush_pending(self, meeting_id: str, participant_id: int) -> None:
        key = self._room_key(meeting_id)
        pending_key = (key, participant_id)
        async with self._lock:
            messages = self._pending.pop(pending_key, [])

        for message in messages:
            await self.send_to(meeting_id, participant_id, message, queue_if_offline=False)

    async def disconnect(self, meeting_id: str, websocket: WebSocket) -> tuple[str, int] | None:
        key = self._room_key(meeting_id)
        participant_id: int | None = None
        async with self._lock:
            meta = self._socket_meta.pop(websocket, None)
            if meta:
                key, participant_id = meta
            if key in self._rooms:
                self._rooms[key] = {
                    pid: sock for pid, sock in self._rooms[key].items() if sock is not websocket
                }
                if not self._rooms[key]:
                    del self._rooms[key]
        if participant_id is not None:
            return key, participant_id
        return None

    async def send_to(
        self,
        meeting_id: str,
        target_participant_id: int,
        message: dict[str, Any],
        *,
        queue_if_offline: bool = True,
    ) -> bool:
        key = self._room_key(meeting_id)
        async with self._lock:
            websocket = self._rooms.get(key, {}).get(target_participant_id)

        if websocket is None:
            if queue_if_offline and message.get("type") in {
                "webrtc_offer",
                "webrtc_answer",
                "webrtc_ice",
                "webrtc_ready",
            }:
                async with self._lock:
                    queue = self._pending.setdefault((key, target_participant_id), [])
                    if message.get("type") == "webrtc_ice":
                        candidate = message.get("candidate", {})
                        fingerprint = (
                            f"{candidate.get('sdpMid')}:{candidate.get('sdpMLineIndex')}:"
                            f"{candidate.get('candidate')}"
                        )
                        if any(
                            f"{item.get('candidate', {}).get('sdpMid')}:"
                            f"{item.get('candidate', {}).get('sdpMLineIndex')}:"
                            f"{item.get('candidate', {}).get('candidate')}" == fingerprint
                            for item in queue
                            if item.get("type") == "webrtc_ice"
                        ):
                            return False
                    queue.append(message)
                    if len(queue) > 200:
                        del queue[:-200]
                return False
            return False

        try:
            await websocket.send_json(message)
            return True
        except Exception:
            await self.disconnect(meeting_id, websocket)
            return False

    async def broadcast(
        self,
        meeting_id: str,
        message: dict[str, Any],
        exclude_participant_id: int | None = None,
    ) -> None:
        key = self._room_key(meeting_id)
        async with self._lock:
            participants = dict(self._rooms.get(key, {}))

        stale: list[WebSocket] = []
        for participant_id, websocket in participants.items():
            if exclude_participant_id is not None and participant_id == exclude_participant_id:
                continue
            try:
                await websocket.send_json(message)
            except Exception:
                stale.append(websocket)

        for websocket in stale:
            await self.disconnect(meeting_id, websocket)

    def has_participant(self, meeting_id: str, participant_id: int) -> bool:
        key = self._room_key(meeting_id)
        return participant_id in self._rooms.get(key, {})

    def participant_ids(self, meeting_id: str) -> list[int]:
        key = self._room_key(meeting_id)
        return list(self._rooms.get(key, {}).keys())


meeting_hub = MeetingHub()
