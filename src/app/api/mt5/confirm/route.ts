import { NextRequest, NextResponse } from 'next/server';
import { updateSignalStatus, getSignalById } from '@/lib/db-mt5';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/mt5/confirm — Confirm or skip a signal
 *
 * Body: { signalId: string, action: 'execute' | 'skip' }
 *
 * - action: 'execute' → marks signal as 'executed' (the bot will proceed to trade)
 * - action: 'skip'    → marks signal as 'skipped' (the bot will ignore it)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { signalId, action } = body;

    if (!signalId || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: signalId, action' },
        { status: 400 },
      );
    }

    if (action !== 'execute' && action !== 'skip') {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Must be "execute" or "skip"' },
        { status: 400 },
      );
    }

    // Verify the signal exists and is in pending status
    const signal = await getSignalById(signalId);
    if (!signal) {
      return NextResponse.json(
        { success: false, error: 'Signal not found' },
        { status: 404 },
      );
    }

    if (signal.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Signal is already ${signal.status}, cannot ${action}` },
        { status: 409 },
      );
    }

    // Update signal status
    const newStatus = action === 'execute' ? 'executed' : 'skipped';
    const success = await updateSignalStatus(signalId, newStatus);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to update signal status' },
        { status: 500 },
      );
    }

    // Fetch the updated signal
    const updatedSignal = await getSignalById(signalId);

    return NextResponse.json({
      success: true,
      data: updatedSignal,
    });
  } catch (err) {
    console.error('[MT5 Confirm API] POST error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to confirm signal' },
      { status: 500 },
    );
  }
}
