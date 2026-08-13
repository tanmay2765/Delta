import os
import json
import urllib.error
import urllib.request

from fastapi import APIRouter

router = APIRouter(prefix="/api/turn", tags=["turn"])


def _stun_servers() -> list[dict]:
    raw = os.getenv("STUN_URLS", "stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302")
    return [{"urls": url.strip()} for url in raw.split(",") if url.strip()]


def _turn_from_env() -> list[dict]:
    turn_urls = os.getenv("TURN_URLS", os.getenv("TURN_URL", "")).strip()
    username = os.getenv("TURN_USERNAME", "").strip()
    credential = os.getenv("TURN_CREDENTIAL", "").strip()
    if not turn_urls or not username or not credential:
        return []

    urls = [url.strip() for url in turn_urls.split(",") if url.strip()]
    return [{"urls": urls if len(urls) > 1 else urls[0], "username": username, "credential": credential}]


def _fetch_metered_credentials() -> list[dict] | None:
    api_key = os.getenv("METERED_TURN_API_KEY", "").strip()
    if not api_key:
        return None

    base_url = os.getenv("METERED_TURN_CREDENTIALS_URL", "").strip()
    if not base_url:
        return None

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
    ICE server config for WebRTC clients.

    Configure TURN via environment variables (never expose secrets in frontend source):

      STUN_URLS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
      TURN_URLS=turn:your.turn.server:3478,turns:your.turn.server:5349
      TURN_USERNAME=...
      TURN_CREDENTIAL=...

    Or use Metered dynamic credentials:

      METERED_TURN_API_KEY=...
      METERED_TURN_CREDENTIALS_URL=https://YOUR_APP.metered.ca/api/v1/turn/credentials
    """
    servers = _stun_servers()

    metered = _fetch_metered_credentials()
    if metered:
        return servers + metered

    servers.extend(_turn_from_env())
    return servers
