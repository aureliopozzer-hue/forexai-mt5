import { NextRequest, NextResponse } from 'next/server';
import { updateConfig } from '@/lib/db-mt5';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/mt5/broker-connect — Save broker credentials and trigger MT5 login
 *
 * Body: {
 *   mt5_login: number;       // MT5 account number
 *   mt5_password: string;    // MT5 password
 *   mt5_server: string;      // Broker server name
 *   mt5_account_type: 'demo' | 'live';
 * }
 *
 * This endpoint:
 * 1. Validates the broker credentials
 * 2. Saves them to Supabase (mt5_config table)
 * 3. The Bridge/Bot picks them up on the next polling cycle
 * 4. Returns success/failure
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const login = Number(body.mt5_login);
    const password = String(body.mt5_password || '');
    const server = String(body.mt5_server || '');
    const accountType = String(body.mt5_account_type || 'demo');

    if (!login || login <= 0) {
      return NextResponse.json(
        { success: false, error: 'MT5 Login (account number) is required' },
        { status: 400 },
      );
    }

    if (!password || password === '••••••••') {
      return NextResponse.json(
        { success: false, error: 'MT5 Password is required' },
        { status: 400 },
      );
    }

    if (!server) {
      return NextResponse.json(
        { success: false, error: 'MT5 Server name is required' },
        { status: 400 },
      );
    }

    if (!['demo', 'live'].includes(accountType)) {
      return NextResponse.json(
        { success: false, error: 'Account type must be "demo" or "live"' },
        { status: 400 },
      );
    }

    // Save credentials to Supabase
    const config = await updateConfig({
      mt5_login: login,
      mt5_password: password,
      mt5_server: server,
      mt5_account_type: accountType as 'demo' | 'live',
    });

    if (!config) {
      return NextResponse.json(
        { success: false, error: 'Failed to save broker credentials' },
        { status: 500 },
      );
    }

    // Mask password in response
    const safeConfig = {
      ...config,
      mt5_password: '••••••••',
    };

    return NextResponse.json({
      success: true,
      message: 'Broker credentials saved successfully. The bot will connect to your MT5 account on the next polling cycle.',
      data: safeConfig,
    });
  } catch (err) {
    console.error('[MT5 Broker Connect API] POST error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to save broker credentials' },
      { status: 500 },
    );
  }
}
