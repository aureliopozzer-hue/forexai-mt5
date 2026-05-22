import { NextResponse } from 'next/server';
import { getBotStatus, updateBotStatus } from '@/lib/db-mt5';

// Force dynamic rendering — never cache bot status
export const dynamic = 'force-dynamic';

/**
 * GET /api/mt5/status — Get bot connection status
 *
 * Returns the current bot status including:
 * - Connection state (connected, mt5_connected)
 * - Account info (balance, equity, leverage)
 * - Heartbeat timestamp (for offline detection)
 *
 * The dashboard polls this to show bot status indicator.
 */
export async function GET() {
  try {
    const status = await getBotStatus();

    if (!status) {
      // No bot status row exists — bot has never connected
      return NextResponse.json({
        success: true,
        data: {
          connected: false,
          mt5_connected: false,
          account_balance: 0,
          account_equity: 0,
          account_leverage: 0,
          account_currency: 'USD',
          open_positions_count: 0,
          last_heartbeat: null,
          server_time: null,
          bot_version: null,
          mt5_terminal_path: null,
          isStale: true,
        },
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      });
    }

    // Determine if the bot is stale (no heartbeat for > 60 seconds)
    const lastHeartbeat = new Date(status.last_heartbeat).getTime();
    const now = Date.now();
    const staleThreshold = 60 * 1000; // 60 seconds
    const isStale = now - lastHeartbeat > staleThreshold;

    // If stale, the bot is effectively disconnected
    const effectiveConnected = isStale ? false : status.connected;

    return NextResponse.json({
      success: true,
      data: {
        ...status,
        connected: effectiveConnected,
        isStale,
        lastHeartbeatAge: Math.round((now - lastHeartbeat) / 1000), // seconds
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (err) {
    console.error('[MT5 Status API] GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bot status' },
      { status: 500 },
    );
  }
}
