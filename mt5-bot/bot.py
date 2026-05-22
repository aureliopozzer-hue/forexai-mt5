#!/usr/bin/env python3
"""
ForexAI MT5 Bot — Main Loop v3.0.0

Polls the Supabase backend for new trading signals and executes them
via MetaTrader 5 when auto-trading is enabled. Syncs positions and
status back to the backend.

v3.0.0 — Added:
  - Broker credentials read from Supabase (client configures via website)
  - Risk management: profit target, loss limit, lot sizing (fixed & percentage)
  - Demo/Live account support
  - Daily P&L tracking and risk limit enforcement

Run on a Windows VPS where MT5 terminal is installed.
"""

import json
import logging
import signal
import sys
import time
from datetime import datetime, timezone, date

import config
import mt5_executor
import supabase_client

logger = logging.getLogger("forexai")

# ---------------------------------------------------------------------------
# Global state
# ---------------------------------------------------------------------------

running = True
sb: supabase_client.SupabaseClient | None = None

# Track which signal IDs we've already processed (avoid double-execution)
_processed_signal_ids: set[str] = set()

# Track last known broker credentials to detect changes
_last_broker_login: int = 0
_last_broker_server: str = ""


def _handle_shutdown(signum: int, frame) -> None:
    """Graceful shutdown on SIGINT / SIGTERM."""
    global running
    logger.info("Received signal %s — shutting down …", signal.Signals(signum).name)
    running = False


signal.signal(signal.SIGINT, _handle_shutdown)
signal.signal(signal.SIGTERM, _handle_shutdown)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_within_trading_hours(cfg: dict) -> bool:
    """Check if the current UTC time is within the configured trading window."""
    start_str = cfg.get("trading_hours_start", "09:00")
    end_str = cfg.get("trading_hours_end", "17:00")

    try:
        start_h, start_m = map(int, start_str.split(":"))
        end_h, end_m = map(int, end_str.split(":"))
    except (ValueError, AttributeError):
        logger.warning("Invalid trading hours config: %s-%s, defaulting to 09:00-17:00", start_str, end_str)
        start_h, start_m, end_h, end_m = 9, 0, 17, 0

    now = datetime.now(timezone.utc)
    start_mins = start_h * 60 + start_m
    end_mins = end_h * 60 + end_m
    now_mins = now.hour * 60 + now.minute

    return start_mins <= now_mins < end_mins


def _is_symbol_allowed(symbol: str, cfg: dict) -> bool:
    """Check if the symbol is in the allowed_symbols list."""
    allowed_raw = cfg.get("allowed_symbols", "[]")
    try:
        allowed_list = json.loads(allowed_raw) if isinstance(allowed_raw, str) else allowed_raw
    except json.JSONDecodeError:
        allowed_list = []

    # If the list is empty, all symbols are allowed
    if not allowed_list:
        return True

    normalized = symbol.replace("/", "").upper()
    return normalized in [s.replace("/", "").upper() for s in allowed_list]


def _is_strategy_allowed(strategy: str, cfg: dict) -> bool:
    """Check if the strategy is in the strategy_filter list."""
    filter_raw = cfg.get("strategy_filter", "[]")
    try:
        filter_list = json.loads(filter_raw) if isinstance(filter_raw, str) else filter_raw
    except json.JSONDecodeError:
        filter_list = []

    # If the list is empty, all strategies are allowed
    if not filter_list:
        return True

    return strategy in filter_list


def _should_skip_signal(signal_data: dict, cfg: dict) -> str | None:
    """Return a reason string if a signal should be skipped, or None if it should execute."""
    # Skip if already processed
    if signal_data["id"] in _processed_signal_ids:
        return "already processed"

    # Check confidence threshold
    min_confidence = int(cfg.get("min_confidence", 70))
    signal_confidence = int(signal_data.get("confidence", 0))
    if signal_confidence < min_confidence:
        return f"confidence {signal_confidence}% < min {min_confidence}%"

    # Check symbol allowlist
    if not _is_symbol_allowed(signal_data.get("symbol", ""), cfg):
        return f"symbol {signal_data.get('symbol')} not allowed"

    # Check strategy filter
    if not _is_strategy_allowed(signal_data.get("strategy", ""), cfg):
        return f"strategy {signal_data.get('strategy')} not allowed"

    # Check max open positions
    current_positions = mt5_executor.get_open_positions()
    max_positions = int(cfg.get("max_open_positions", 5))
    if len(current_positions) >= max_positions:
        return f"max positions reached ({len(current_positions)}/{max_positions})"

    # Check trading hours
    if not _is_within_trading_hours(cfg):
        return "outside trading hours"

    # ========== RISK MANAGEMENT CHECKS ==========
    # Check profit target / loss limit
    if mt5_executor.is_connected():
        account_info = mt5_executor.get_account_info()
        if account_info:
            risk_reason = mt5_executor.check_risk_limits(
                cfg, account_info["account_balance"], account_info["account_equity"]
            )
            if risk_reason:
                return f"risk limit: {risk_reason}"

    return None


def _check_and_update_broker_credentials(cfg: dict) -> bool:
    """Check if broker credentials have changed in config and update executor.

    Returns True if credentials were updated (reconnection needed).
    """
    global _last_broker_login, _last_broker_server

    # Read from Supabase columns: broker_login, broker_password, broker_server, account_type
    # Also support old column names for backward compatibility
    login = int(cfg.get("broker_login", cfg.get("mt5_login", 0)))
    password = cfg.get("broker_password", cfg.get("mt5_password", ""))
    server = cfg.get("broker_server", cfg.get("mt5_server", ""))

    if not login or not password or not server:
        # No credentials in Supabase — use .env file (already loaded)
        return False

    # Check if credentials changed
    if login != _last_broker_login or server != _last_broker_server:
        logger.info(
            "Broker credentials changed in config: login=%d server=%s (was login=%d server=%s)",
            login, server, _last_broker_login, _last_broker_server,
        )
        mt5_executor.set_broker_credentials(login, password, server)
        _last_broker_login = login
        _last_broker_server = server
        return True

    # Even if login/server same, update password (might have changed)
    mt5_executor.set_broker_credentials(login, password, server)
    return False


# ---------------------------------------------------------------------------
# Core operations
# ---------------------------------------------------------------------------

def poll_and_execute() -> None:
    """Fetch pending signals and execute them if conditions are met."""
    global _processed_signal_ids

    # Get configuration from Supabase
    cfg = sb.get_config()

    # Check if broker credentials changed — reconnect if needed
    credentials_changed = _check_and_update_broker_credentials(cfg)
    if credentials_changed and mt5_executor.is_connected():
        logger.info("Broker credentials changed — reconnecting to MT5...")
        mt5_executor.disconnect_mt5()
        if mt5_executor.connect_mt5():
            logger.info("Reconnected with new credentials")
        else:
            logger.error("Failed to reconnect with new credentials")

    # Fetch pending signals
    try:
        pending = sb.get_pending_signals()
    except supabase_client.SupabaseError as exc:
        logger.error("Failed to fetch signals: %s", exc)
        return

    if not pending:
        logger.debug("No pending signals")
        return

    auto_enabled = cfg.get("auto_trading_enabled", False)

    for sig in pending:
        sig_id = sig.get("id", "")

        # Mark as processed immediately to avoid double-execution
        _processed_signal_ids.add(sig_id)

        # If auto-trading is off, skip the signal
        if not auto_enabled:
            logger.info("Signal %s skipped — auto-trading disabled", sig_id)
            try:
                sb.update_signal_status(sig_id, "skipped", "Auto-trading disabled")
            except supabase_client.SupabaseError:
                pass
            continue

        # Check if signal should be skipped
        skip_reason = _should_skip_signal(sig, cfg)
        if skip_reason:
            logger.info("Signal %s skipped: %s", sig_id, skip_reason)
            try:
                sb.update_signal_status(sig_id, "skipped", skip_reason)
            except supabase_client.SupabaseError:
                pass
            continue

        # Ensure MT5 is connected before executing
        if not mt5_executor.is_connected():
            logger.warning("MT5 not connected — attempting reconnect …")
            if not mt5_executor.connect_mt5():
                try:
                    sb.update_signal_status(sig_id, "failed", "MT5 not connected")
                except supabase_client.SupabaseError:
                    pass
                continue

        # Execute the signal (pass config for risk management lot sizing)
        logger.info(
            "Executing signal %s: %s %s @ %.5f",
            sig_id, sig.get("direction"), sig.get("symbol"), float(sig.get("entry_price", 0)),
        )
        result = mt5_executor.execute_signal(sig, cfg)

        if result["success"]:
            # Update signal as executed
            try:
                sb.update_signal_status(sig_id, "executed")
            except supabase_client.SupabaseError:
                pass

            # Immediately sync positions so the frontend sees the new trade
            _sync_positions()
        else:
            error_msg = result.get("error", "Unknown error")
            try:
                sb.update_signal_status(sig_id, "failed", error_msg)
            except supabase_client.SupabaseError:
                pass


def _sync_positions() -> None:
    """Synchronise MT5 positions with Supabase."""
    try:
        mt5_positions = mt5_executor.get_open_positions()
        if mt5_positions:
            sb.upsert_positions(mt5_positions)

        # Detect closed positions: tickets in Supabase but not in MT5
        db_tickets = sb.get_open_position_tickets()
        mt5_tickets = {p["ticket"] for p in mt5_positions}
        closed_tickets = db_tickets - mt5_tickets

        for ticket in closed_tickets:
            logger.info("Detected closed position ticket=%d", ticket)
            try:
                sb.close_position(ticket)
            except supabase_client.SupabaseError as exc:
                logger.error("Failed to mark ticket=%d as closed: %s", ticket, exc)

    except (supabase_client.SupabaseError, Exception) as exc:
        logger.error("Position sync failed: %s", exc)


def _send_heartbeat() -> None:
    """Send a heartbeat with account info to Supabase."""
    status: dict = {
        "connected": True,
        "mt5_connected": False,
        "account_balance": 0,
        "account_equity": 0,
        "account_leverage": 0,
        "account_currency": "USD",
        "open_positions_count": 0,
        "bot_version": "3.0.0",
    }

    if mt5_executor.is_connected():
        account_info = mt5_executor.get_account_info()
        if account_info:
            status.update(account_info)
        else:
            status["mt5_connected"] = False
    else:
        status["mt5_connected"] = False

    try:
        sb.update_bot_status(status)
    except supabase_client.SupabaseError as exc:
        logger.error("Heartbeat failed: %s", exc)


def _update_daily_pnl() -> None:
    """Update daily P&L tracking in Supabase config."""
    if not mt5_executor.is_connected():
        return

    try:
        cfg = sb.get_config()
        positions = mt5_executor.get_open_positions()
        total_pnl = sum(p.get("profit", 0) for p in positions)

        updates = mt5_executor.update_daily_pnl(cfg, total_pnl)

        # Update config with new daily P&L
        # Use a direct Supabase PATCH since we don't want to trigger a full config update
        sb._patch(
            "mt5_config",
            params={"id": "eq.1"},
            body=updates,
        )
        logger.debug("Daily P&L updated: %s", updates)
    except Exception as exc:
        logger.error("Failed to update daily P&L: %s", exc)


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def main() -> None:
    """Entry point — initialise and run the main bot loop."""
    global sb, running

    # Configure logging
    log = config.setup_logging()
    log.info("=" * 60)
    log.info("ForexAI MT5 Bot v3.0.0 starting …")
    log.info("=" * 60)

    # Validate configuration
    problems = config.validate()
    # Don't block on MT5 credentials — they can come from Supabase
    mt5_problems = [p for p in problems if "MT5_LOGIN" in p or "MT5_PASSWORD" in p or "MT5_SERVER" in p]
    other_problems = [p for p in problems if p not in mt5_problems]

    if other_problems:
        for p in other_problems:
            log.error("Config error: %s", p)
        log.error("Fix the above errors in your .env file and restart the bot.")
        sys.exit(1)

    if mt5_problems:
        for p in mt5_problems:
            log.warning("Config warning: %s (will use Supabase config if available)", p)

    log.info("Configuration: %s", json.dumps(config.as_dict(), indent=2))

    # Initialise Supabase client
    sb = supabase_client.SupabaseClient()
    log.info("Supabase client initialised for %s", config.SUPABASE_URL)

    # Check if broker credentials are in Supabase config
    cfg = sb.get_config()
    _check_and_update_broker_credentials(cfg)

    # Connect to MT5 (will use Supabase credentials if available, otherwise .env)
    if not mt5_executor.connect_mt5():
        log.error("Cannot connect to MT5 — will retry in the main loop")

    # Send initial heartbeat
    _send_heartbeat()

    # Timing accumulators
    last_signal_poll = 0.0
    last_position_sync = 0.0
    last_heartbeat = 0.0
    last_mt5_reconnect_attempt = 0.0
    last_daily_pnl_update = 0.0

    poll_interval = config.POLL_INTERVAL
    position_sync_interval = config.POSITION_SYNC_INTERVAL
    heartbeat_interval = config.HEARTBEAT_INTERVAL
    daily_pnl_interval = 60  # Update daily P&L every 60 seconds

    log.info("Bot running — poll every %ds, position sync every %ds, heartbeat every %ds",
             poll_interval, position_sync_interval, heartbeat_interval)

    while running:
        now = time.monotonic()

        # --- MT5 reconnection check ---
        if not mt5_executor.is_connected():
            if now - last_mt5_reconnect_attempt >= 30:  # retry every 30s
                last_mt5_reconnect_attempt = now
                log.warning("MT5 disconnected — attempting reconnect …")
                # Re-read config in case credentials were updated
                try:
                    cfg = sb.get_config()
                    _check_and_update_broker_credentials(cfg)
                except Exception:
                    pass
                if mt5_executor.connect_mt5():
                    log.info("MT5 reconnected successfully")
                else:
                    log.error("MT5 reconnection failed — will retry in 30s")

        # --- Signal polling ---
        if now - last_signal_poll >= poll_interval:
            last_signal_poll = now
            try:
                poll_and_execute()
            except Exception as exc:
                log.error("Error in poll_and_execute: %s", exc, exc_info=True)

        # --- Position sync ---
        if now - last_position_sync >= position_sync_interval:
            last_position_sync = now
            if mt5_executor.is_connected():
                try:
                    _sync_positions()
                except Exception as exc:
                    log.error("Error syncing positions: %s", exc, exc_info=True)

        # --- Daily P&L update ---
        if now - last_daily_pnl_update >= daily_pnl_interval:
            last_daily_pnl_update = now
            try:
                _update_daily_pnl()
            except Exception as exc:
                log.error("Error updating daily P&L: %s", exc, exc_info=True)

        # --- Heartbeat ---
        if now - last_heartbeat >= heartbeat_interval:
            last_heartbeat = now
            try:
                _send_heartbeat()
            except Exception as exc:
                log.error("Error sending heartbeat: %s", exc, exc_info=True)

        # Sleep for a short interval to avoid busy-waiting
        time.sleep(1)

    # --- Graceful shutdown ---
    log.info("Shutting down …")

    # Send offline status
    try:
        sb.update_bot_status({
            "connected": False,
            "mt5_connected": False,
            "open_positions_count": 0,
        })
    except Exception:
        pass

    mt5_executor.disconnect_mt5()
    log.info("ForexAI MT5 Bot stopped.")


if __name__ == "__main__":
    main()
