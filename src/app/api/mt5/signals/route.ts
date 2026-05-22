import { NextRequest, NextResponse } from 'next/server';
import { getPendingSignals, getSignals, createSignal } from '@/lib/db-mt5';
import type { MT5SignalCreatePayload, MT5SignalStatus } from '@/lib/mt5-types';

// Force dynamic rendering — never cache signal data
export const dynamic = 'force-dynamic';

/**
 * GET /api/mt5/signals — Get signals
 *
 * Query params:
 * - status: filter by status (pending, executed, skipped, expired, failed). Default: pending
 * - limit: max results. Default: 50
 *
 * The Python bot polls this with ?status=pending to find signals to execute.
 * The frontend dashboard can query with other statuses for history display.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = (searchParams.get('status') as MT5SignalStatus) || 'pending';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // If specifically requesting pending signals, use the optimized function
    if (status === 'pending' && limit >= 50) {
      const signals = await getPendingSignals();
      return NextResponse.json({
        success: true,
        data: signals,
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      });
    }

    // Otherwise, use the general getSignals with filters
    const signals = await getSignals(status, limit);
    return NextResponse.json({
      success: true,
      data: signals,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (err) {
    console.error('[MT5 Signals API] GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch signals' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/mt5/signals — Create a new signal
 *
 * Called when AI analysis generates a trade signal with auto-trading enabled.
 * Body: { symbol, direction, entry_price, stop_loss, take_profit, confidence, strategy, lot_size }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, direction, entry_price, stop_loss, take_profit, confidence, strategy, lot_size } = body;

    // Validate required fields
    if (!symbol || !direction || entry_price === undefined || stop_loss === undefined || take_profit === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: symbol, direction, entry_price, stop_loss, take_profit' },
        { status: 400 },
      );
    }

    // Validate direction
    if (direction !== 'BUY' && direction !== 'SELL') {
      return NextResponse.json(
        { success: false, error: 'Invalid direction. Must be BUY or SELL' },
        { status: 400 },
      );
    }

    // Validate numeric fields
    if (entry_price <= 0 || stop_loss <= 0 || take_profit <= 0) {
      return NextResponse.json(
        { success: false, error: 'entry_price, stop_loss, and take_profit must be positive numbers' },
        { status: 400 },
      );
    }

    // Validate confidence range
    const conf = Number(confidence) || 50;
    if (conf < 0 || conf > 100) {
      return NextResponse.json(
        { success: false, error: 'Confidence must be between 0 and 100' },
        { status: 400 },
      );
    }

    // Validate lot size
    const lot = Number(lot_size) || 0.01;
    if (lot <= 0 || lot > 100) {
      return NextResponse.json(
        { success: false, error: 'lot_size must be between 0.01 and 100' },
        { status: 400 },
      );
    }

    const payload: MT5SignalCreatePayload = {
      symbol: symbol.toUpperCase().trim(),
      direction,
      entry_price: Number(entry_price),
      stop_loss: Number(stop_loss),
      take_profit: Number(take_profit),
      confidence: conf,
      strategy: strategy || 'technical',
      lot_size: lot,
    };

    const signal = await createSignal(payload);

    if (!signal) {
      return NextResponse.json(
        { success: false, error: 'Failed to create signal' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: signal,
    }, { status: 201 });
  } catch (err) {
    console.error('[MT5 Signals API] POST error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to create signal' },
      { status: 500 },
    );
  }
}
