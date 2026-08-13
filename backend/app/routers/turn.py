import json
import os
import urllib.error
import urllib.request

from fastapi import APIRouter

router = APIRouter(prefix="/api/turn", tags=["turn"])

DEFAULT_ICE_SERVERS = [
    {"urls": "stun:stun.l.google.com:19302"},
    {"urls": "stun:stun1.l.google.com:19302"},
    {"urls": "stun:stun.relay.metered.ca:80"},
    {
        "urls": [
            "turn:openrelay.metered.ca:80",
            "turn:openrelay.metered.ca:443",
            "turn:openrelay.metered.ca:443?transport=tcp",
            "turns:openrelay.metered.ca:443?transport=tcp",
        ],
        "username": "openrelayproject",
        "credential": "openrelayproject",
    },
]


def _fetch_metered_credentials() -> list[dict] | None:
    api_key = os.getenv("METERED_TURN_API_KEY", "").strip()
    if not api_key:
        return None

    base_url = os.getenv(
        "METERED_TURN_CREDENTIALS_URL",
        "https://delta.metered.live/api/v1/turn/credentials",
    ).strip()
    separator = "&" if "?" in base_url else "?"
    url = f"{base_url}{separator}apiKey={api_key}"

    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError):
        return None

    if isinstance(payload, list) and payload:
        return payload
    return None


@router.get("/ice-servers")
def ice_servers() -> list[dict]:
    """
    Return ICE/TURN servers for WebRTC.

    Set METERED_TURN_API_KEY on the backend for reliable cross-network video
    (free tier at https://www.metered.ca/tools/open-relay or a Metered app key).
    """
    metered = _fetch_metered_credentials()
    if metered:
        stun = [
            {"urls": "stun:stun.l.google.com:19302"},
            {"urls": "stun:stun.relay.metered.ca:80"},
        ]
        return stun + metered
    return DEFAULT_ICE_SERVERS
