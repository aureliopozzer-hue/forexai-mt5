import { NextRequest, NextResponse } from 'next/server';
import { getConfig, updateConfig, getSignalStats } from '@/lib/db-mt5';
import type { MT5ConfigUpdatePayload } from '@/lib/mt5-types';

// Force dynamic rendering — never cache config data
export const dynamic = 'force-dynamic';

/**
 * GET /api/mt5/config — Get auto-trading configuration
 *
 * Returns the current MT5 auto-trading configuration.
 * Also includes signal statistics for the dashboard.
 * Password is masked for security.
 */
export async function GET() {
  try {
    const [config, stats] = await Promise.all([
      getConfig(),
      getSignalStats(),
    ]);

    if (!config) {
      // No config row exists yet — return defaults
      return NextResponse.json({
        success: true,
        data: {
          auto_trading_enabled: false,
          max_lot_size: 0.01,
          risk_per_trade_pct: 1.0,
          allowed_symbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD'],
          max_open_positions: 3,
          min_confidence: 60,
          strategy_filter: ['technical', 'smc', 'hybrid'],
          stop_loss_default_pips: 30,
          take_profit_default_pips: 60,
          trading_hours_start: '09:00',
          trading_hours_end: '17:00',
          updated_at: null,
          // Broker connection
          mt5_login: 0,
          mt5_password: '',
          mt5_server: '',
          mt5_account_type: 'demo',
          mt5_connected: false,
          // Risk management
          profit_target: 0,
          loss_limit: 0,
          lot_type: 'fixed',
          lot_percentage: 1.0,
          fixed_lot: 0.01,
          daily_pnl: 0,
          daily_pnl_date: null,
        },
        stats,
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      });
    }

    // Mask the password before sending to frontend
    const safeConfig = {
      ...config,
      mt5_password: config.mt5_password ? '••••••••' : '',
      mt5_connected: false, // Will be determined by bot status
    };

    return NextResponse.json({
      success: true,
      data: safeConfig,
      stats,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (err) {
    console.error('[MT5 Config API] GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch config' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/mt5/config — Update auto-trading configuration
 *
 * Body: Partial MT5Config fields (any subset of the config can be updated)
 *
 * Example: { auto_trading_enabled: true, max_lot_size: 0.05, profit_target: 500, lot_type: 'percentage' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate numeric fields if provided
    if (body.max_lot_size !== undefined) {
      const val = Number(body.max_lot_size);
      if (isNaN(val) || val <= 0 || val > 100) {
        return NextResponse.json(
          { success: false, error: 'max_lot_size must be between 0.01 and 100' },
          { status: 400 },
        );
      }
      body.max_lot_size = val;
    }

    if (body.risk_per_trade_pct !== undefined) {
      const val = Number(body.risk_per_trade_pct);
      if (isNaN(val) || val <= 0 || val > 100) {
        return NextResponse.json(
          { success: false, error: 'risk_per_trade_pct must be between 0.1 and 100' },
          { status: 400 },
        );
      }
      body.risk_per_trade_pct = val;
    }

    if (body.max_open_positions !== undefined) {
      const val = Number(body.max_open_positions);
      if (isNaN(val) || val < 1 || val > 50) {
        return NextResponse.json(
          { success: false, error: 'max_open_positions must be between 1 and 50' },
          { status: 400 },
        );
      }
      body.max_open_positions = val;
    }

    if (body.min_confidence !== undefined) {
      const val = Number(body.min_confidence);
      if (isNaN(val) || val < 0 || val > 100) {
        return NextResponse.json(
          { success: false, error: 'min_confidence must be between 0 and 100' },
          { status: 400 },
        );
      }
      body.min_confidence = val;
    }

    if (body.stop_loss_default_pips !== undefined) {
      const val = Number(body.stop_loss_default_pips);
      if (isNaN(val) || val < 1 || val > 5000) {
        return NextResponse.json(
          { success: false, error: 'stop_loss_default_pips must be between 1 and 5000' },
          { status: 400 },
        );
      }
      body.stop_loss_default_pips = val;
    }

    if (body.take_profit_default_pips !== undefined) {
      const val = Number(body.take_profit_default_pips);
      if (isNaN(val) || val < 1 || val > 5000) {
        return NextResponse.json(
          { success: false, error: 'take_profit_default_pips must be between 1 and 5000' },
          { status: 400 },
        );
      }
      body.take_profit_default_pips = val;
    }

    // Validate time format if provided
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (body.trading_hours_start !== undefined && !timeRegex.test(body.trading_hours_start)) {
      return NextResponse.json(
        { success: false, error: 'trading_hours_start must be in HH:MM format (e.g., "09:00")' },
        { status: 400 },
      );
    }
    if (body.trading_hours_end !== undefined && !timeRegex.test(body.trading_hours_end)) {
      return NextResponse.json(
        { success: false, error: 'trading_hours_end must be in HH:MM format (e.g., "17:00")' },
        { status: 400 },
      );
    }

    // Validate arrays if provided
    if (body.allowed_symbols !== undefined) {
      if (!Array.isArray(body.allowed_symbols) || body.allowed_symbols.length === 0) {
        return NextResponse.json(
          { success: false, error: 'allowed_symbols must be a non-empty array of strings' },
          { status: 400 },
        );
      }
      // Normalize symbols to uppercase
      body.allowed_symbols = body.allowed_symbols.map((s: string) => String(s).toUpperCase().trim());
    }

    if (body.strategy_filter !== undefined) {
      if (!Array.isArray(body.strategy_filter)) {
        return NextResponse.json(
          { success: false, error: 'strategy_filter must be an array of strings' },
          { status: 400 },
        );
      }
    }

    // ===== Broker connection validation =====
    if (body.mt5_login !== undefined) {
      const val = Number(body.mt5_login);
      if (isNaN(val) || val < 0) {
        return NextResponse.json(
          { success: false, error: 'mt5_login must be a positive number' },
          { status: 400 },
        );
      }
      body.mt5_login = val;
    }

    if (body.mt5_password !== undefined) {
      // Don't save the masked password "••••••••"
      if (body.mt5_password === '••••••••' || body.mt5_password === '') {
        delete body.mt5_password; // Skip updating password if masked/empty
      }
    }

    if (body.mt5_account_type !== undefined) {
      if (!['demo', 'live'].includes(body.mt5_account_type)) {
        return NextResponse.json(
          { success: false, error: 'mt5_account_type must be "demo" or "live"' },
          { status: 400 },
        );
      }
    }

    // ===== Risk management validation =====
    if (body.profit_target !== undefined) {
      const val = Number(body.profit_target);
      if (isNaN(val) || val < 0) {
        return NextResponse.json(
          { success: false, error: 'profit_target must be >= 0 (0 = disabled)' },
          { status: 400 },
        );
      }
      body.profit_target = val;
    }

    if (body.loss_limit !== undefined) {
      const val = Number(body.loss_limit);
      if (isNaN(val) || val < 0) {
        return NextResponse.json(
          { success: false, error: 'loss_limit must be >= 0 (0 = disabled)' },
          { status: 400 },
        );
      }
      body.loss_limit = val;
    }

    if (body.lot_type !== undefined) {
      if (!['fixed', 'percentage'].includes(body.lot_type)) {
        return NextResponse.json(
          { success: false, error: 'lot_type must be "fixed" or "percentage"' },
          { status: 400 },
        );
      }
    }

    if (body.lot_percentage !== undefined) {
      const val = Number(body.lot_percentage);
      if (isNaN(val) || val <= 0 || val > 10) {
        return NextResponse.json(
          { success: false, error: 'lot_percentage must be between 0.1 and 10' },
          { status: 400 },
        );
      }
      body.lot_percentage = val;
    }

    if (body.fixed_lot !== undefined) {
      const val = Number(body.fixed_lot);
      if (isNaN(val) || val <= 0 || val > 100) {
        return NextResponse.json(
          { success: false, error: 'fixed_lot must be between 0.01 and 100' },
          { status: 400 },
        );
      }
      body.fixed_lot = val;
    }

    // Special warning when enabling auto-trading
    if (body.auto_trading_enabled === true) {
      const currentConfig = await getConfig();
      if (currentConfig && !currentConfig.auto_trading_enabled) {
        console.log('[MT5 Config API] Auto-trading ENABLED — signals will be executed automatically');
      }
    }

    const payload: MT5ConfigUpdatePayload = body;
    const config = await updateConfig(payload);

    if (!config) {
      return NextResponse.json(
        { success: false, error: 'Failed to update config' },
        { status: 500 },
      );
    }

    // Mask password in response
    const safeConfig = {
      ...config,
      mt5_password: config.mt5_password ? '••••••••' : '',
    };

    return NextResponse.json({
      success: true,
      data: safeConfig,
    });
  } catch (err) {
    console.error('[MT5 Config API] POST error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to update config' },
      { status: 500 },
    );
  }
}
