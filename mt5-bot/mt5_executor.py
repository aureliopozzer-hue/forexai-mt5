"""
MT5 trade execution module for ForexAI Bot.

Handles all interaction with the MetaTrader 5 terminal:
connecting, executing signals, querying positions, closing trades,
and reading account information.

v2.1.0 — Added risk management: broker creds from Supabase, 
         profit target, loss limit, lot sizing (fixed & percentage).
"""

import logging
import threading
from datetime import datetime, timezone, date
from typing import Any

import MetaTrader5 as mt5

import config

logger = logging.getLogger("forexai")

# Thread lock to serialise MT5 calls (the MT5 Python API is not thread-safe)
_mt5_lock = threading.Lock()

# Magic number used to tag orders placed by this bot so we can filter them
MAGIC_NUMBER = 123456

# Cache for broker credentials from Supabase
_broker_login: int = 0
_broker_password: str = ""
_broker_server: str = ""


# ---------------------------------------------------------------------------
# Connection management
# ---------------------------------------------------------------------------

def set_broker_credentials(login: int, password: str, server: str) -> None:
    """Update broker credentials (read from Supabase config)."""
    global _broker_login, _broker_password, _broker_server
    _broker_login = login
    _broker_password = password
    _broker_server = server
    logger.info("Broker credentials updated: login=%d server=%s", login, server)


def connect_mt5() -> bool:
    """Initialise and log in to the MT5 terminal.

    Uses broker credentials from Supabase config if available,
    otherwise falls back to .env file settings.

    Returns True on success, False on failure.
    """
    with _mt5_lock:
        # Shut down any existing connection first
        mt5.shutdown()

        # Determine credentials: Supabase config takes priority over .env
        login = _broker_login if _broker_login else config.MT5_LOGIN
        password = _broker_password if _broker_password else config.MT5_PASSWORD
        server = _broker_server if _broker_server else config.MT5_SERVER

        if not login or not password or not server:
            logger.error(
                "MT5 credentials not configured. Set them in the dashboard or .env file."
            )
            return False

        # Attempt initialisation with optional path
        init_kwargs: dict[str, Any] = {}
        if config.MT5_PATH:
            init_kwargs["path"] = config.MT5_PATH

        if not mt5.initialize(**init_kwargs):
            logger.error(
                "MT5 initialize() failed: %s", mt5.last_error()
            )
            return False

        # Log in to the trading account
        if not mt5.login(
            login=login,
            password=password,
            server=server,
        ):
            logger.error(
                "MT5 login() failed for %d@%s: %s",
                login, server, mt5.last_error(),
            )
            mt5.shutdown()
            return False

        account_info = mt5.account_info()
        if account_info:
            logger.info(
                "MT5 connected: login=%d  server=%s  balance=%.2f  equity=%.2f  leverage=%d",
                account_info.login,
                account_info.server,
                account_info.balance,
                account_info.equity,
                account_info.leverage,
            )
        return True


def disconnect_mt5() -> None:
    """Shut down the MT5 connection cleanly."""
    with _mt5_lock:
        mt5.shutdown()
        logger.info("MT5 disconnected")


def is_connected() -> bool:
    """Check if MT5 is currently connected and responsive."""
    with _mt5_lock:
        try:
            info = mt5.account_info()
            return info is not None
        except Exception:
            return False


# ---------------------------------------------------------------------------
# Risk Management
# ---------------------------------------------------------------------------

def calculate_lot_size(cfg: dict, account_balance: float, symbol: str, sl_distance_pips: float) -> float:
    """Calculate the lot size based on risk management configuration.

    Two modes:
    - 'fixed': Use the fixed_lot value from config
    - 'percentage': Calculate lot size based on risk % of balance and SL distance

    Args:
        cfg: The mt5_config row from Supabase
        account_balance: Current account balance
        symbol: Trading symbol (e.g., 'EURUSD')
        sl_distance_pips: Stop loss distance in pips

    Returns:
        Calculated lot size (clamped to symbol limits)
    """
    lot_type = cfg.get("lot_type", "fixed")

    if lot_type == "percentage":
        # Calculate lot based on risk percentage
        risk_pct = float(cfg.get("lot_percentage", 1.0))
        risk_amount = account_balance * (risk_pct / 100.0)

        # Get symbol info for pip value calculation
        symbol_info = _get_symbol_info(symbol)
        if not symbol_info:
            logger.warning("Cannot calculate percentage lot — symbol %s not found, using 0.01", symbol)
            return 0.01

        # Calculate pip value
        pip_value = _get_pip_value(symbol_info)
        if pip_value <= 0 or sl_distance_pips <= 0:
            logger.warning("Cannot calculate percentage lot — pip_value=%.5f sl_distance=%.1f", pip_value, sl_distance_pips)
            return 0.01

        # Lot size = risk_amount / (sl_distance_pips * pip_value_per_lot)
        # pip_value_per_lot = pip_value * contract_size (usually 100000 for forex)
        contract_size = symbol_info.trade_contract_size if hasattr(symbol_info, 'trade_contract_size') else 100000
        pip_value_per_lot = pip_value * contract_size

        if pip_value_per_lot > 0:
            lot_size = risk_amount / (sl_distance_pips * pip_value_per_lot)
        else:
            lot_size = 0.01

        logger.info(
            "Percentage lot calc: balance=%.2f risk_pct=%.1f%% risk_amount=%.2f sl_pips=%.1f pip_val=%.5f lot=%.2f",
            account_balance, risk_pct, risk_amount, sl_distance_pips, pip_value, lot_size,
        )
    else:
        # Fixed lot
        lot_size = float(cfg.get("fixed_lot", 0.01))
        logger.info("Using fixed lot: %.2f", lot_size)

    # Clamp to symbol limits
    symbol_info = _get_symbol_info(symbol)
    if symbol_info:
        min_lot = symbol_info.volume_min
        max_lot = symbol_info.volume_max
        lot_step = symbol_info.volume_step
        lot_size = max(min_lot, min(lot_size, max_lot))
        lot_size = round(round(lot_size / lot_step) * lot_step, 8)

    return lot_size


def check_risk_limits(cfg: dict, account_balance: float, account_equity: float) -> str | None:
    """Check if risk limits have been reached.

    Returns None if trading is allowed, or a reason string if trading should stop.
    """
    profit_target = float(cfg.get("profit_target", 0))
    loss_limit = float(cfg.get("loss_limit", 0))
    daily_pnl = float(cfg.get("daily_pnl", 0))

    # Reset daily P&L if it's a new day
    daily_pnl_date_str = cfg.get("daily_pnl_date", "")
    today = date.today().isoformat()
    if daily_pnl_date_str != today:
        daily_pnl = 0.0

    # Check profit target
    if profit_target > 0 and daily_pnl >= profit_target:
        return f"Profit target reached: ${daily_pnl:.2f} >= ${profit_target:.2f}"

    # Check loss limit
    if loss_limit > 0 and daily_pnl <= -loss_limit:
        return f"Loss limit reached: ${daily_pnl:.2f} <= -${loss_limit:.2f}"

    return None


def update_daily_pnl(cfg: dict, current_pnl: float) -> dict:
    """Update the daily P&L tracking in config.

    Returns the updated config fields to save to Supabase.
    """
    today = date.today().isoformat()
    daily_pnl_date_str = cfg.get("daily_pnl_date", "")

    if daily_pnl_date_str != today:
        # New day — reset P&L
        return {
            "daily_pnl": current_pnl,
            "daily_pnl_date": today,
        }
    else:
        # Same day — accumulate
        existing_pnl = float(cfg.get("daily_pnl", 0))
        return {
            "daily_pnl": existing_pnl + current_pnl,
            "daily_pnl_date": today,
        }


def _get_pip_value(symbol_info) -> float:
    """Get the pip value for a symbol."""
    point = symbol_info.point
    digits = symbol_info.digits
    if digits == 3 or digits == 5:
        return point * 10
    return point


# ---------------------------------------------------------------------------
# Symbol helpers
# ---------------------------------------------------------------------------

def _normalize_symbol(symbol: str) -> str:
    """Convert a forex pair from display format to MT5 format.

    Examples:
        'EUR/USD' → 'EURUSD'
        'GBPUSD'  → 'GBPUSD'  (already normalised)
    """
    return symbol.replace("/", "").replace(" ", "").strip().upper()


def _get_symbol_info(symbol: str) -> mt5.SymbolInfo | None:
    """Fetch symbol info, attempting to enable the symbol if not visible."""
    with _mt5_lock:
        info = mt5.symbol_info(symbol)
        if info is None:
            logger.warning("Symbol %s not found in MT5", symbol)
            return None
        if not info.visible:
            # Try to add the symbol to Market Watch
            if not mt5.symbol_select(symbol, True):
                logger.warning("Could not add %s to Market Watch", symbol)
                return None
        return info


# ---------------------------------------------------------------------------
# Order execution
# ---------------------------------------------------------------------------

def execute_signal(signal: dict, cfg: dict | None = None) -> dict:
    """Execute a trading signal via MT5.

    Args:
        signal: A dict matching the mt5_signals table schema
        cfg: Optional config dict for risk management (lot sizing)

    Returns:
        A dict with keys: success (bool), ticket (int|None), error (str|None)
    """
    symbol = _normalize_symbol(signal.get("symbol", ""))
    direction = signal.get("direction", "").upper()
    entry_price = float(signal.get("entry_price", 0))
    stop_loss = float(signal.get("stop_loss", 0))
    take_profit = float(signal.get("take_profit", 0))
    signal_id = signal.get("id", "")

    # Validate direction
    if direction not in ("BUY", "SELL"):
        return {"success": False, "ticket": None, "error": f"Invalid direction: {direction}"}

    if not symbol:
        return {"success": False, "ticket": None, "error": "Empty symbol"}

    # Validate symbol exists in MT5
    symbol_info = _get_symbol_info(symbol)
    if symbol_info is None:
        return {"success": False, "ticket": None, "error": f"Symbol {symbol} not available in MT5"}

    # Determine order type and price
    if direction == "BUY":
        order_type = mt5.ORDER_TYPE_BUY
        price_field = symbol_info.ask
    else:
        order_type = mt5.ORDER_TYPE_SELL
        price_field = symbol_info.bid

    # Calculate lot size using risk management
    if cfg:
        # Calculate SL distance in pips for percentage lot sizing
        pip_value = _get_pip_value(symbol_info)
        sl_distance_pips = 0.0
        if stop_loss > 0 and pip_value > 0:
            sl_distance_pips = abs(price_field - stop_loss) / pip_value

        # Get account info for balance
        account_info = mt5.account_info()
        account_balance = account_info.balance if account_info else 10000

        lot_size = calculate_lot_size(cfg, account_balance, symbol, sl_distance_pips)
    else:
        lot_size = float(signal.get("lot_size", 0.01))

    # Determine the fill policy
    fill_type = mt5.ORDER_FILLING_IOC
    filling_mode = symbol_info.filling_mode
    if filling_mode & mt5.SYMBOL_FILLING_FOK:
        fill_type = mt5.ORDER_FILLING_FOK
    elif filling_mode & mt5.SYMBOL_FILLING_IOC:
        fill_type = mt5.ORDER_FILLING_IOC
    else:
        fill_type = mt5.ORDER_FILLING_RETURN

    # Clamp lot size to symbol limits
    min_lot = symbol_info.volume_min
    max_lot = symbol_info.volume_max
    lot_step = symbol_info.volume_step
    lot_size = max(min_lot, min(lot_size, max_lot))
    # Round to nearest lot step
    lot_size = round(round(lot_size / lot_step) * lot_step, 8)

    # Build the order request
    request: dict[str, Any] = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": lot_size,
        "type": order_type,
        "price": price_field,
        "sl": stop_loss,
        "tp": take_profit,
        "deviation": 20,  # max price deviation in points
        "magic": MAGIC_NUMBER,
        "comment": f"ForexAI|{signal_id[:8]}",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": fill_type,
    }

    logger.info(
        "Sending %s order: %s %.2f lots @ %.5f  SL=%.5f  TP=%.5f",
        direction, symbol, lot_size, price_field, stop_loss, take_profit,
    )

    with _mt5_lock:
        result = mt5.order_send(request)

    if result is None:
        error = f"order_send returned None: {mt5.last_error()}"
        logger.error(error)
        return {"success": False, "ticket": None, "error": error}

    if result.retcode != mt5.TRADE_RETCODE_DONE:
        error = (
            f"order_send failed: retcode={result.retcode} "
            f"comment={result.comment}"
        )
        logger.error(error)
        return {"success": False, "ticket": None, "error": error}

    ticket = result.order
    logger.info(
        "Order executed successfully: ticket=%d  price=%.5f  volume=%.2f",
        ticket, result.price, result.volume,
    )
    return {"success": True, "ticket": ticket, "error": None}


# ---------------------------------------------------------------------------
# Position queries
# ---------------------------------------------------------------------------

def get_open_positions() -> list[dict]:
    """Return a list of currently open positions from MT5.

    Each position is returned as a dict with fields matching the
    mt5_positions Supabase table.
    """
    with _mt5_lock:
        raw_positions = mt5.positions_get()

    if raw_positions is None:
        logger.warning("Failed to get positions: %s", mt5.last_error())
        return []

    positions: list[dict] = []
    for pos in raw_positions:
        direction = "BUY" if pos.type == mt5.ORDER_TYPE_BUY else "SELL"

        # Calculate profit in pips
        symbol_info = _get_symbol_info(pos.symbol)
        pip_value = 0.0001
        if symbol_info:
            pip_value = _get_pip_value(symbol_info)

        profit_pips = 0.0
        if pip_value > 0:
            if direction == "BUY":
                profit_pips = (pos.price_current - pos.price_open) / pip_value
            else:
                profit_pips = (pos.price_open - pos.price_current) / pip_value

        positions.append({
            "ticket": pos.ticket,
            "symbol": pos.symbol,
            "direction": direction,
            "lot_size": pos.volume,
            "entry_price": pos.price_open,
            "stop_loss": pos.sl,
            "take_profit": pos.tp,
            "current_price": pos.price_current,
            "profit": pos.profit,
            "profit_pips": round(profit_pips, 1),
            "open_time": pos.time.isoformat() if pos.time else None,
            "status": "open",
            "signal_id": None,
        })

    logger.debug("Fetched %d open position(s) from MT5", len(positions))
    return positions


# ---------------------------------------------------------------------------
# Close trade
# ---------------------------------------------------------------------------

def close_trade(ticket: int) -> dict:
    """Close an open position by ticket number.

    Returns:
        dict with success (bool), error (str|None).
    """
    with _mt5_lock:
        position = mt5.positions_get(ticket=ticket)

    if position is None or len(position) == 0:
        error = f"Position ticket={ticket} not found"
        logger.warning(error)
        return {"success": False, "error": error}

    pos = position[0]
    symbol = pos.symbol
    volume = pos.volume

    # Determine the closing order type (opposite of position direction)
    if pos.type == mt5.ORDER_TYPE_BUY:
        order_type = mt5.ORDER_TYPE_SELL
        with _mt5_lock:
            symbol_info = mt5.symbol_info(symbol)
        close_price = symbol_info.bid if symbol_info else 0
    else:
        order_type = mt5.ORDER_TYPE_BUY
        with _mt5_lock:
            symbol_info = mt5.symbol_info(symbol)
        close_price = symbol_info.ask if symbol_info else 0

    if close_price == 0:
        error = f"Cannot get closing price for {symbol}"
        logger.error(error)
        return {"success": False, "error": error}

    # Determine fill policy
    fill_type = mt5.ORDER_FILLING_IOC
    if symbol_info:
        filling_mode = symbol_info.filling_mode
        if filling_mode & mt5.SYMBOL_FILLING_FOK:
            fill_type = mt5.ORDER_FILLING_FOK
        elif filling_mode & mt5.SYMBOL_FILLING_IOC:
            fill_type = mt5.ORDER_FILLING_IOC
        else:
            fill_type = mt5.ORDER_FILLING_RETURN

    request: dict[str, Any] = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": volume,
        "type": order_type,
        "position": ticket,
        "price": close_price,
        "deviation": 20,
        "magic": MAGIC_NUMBER,
        "comment": "ForexAI|close",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": fill_type,
    }

    logger.info("Closing position ticket=%d  %s %.2f @ %.5f", ticket, symbol, volume, close_price)

    with _mt5_lock:
        result = mt5.order_send(request)

    if result is None:
        error = f"close order_send returned None: {mt5.last_error()}"
        logger.error(error)
        return {"success": False, "error": error}

    if result.retcode != mt5.TRADE_RETCODE_DONE:
        error = f"close order failed: retcode={result.retcode} comment={result.comment}"
        logger.error(error)
        return {"success": False, "error": error}

    logger.info("Position ticket=%d closed at %.5f", ticket, result.price)
    return {"success": True, "error": None}


# ---------------------------------------------------------------------------
# Account info
# ---------------------------------------------------------------------------

def get_account_info() -> dict | None:
    """Return a dict with key account information from MT5."""
    with _mt5_lock:
        info = mt5.account_info()

    if info is None:
        logger.warning("Failed to get MT5 account info: %s", mt5.last_error())
        return None

    return {
        "mt5_connected": True,
        "account_balance": info.balance,
        "account_equity": info.equity,
        "account_leverage": info.leverage,
        "account_currency": info.currency,
        "open_positions_count": len(mt5.positions_get() or []),
        "mt5_terminal_path": config.MT5_PATH,
        "mt5_login": info.login,
        "mt5_server": info.server,
        # Determine account type from server name (common convention)
        "mt5_account_type": "demo" if "demo" in info.server.lower() else "live",
    }
