"""
ForexAI MT5 Bridge v2
=====================
Runs on Windows EC2 instance with MT5 installed.
Flask server that receives trade signals from Linux monitor bot,
executes trades on MT5 with full risk management.

All data files stored in C:\\ForexAI\\
"""

import os
import sys
import json
import logging
import traceback
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any, List

from flask import Flask, request, jsonify

# ---------------------------------------------------------------------------
# Paths – everything lives under C:\ForexAI\
# ---------------------------------------------------------------------------
BASE_DIR = Path(r"C:\ForexAI")
BASE_DIR.mkdir(parents=True, exist_ok=True)

CONFIG_PATH = BASE_DIR / "bridge_config.json"
DAILY_STATS_PATH = BASE_DIR / "daily_stats.json"
LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------
logger = logging.getLogger("mt5_bridge")
logger.setLevel(logging.DEBUG)

# Console handler
_console_handler = logging.StreamHandler(sys.stdout)
_console_handler.setLevel(logging.INFO)
_console_fmt = logging.Formatter("[%(asctime)s] %(levelname)-8s %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
_console_handler.setFormatter(_console_fmt)
logger.addHandler(_console_handler)

# File handler – rotate daily via TimedRotatingFileHandler if available
try:
    from logging.handlers import TimedRotatingFileHandler
    _file_handler = TimedRotatingFileHandler(
        str(LOG_DIR / "bridge.log"), when="midnight", backupCount=30
    )
except Exception:
    _file_handler = logging.FileHandler(str(LOG_DIR / "bridge.log"))

_file_handler.setLevel(logging.DEBUG)
_file_fmt = logging.Formatter(
    "%(asctime)s | %(levelname)-8s | %(funcName)-25s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
_file_handler.setFormatter(_file_fmt)
logger.addHandler(_file_handler)

# ---------------------------------------------------------------------------
# Default configuration
# ---------------------------------------------------------------------------
DEFAULT_CONFIG: Dict[str, Any] = {
    "account_type": "demo",
    "lot_sizing_mode": "fixed",
    "fixed_lot_size": 0.01,
    "risk_per_trade_pct": 2.0,
    "daily_profit_target": 0,
    "daily_profit_target_pct": 0,
    "daily_loss_limit": 0,
    "daily_loss_limit_pct": 0,
    "max_trades_per_day": 0,
    "max_open_positions": 5,
    "min_confidence": 70,
    "allowed_symbols": ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD"],
    "auto_close_on_target": False,
    "auto_close_on_loss_limit": False,
    "trailing_stop_enabled": False,
    "trailing_stop_pips": 0,
    "break_even_enabled": False,
    "break_even_pips": 10,
    "trading_hours_start": "00:00",
    "trading_hours_end": "23:59",
    "mt5_login": 0,
    "mt5_password": "",
    "mt5_server": "",
    "mt5_path": r"C:\Program Files\MetaTrader 5\terminal64.exe",
    "supabase_url": os.environ.get("SUPABASE_URL", "https://cmcnenrtnxnfmkxhsqyp.supabase.co"),
    "supabase_key": os.environ.get("SUPABASE_KEY", ""),
}

# ---------------------------------------------------------------------------
# Default daily stats
# ---------------------------------------------------------------------------
DEFAULT_DAILY_STATS: Dict[str, Any] = {
    "date": "",
    "trades_count": 0,
    "wins": 0,
    "losses": 0,
    "total_profit": 0.0,
    "total_loss": 0.0,
    "net_pnl": 0.0,
    "starting_balance": 0.0,
}

# ---------------------------------------------------------------------------
# Flask app
# ---------------------------------------------------------------------------
app = Flask(__name__)

# ---------------------------------------------------------------------------
# MT5 import (may fail on non-Windows / non-MT5 environments)
# ---------------------------------------------------------------------------
mt5 = None
MT5_AVAILABLE = False

try:
    import MetaTrader5 as _mt5
    mt5 = _mt5
    MT5_AVAILABLE = True
    logger.info("MetaTrader5 package imported successfully.")
except ImportError:
    logger.warning("MetaTrader5 package not available – running in OFFLINE mode.")

# ---------------------------------------------------------------------------
# Supabase helper
# ---------------------------------------------------------------------------
def update_supabase_signal(signal_id: str, status: str, ticket: Optional[int] = None,
                           executed_lot: Optional[float] = None, error_msg: Optional[str] = None):
    """Update the mt5_signals table in Supabase after execution attempt."""
    config = load_config()
    supabase_url = config.get("supabase_url", "")
    supabase_key = config.get("supabase_key", "")
    if not supabase_url or not supabase_key:
        logger.warning("Supabase URL/key not configured – skipping signal update.")
        return

    try:
        import urllib.request
        import urllib.error

        url = "%s/rest/v1/mt5_signals?signal_id=eq.%s" % (supabase_url, signal_id)
        payload = {
            "status": status,
            "executed_at": datetime.utcnow().isoformat() + "Z",
        }
        if ticket is not None:
            payload["mt5_ticket"] = ticket
        if executed_lot is not None:
            payload["executed_lot"] = executed_lot
        if error_msg is not None:
            payload["error_message"] = error_msg

        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            method="PATCH",
            headers={
                "apikey": supabase_key,
                "Authorization": "Bearer %s" % supabase_key,
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            logger.info("Supabase signal %s updated -> %s (HTTP %s)", signal_id, status, resp.status)
    except Exception as exc:
        logger.error("Failed to update Supabase signal %s: %s", signal_id, str(exc))

# ---------------------------------------------------------------------------
# Config helpers
# ---------------------------------------------------------------------------
def load_config() -> Dict[str, Any]:
    """Load config from disk, merging with defaults for any missing keys."""
    config = dict(DEFAULT_CONFIG)
    if CONFIG_PATH.exists():
        try:
            with open(str(CONFIG_PATH), "r") as fh:
                saved = json.load(fh)
            config.update(saved)
        except Exception as exc:
            logger.error("Failed to load config: %s", str(exc))
    return config


def save_config(config: Dict[str, Any]):
    """Persist config to disk."""
    try:
        with open(str(CONFIG_PATH), "w") as fh:
            json.dump(config, fh, indent=2)
        logger.info("Config saved to %s", str(CONFIG_PATH))
    except Exception as exc:
        logger.error("Failed to save config: %s", str(exc))

# ---------------------------------------------------------------------------
# Daily stats helpers
# ---------------------------------------------------------------------------
def _today_str() -> str:
    return datetime.now().strftime("%Y-%m-%d")


def load_daily_stats() -> Dict[str, Any]:
    """Load daily stats; auto-reset if the date has changed."""
    stats = dict(DEFAULT_DAILY_STATS)
    needs_reset = True

    if DAILY_STATS_PATH.exists():
        try:
            with open(str(DAILY_STATS_PATH), "r") as fh:
                saved = json.load(fh)
            stats.update(saved)
            if stats.get("date") == _today_str():
                needs_reset = False
        except Exception as exc:
            logger.error("Failed to load daily stats: %s", str(exc))

    if needs_reset:
        stats = reset_daily_stats_internal(save=True)
    return stats


def save_daily_stats(stats: Dict[str, Any]):
    """Persist daily stats to disk."""
    try:
        with open(str(DAILY_STATS_PATH), "w") as fh:
            json.dump(stats, fh, indent=2)
    except Exception as exc:
        logger.error("Failed to save daily stats: %s", str(exc))


def reset_daily_stats_internal(save: bool = True) -> Dict[str, Any]:
    """Return a fresh daily stats dict and optionally persist it."""
    starting_balance = 0.0
    if MT5_AVAILABLE and mt5 is not None:
        info = mt5.account_info()
        if info is not None:
            starting_balance = info.balance

    stats = {
        "date": _today_str(),
        "trades_count": 0,
        "wins": 0,
        "losses": 0,
        "total_profit": 0.0,
        "total_loss": 0.0,
        "net_pnl": 0.0,
        "starting_balance": starting_balance,
    }
    if save:
        save_daily_stats(stats)
        logger.info("Daily stats reset for %s", stats["date"])
    return stats

# ---------------------------------------------------------------------------
# MT5 helpers
# ---------------------------------------------------------------------------
def init_mt5() -> bool:
    """Initialize MT5 connection using config credentials."""
    if not MT5_AVAILABLE or mt5 is None:
        logger.warning("MT5 not available – init skipped (offline mode).")
        return False

    config = load_config()
    path = config.get("mt5_path", r"C:\Program Files\MetaTrader 5\terminal64.exe")

    # Shutdown first if already initialized
    try:
        mt5.shutdown()
    except Exception:
        pass

    if not mt5.initialize(path=path):
        err = mt5.last_error()
        logger.error("MT5 initialize failed: %s", str(err))
        return False

    logger.info("MT5 initialized (path=%s).", path)

    login = config.get("mt5_login", 0)
    password = config.get("mt5_password", "")
    server = config.get("mt5_server", "")

    if login and password and server:
        if not mt5.login(login=int(login), password=password, server=server):
            err = mt5.last_error()
            logger.error("MT5 login failed (login=%s, server=%s): %s", login, server, str(err))
            mt5.shutdown()
            return False
        logger.info("MT5 logged in: login=%s server=%s", login, server)
    else:
        logger.warning("MT5 credentials not fully configured – using current terminal session.")

    return True


def get_mt5_account_info() -> Optional[Dict[str, Any]]:
    """Return dict of MT5 account info or None."""
    if not MT5_AVAILABLE or mt5 is None:
        return None
    info = mt5.account_info()
    if info is None:
        return None
    return {
        "login": info.login,
        "balance": info.balance,
        "equity": info.equity,
        "margin": info.margin,
        "free_margin": info.margin_free,
        "margin_level": info.margin_level if info.margin_level else 0,
        "profit": info.profit,
        "currency": info.currency,
        "server": info.server,
        "trade_mode": info.trade_mode,
        "trade_mode_str": {0: "DEMO", 1: "CONTEST", 2: "REAL"}.get(info.trade_mode, "UNKNOWN"),
    }


def get_open_positions() -> List[Dict[str, Any]]:
    """Return list of open MT5 positions."""
    if not MT5_AVAILABLE or mt5 is None:
        return []
    positions = mt5.positions_get()
    if positions is None:
        return []
    result = []
    for pos in positions:
        result.append({
            "ticket": pos.ticket,
            "symbol": pos.symbol,
            "type": pos.type,
            "type_str": {0: "BUY", 1: "SELL"}.get(pos.type, "UNKNOWN"),
            "volume": pos.volume,
            "price_open": pos.price_open,
            "price_current": pos.price_current,
            "sl": pos.sl,
            "tp": pos.tp,
            "profit": pos.profit,
            "swap": pos.swap,
            "time": datetime.fromtimestamp(pos.time).isoformat() if pos.time else "",
            "comment": pos.comment,
            "magic": pos.magic,
        })
    return result


def symbol_info(symbol: str):
    """Get symbol info from MT5."""
    if not MT5_AVAILABLE or mt5 is None:
        return None
    return mt5.symbol_info(symbol)


def symbol_tick(symbol: str):
    """Get latest tick for symbol."""
    if not MT5_AVAILABLE or mt5 is None:
        return None
    return mt5.symbol_info_tick(symbol)

# ---------------------------------------------------------------------------
# Lot size calculation
# ---------------------------------------------------------------------------
def calculate_lot_size(symbol: str, sl_price: float, config: Dict[str, Any]) -> float:
    """
    Calculate lot size based on config lot_sizing_mode.

    Modes:
      - "fixed": Use fixed_lot_size directly.
      - "percentage": risk_per_trade_pct % of balance / (SL distance in pips * pip_value).
      - "risk_based": Same formula but more conservative (half risk).
    """
    mode = config.get("lot_sizing_mode", "fixed")

    if mode == "fixed":
        return round(config.get("fixed_lot_size", 0.01), 2)

    # We need account balance and symbol info for the other modes
    info = get_mt5_account_info()
    if info is None:
        logger.warning("Cannot fetch account info for lot calculation – using fixed lot.")
        return round(config.get("fixed_lot_size", 0.01), 2)

    balance = info.get("balance", 0)
    risk_pct = config.get("risk_per_trade_pct", 2.0)

    # Determine risk amount in account currency
    if mode == "risk_based":
        # More conservative: use half the risk percentage
        risk_amount = balance * (risk_pct / 2.0 / 100.0)
    else:
        risk_amount = balance * (risk_pct / 100.0)

    # Get symbol info for point/pip calculation
    sym_info = symbol_info(symbol)
    if sym_info is None:
        logger.warning("Cannot fetch symbol info for %s – using fixed lot.", symbol)
        return round(config.get("fixed_lot_size", 0.01), 2)

    # Ensure symbol is visible in Market Watch
    if not sym_info.visible:
        if MT5_AVAILABLE and mt5 is not None:
            mt5.symbol_select(symbol, True)
            sym_info = symbol_info(symbol)
            if sym_info is None:
                return round(config.get("fixed_lot_size", 0.01), 2)

    point = sym_info.point
    trade_contract_size = sym_info.trade_contract_size
    digits = sym_info.digits

    # Calculate SL distance in price
    tick_data = symbol_tick(symbol)
    if tick_data is None:
        logger.warning("Cannot fetch tick for %s – using fixed lot.", symbol)
        return round(config.get("fixed_lot_size", 0.01), 2)

    current_price = tick_data.ask if sl_price < tick_data.ask else tick_data.bid
    sl_distance = abs(current_price - sl_price)

    if sl_distance <= 0:
        logger.warning("SL distance is zero for %s – using fixed lot.", symbol)
        return round(config.get("fixed_lot_size", 0.01), 2)

    # Pip value calculation
    # For most pairs: pip = point * 10, for JPY pairs: pip = point * 100 (already in point)
    # Simplified: pip_value = point * trade_contract_size
    tick_value = sym_info.trade_tick_value
    tick_size = sym_info.trade_tick_size

    if tick_size > 0 and tick_value > 0:
        pip_value_per_lot = (sl_distance / tick_size) * tick_value
    else:
        # Fallback approximation
        pip_value_per_lot = sl_distance * trade_contract_size

    if pip_value_per_lot <= 0:
        logger.warning("Pip value calculation returned zero – using fixed lot.")
        return round(config.get("fixed_lot_size", 0.01), 2)

    lot = risk_amount / pip_value_per_lot

    # Normalize to symbol's volume constraints
    vol_step = sym_info.volume_step if sym_info.volume_step else 0.01
    vol_min = sym_info.volume_min if sym_info.volume_min else 0.01
    vol_max = sym_info.volume_max if sym_info.volume_max else 100.0

    lot = max(vol_min, min(vol_max, lot))
    # Round to volume step
    lot = round(round(lot / vol_step) * vol_step, 8)
    # Final round to 2 decimal places (standard for most brokers)
    lot = round(lot, 2)

    logger.info(
        "Lot calculated: mode=%s symbol=%s balance=%.2f risk_pct=%.2f sl_distance=%.5f lot=%.2f",
        mode, symbol, balance, risk_pct, sl_distance, lot,
    )
    return lot

# ---------------------------------------------------------------------------
# Risk management checks
# ---------------------------------------------------------------------------
def check_daily_loss_limit(stats: Dict[str, Any], config: Dict[str, Any]) -> Optional[str]:
    """Check if daily loss limit has been reached. Returns error message or None."""
    daily_loss_limit = config.get("daily_loss_limit", 0)
    daily_loss_limit_pct = config.get("daily_loss_limit_pct", 0)

    net_pnl = stats.get("net_pnl", 0.0)

    # Check absolute loss limit
    if daily_loss_limit > 0 and net_pnl < 0 and abs(net_pnl) >= daily_loss_limit:
        msg = "Daily loss limit reached: P&L=%.2f, limit=%.2f" % (net_pnl, daily_loss_limit)
        logger.warning(msg)
        return msg

    # Check percentage loss limit
    if daily_loss_limit_pct > 0 and net_pnl < 0:
        starting_balance = stats.get("starting_balance", 0)
        if starting_balance > 0:
            loss_pct = abs(net_pnl) / starting_balance * 100.0
            if loss_pct >= daily_loss_limit_pct:
                msg = "Daily loss limit (%%) reached: loss_pct=%.2f%%, limit=%.2f%%" % (
                    loss_pct, daily_loss_limit_pct
                )
                logger.warning(msg)
                return msg

    return None


def check_daily_profit_target(stats: Dict[str, Any], config: Dict[str, Any]) -> Optional[str]:
    """Check if daily profit target has been reached. Returns error message or None."""
    daily_profit_target = config.get("daily_profit_target", 0)
    daily_profit_target_pct = config.get("daily_profit_target_pct", 0)

    net_pnl = stats.get("net_pnl", 0.0)

    # Check absolute profit target
    if daily_profit_target > 0 and net_pnl >= daily_profit_target:
        msg = "Daily profit target reached: P&L=%.2f, target=%.2f" % (net_pnl, daily_profit_target)
        logger.warning(msg)
        return msg

    # Check percentage profit target
    if daily_profit_target_pct > 0 and net_pnl > 0:
        starting_balance = stats.get("starting_balance", 0)
        if starting_balance > 0:
            profit_pct = net_pnl / starting_balance * 100.0
            if profit_pct >= daily_profit_target_pct:
                msg = "Daily profit target (%%) reached: profit_pct=%.2f%%, target=%.2f%%" % (
                    profit_pct, daily_profit_target_pct
                )
                logger.warning(msg)
                return msg

    return None


def check_max_trades_per_day(stats: Dict[str, Any], config: Dict[str, Any]) -> Optional[str]:
    """Check if max trades per day reached. Returns error message or None."""
    max_trades = config.get("max_trades_per_day", 0)
    if max_trades > 0:
        trades_count = stats.get("trades_count", 0)
        if trades_count >= max_trades:
            msg = "Max trades per day reached: %d / %d" % (trades_count, max_trades)
            logger.warning(msg)
            return msg
    return None


def check_max_open_positions(config: Dict[str, Any]) -> Optional[str]:
    """Check if max open positions reached. Returns error message or None."""
    max_positions = config.get("max_open_positions", 5)
    positions = get_open_positions()
    current_count = len(positions)
    if current_count >= max_positions:
        msg = "Max open positions reached: %d / %d" % (current_count, max_positions)
        logger.warning(msg)
        return msg
    return None


def check_allowed_symbols(symbol: str, config: Dict[str, Any]) -> Optional[str]:
    """Check if symbol is in allowed list. Returns error message or None."""
    allowed = config.get("allowed_symbols", [])
    if allowed and symbol not in allowed:
        msg = "Symbol %s not in allowed list: %s" % (symbol, str(allowed))
        logger.warning(msg)
        return msg
    return None


def check_trading_hours(config: Dict[str, Any]) -> Optional[str]:
    """Check if current time is within allowed trading hours. Returns error message or None."""
    start_str = config.get("trading_hours_start", "00:00")
    end_str = config.get("trading_hours_end", "23:59")

    try:
        now = datetime.now()
        start_h, start_m = [int(x) for x in start_str.split(":")]
        end_h, end_m = [int(x) for x in end_str.split(":")]

        start_minutes = start_h * 60 + start_m
        end_minutes = end_h * 60 + end_m
        now_minutes = now.hour * 60 + now.minute

        if start_minutes <= end_minutes:
            # Normal range, e.g., 08:00 to 20:00
            if now_minutes < start_minutes or now_minutes > end_minutes:
                msg = "Outside trading hours: now=%s, allowed=%s-%s" % (
                    now.strftime("%H:%M"), start_str, end_str
                )
                logger.warning(msg)
                return msg
        else:
            # Wraps around midnight, e.g., 22:00 to 06:00
            if now_minutes < start_minutes and now_minutes > end_minutes:
                msg = "Outside trading hours: now=%s, allowed=%s-%s" % (
                    now.strftime("%H:%M"), start_str, end_str
                )
                logger.warning(msg)
                return msg
    except Exception as exc:
        logger.error("Error parsing trading hours: %s", str(exc))

    return None


def run_all_risk_checks(symbol: str, sl_price: float, config: Dict[str, Any],
                        stats: Dict[str, Any]) -> Optional[str]:
    """Run all risk checks. Returns first error message or None if all pass."""
    # 1. Daily loss limit
    err = check_daily_loss_limit(stats, config)
    if err:
        return err

    # 2. Daily profit target
    err = check_daily_profit_target(stats, config)
    if err:
        return err

    # 3. Max trades per day
    err = check_max_trades_per_day(stats, config)
    if err:
        return err

    # 4. Max open positions
    err = check_max_open_positions(config)
    if err:
        return err

    # 5. Allowed symbols
    err = check_allowed_symbols(symbol, config)
    if err:
        return err

    # 6. Trading hours
    err = check_trading_hours(config)
    if err:
        return err

    return None

# ---------------------------------------------------------------------------
# Trade execution
# ---------------------------------------------------------------------------
def execute_mt5_trade(symbol: str, action: str, lot_size: float,
                      sl: float, tp: float, signal_id: str,
                      config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute a trade on MT5.

    Returns dict with:
      - success: bool
      - ticket: int or None
      - lot_size: float
      - error: str or None
    """
    if not MT5_AVAILABLE or mt5 is None:
        return {"success": False, "ticket": None, "lot_size": lot_size,
                "error": "MT5 is not available (offline mode)"}

    # Ensure symbol is selected in Market Watch
    sym_info = symbol_info(symbol)
    if sym_info is None:
        return {"success": False, "ticket": None, "lot_size": lot_size,
                "error": "Symbol %s not found in MT5" % symbol}

    if not sym_info.visible:
        if not mt5.symbol_select(symbol, True):
            return {"success": False, "ticket": None, "lot_size": lot_size,
                    "error": "Failed to select symbol %s in Market Watch" % symbol}

    # Normalize SL/TP – MT5 requires them to match symbol digits
    digits = sym_info.digits
    if sl > 0:
        sl = round(sl, digits)
    else:
        sl = 0.0
    if tp > 0:
        tp = round(tp, digits)
    else:
        tp = 0.0

    # Determine order type
    action_upper = action.upper()
    if action_upper == "BUY":
        order_type = mt5.ORDER_TYPE_BUY
        tick = symbol_tick(symbol)
        if tick is None:
            return {"success": False, "ticket": None, "lot_size": lot_size,
                    "error": "Cannot get tick for %s" % symbol}
        price = tick.ask
    elif action_upper == "SELL":
        order_type = mt5.ORDER_TYPE_SELL
        tick = symbol_tick(symbol)
        if tick is None:
            return {"success": False, "ticket": None, "lot_size": lot_size,
                    "error": "Cannot get tick for %s" % symbol}
        price = tick.bid
    else:
        return {"success": False, "ticket": None, "lot_size": lot_size,
                "error": "Invalid action: %s (must be BUY or SELL)" % action}

    price = round(price, digits)

    # Build the request
    magic_number = 100001  # Custom magic number for ForexAI bridge
    comment_str = "ForexAI|%s" % signal_id

    request_data = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": lot_size,
        "type": order_type,
        "price": price,
        "sl": sl,
        "tp": tp,
        "deviation": 20,
        "magic": magic_number,
        "comment": comment_str,
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }

    logger.info(
        "Sending MT5 order: symbol=%s action=%s lot=%.2f price=%.5f sl=%.5f tp=%.5f signal=%s",
        symbol, action_upper, lot_size, price, sl, tp, signal_id,
    )

    result = mt5.order_send(request_data)

    if result is None:
        err_code = mt5.last_error()
        err_msg = "order_send returned None. MT5 last error: %s" % str(err_code)
        logger.error(err_msg)
        return {"success": False, "ticket": None, "lot_size": lot_size, "error": err_msg}

    if result.retcode != mt5.TRADE_RETCODE_DONE:
        err_msg = "order_send failed: retcode=%d comment=%s" % (result.retcode, result.comment)
        logger.error(err_msg)
        return {"success": False, "ticket": None, "lot_size": lot_size, "error": err_msg}

    ticket = result.order
    logger.info(
        "Order executed successfully: ticket=%d symbol=%s action=%s lot=%.2f price=%.5f",
        ticket, symbol, action_upper, lot_size, result.price,
    )
    return {"success": True, "ticket": ticket, "lot_size": lot_size, "error": None}

# ---------------------------------------------------------------------------
# Post-trade processing
# ---------------------------------------------------------------------------
def update_daily_stats_after_trade(signal_id: str, symbol: str, action: str,
                                   lot_size: float, ticket: Optional[int],
                                   success: bool, error: Optional[str]):
    """Update daily stats after a trade attempt."""
    stats = load_daily_stats()

    if success:
        stats["trades_count"] = stats.get("trades_count", 0) + 1

        # Check if there are any closed trades from today to update win/loss
        # For now, we just increment trade count. Win/loss is calculated
        # when we refresh stats from MT5 history.
        _refresh_daily_pnl(stats)

    save_daily_stats(stats)

    # After updating, check auto-close conditions
    config = load_config()
    net_pnl = stats.get("net_pnl", 0.0)

    # Auto close on profit target
    if config.get("auto_close_on_target", False):
        daily_profit_target = config.get("daily_profit_target", 0)
        daily_profit_target_pct = config.get("daily_profit_target_pct", 0)

        should_close = False
        if daily_profit_target > 0 and net_pnl >= daily_profit_target:
            should_close = True
        if daily_profit_target_pct > 0 and net_pnl > 0:
            starting_balance = stats.get("starting_balance", 0)
            if starting_balance > 0:
                profit_pct = net_pnl / starting_balance * 100.0
                if profit_pct >= daily_profit_target_pct:
                    should_close = True

        if should_close:
            logger.warning("Auto-close triggered: daily profit target reached (P&L=%.2f)", net_pnl)
            close_all_positions()

    # Auto close on loss limit
    if config.get("auto_close_on_loss_limit", False):
        daily_loss_limit = config.get("daily_loss_limit", 0)
        daily_loss_limit_pct = config.get("daily_loss_limit_pct", 0)

        should_close = False
        if daily_loss_limit > 0 and net_pnl < 0 and abs(net_pnl) >= daily_loss_limit:
            should_close = True
        if daily_loss_limit_pct > 0 and net_pnl < 0:
            starting_balance = stats.get("starting_balance", 0)
            if starting_balance > 0:
                loss_pct = abs(net_pnl) / starting_balance * 100.0
                if loss_pct >= daily_loss_limit_pct:
                    should_close = True

        if should_close:
            logger.warning("Auto-close triggered: daily loss limit reached (P&L=%.2f)", net_pnl)
            close_all_positions()


def _refresh_daily_pnl(stats: Dict[str, Any]):
    """Refresh daily P&L from MT5 deal history for today."""
    if not MT5_AVAILABLE or mt5 is None:
        return

    try:
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        deals = mt5.history_deals_get(today, datetime.now() + timedelta(days=1))

        if deals is None or len(deals) == 0:
            return

        total_profit = 0.0
        total_loss = 0.0
        wins = 0
        losses = 0

        for deal in deals:
            # Only count deal OUT (closing deals) with our magic number
            if deal.entry != mt5.DEAL_ENTRY_OUT:
                continue
            if deal.magic != 100001:
                continue
            if deal.profit > 0:
                total_profit += deal.profit
                wins += 1
            elif deal.profit < 0:
                total_loss += abs(deal.profit)
                losses += 1

        stats["wins"] = wins
        stats["losses"] = losses
        stats["total_profit"] = round(total_profit, 2)
        stats["total_loss"] = round(total_loss, 2)
        stats["net_pnl"] = round(total_profit - total_loss, 2)

    except Exception as exc:
        logger.error("Error refreshing daily P&L: %s", str(exc))

# ---------------------------------------------------------------------------
# Close position helpers
# ---------------------------------------------------------------------------
def close_position_by_ticket(ticket: int) -> Dict[str, Any]:
    """Close a specific position by ticket number."""
    if not MT5_AVAILABLE or mt5 is None:
        return {"success": False, "error": "MT5 is not available (offline mode)"}

    positions = mt5.positions_get(ticket=ticket)
    if positions is None or len(positions) == 0:
        return {"success": False, "error": "Position %d not found" % ticket}

    pos = positions[0]

    # Determine close order type (opposite of position type)
    if pos.type == mt5.ORDER_TYPE_BUY:
        close_type = mt5.ORDER_TYPE_SELL
        tick = symbol_tick(pos.symbol)
        if tick is None:
            return {"success": False, "error": "Cannot get tick for %s" % pos.symbol}
        close_price = tick.bid
    else:
        close_type = mt5.ORDER_TYPE_BUY
        tick = symbol_tick(pos.symbol)
        if tick is None:
            return {"success": False, "error": "Cannot get tick for %s" % pos.symbol}
        close_price = tick.ask

    close_request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": pos.symbol,
        "volume": pos.volume,
        "type": close_type,
        "position": ticket,
        "price": close_price,
        "deviation": 20,
        "magic": 100001,
        "comment": "ForexAI|Close|%d" % ticket,
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }

    logger.info("Closing position: ticket=%d symbol=%s volume=%.2f", ticket, pos.symbol, pos.volume)
    result = mt5.order_send(close_request)

    if result is None:
        err_code = mt5.last_error()
        err_msg = "close order_send returned None. MT5 last error: %s" % str(err_code)
        logger.error(err_msg)
        return {"success": False, "error": err_msg}

    if result.retcode != mt5.TRADE_RETCODE_DONE:
        err_msg = "close order failed: retcode=%d comment=%s" % (result.retcode, result.comment)
        logger.error(err_msg)
        return {"success": False, "error": err_msg}

    logger.info("Position %d closed successfully at price %.5f", ticket, result.price)
    return {"success": True, "ticket": ticket, "close_price": result.price}


def close_all_positions() -> Dict[str, Any]:
    """Emergency close all open positions."""
    positions = get_open_positions()
    if not positions:
        return {"success": True, "closed": 0, "errors": 0, "details": []}

    closed = 0
    errors = 0
    details = []

    for pos in positions:
        ticket = pos["ticket"]
        result = close_position_by_ticket(ticket)
        if result["success"]:
            closed += 1
            details.append({"ticket": ticket, "status": "closed"})
        else:
            errors += 1
            details.append({"ticket": ticket, "status": "error", "error": result.get("error", "")})

    logger.info("Close all positions: closed=%d errors=%d", closed, errors)
    return {"success": errors == 0, "closed": closed, "errors": errors, "details": details}

# ---------------------------------------------------------------------------
# Flask routes
# ---------------------------------------------------------------------------
@app.route("/health", methods=["GET"])
def health():
    """Return bridge health, MT5 connection status, and account info."""
    mt5_connected = False
    account_info = None
    config = load_config()

    if MT5_AVAILABLE and mt5 is not None:
        info = mt5.account_info()
        if info is not None:
            mt5_connected = True
            account_info = get_mt5_account_info()

    account_type = config.get("account_type", "demo")
    warning = ""
    if account_type == "live":
        warning = "WARNING: Bridge is configured for LIVE trading. Real money is at risk!"

    return jsonify({
        "status": "ok" if mt5_connected else "degraded",
        "mt5_available": MT5_AVAILABLE,
        "mt5_connected": mt5_connected,
        "account_type": account_type,
        "account_info": account_info,
        "warning": warning,
        "timestamp": datetime.now().isoformat(),
    })


@app.route("/execute", methods=["POST"])
def execute():
    """
    Execute a trade signal.

    Expected JSON body:
    {
        "signal_id": "uuid",
        "symbol": "EURUSD",
        "action": "BUY",
        "lot_size": 0.01,   // optional, overridden by risk calculation
        "sl": 1.0800,
        "tp": 1.0900,
        "confidence": 85    // optional, checked against min_confidence
    }
    """
    try:
        data = request.get_json(force=True)
    except Exception as exc:
        logger.error("Failed to parse request body: %s", str(exc))
        return jsonify({"success": False, "error": "Invalid JSON body"}), 400

    signal_id = data.get("signal_id", "")
    symbol = data.get("symbol", "")
    action = data.get("action", "")
    sl = float(data.get("sl", 0))
    tp = float(data.get("tp", 0))
    confidence = data.get("confidence", 0)
    requested_lot = float(data.get("lot_size", 0))

    if not signal_id:
        return jsonify({"success": False, "error": "Missing signal_id"}), 400
    if not symbol:
        return jsonify({"success": False, "error": "Missing symbol"}), 400
    if action.upper() not in ("BUY", "SELL"):
        return jsonify({"success": False, "error": "Invalid action (must be BUY or SELL)"}), 400

    config = load_config()
    stats = load_daily_stats()

    # --- Risk checks ---
    risk_error = run_all_risk_checks(symbol, sl, config, stats)
    if risk_error:
        update_supabase_signal(signal_id, "rejected", error_msg=risk_error)
        return jsonify({"success": False, "error": risk_error, "stage": "risk_check"}), 403

    # Confidence check
    min_confidence = config.get("min_confidence", 70)
    if confidence and confidence < min_confidence:
        msg = "Confidence too low: %d < %d minimum" % (confidence, min_confidence)
        update_supabase_signal(signal_id, "rejected", error_msg=msg)
        return jsonify({"success": False, "error": msg, "stage": "confidence_check"}), 403

    # --- Lot size calculation ---
    if sl > 0:
        lot_size = calculate_lot_size(symbol, sl, config)
    else:
        # No SL provided, use fixed lot or requested lot
        mode = config.get("lot_sizing_mode", "fixed")
        if mode == "fixed":
            lot_size = config.get("fixed_lot_size", 0.01)
        elif requested_lot > 0:
            lot_size = requested_lot
        else:
            lot_size = config.get("fixed_lot_size", 0.01)

    lot_size = round(lot_size, 2)
    if lot_size <= 0:
        msg = "Calculated lot size is zero or negative: %.2f" % lot_size
        update_supabase_signal(signal_id, "rejected", error_msg=msg)
        return jsonify({"success": False, "error": msg, "stage": "lot_calculation"}), 400

    # --- Execute trade ---
    logger.info(
        "Executing trade: signal=%s symbol=%s action=%s lot=%.2f sl=%.5f tp=%.5f",
        signal_id, symbol, action, lot_size, sl, tp,
    )

    result = execute_mt5_trade(symbol, action, lot_size, sl, tp, signal_id, config)

    if result["success"]:
        ticket = result["ticket"]
        executed_lot = result["lot_size"]

        # Update Supabase
        update_supabase_signal(signal_id, "executed", ticket=ticket, executed_lot=executed_lot)

        # Update daily stats
        update_daily_stats_after_trade(
            signal_id=signal_id,
            symbol=symbol,
            action=action,
            lot_size=executed_lot,
            ticket=ticket,
            success=True,
            error=None,
        )

        account_type = config.get("account_type", "demo")
        return jsonify({
            "success": True,
            "ticket": ticket,
            "symbol": symbol,
            "action": action,
            "lot_size": executed_lot,
            "account_type": account_type,
            "message": "Trade executed successfully",
        })
    else:
        error_msg = result.get("error", "Unknown error")
        update_supabase_signal(signal_id, "failed", error_msg=error_msg)

        update_daily_stats_after_trade(
            signal_id=signal_id,
            symbol=symbol,
            action=action,
            lot_size=lot_size,
            ticket=None,
            success=False,
            error=error_msg,
        )

        return jsonify({
            "success": False,
            "error": error_msg,
            "stage": "execution",
        }), 500


@app.route("/positions", methods=["GET"])
def positions():
    """Return all open MT5 positions."""
    open_positions = get_open_positions()
    config = load_config()
    return jsonify({
        "success": True,
        "count": len(open_positions),
        "positions": open_positions,
        "max_open_positions": config.get("max_open_positions", 5),
    })


@app.route("/close/<int:ticket>", methods=["POST"])
def close_ticket(ticket):
    """Close a specific position by ticket number."""
    result = close_position_by_ticket(ticket)
    if result["success"]:
        return jsonify(result)
    else:
        return jsonify(result), 400


@app.route("/config", methods=["GET"])
def get_config():
    """Return current risk management config (mask sensitive fields)."""
    config = load_config()
    # Mask password
    safe_config = dict(config)
    if safe_config.get("mt5_password"):
        safe_config["mt5_password"] = "********"
    if safe_config.get("supabase_key"):
        safe_config["supabase_key"] = safe_config["supabase_key"][:10] + "********"
    return jsonify({"success": True, "config": safe_config})


@app.route("/config", methods=["POST"])
def update_config():
    """
    Update risk management config.

    Body can include any subset of config fields.
    """
    try:
        data = request.get_json(force=True)
    except Exception as exc:
        logger.error("Failed to parse config update body: %s", str(exc))
        return jsonify({"success": False, "error": "Invalid JSON body"}), 400

    if not isinstance(data, dict):
        return jsonify({"success": False, "error": "Body must be a JSON object"}), 400

    config = load_config()

    # Apply updates – only known keys are accepted
    updated_keys = []
    for key, value in data.items():
        if key in DEFAULT_CONFIG:
            config[key] = value
            updated_keys.append(key)
        else:
            logger.warning("Ignoring unknown config key: %s", key)

    if not updated_keys:
        return jsonify({"success": False, "error": "No valid config keys provided"}), 400

    save_config(config)

    # If MT5 credentials changed, reinitialize
    mt5_creds_changed = any(k in updated_keys for k in ["mt5_login", "mt5_password", "mt5_server", "mt5_path"])
    reinit_msg = ""
    if mt5_creds_changed:
        if init_mt5():
            reinit_msg = "MT5 reinitialized with new credentials."
        else:
            reinit_msg = "MT5 reinitialization failed with new credentials."

    # If account type changed to live, warn
    account_warning = ""
    if "account_type" in updated_keys and config.get("account_type") == "live":
        account_warning = "WARNING: Account type set to LIVE. Real money is at risk!"

    return jsonify({
        "success": True,
        "updated_keys": updated_keys,
        "mt5_reinit": reinit_msg,
        "account_warning": account_warning,
    })


@app.route("/daily-stats", methods=["GET"])
def daily_stats():
    """Return today's trading stats."""
    stats = load_daily_stats()
    # Refresh P&L from MT5
    _refresh_daily_pnl(stats)
    save_daily_stats(stats)

    config = load_config()

    # Calculate win rate
    total = stats.get("wins", 0) + stats.get("losses", 0)
    win_rate = (stats.get("wins", 0) / total * 100.0) if total > 0 else 0.0

    return jsonify({
        "success": True,
        "stats": stats,
        "win_rate": round(win_rate, 2),
        "account_type": config.get("account_type", "demo"),
    })


@app.route("/close-all", methods=["POST"])
def close_all():
    """Emergency close all positions."""
    logger.warning("EMERGENCY CLOSE ALL requested!")
    result = close_all_positions()
    if result["success"]:
        return jsonify(result)
    else:
        return jsonify(result), 207  # 207 Multi-Status (partial success)


@app.route("/reset-daily", methods=["POST"])
def reset_daily():
    """Reset daily counters (auto-called at midnight)."""
    stats = reset_daily_stats_internal(save=True)
    logger.info("Daily stats manually reset.")
    return jsonify({"success": True, "stats": stats})

# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
def startup():
    """Initialize everything on startup."""
    logger.info("=" * 60)
    logger.info("  ForexAI MT5 Bridge v2 Starting")
    logger.info("=" * 60)

    # Ensure config exists on disk
    if not CONFIG_PATH.exists():
        save_config(dict(DEFAULT_CONFIG))
        logger.info("Default config created at %s", str(CONFIG_PATH))
    else:
        # Merge any missing keys from defaults
        config = load_config()
        missing = [k for k in DEFAULT_CONFIG if k not in config]
        if missing:
            for k in missing:
                config[k] = DEFAULT_CONFIG[k]
            save_config(config)
            logger.info("Config updated with missing keys: %s", str(missing))

    config = load_config()

    # Display account type warning
    account_type = config.get("account_type", "demo")
    if account_type == "live":
        logger.warning("=" * 60)
        logger.warning("  !!! LIVE TRADING MODE ENABLED !!!")
        logger.warning("  Real money is at risk!")
        logger.warning("  Ensure you have verified the configuration.")
        logger.warning("=" * 60)
    else:
        logger.info("Account type: DEMO (safe mode)")

    # Initialize MT5
    if MT5_AVAILABLE:
        if init_mt5():
            logger.info("MT5 connection established successfully.")
            info = get_mt5_account_info()
            if info:
                logger.info(
                    "  Login: %s | Balance: %.2f %s | Server: %s | Mode: %s",
                    info.get("login"), info.get("balance", 0),
                    info.get("currency", ""), info.get("server", ""),
                    info.get("trade_mode_str", ""),
                )
        else:
            logger.error("MT5 initialization FAILED. Bridge will run in degraded mode.")
    else:
        logger.warning("MT5 package not available. Bridge running in OFFLINE mode.")

    # Initialize daily stats
    stats = load_daily_stats()
    logger.info(
        "Daily stats for %s: trades=%d P&L=%.2f",
        stats.get("date", "N/A"), stats.get("trades_count", 0), stats.get("net_pnl", 0),
    )

    logger.info("ForexAI MT5 Bridge v2 ready on port 5555.")


# Run startup before first request
startup()

@app.route("/sync-credentials", methods=["POST"])
def sync_credentials():
    """
    Fetch broker credentials from Supabase and reconnect MT5.
    
    This endpoint is called when the user saves broker credentials
    via the website. It reads the credentials from the mt5_config
    table in Supabase and reconnects MT5 with the new credentials.
    """
    config = load_config()
    supabase_url = config.get("supabase_url", "")
    supabase_key = config.get("supabase_key", "")
    
    if not supabase_url or not supabase_key:
        return jsonify({
            "success": False,
            "error": "Supabase not configured on bridge",
        }), 500
    
    try:
        import urllib.request
        import urllib.error
        
        # Fetch config from Supabase
        url = "%s/rest/v1/mt5_config?select=broker_login,broker_password,broker_server,account_type&limit=1" % supabase_url
        req = urllib.request.Request(
            url,
            headers={
                "apikey": supabase_key,
                "Authorization": "Bearer %s" % supabase_key,
            },
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            rows = json.loads(resp.read().decode("utf-8"))
        
        if not rows:
            return jsonify({
                "success": False,
                "error": "No config row found in Supabase",
            }), 404
        
        row = rows[0]
        login = row.get("broker_login", 0)
        password = row.get("broker_password", "")
        server = row.get("broker_server", "")
        account_type = row.get("account_type", "demo")
        
        if not login or not password or not server:
            return jsonify({
                "success": False,
                "error": "Broker credentials not set in Supabase (broker_login, broker_password, broker_server)",
                "has_login": bool(login),
                "has_password": bool(password),
                "has_server": bool(server),
            }), 400
        
        logger.info("Synced credentials from Supabase: login=%s server=%s type=%s", login, server, account_type)
        
        # Update local config
        config["mt5_login"] = login
        config["mt5_password"] = password
        config["mt5_server"] = server
        config["account_type"] = account_type
        save_config(config)
        
        # Reconnect MT5 with new credentials
        if not MT5_AVAILABLE or mt5 is None:
            return jsonify({
                "success": False,
                "error": "MT5 not available on this system",
                "credentials_saved": True,
            }), 503
        
        # Shutdown existing connection
        try:
            mt5.shutdown()
        except Exception:
            pass
        
        # Initialize and login
        path = config.get("mt5_path", r"C:\Program Files\MetaTrader 5\terminal64.exe")
        if not mt5.initialize(path=path):
            err = mt5.last_error()
            return jsonify({
                "success": False,
                "error": "MT5 initialize failed: %s" % str(err),
                "credentials_saved": True,
            }), 500
        
        if not mt5.login(login=int(login), password=password, server=server):
            err = mt5.last_error()
            return jsonify({
                "success": False,
                "error": "MT5 login failed: %s" % str(err),
                "credentials_saved": True,
                "login": login,
                "server": server,
            }), 401
        
        # Success — get account info
        account_info = get_mt5_account_info()
        logger.info("MT5 reconnected with new credentials: login=%s server=%s", login, server)
        
        return jsonify({
            "success": True,
            "message": "MT5 connected with new broker credentials",
            "login": login,
            "server": server,
            "account_type": account_type,
            "account_info": account_info,
        })
    
    except Exception as exc:
        logger.error("sync-credentials failed: %s", str(exc))
        return jsonify({
            "success": False,
            "error": str(exc),
        }), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5555, debug=False)
