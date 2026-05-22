"""
Configuration loader for ForexAI MT5 Bot.

Reads settings from environment variables or a .env file, with sensible defaults.
"""

import os
import logging
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from the same directory as this script
_ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=_ENV_PATH)


def _get_env(key: str, default: str | None = None, required: bool = False) -> str:
    """Fetch an environment variable, optionally enforcing its presence."""
    value = os.getenv(key, default)
    if required and not value:
        raise EnvironmentError(
            f"Required environment variable '{key}' is not set. "
            f"Copy .env.example to .env and fill in the values."
        )
    return value


def _get_int(key: str, default: int) -> int:
    """Fetch an integer environment variable."""
    try:
        return int(os.getenv(key, str(default)))
    except ValueError:
        return default


def _get_float(key: str, default: float) -> float:
    """Fetch a float environment variable."""
    try:
        return float(os.getenv(key, str(default)))
    except ValueError:
        return default


# ---------------------------------------------------------------------------
# Supabase
# ---------------------------------------------------------------------------
SUPABASE_URL: str = _get_env("SUPABASE_URL", required=True)
SUPABASE_SERVICE_KEY: str = _get_env("SUPABASE_SERVICE_KEY", required=True)

# ---------------------------------------------------------------------------
# MT5 Terminal
# ---------------------------------------------------------------------------
MT5_LOGIN: int = _get_int("MT5_LOGIN", 0)
MT5_PASSWORD: str = _get_env("MT5_PASSWORD", "")
MT5_SERVER: str = _get_env("MT5_SERVER", "MetaQuotes-Demo")
MT5_PATH: str = _get_env("MT5_PATH", r"C:\Program Files\MetaTrader 5\terminal64.exe")

# ---------------------------------------------------------------------------
# Bot behaviour
# ---------------------------------------------------------------------------
POLL_INTERVAL: int = _get_int("POLL_INTERVAL", 30)          # seconds between signal polls
POSITION_SYNC_INTERVAL: int = _get_int("POSITION_SYNC_INTERVAL", 60)  # seconds between position syncs
HEARTBEAT_INTERVAL: int = _get_int("HEARTBEAT_INTERVAL", 60)          # seconds between heartbeats
LOG_LEVEL: str = _get_env("LOG_LEVEL", "INFO").upper()

# ---------------------------------------------------------------------------
# Derived helpers
# ---------------------------------------------------------------------------

def validate() -> list[str]:
    """Return a list of configuration problems (empty = OK)."""
    problems: list[str] = []
    if not SUPABASE_URL or "your-project" in SUPABASE_URL:
        problems.append("SUPABASE_URL is not configured")
    if not SUPABASE_SERVICE_KEY or "your-service-role-key" in SUPABASE_SERVICE_KEY:
        problems.append("SUPABASE_SERVICE_KEY is not configured")
    if MT5_LOGIN == 0:
        problems.append("MT5_LOGIN is not set (must be your MT5 account number)")
    if not MT5_PASSWORD:
        problems.append("MT5_PASSWORD is not set")
    if not MT5_SERVER:
        problems.append("MT5_SERVER is not set")
    if POLL_INTERVAL < 5:
        problems.append("POLL_INTERVAL must be >= 5 seconds")
    return problems


def as_dict() -> dict:
    """Return a safe, redacted summary of the configuration (for logging)."""
    return {
        "SUPABASE_URL": SUPABASE_URL,
        "SUPABASE_SERVICE_KEY": SUPABASE_SERVICE_KEY[:8] + "..." if len(SUPABASE_SERVICE_KEY) > 8 else "***",
        "MT5_LOGIN": MT5_LOGIN,
        "MT5_PASSWORD": "***",
        "MT5_SERVER": MT5_SERVER,
        "MT5_PATH": MT5_PATH,
        "POLL_INTERVAL": POLL_INTERVAL,
        "POSITION_SYNC_INTERVAL": POSITION_SYNC_INTERVAL,
        "HEARTBEAT_INTERVAL": HEARTBEAT_INTERVAL,
        "LOG_LEVEL": LOG_LEVEL,
    }


def setup_logging() -> logging.Logger:
    """Configure and return the root logger for the bot."""
    logger = logging.getLogger("forexai")
    logger.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))

    # Console handler with timestamp
    console = logging.StreamHandler()
    console.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-7s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    console.setFormatter(formatter)
    logger.addHandler(console)

    # File handler
    log_path = Path(__file__).resolve().parent / "bot.log"
    file_handler = logging.FileHandler(log_path, encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    return logger
