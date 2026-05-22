import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/mt5/migrate — Add new columns for broker connection & risk management
 *
 * This endpoint runs ALTER TABLE statements to add the new columns
 * needed for the broker connection and risk management features.
 * Safe to run multiple times (uses IF NOT EXISTS).
 */
export async function POST() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json(
      { success: false, error: 'Supabase not configured' },
      { status: 500 },
    );
  }

  // We'll use the Supabase REST API to check if columns exist
  // and the pg connection for ALTER TABLE if available
  try {
    // Try using the Supabase SQL execution via the management API
    // Since we can't run ALTER TABLE via REST API, we'll try a different approach:
    // Use the pg library to connect directly
    const { Client } = await import('pg');

    // Try different connection strings
    const connStrs = [
      // Direct connection (works if network allows)
      `postgresql://postgres:${encodeURIComponent(getDbPassword())}@db.${getProjectRef()}.supabase.co:5432/postgres`,
      // Session mode pooler
      `postgresql://postgres.${getProjectRef()}:${encodeURIComponent(getDbPassword())}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
      // Transaction mode pooler
      `postgresql://postgres.${getProjectRef()}:${encodeURIComponent(getDbPassword())}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
    ];

    let client: InstanceType<typeof Client> | null = null;

    for (const connStr of connStrs) {
      try {
        const c = new Client({
          connectionString: connStr,
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 10000,
        });
        await c.connect();
        client = c;
        break;
      } catch {
        continue;
      }
    }

    if (!client) {
      return NextResponse.json({
        success: false,
        error: 'Could not connect to database. Please run the migration SQL manually in the Supabase Dashboard SQL Editor.',
        migrationSQL: getMigrationSQL(),
      }, { status: 500 });
    }

    // Run migration
    await client.query(getMigrationSQL());

    // Verify
    const result = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'mt5_config' ORDER BY column_name",
    );

    await client.end();

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      columns: result.rows.map((r: { column_name: string }) => r.column_name),
    });
  } catch (err) {
    console.error('[MT5 Migrate] Error:', err);
    return NextResponse.json({
      success: false,
      error: 'Migration failed',
      details: err instanceof Error ? err.message : String(err),
      migrationSQL: getMigrationSQL(),
    }, { status: 500 });
  }
}

/**
 * GET /api/mt5/migrate — Get the migration SQL to run manually
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    migrationSQL: getMigrationSQL(),
    instructions: 'Run this SQL in the Supabase Dashboard SQL Editor (https://supabase.com/dashboard → SQL Editor)',
  });
}

function getProjectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return url.replace('https://', '').replace('.supabase.co', '');
}

function getDbPassword(): string {
  // Try to get from env or use the known password
  return process.env.SUPABASE_DB_PASSWORD || '';
}

function getMigrationSQL(): string {
  return `
-- Migration: Add broker connection & risk management columns
-- Safe to run multiple times (IF NOT EXISTS)

-- Broker connection fields in mt5_config
ALTER TABLE mt5_config ADD COLUMN IF NOT EXISTS mt5_login BIGINT DEFAULT 0;
ALTER TABLE mt5_config ADD COLUMN IF NOT EXISTS mt5_password TEXT DEFAULT '';
ALTER TABLE mt5_config ADD COLUMN IF NOT EXISTS mt5_server TEXT DEFAULT '';
ALTER TABLE mt5_config ADD COLUMN IF NOT EXISTS mt5_account_type TEXT DEFAULT 'demo';

-- Risk management fields in mt5_config
ALTER TABLE mt5_config ADD COLUMN IF NOT EXISTS profit_target FLOAT DEFAULT 0;
ALTER TABLE mt5_config ADD COLUMN IF NOT EXISTS loss_limit FLOAT DEFAULT 0;
ALTER TABLE mt5_config ADD COLUMN IF NOT EXISTS lot_type TEXT DEFAULT 'fixed';
ALTER TABLE mt5_config ADD COLUMN IF NOT EXISTS lot_percentage FLOAT DEFAULT 1.0;
ALTER TABLE mt5_config ADD COLUMN IF NOT EXISTS fixed_lot FLOAT DEFAULT 0.01;

-- Daily P&L tracking for risk management
ALTER TABLE mt5_config ADD COLUMN IF NOT EXISTS daily_pnl FLOAT DEFAULT 0;
ALTER TABLE mt5_config ADD COLUMN IF NOT EXISTS daily_pnl_date DATE;

-- Broker info in bot status (for display)
ALTER TABLE mt5_bot_status ADD COLUMN IF NOT EXISTS mt5_login BIGINT DEFAULT 0;
ALTER TABLE mt5_bot_status ADD COLUMN IF NOT EXISTS mt5_server TEXT DEFAULT '';
ALTER TABLE mt5_bot_status ADD COLUMN IF NOT EXISTS mt5_account_type TEXT DEFAULT 'demo';
`.trim();
}
