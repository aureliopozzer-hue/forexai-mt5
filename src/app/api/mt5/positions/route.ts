import { NextRequest, NextResponse } from 'next/server';
import { getPositions, getOpenPositions, closePosition } from '@/lib/db-mt5';
import type { MT5PositionStatus } from '@/lib/mt5-types';

// Force dynamic rendering — never cache position data
export const dynamic = 'force-dynamic';

/**
 * GET /api/mt5/positions — Get positions
 *
 * Query params:
 * - status: filter by status (open, closed, error). Default: open
 * - all: if "true", returns all positions regardless of status
 *
 * The dashboard uses this to display current open positions.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status') as MT5PositionStatus | null;
    const allParam = searchParams.get('all');

    let positions;

    if (allParam === 'true') {
      // Return all positions
      positions = await getPositions();
    } else if (statusParam) {
      // Filter by specific status
      positions = await getPositions(statusParam);
    } else {
      // Default: open positions only
      positions = await getOpenPositions();
    }

    // Calculate total P&L from open positions
    const totalPnL = positions
      .filter(p => p.status === 'open')
      .reduce((sum, p) => sum + p.profit, 0);

    const totalPnLPips = positions
      .filter(p => p.status === 'open')
      .reduce((sum, p) => sum + p.profit_pips, 0);

    return NextResponse.json({
      success: true,
      data: positions,
      summary: {
        totalPositions: positions.length,
        openPositions: positions.filter(p => p.status === 'open').length,
        totalPnL: Math.round(totalPnL * 100) / 100,
        totalPnLPips: Math.round(totalPnLPips * 10) / 10,
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (err) {
    console.error('[MT5 Positions API] GET error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch positions' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/mt5/positions — Close a position by ticket
 *
 * Body: { ticket: number }
 *
 * Marks the position as 'closed' in the database.
 * Note: This updates the Supabase state; the Python bot on VPS
 * handles the actual MT5 order closure and then syncs the state back.
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { ticket } = body;

    if (!ticket || typeof ticket !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid ticket number' },
        { status: 400 },
      );
    }

    const success = await closePosition(ticket);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to close position' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { ticket, status: 'closed' },
    });
  } catch (err) {
    console.error('[MT5 Positions API] DELETE error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to close position' },
      { status: 500 },
    );
  }
}
