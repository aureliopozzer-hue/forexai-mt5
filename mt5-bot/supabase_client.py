"""
Supabase REST API client for ForexAI MT5 Bot.

All communication with the Supabase backend goes through this module.
Uses the service-role key so the bot has full access to all tables.
"""

import logging
import time
from typing import Any

import requests

import config

logger = logging.getLogger("forexai")

# Maximum number of retries for transient failures
_MAX_RETRIES = 3
_RETRY_BACKOFF = 2  # seconds, doubled on each retry


class SupabaseError(Exception):
    """Raised when a Supabase API call fails after retries."""


class SupabaseClient:
    """Lightweight wrapper around the Supabase REST API (PostgREST)."""

    def __init__(self) -> None:
        self.base_url = config.SUPABASE_URL.rstrip("/")
        self.rest_url = f"{self.base_url}/rest/v1"
        self.headers = {
            "apikey": config.SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {config.SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",  # so PATCH/POST returns the row
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _request(
        self,
        method: str,
        table: str,
        *,
        params: dict | None = None,
        json_body: dict | None = None,
    ) -> Any:
        """Perform an HTTP request to Supabase with retry logic."""
        url = f"{self.rest_url}/{table}"
        last_exc: Exception | None = None

        for attempt in range(1, _MAX_RETRIES + 1):
            try:
                resp = requests.request(
                    method,
                    url,
                    headers=self.headers,
                    params=params,
                    json=json_body,
                    timeout=15,
                )
                if resp.status_code in (200, 201):
                    return resp.json()
                if resp.status_code == 204:
                    return None
                # Conflict on upsert — still fine for our use
                if resp.status_code == 409:
                    logger.warning("Conflict on %s %s (attempt %d)", method, table, attempt)
                    return None
                logger.error(
                    "Supabase %s %s returned %d: %s",
                    method, table, resp.status_code, resp.text[:300],
                )
                last_exc = SupabaseError(f"HTTP {resp.status_code}: {resp.text[:200]}")
            except requests.RequestException as exc:
                logger.warning("Request failed on %s %s (attempt %d): %s", method, table, attempt, exc)
                last_exc = exc

            if attempt < _MAX_RETRIES:
                sleep_time = _RETRY_BACKOFF * (2 ** (attempt - 1))
                logger.info("Retrying in %ds …", sleep_time)
                time.sleep(sleep_time)

        raise SupabaseError(f"Failed after {_MAX_RETRIES} retries: {last_exc}") from last_exc

    def _get(self, table: str, params: dict | None = None) -> list[dict]:
        result = self._request("GET", table, params=params)
        return result if isinstance(result, list) else [result] if result else []

    def _post(self, table: str, body: dict) -> Any:
        return self._request("POST", table, json_body=body)

    def _patch(self, table: str, params: dict, body: dict) -> Any:
        return self._request("PATCH", table, params=params, json_body=body)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_pending_signals(self) -> list[dict]:
        """Fetch all signals with status 'pending', ordered by creation time."""
        rows = self._get(
            "mt5_signals",
            params={
                "select": "*",
                "status": "eq.pending",
                "order": "created_at.asc",
            },
        )
        logger.debug("Fetched %d pending signal(s)", len(rows))
        return rows

    def update_signal_status(
        self,
        signal_id: str,
        status: str,
        error: str | None = None,
    ) -> None:
        """Update a signal's status after execution attempt.

        Args:
            signal_id: The primary key of the signal row.
            status: One of 'executed', 'skipped', 'expired', 'failed'.
            error: Optional error message (stored in error_message column).
        """
        body: dict[str, Any] = {
            "status": status,
            "executed_at": "now()",
        }
        if error:
            body["error_message"] = error[:500]  # truncate to avoid overflow

        self._patch(
            "mt5_signals",
            params={"id": f"eq.{signal_id}"},
            body=body,
        )
        logger.info("Signal %s → %s%s", signal_id, status, f" ({error})" if error else "")

    def get_config(self) -> dict:
        """Get the auto-trading configuration (single row, id='1')."""
        rows = self._get(
            "mt5_config",
            params={"id": "eq.1"},
        )
        if rows:
            return rows[0]
        # Return sensible defaults if config row doesn't exist yet
        logger.warning("No mt5_config row found — using built-in defaults")
        return {
            "auto_trading_enabled": False,
            "max_lot_size": 0.1,
            "risk_per_trade_pct": 2.0,
            "allowed_symbols": "[]",
            "max_open_positions": 5,
            "min_confidence": 70,
            "strategy_filter": "[]",
            "stop_loss_default_pips": 50,
            "take_profit_default_pips": 100,
            "trading_hours_start": "09:00",
            "trading_hours_end": "17:00",
        }

    def upsert_positions(self, positions: list[dict]) -> None:
        """Upsert current MT5 positions into mt5_positions.

        Each position dict must contain at least a 'ticket' field which is
        used as the conflict key.
        """
        if not positions:
            return

        # PostgREST upsert requires the Prefer header we already set
        # and the on_conflict query param.
        url = f"{self.rest_url}/mt5_positions"
        payload = positions

        try:
            resp = requests.request(
                "POST",
                url,
                headers={
                    **self.headers,
                    "Prefer": "return=representation,resolution=merge-duplicates",
                },
                params={"on_conflict": "ticket"},
                json=payload,
                timeout=15,
            )
            if resp.status_code in (200, 201):
                logger.debug("Upserted %d position(s)", len(positions))
            else:
                logger.error("Position upsert failed (%d): %s", resp.status_code, resp.text[:300])
        except requests.RequestException as exc:
            logger.error("Position upsert request failed: %s", exc)

    def close_position(self, ticket: int) -> None:
        """Mark a position as closed in Supabase."""
        self._patch(
            "mt5_positions",
            params={"ticket": f"eq.{ticket}"},
            body={
                "status": "closed",
                "close_time": "now()",
            },
        )
        logger.info("Position ticket=%d marked as closed", ticket)

    def update_bot_status(self, status_dict: dict) -> None:
        """Upsert the single-row mt5_bot_status (id='1')."""
        status_dict["id"] = "1"
        status_dict["last_heartbeat"] = "now()"
        status_dict["server_time"] = "now()"

        url = f"{self.rest_url}/mt5_bot_status"
        try:
            resp = requests.request(
                "POST",
                url,
                headers={
                    **self.headers,
                    "Prefer": "return=representation,resolution=merge-duplicates",
                },
                params={"on_conflict": "id"},
                json=status_dict,
                timeout=15,
            )
            if resp.status_code in (200, 201):
                logger.debug("Bot status updated")
            else:
                logger.error(
                    "Bot status update failed (%d): %s",
                    resp.status_code,
                    resp.text[:300],
                )
        except requests.RequestException as exc:
            logger.error("Bot status update request failed: %s", exc)

    def get_open_position_tickets(self) -> set[int]:
        """Get the set of MT5 tickets currently recorded as 'open' in Supabase.

        Used to detect positions that were closed externally (SL/TP hit)
        so we can mark them as closed in Supabase.
        """
        rows = self._get(
            "mt5_positions",
            params={
                "select": "ticket",
                "status": "eq.open",
            },
        )
        return {row["ticket"] for row in rows}
