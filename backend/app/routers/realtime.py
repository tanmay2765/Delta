import json
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.database import SessionLocal
from app.services import meeting_service
from app.ws.meeting_hub import meeting_hub

router = APIRouter(prefix="/api/meetings", tags=["realtime"])

WEBRTC_SIGNAL_TYPES = {
    "webrtc_offer",
    "webrtc_answer",
    "webrtc_ice",
}

CHAT_MESSAGE_TYPE = "chat_message"
REACTION_MESSAGE_TYPE = "reaction"


async def _broadcast_meeting_state(meeting_identifier: str) -> None:
    db = SessionLocal()
    try:
        meeting = meeting_service.get_meeting_details(db, meeting_identifier)
        if not meeting:
            return
        payload = meeting_service.meeting_to_response(meeting)
        await meeting_hub.broadcast(
            meeting.meeting_id,
            {"type": "meeting_updated", "meeting": payload},
        )
    finally:
        db.close()


async def broadcast_meeting_state(meeting_identifier: str) -> None:
    await _broadcast_meeting_state(meeting_identifier)


async def broadcast_meeting_ended(meeting_identifier: str) -> None:
    db = SessionLocal()
    try:
        meeting = meeting_service.get_meeting_details(db, meeting_identifier)
        if not meeting:
            return
        await meeting_hub.broadcast(
            meeting.meeting_id,
            {"type": "meeting_ended", "meeting_id": meeting.meeting_id},
        )
    finally:
        db.close()


async def broadcast_participant_removed(meeting_identifier: str, participant_id: int) -> None:
    db = SessionLocal()
    try:
        meeting = meeting_service.get_meeting_details(db, meeting_identifier)
        if not meeting:
            return
        await meeting_hub.send_to(
            meeting.meeting_id,
            participant_id,
            {"type": "participant_removed"},
        )
        await meeting_hub.broadcast(
            meeting.meeting_id,
            {"type": "meeting_updated", "meeting": meeting_service.meeting_to_response(meeting)},
        )
    finally:
        db.close()


@router.websocket("/{meeting_id}/ws")
async def meeting_websocket(
    websocket: WebSocket,
    meeting_id: str,
    participant_id: int,
    session_token: str,
) -> None:
    db = SessionLocal()
    try:
        meeting, participant = meeting_service.verify_participant_session(
            db,
            meeting_id,
            participant_id,
            session_token,
        )
        if not meeting or not participant:
            await websocket.close(code=4403)
            return
        if meeting.status == "ended":
            await websocket.close(code=4410)
            return
    finally:
        db.close()

    await meeting_hub.connect(meeting_id, participant_id, websocket)

    db = SessionLocal()
    try:
        meeting = meeting_service.get_meeting_details(db, meeting_id)
        if meeting:
            await websocket.send_json(
                {
                    "type": "meeting_updated",
                    "meeting": meeting_service.meeting_to_response(meeting),
                }
            )
    finally:
        db.close()

    await meeting_hub.broadcast(
        meeting_id,
        {"type": "webrtc_ready", "from": participant_id},
        exclude_participant_id=participant_id,
    )

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                continue

            if not isinstance(payload, dict):
                continue

            message_type = payload.get("type")
            if message_type == CHAT_MESSAGE_TYPE:
                text = payload.get("text")
                if not isinstance(text, str) or not text.strip():
                    continue
                db = SessionLocal()
                try:
                    meeting = meeting_service.get_meeting_details(db, meeting_id)
                    participant = next(
                        (p for p in meeting.participants if p.id == participant_id),
                        None,
                    ) if meeting else None
                    sender_name = participant.display_name if participant else "Guest"
                finally:
                    db.close()
                await meeting_hub.broadcast(
                    meeting_id,
                    {
                        "type": CHAT_MESSAGE_TYPE,
                        "from": participant_id,
                        "sender_name": sender_name,
                        "text": text.strip()[:2000],
                        "sent_at": datetime.utcnow().isoformat(),
                    },
                )
                continue

            if message_type == REACTION_MESSAGE_TYPE:
                emoji = payload.get("emoji")
                if not isinstance(emoji, str) or not emoji.strip():
                    continue
                await meeting_hub.broadcast(
                    meeting_id,
                    {
                        "type": REACTION_MESSAGE_TYPE,
                        "from": participant_id,
                        "emoji": emoji.strip()[:8],
                    },
                )
                continue

            if message_type not in WEBRTC_SIGNAL_TYPES:
                continue

            target_id = payload.get("to")
            if not isinstance(target_id, int):
                continue

            if not meeting_hub.has_participant(meeting_id, target_id):
                continue

            relay = {key: value for key, value in payload.items() if key != "to"}
            relay["from"] = participant_id
            await meeting_hub.send_to(meeting_id, target_id, relay)
    except WebSocketDisconnect:
        disconnected = await meeting_hub.disconnect(meeting_id, websocket)
        if disconnected:
            _, left_participant_id = disconnected
            await meeting_hub.broadcast(
                meeting_id,
                {"type": "webrtc_left", "from": left_participant_id},
            )
