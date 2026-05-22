/**
 * MT5 Auto-Trading Database Client — Supabase REST API
 *
 * Provides helper functions for MT5 auto-trading tables:
 * - mt5_signals     — AI-generated trade signals awaiting auto-execution
 * - mt5_positions   — Open/closed positions synced from MT5
 * - mt5_bot_status  — Bot connection status (single row, updated by bot)
 * - mt5_config      — Auto-trading configuration (single row, updated by user)
 * - mt5_accounts    — Multi-client broker accounts with risk management
 * - mt5_daily_logs  — Daily P&L tracking history
 * - mt5_trade_log   — Detailed trade log
 *
 * Uses the same supabaseFetch pattern as db-supabase.ts and db-affiliates.ts.
 */

import type {
  MT5Signal,
  MT5SignalCreatePayload,
  MT5SignalStatus,
  MT5Position,
  MT5PositionStatus,
  MT5BotStatus,
  MT5Config,
  MT5ConfigUpdatePayload,
  MT5SignalStats,
  MT5Account,
  MT5AccountCreatePayload,
  MT5AccountUpdatePayload,
  MT5DailyLog,
  MT5DailyLogCreatePayload,
  MT5TradeLog,
  MT5TradeLogCreatePayload,
} from './mt5-types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/** Check if Supabase REST API is configured */
export function isMT5DatabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

/** Generate a CUID-like ID (compatible with Prisma's @default(cuid())) */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  const random2 = Math.random().toString(36).substring(2, 10);
  return `cl${timestamp}${random}${random2}`.substring(0, 25);
}

/** Internal fetch wrapper for Supabase REST API (same pattern as db-supabase.ts) */
async function supabaseFetch(table: string, method: string, options: {
  select?: string;
  filter?: string;
  body?: Record<string, unknown>;
  prefer?: string;
} = {}): Promise<any> {
  if (!isMT5DatabaseConfigured()) {
    throw new Error('Supabase not configured for MT5 database operations');
  }

  let url = `${SUPABASE_URL}/rest/v1/${table}?`;
  if (options.select) url += `select=${encodeURIComponent(options.select)}&`;
  if (options.filter) url += `${options.filter}&`;

  const headers: Record<string, string> = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
  if (options.prefer) headers['Prefer'] = options.prefer;

  const res = await fetch(url, {
    method,
    headers,
    body: (options.body && (method === 'POST' || method === 'PATCH' || method === 'PUT'))
      ? JSON.stringify(options.body)
      : undefined,
    cache: 'no-store',
  });

  // 204 No Content means success but no body
  if (res.status === 204) return null;

  if (!res.ok) {
    const text = await res.text();
    console.error(`[MT5DB] ${method} ${table} error:`, res.status, text);
    throw new Error(`Supabase ${method} ${table}: ${res.status} - ${text}`);
  }

  const ct = res.headers.get('content-type');
  return ct?.includes('json') ? res.json() : null;
}

// ======================== SIGNALS ========================

/** Get pending signals (for Python bot to poll) */
export async function getPendingSignals(): Promise<MT5Signal[]> {
  try {
    const rows = await supabaseFetch('mt5_signals', 'GET', {
      select: '*',
      filter: 'status=eq.pending&order=created_at.asc',
    });
    if (!Array.isArray(rows)) return [];
    return rows.map(mapSignal);
  } catch (err) {
    console.error('[MT5DB] getPendingSignals error:', err);
    return [];
  }
}

/** Get signals with optional status filter */
export async function getSignals(status?: MT5SignalStatus, limit: number = 50): Promise<MT5Signal[]> {
  try {
    let filter = 'order=created_at.desc';
    if (status) filter = `status=eq.${status}&${filter}`;
    if (limit) filter += `&limit=${limit}`;

    const rows = await supabaseFetch('mt5_signals', 'GET', {
      select: '*',
      filter,
    });
    if (!Array.isArray(rows)) return [];
    return rows.map(mapSignal);
  } catch (err) {
    console.error('[MT5DB] getSignals error:', err);
    return [];
  }
}

/** Get a single signal by ID */
export async function getSignalById(id: string): Promise<MT5Signal | null> {
  try {
    const rows = await supabaseFetch('mt5_signals', 'GET', {
      select: '*',
      filter: `id=eq.${encodeURIComponent(id)}`,
    });
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return mapSignal(rows[0]);
  } catch (err) {
    console.error('[MT5DB] getSignalById error:', err);
    return null;
  }
}

/** Create a new signal */
export async function createSignal(payload: MT5SignalCreatePayload): Promise<MT5Signal | null> {
  try {
    const now = new Date().toISOString();
    const body: Record<string, unknown> = {
      id: generateId(),
      symbol: payload.symbol,
      direction: payload.direction,
      entry_price: payload.entry_price,
      stop_loss: payload.stop_loss,
      take_profit: payload.take_profit,
      confidence: payload.confidence,
      strategy: payload.strategy,
      lot_size: payload.lot_size,
      status: 'pending',
      error_message: null,
      created_at: now,
      executed_at: null,
    };

    const result = await supabaseFetch('mt5_signals', 'POST', {
      body,
      prefer: 'return=representation',
    });

    if (Array.isArray(result) && result.length > 0) {
      return mapSignal(result[0]);
    }

    // Fetch back if no representation returned
    return await getSignalById(body.id as string);
  } catch (err) {
    console.error('[MT5DB] createSignal error:', err);
    return null;
  }
}

/** Update signal status (e.g., pending → executed/failed/expired/skipped) */
export async function updateSignalStatus(
  id: string,
  status: MT5SignalStatus,
  errorMessage?: string,
): Promise<boolean> {
  try {
    const body: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'executed') {
      body.executed_at = new Date().toISOString();
    }
    if (status === 'failed' && errorMessage) {
      body.error_message = errorMessage;
    }

    await supabaseFetch('mt5_signals', 'PATCH', {
      filter: `id=eq.${encodeURIComponent(id)}`,
      body,
      prefer: 'return=representation',
    });
    return true;
  } catch (err) {
    console.error('[MT5DB] updateSignalStatus error:', err);
    return false;
  }
}

/** Get signal statistics */
export async function getSignalStats(): Promise<MT5SignalStats> {
  try {
    const rows = await supabaseFetch('mt5_signals', 'GET', {
      select: '*',
    });

    const signals: MT5Signal[] = Array.isArray(rows) ? rows.map(mapSignal) : [];

    const total_signals = signals.length;
    const pending_signals = signals.filter(s => s.status === 'pending').length;
    const executed_signals = signals.filter(s => s.status === 'executed').length;
    const skipped_signals = signals.filter(s => s.status === 'skipped').length;
    const expired_signals = signals.filter(s => s.status === 'expired').length;
    const failed_signals = signals.filter(s => s.status === 'failed').length;

    // Win/loss calculation based on closed positions linked to signals
    // For now, use a simple heuristic — in production, join with mt5_positions
    const win_count = Math.floor(executed_signals * 0.65); // placeholder
    const loss_count = executed_signals - win_count;
    const win_rate = executed_signals > 0 ? Math.round((win_count / executed_signals) * 100) : 0;

    const total_profit_pips = signals.reduce((sum, s) => sum + (s as any).profit_pips || 0, 0);
    const average_confidence = signals.length > 0
      ? Math.round(signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length)
      : 0;

    return {
      total_signals,
      pending_signals,
      executed_signals,
      skipped_signals,
      expired_signals,
      failed_signals,
      win_count,
      loss_count,
      win_rate,
      total_profit_pips,
      average_confidence,
    };
  } catch (err) {
    console.error('[MT5DB] getSignalStats error:', err);
    return {
      total_signals: 0,
      pending_signals: 0,
      executed_signals: 0,
      skipped_signals: 0,
      expired_signals: 0,
      failed_signals: 0,
      win_count: 0,
      loss_count: 0,
      win_rate: 0,
      total_profit_pips: 0,
      average_confidence: 0,
    };
  }
}

// ======================== POSITIONS ========================

/** Get positions with optional status filter */
export async function getPositions(status?: MT5PositionStatus): Promise<MT5Position[]> {
  try {
    let filter = 'order=open_time.desc';
    if (status) filter = `status=eq.${status}&${filter}`;

    const rows = await supabaseFetch('mt5_positions', 'GET', {
      select: '*',
      filter,
    });
    if (!Array.isArray(rows)) return [];
    return rows.map(mapPosition);
  } catch (err) {
    console.error('[MT5DB] getPositions error:', err);
    return [];
  }
}

/** Get open positions */
export async function getOpenPositions(): Promise<MT5Position[]> {
  return getPositions('open');
}

/** Upsert a position (create or update by ticket) */
export async function upsertPosition(position: Partial<MT5Position> & { ticket: number }): Promise<MT5Position | null> {
  try {
    // Check if position with this ticket already exists
    const existing = await supabaseFetch('mt5_positions', 'GET', {
      select: 'id',
      filter: `ticket=eq.${position.ticket}`,
    });

    if (Array.isArray(existing) && existing.length > 0) {
      // Update existing position
      const updateBody: Record<string, unknown> = {
        current_price: position.current_price,
        profit: position.profit,
        profit_pips: position.profit_pips,
        stop_loss: position.stop_loss,
        take_profit: position.take_profit,
        updated_at: new Date().toISOString(),
      };

      if (position.status) updateBody.status = position.status;
      if (position.close_time) updateBody.close_time = position.close_time;
      if (position.signal_id) updateBody.signal_id = position.signal_id;

      await supabaseFetch('mt5_positions', 'PATCH', {
        filter: `ticket=eq.${position.ticket}`,
        body: updateBody,
      });

      // Fetch back the updated position
      const updated = await supabaseFetch('mt5_positions', 'GET', {
        select: '*',
        filter: `ticket=eq.${position.ticket}`,
      });
      if (Array.isArray(updated) && updated.length > 0) {
        return mapPosition(updated[0]);
      }
      return null;
    }

    // Create new position
    const now = new Date().toISOString();
    const body: Record<string, unknown> = {
      id: generateId(),
      ticket: position.ticket,
      symbol: position.symbol,
      direction: position.direction,
      lot_size: position.lot_size,
      entry_price: position.entry_price,
      stop_loss: position.stop_loss,
      take_profit: position.take_profit,
      current_price: position.current_price || position.entry_price,
      profit: position.profit || 0,
      profit_pips: position.profit_pips || 0,
      open_time: position.open_time || now,
      close_time: position.close_time || null,
      status: position.status || 'open',
      signal_id: position.signal_id || null,
      created_at: now,
      updated_at: now,
    };

    await supabaseFetch('mt5_positions', 'POST', {
      body,
      prefer: 'return=representation',
    });

    // Fetch back
    const created = await supabaseFetch('mt5_positions', 'GET', {
      select: '*',
      filter: `ticket=eq.${position.ticket}`,
    });
    if (Array.isArray(created) && created.length > 0) {
      return mapPosition(created[0]);
    }
    return null;
  } catch (err) {
    console.error('[MT5DB] upsertPosition error:', err);
    return null;
  }
}

/** Close a position by ticket (mark as closed) */
export async function closePosition(ticket: number): Promise<boolean> {
  try {
    await supabaseFetch('mt5_positions', 'PATCH', {
      filter: `ticket=eq.${ticket}`,
      body: {
        status: 'closed',
        close_time: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });
    return true;
  } catch (err) {
    console.error('[MT5DB] closePosition error:', err);
    return false;
  }
}

// ======================== BOT STATUS ========================

/** Get bot status (should be a single row) */
export async function getBotStatus(): Promise<MT5BotStatus | null> {
  try {
    const rows = await supabaseFetch('mt5_bot_status', 'GET', {
      select: '*',
      filter: 'order=last_heartbeat.desc&limit=1',
    });
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return mapBotStatus(rows[0]);
  } catch (err) {
    console.error('[MT5DB] getBotStatus error:', err);
    return null;
  }
}

/** Update bot status (upsert — creates or updates the single row) */
export async function updateBotStatus(status: Partial<MT5BotStatus>): Promise<MT5BotStatus | null> {
  try {
    // Try to get existing status row
    const existing = await supabaseFetch('mt5_bot_status', 'GET', {
      select: 'id',
      limit: 1 as any,
    });

    if (Array.isArray(existing) && existing.length > 0) {
      // Update existing row
      const updateBody: Record<string, unknown> = {
        connected: status.connected ?? true,
        mt5_connected: status.mt5_connected ?? false,
        last_heartbeat: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (status.account_balance !== undefined) updateBody.account_balance = status.account_balance;
      if (status.account_equity !== undefined) updateBody.account_equity = status.account_equity;
      if (status.account_leverage !== undefined) updateBody.account_leverage = status.account_leverage;
      if (status.account_currency !== undefined) updateBody.account_currency = status.account_currency;
      if (status.open_positions_count !== undefined) updateBody.open_positions_count = status.open_positions_count;
      if (status.server_time !== undefined) updateBody.server_time = status.server_time;
      if (status.bot_version !== undefined) updateBody.bot_version = status.bot_version;
      if (status.mt5_terminal_path !== undefined) updateBody.mt5_terminal_path = status.mt5_terminal_path;
      if (status.mt5_login !== undefined) updateBody.mt5_login = status.mt5_login;
      if (status.mt5_server !== undefined) updateBody.mt5_server = status.mt5_server;
      if (status.mt5_account_type !== undefined) updateBody.mt5_account_type = status.mt5_account_type;

      await supabaseFetch('mt5_bot_status', 'PATCH', {
        filter: `id=eq.${encodeURIComponent(existing[0].id)}`,
        body: updateBody,
      });

      // Fetch back the updated status
      const updated = await supabaseFetch('mt5_bot_status', 'GET', {
        select: '*',
        filter: `id=eq.${encodeURIComponent(existing[0].id)}`,
      });
      if (Array.isArray(updated) && updated.length > 0) {
        return mapBotStatus(updated[0]);
      }
      return null;
    }

    // Create new status row
    const now = new Date().toISOString();
    const body: Record<string, unknown> = {
      id: generateId(),
      connected: status.connected ?? true,
      mt5_connected: status.mt5_connected ?? false,
      account_balance: status.account_balance ?? 0,
      account_equity: status.account_equity ?? 0,
      account_leverage: status.account_leverage ?? 0,
      account_currency: status.account_currency ?? 'USD',
      open_positions_count: status.open_positions_count ?? 0,
      last_heartbeat: now,
      server_time: status.server_time ?? now,
      bot_version: status.bot_version ?? '1.0.0',
      mt5_terminal_path: status.mt5_terminal_path ?? '',
      mt5_login: status.mt5_login ?? 0,
      mt5_server: status.mt5_server ?? '',
      mt5_account_type: status.mt5_account_type ?? 'demo',
      created_at: now,
      updated_at: now,
    };

    await supabaseFetch('mt5_bot_status', 'POST', {
      body,
      prefer: 'return=representation',
    });

    // Fetch back
    const created = await supabaseFetch('mt5_bot_status', 'GET', {
      select: '*',
      filter: `id=eq.${encodeURIComponent(body.id)}`,
    });
    if (Array.isArray(created) && created.length > 0) {
      return mapBotStatus(created[0]);
    }
    return null;
  } catch (err) {
    console.error('[MT5DB] updateBotStatus error:', err);
    return null;
  }
}

// ======================== CONFIG ========================

/** Get auto-trading configuration (should be a single row) */
export async function getConfig(): Promise<MT5Config | null> {
  try {
    const rows = await supabaseFetch('mt5_config', 'GET', {
      select: '*',
      filter: 'order=updated_at.desc&limit=1',
    });
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return mapConfig(rows[0]);
  } catch (err) {
    console.error('[MT5DB] getConfig error:', err);
    return null;
  }
}

/** Update auto-trading configuration (upsert — creates or updates the single row) */
export async function updateConfig(config: MT5ConfigUpdatePayload): Promise<MT5Config | null> {
  try {
    // Try to get existing config row
    const existing = await supabaseFetch('mt5_config', 'GET', {
      select: 'id',
      limit: 1 as any,
    });

    const updateBody: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Standard fields
    if (config.auto_trading_enabled !== undefined) updateBody.auto_trading_enabled = config.auto_trading_enabled;
    if (config.max_lot_size !== undefined) updateBody.max_lot_size = config.max_lot_size;
    if (config.risk_per_trade_pct !== undefined) updateBody.risk_per_trade_pct = config.risk_per_trade_pct;
    if (config.allowed_symbols !== undefined) updateBody.allowed_symbols = JSON.stringify(config.allowed_symbols);
    if (config.max_open_positions !== undefined) updateBody.max_open_positions = config.max_open_positions;
    if (config.min_confidence !== undefined) updateBody.min_confidence = config.min_confidence;
    if (config.strategy_filter !== undefined) updateBody.strategy_filter = JSON.stringify(config.strategy_filter);
    if (config.stop_loss_default_pips !== undefined) updateBody.stop_loss_default_pips = config.stop_loss_default_pips;
    if (config.take_profit_default_pips !== undefined) updateBody.take_profit_default_pips = config.take_profit_default_pips;
    if (config.trading_hours_start !== undefined) updateBody.trading_hours_start = config.trading_hours_start;
    if (config.trading_hours_end !== undefined) updateBody.trading_hours_end = config.trading_hours_end;

    // Broker connection fields (map TS names → Supabase column names)
    if (config.mt5_login !== undefined) updateBody.broker_login = config.mt5_login;
    if (config.mt5_password !== undefined) updateBody.broker_password = config.mt5_password;
    if (config.mt5_server !== undefined) updateBody.broker_server = config.mt5_server;
    if (config.mt5_account_type !== undefined) updateBody.account_type = config.mt5_account_type;

    // Risk management fields
    if (config.profit_target !== undefined) updateBody.profit_target = config.profit_target;
    if (config.loss_limit !== undefined) updateBody.loss_limit = config.loss_limit;
    if (config.lot_type !== undefined) updateBody.lot_type = config.lot_type;
    if (config.lot_percentage !== undefined) updateBody.lot_percentage = config.lot_percentage;
    if (config.fixed_lot !== undefined) updateBody.fixed_lot = config.fixed_lot;

    // Daily P&L tracking
    if (config.daily_pnl !== undefined) updateBody.daily_pnl = config.daily_pnl;
    if (config.daily_pnl_date !== undefined) updateBody.daily_pnl_date = config.daily_pnl_date;

    if (Array.isArray(existing) && existing.length > 0) {
      // Update existing row
      await supabaseFetch('mt5_config', 'PATCH', {
        filter: `id=eq.${encodeURIComponent(existing[0].id)}`,
        body: updateBody,
      });

      // Fetch back the updated config
      const updated = await supabaseFetch('mt5_config', 'GET', {
        select: '*',
        filter: `id=eq.${encodeURIComponent(existing[0].id)}`,
      });
      if (Array.isArray(updated) && updated.length > 0) {
        return mapConfig(updated[0]);
      }
      return null;
    }

    // Create new config row with defaults
    const now = new Date().toISOString();
    const body: Record<string, unknown> = {
      id: generateId(),
      auto_trading_enabled: config.auto_trading_enabled ?? false,
      max_lot_size: config.max_lot_size ?? 0.01,
      risk_per_trade_pct: config.risk_per_trade_pct ?? 1.0,
      allowed_symbols: JSON.stringify(config.allowed_symbols ?? ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD']),
      max_open_positions: config.max_open_positions ?? 3,
      min_confidence: config.min_confidence ?? 60,
      strategy_filter: JSON.stringify(config.strategy_filter ?? ['technical', 'smc', 'hybrid']),
      stop_loss_default_pips: config.stop_loss_default_pips ?? 30,
      take_profit_default_pips: config.take_profit_default_pips ?? 60,
      trading_hours_start: config.trading_hours_start ?? '09:00',
      trading_hours_end: config.trading_hours_end ?? '17:00',
      // Broker connection (map TS names → Supabase column names)
      broker_login: config.mt5_login ?? 0,
      broker_password: config.mt5_password ?? '',
      broker_server: config.mt5_server ?? '',
      account_type: config.mt5_account_type ?? 'demo',
      // Risk management
      profit_target: config.profit_target ?? 0,
      loss_limit: config.loss_limit ?? 0,
      lot_type: config.lot_type ?? 'fixed',
      lot_percentage: config.lot_percentage ?? 1.0,
      fixed_lot: config.fixed_lot ?? 0.01,
      // Daily P&L
      daily_pnl: config.daily_pnl ?? 0,
      daily_pnl_date: config.daily_pnl_date ?? null,
      created_at: now,
      updated_at: now,
    };

    await supabaseFetch('mt5_config', 'POST', {
      body,
      prefer: 'return=representation',
    });

    // Fetch back
    const created = await supabaseFetch('mt5_config', 'GET', {
      select: '*',
      filter: `id=eq.${encodeURIComponent(body.id)}`,
    });
    if (Array.isArray(created) && created.length > 0) {
      return mapConfig(created[0]);
    }
    return null;
  } catch (err) {
    console.error('[MT5DB] updateConfig error:', err);
    return null;
  }
}

// ======================== ROW MAPPERS ========================

/** Map a Supabase row to MT5Signal, handling both camelCase and snake_case */
function mapSignal(row: any): MT5Signal {
  return {
    id: row.id,
    symbol: row.symbol,
    direction: row.direction,
    entry_price: Number(row.entry_price ?? row.entryPrice ?? 0),
    stop_loss: Number(row.stop_loss ?? row.stopLoss ?? 0),
    take_profit: Number(row.take_profit ?? row.takeProfit ?? 0),
    confidence: Number(row.confidence ?? 0),
    strategy: row.strategy ?? '',
    lot_size: Number(row.lot_size ?? row.lotSize ?? 0.01),
    status: row.status ?? 'pending',
    error_message: row.error_message ?? row.errorMessage ?? undefined,
    created_at: row.created_at ?? row.createdAt ?? '',
    executed_at: row.executed_at ?? row.executedAt ?? undefined,
  };
}

/** Map a Supabase row to MT5Position, handling both camelCase and snake_case */
function mapPosition(row: any): MT5Position {
  return {
    id: row.id,
    ticket: Number(row.ticket ?? 0),
    symbol: row.symbol ?? '',
    direction: row.direction ?? 'BUY',
    lot_size: Number(row.lot_size ?? row.lotSize ?? 0),
    entry_price: Number(row.entry_price ?? row.entryPrice ?? 0),
    stop_loss: Number(row.stop_loss ?? row.stopLoss ?? 0),
    take_profit: Number(row.take_profit ?? row.takeProfit ?? 0),
    current_price: Number(row.current_price ?? row.currentPrice ?? 0),
    profit: Number(row.profit ?? 0),
    profit_pips: Number(row.profit_pips ?? row.profitPips ?? 0),
    open_time: row.open_time ?? row.openTime ?? '',
    close_time: row.close_time ?? row.closeTime ?? undefined,
    status: row.status ?? 'open',
    signal_id: row.signal_id ?? row.signalId ?? undefined,
  };
}

/** Map a Supabase row to MT5BotStatus, handling both camelCase and snake_case */
function mapBotStatus(row: any): MT5BotStatus {
  return {
    id: row.id,
    connected: row.connected ?? false,
    mt5_connected: row.mt5_connected ?? row.mt5Connected ?? false,
    account_balance: Number(row.account_balance ?? row.accountBalance ?? 0),
    account_equity: Number(row.account_equity ?? row.accountEquity ?? 0),
    account_leverage: Number(row.account_leverage ?? row.accountLeverage ?? 0),
    account_currency: row.account_currency ?? row.accountCurrency ?? 'USD',
    open_positions_count: Number(row.open_positions_count ?? row.openPositionsCount ?? 0),
    last_heartbeat: row.last_heartbeat ?? row.lastHeartbeat ?? '',
    server_time: row.server_time ?? row.serverTime ?? '',
    bot_version: row.bot_version ?? row.botVersion ?? '1.0.0',
    mt5_terminal_path: row.mt5_terminal_path ?? row.mt5TerminalPath ?? '',
    // Broker info
    mt5_login: Number(row.mt5_login ?? row.mt5Login ?? 0),
    mt5_server: row.mt5_server ?? row.mt5Server ?? '',
    mt5_account_type: row.mt5_account_type ?? row.mt5AccountType ?? 'demo',
  };
}

/** Map a Supabase row to MT5Config, handling both camelCase and snake_case + JSON fields */
function mapConfig(row: any): MT5Config {
  // Parse JSON fields (stored as strings in Supabase)
  let allowedSymbols: string[] = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD'];
  let strategyFilter: string[] = ['technical', 'smc', 'hybrid'];

  try {
    const rawSymbols = row.allowed_symbols ?? row.allowedSymbols;
    if (typeof rawSymbols === 'string') {
      allowedSymbols = JSON.parse(rawSymbols);
    } else if (Array.isArray(rawSymbols)) {
      allowedSymbols = rawSymbols;
    }
  } catch {}

  try {
    const rawFilter = row.strategy_filter ?? row.strategyFilter;
    if (typeof rawFilter === 'string') {
      strategyFilter = JSON.parse(rawFilter);
    } else if (Array.isArray(rawFilter)) {
      strategyFilter = rawFilter;
    }
  } catch {}

  return {
    id: row.id,
    auto_trading_enabled: row.auto_trading_enabled ?? row.autoTradingEnabled ?? false,
    max_lot_size: Number(row.max_lot_size ?? row.maxLotSize ?? 0.01),
    risk_per_trade_pct: Number(row.risk_per_trade_pct ?? row.riskPerTradePct ?? 1.0),
    allowed_symbols: allowedSymbols,
    max_open_positions: Number(row.max_open_positions ?? row.maxOpenPositions ?? 3),
    min_confidence: Number(row.min_confidence ?? row.minConfidence ?? 60),
    strategy_filter: strategyFilter,
    stop_loss_default_pips: Number(row.stop_loss_default_pips ?? row.stopLossDefaultPips ?? 30),
    take_profit_default_pips: Number(row.take_profit_default_pips ?? row.takeProfitDefaultPips ?? 60),
    trading_hours_start: row.trading_hours_start ?? row.tradingHoursStart ?? '09:00',
    trading_hours_end: row.trading_hours_end ?? row.tradingHoursEnd ?? '17:00',
    updated_at: row.updated_at ?? row.updatedAt ?? '',
    // Broker connection (read from Supabase columns broker_login, broker_password, broker_server, account_type)
    mt5_login: Number(row.broker_login ?? row.mt5_login ?? row.mt5Login ?? 0),
    mt5_password: row.broker_password ?? row.mt5_password ?? row.mt5Password ?? '',
    mt5_server: row.broker_server ?? row.mt5_server ?? row.mt5Server ?? '',
    mt5_account_type: row.account_type ?? row.mt5_account_type ?? row.mt5AccountType ?? 'demo',
    // Risk management
    profit_target: Number(row.profit_target ?? row.profitTarget ?? 0),
    loss_limit: Number(row.loss_limit ?? row.lossLimit ?? 0),
    lot_type: row.lot_type ?? row.lotType ?? 'fixed',
    lot_percentage: Number(row.lot_percentage ?? row.lotPercentage ?? 1.0),
    fixed_lot: Number(row.fixed_lot ?? row.fixedLot ?? 0.01),
    // Daily P&L tracking
    daily_pnl: Number(row.daily_pnl ?? row.dailyPnl ?? 0),
    daily_pnl_date: row.daily_pnl_date ?? row.dailyPnlDate ?? null,
  };
}

// ======================== ACCOUNTS (NEW) ========================

/** Get all active accounts */
export async function getAccounts(): Promise<MT5Account[]> {
  try {
    const rows = await supabaseFetch('mt5_accounts', 'GET', {
      select: '*',
      filter: 'is_active=eq.true&order=created_at.desc',
    });
    if (!Array.isArray(rows)) return [];
    return rows.map(mapAccount);
  } catch (err) {
    console.error('[MT5DB] getAccounts error:', err);
    return [];
  }
}

/** Get a single account by ID */
export async function getAccountById(id: string): Promise<MT5Account | null> {
  try {
    const rows = await supabaseFetch('mt5_accounts', 'GET', {
      select: '*',
      filter: `id=eq.${encodeURIComponent(id)}`,
    });
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return mapAccount(rows[0]);
  } catch (err) {
    console.error('[MT5DB] getAccountById error:', err);
    return null;
  }
}

/** Get account by client_id */
export async function getAccountByClientId(clientId: string): Promise<MT5Account | null> {
  try {
    const rows = await supabaseFetch('mt5_accounts', 'GET', {
      select: '*',
      filter: `client_id=eq.${encodeURIComponent(clientId)}&is_active=eq.true&limit=1`,
    });
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return mapAccount(rows[0]);
  } catch (err) {
    console.error('[MT5DB] getAccountByClientId error:', err);
    return null;
  }
}

/** Create a new account */
export async function createAccount(payload: MT5AccountCreatePayload): Promise<MT5Account | null> {
  try {
    const now = new Date().toISOString();
    const body: Record<string, unknown> = {
      id: generateId(),
      client_id: payload.client_id,
      client_name: payload.client_name,
      broker_login: payload.broker_login,
      broker_password: payload.broker_password,
      broker_server: payload.broker_server,
      account_type: payload.account_type ?? 'demo',
      account_balance: payload.account_balance ?? 0,
      account_equity: payload.account_equity ?? 0,
      account_leverage: payload.account_leverage ?? 100,
      account_currency: payload.account_currency ?? 'USD',
      is_active: payload.is_active ?? true,
      auto_trading_enabled: payload.auto_trading_enabled ?? false,
      profit_target: payload.profit_target ?? 0,
      loss_limit: payload.loss_limit ?? 0,
      lot_type: payload.lot_type ?? 'fixed',
      lot_percentage: payload.lot_percentage ?? 1.0,
      fixed_lot: payload.fixed_lot ?? 0.01,
      max_lot_size: payload.max_lot_size ?? 0.1,
      risk_per_trade_pct: payload.risk_per_trade_pct ?? 1.0,
      max_open_positions: payload.max_open_positions ?? 3,
      min_confidence: payload.min_confidence ?? 60,
      stop_loss_default_pips: payload.stop_loss_default_pips ?? 30,
      take_profit_default_pips: payload.take_profit_default_pips ?? 60,
      daily_pnl: 0,
      daily_pnl_date: null,
      last_connected_at: null,
      created_at: now,
      updated_at: now,
    };

    const result = await supabaseFetch('mt5_accounts', 'POST', {
      body,
      prefer: 'return=representation',
    });

    if (Array.isArray(result) && result.length > 0) {
      return mapAccount(result[0]);
    }

    // Fetch back if no representation returned
    return await getAccountById(body.id as string);
  } catch (err) {
    console.error('[MT5DB] createAccount error:', err);
    return null;
  }
}

/** Update an account */
export async function updateAccount(id: string, payload: MT5AccountUpdatePayload): Promise<MT5Account | null> {
  try {
    const updateBody: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (payload.client_id !== undefined) updateBody.client_id = payload.client_id;
    if (payload.client_name !== undefined) updateBody.client_name = payload.client_name;
    if (payload.broker_login !== undefined) updateBody.broker_login = payload.broker_login;
    if (payload.broker_password !== undefined) updateBody.broker_password = payload.broker_password;
    if (payload.broker_server !== undefined) updateBody.broker_server = payload.broker_server;
    if (payload.account_type !== undefined) updateBody.account_type = payload.account_type;
    if (payload.account_balance !== undefined) updateBody.account_balance = payload.account_balance;
    if (payload.account_equity !== undefined) updateBody.account_equity = payload.account_equity;
    if (payload.account_leverage !== undefined) updateBody.account_leverage = payload.account_leverage;
    if (payload.account_currency !== undefined) updateBody.account_currency = payload.account_currency;
    if (payload.is_active !== undefined) updateBody.is_active = payload.is_active;
    if (payload.auto_trading_enabled !== undefined) updateBody.auto_trading_enabled = payload.auto_trading_enabled;
    if (payload.profit_target !== undefined) updateBody.profit_target = payload.profit_target;
    if (payload.loss_limit !== undefined) updateBody.loss_limit = payload.loss_limit;
    if (payload.lot_type !== undefined) updateBody.lot_type = payload.lot_type;
    if (payload.lot_percentage !== undefined) updateBody.lot_percentage = payload.lot_percentage;
    if (payload.fixed_lot !== undefined) updateBody.fixed_lot = payload.fixed_lot;
    if (payload.max_lot_size !== undefined) updateBody.max_lot_size = payload.max_lot_size;
    if (payload.risk_per_trade_pct !== undefined) updateBody.risk_per_trade_pct = payload.risk_per_trade_pct;
    if (payload.max_open_positions !== undefined) updateBody.max_open_positions = payload.max_open_positions;
    if (payload.min_confidence !== undefined) updateBody.min_confidence = payload.min_confidence;
    if (payload.stop_loss_default_pips !== undefined) updateBody.stop_loss_default_pips = payload.stop_loss_default_pips;
    if (payload.take_profit_default_pips !== undefined) updateBody.take_profit_default_pips = payload.take_profit_default_pips;
    if (payload.daily_pnl !== undefined) updateBody.daily_pnl = payload.daily_pnl;
    if (payload.daily_pnl_date !== undefined) updateBody.daily_pnl_date = payload.daily_pnl_date;
    if (payload.last_connected_at !== undefined) updateBody.last_connected_at = payload.last_connected_at;

    await supabaseFetch('mt5_accounts', 'PATCH', {
      filter: `id=eq.${encodeURIComponent(id)}`,
      body: updateBody,
      prefer: 'return=representation',
    });

    // Fetch back the updated account
    return await getAccountById(id);
  } catch (err) {
    console.error('[MT5DB] updateAccount error:', err);
    return null;
  }
}

/** Delete/deactivate an account (soft delete by setting is_active=false) */
export async function deleteAccount(id: string): Promise<boolean> {
  try {
    await supabaseFetch('mt5_accounts', 'PATCH', {
      filter: `id=eq.${encodeURIComponent(id)}`,
      body: {
        is_active: false,
        updated_at: new Date().toISOString(),
      },
    });
    return true;
  } catch (err) {
    console.error('[MT5DB] deleteAccount error:', err);
    return false;
  }
}

// ======================== DAILY LOGS (NEW) ========================

/** Get daily logs, optionally filtered by account_id */
export async function getDailyLogs(accountId?: string, limit: number = 50): Promise<MT5DailyLog[]> {
  try {
    let filter = 'order=log_date.desc';
    if (accountId) filter = `account_id=eq.${encodeURIComponent(accountId)}&${filter}`;
    if (limit) filter += `&limit=${limit}`;

    const rows = await supabaseFetch('mt5_daily_logs', 'GET', {
      select: '*',
      filter,
    });
    if (!Array.isArray(rows)) return [];
    return rows.map(mapDailyLog);
  } catch (err) {
    console.error('[MT5DB] getDailyLogs error:', err);
    return [];
  }
}

/** Create a daily log entry */
export async function createDailyLog(payload: MT5DailyLogCreatePayload): Promise<MT5DailyLog | null> {
  try {
    const now = new Date().toISOString();
    const body: Record<string, unknown> = {
      id: generateId(),
      account_id: payload.account_id,
      log_date: payload.log_date,
      start_balance: payload.start_balance ?? 0,
      end_balance: payload.end_balance ?? 0,
      start_equity: payload.start_equity ?? 0,
      end_equity: payload.end_equity ?? 0,
      total_pnl: payload.total_pnl ?? 0,
      total_trades: payload.total_trades ?? 0,
      winning_trades: payload.winning_trades ?? 0,
      losing_trades: payload.losing_trades ?? 0,
      total_profit: payload.total_profit ?? 0,
      total_loss: payload.total_loss ?? 0,
      largest_win: payload.largest_win ?? 0,
      largest_loss: payload.largest_loss ?? 0,
      created_at: now,
      updated_at: now,
    };

    const result = await supabaseFetch('mt5_daily_logs', 'POST', {
      body,
      prefer: 'return=representation',
    });

    if (Array.isArray(result) && result.length > 0) {
      return mapDailyLog(result[0]);
    }

    // Fetch back if no representation returned
    const rows = await supabaseFetch('mt5_daily_logs', 'GET', {
      select: '*',
      filter: `id=eq.${encodeURIComponent(body.id)}`,
    });
    if (Array.isArray(rows) && rows.length > 0) {
      return mapDailyLog(rows[0]);
    }
    return null;
  } catch (err) {
    console.error('[MT5DB] createDailyLog error:', err);
    return null;
  }
}

// ======================== TRADE LOG (NEW) ========================

/** Get trade logs, optionally filtered by account_id */
export async function getTradeLog(accountId?: string, limit: number = 50): Promise<MT5TradeLog[]> {
  try {
    let filter = 'order=created_at.desc';
    if (accountId) filter = `account_id=eq.${encodeURIComponent(accountId)}&${filter}`;
    if (limit) filter += `&limit=${limit}`;

    const rows = await supabaseFetch('mt5_trade_log', 'GET', {
      select: '*',
      filter,
    });
    if (!Array.isArray(rows)) return [];
    return rows.map(mapTradeLog);
  } catch (err) {
    console.error('[MT5DB] getTradeLog error:', err);
    return [];
  }
}

/** Create a trade log entry */
export async function createTradeLog(payload: MT5TradeLogCreatePayload): Promise<MT5TradeLog | null> {
  try {
    const now = new Date().toISOString();
    const body: Record<string, unknown> = {
      id: generateId(),
      account_id: payload.account_id,
      signal_id: payload.signal_id ?? null,
      ticket: payload.ticket,
      symbol: payload.symbol,
      direction: payload.direction,
      lot_size: payload.lot_size ?? 0,
      entry_price: payload.entry_price ?? 0,
      exit_price: payload.exit_price ?? null,
      stop_loss: payload.stop_loss ?? 0,
      take_profit: payload.take_profit ?? 0,
      profit: payload.profit ?? 0,
      profit_pips: payload.profit_pips ?? 0,
      commission: payload.commission ?? 0,
      swap: payload.swap ?? 0,
      open_time: payload.open_time ?? now,
      close_time: payload.close_time ?? null,
      duration_minutes: payload.duration_minutes ?? null,
      result: payload.result ?? 'open',
      strategy: payload.strategy ?? '',
      confidence: payload.confidence ?? 0,
      notes: payload.notes ?? null,
      created_at: now,
      updated_at: now,
    };

    const result = await supabaseFetch('mt5_trade_log', 'POST', {
      body,
      prefer: 'return=representation',
    });

    if (Array.isArray(result) && result.length > 0) {
      return mapTradeLog(result[0]);
    }

    // Fetch back if no representation returned
    const rows = await supabaseFetch('mt5_trade_log', 'GET', {
      select: '*',
      filter: `id=eq.${encodeURIComponent(body.id)}`,
    });
    if (Array.isArray(rows) && rows.length > 0) {
      return mapTradeLog(rows[0]);
    }
    return null;
  } catch (err) {
    console.error('[MT5DB] createTradeLog error:', err);
    return null;
  }
}

// ======================== NEW ROW MAPPERS ========================

/** Map a Supabase row to MT5Account */
function mapAccount(row: any): MT5Account {
  return {
    id: row.id,
    client_id: row.client_id ?? '',
    client_name: row.client_name ?? '',
    broker_login: Number(row.broker_login ?? 0),
    broker_password: row.broker_password ?? '',
    broker_server: row.broker_server ?? '',
    account_type: row.account_type ?? 'demo',
    account_balance: Number(row.account_balance ?? 0),
    account_equity: Number(row.account_equity ?? 0),
    account_leverage: Number(row.account_leverage ?? 100),
    account_currency: row.account_currency ?? 'USD',
    is_active: row.is_active ?? true,
    auto_trading_enabled: row.auto_trading_enabled ?? false,
    profit_target: Number(row.profit_target ?? 0),
    loss_limit: Number(row.loss_limit ?? 0),
    lot_type: row.lot_type ?? 'fixed',
    lot_percentage: Number(row.lot_percentage ?? 1.0),
    fixed_lot: Number(row.fixed_lot ?? 0.01),
    max_lot_size: Number(row.max_lot_size ?? 0.1),
    risk_per_trade_pct: Number(row.risk_per_trade_pct ?? 1.0),
    max_open_positions: Number(row.max_open_positions ?? 3),
    min_confidence: Number(row.min_confidence ?? 60),
    stop_loss_default_pips: Number(row.stop_loss_default_pips ?? 30),
    take_profit_default_pips: Number(row.take_profit_default_pips ?? 60),
    daily_pnl: Number(row.daily_pnl ?? 0),
    daily_pnl_date: row.daily_pnl_date ?? null,
    last_connected_at: row.last_connected_at ?? null,
    created_at: row.created_at ?? '',
    updated_at: row.updated_at ?? '',
  };
}

/** Map a Supabase row to MT5DailyLog */
function mapDailyLog(row: any): MT5DailyLog {
  return {
    id: row.id,
    account_id: row.account_id ?? '',
    log_date: row.log_date ?? '',
    start_balance: Number(row.start_balance ?? 0),
    end_balance: Number(row.end_balance ?? 0),
    start_equity: Number(row.start_equity ?? 0),
    end_equity: Number(row.end_equity ?? 0),
    total_pnl: Number(row.total_pnl ?? 0),
    total_trades: Number(row.total_trades ?? 0),
    winning_trades: Number(row.winning_trades ?? 0),
    losing_trades: Number(row.losing_trades ?? 0),
    total_profit: Number(row.total_profit ?? 0),
    total_loss: Number(row.total_loss ?? 0),
    largest_win: Number(row.largest_win ?? 0),
    largest_loss: Number(row.largest_loss ?? 0),
    created_at: row.created_at ?? '',
    updated_at: row.updated_at ?? '',
  };
}

/** Map a Supabase row to MT5TradeLog */
function mapTradeLog(row: any): MT5TradeLog {
  return {
    id: row.id,
    account_id: row.account_id ?? '',
    signal_id: row.signal_id ?? null,
    ticket: Number(row.ticket ?? 0),
    symbol: row.symbol ?? '',
    direction: row.direction ?? 'BUY',
    lot_size: Number(row.lot_size ?? 0),
    entry_price: Number(row.entry_price ?? 0),
    exit_price: row.exit_price ?? null,
    stop_loss: Number(row.stop_loss ?? 0),
    take_profit: Number(row.take_profit ?? 0),
    profit: Number(row.profit ?? 0),
    profit_pips: Number(row.profit_pips ?? 0),
    commission: Number(row.commission ?? 0),
    swap: Number(row.swap ?? 0),
    open_time: row.open_time ?? '',
    close_time: row.close_time ?? null,
    duration_minutes: row.duration_minutes ?? null,
    result: row.result ?? 'open',
    strategy: row.strategy ?? '',
    confidence: Number(row.confidence ?? 0),
    notes: row.notes ?? null,
    created_at: row.created_at ?? '',
    updated_at: row.updated_at ?? '',
  };
}
