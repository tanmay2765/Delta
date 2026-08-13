import json
import logging
import os
import urllib.error
import urllib.request

from fastapi import APIRouter

logger = logging.getLogger(__name__)

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


def _metered_credentials_url() -> str:
    explicit = os.getenv("METERED_TURN_CREDENTIALS_URL", "").strip()
    if explicit:
        return explicit

    app_name = os.getenv("METERED_APP_NAME", "").strip()
    if app_name:
        return f"https://{app_name}.metered.ca/api/v1/turn/credentials"

    return ""


def _fetch_metered_credentials() -> tuple[list[dict], str | None]:
    api_key = os.getenv("METERED_TURN_API_KEY", "").strip()
    if not api_key:
        return [], "METERED_TURN_API_KEY not set"

    base_url = _metered_credentials_url()
    if not base_url:
        return [], "Set METERED_TURN_CREDENTIALS_URL or METERED_APP_NAME"

    separator = "&" if "?" in base_url else "?"
    url = f"{base_url}{separator}apiKey={api_key}"

    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:200]
        logger.error("Metered TURN HTTP %s: %s", exc.code, body)
        return [], f"Metered API HTTP {exc.code}"
    except (urllib.error.URLError, TimeoutError) as exc:
        logger.error("Metered TURN network error: %s", exc)
        return [], f"Metered API unreachable: {exc}"
    except (json.JSONDecodeError, ValueError) as exc:
        logger.error("Metered TURN invalid JSON: %s", exc)
        return [], "Metered API returned invalid JSON"

    if isinstance(payload, list) and payload:
        return payload, None

    return [], "Metered API returned empty credentials"


def _has_turn(servers: list[dict]) -> bool:
    for server in servers:
        urls = server.get("urls")
        if isinstance(urls, str):
            urls = [urls]
        if not isinstance(urls, list):
            continue
        if any(str(url).startswith("turn") for url in urls):
            if server.get("username") and server.get("credential"):
                return True
    return False


def build_ice_config() -> dict:
    """Build ICE server list and metadata for WebRTC clients."""
    sources: list[str] = ["stun"]
    servers = _stun_servers()
    turn_error: str | None = None

    metered, metered_error = _fetch_metered_credentials()
    if metered:
        servers.extend(metered)
        sources.append("metered")
    elif metered_error:
        turn_error = metered_error

    env_turn = _turn_from_env()
    if env_turn:
        servers.extend(env_turn)
        sources.append("env")

    turn_configured = _has_turn(servers)

    if not turn_configured and not turn_error:
        turn_error = (
            "No TURN server configured. Set METERED_TURN_API_KEY + METERED_APP_NAME "
            "or TURN_URLS + TURN_USERNAME + TURN_CREDENTIAL on the backend."
        )

    return {
        "ice_servers": servers,
        "turn_configured": turn_configured,
        "sources": sources,
        "turn_error": turn_error,
    }


@router.get("/ice-servers")
def ice_servers() -> dict:
    return build_ice_config()


@router.get("/status")
def turn_status() -> dict:
    config = build_ice_config()
    return {
        "turn_configured": config["turn_configured"],
        "sources": config["sources"],
        "turn_error": config["turn_error"],
        "stun_count": sum(
            1
            for s in config["ice_servers"]
            if str(s.get("urls", "")).startswith("stun") or "stun:" in str(s.get("urls"))
        ),
        "turn_count": sum(
            1 for s in config["ice_servers"] if _has_turn([s])
        ),
    }
