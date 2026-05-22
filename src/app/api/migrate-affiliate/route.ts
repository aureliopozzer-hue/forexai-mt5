import { NextResponse } from 'next/server';

/**
 * POST /api/migrate-affiliate
 *
 * One-time migration endpoint to create affiliate tables in Supabase.
 * Uses the direct PostgreSQL connection (pg module) since the REST API
 * cannot execute DDL statements.
 *
 * SECURITY: This endpoint should be removed or disabled after migration.
 * It requires the DATABASE_URL environment variable.
 */

const MIGRATION_SQL = `
-- Table 1: affiliates
CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  cpf_cnpj TEXT,
  phone TEXT,
  pix_key TEXT,
  bank_name TEXT,
  bank_agency TEXT,
  bank_account TEXT,
  slug TEXT UNIQUE NOT NULL,
  commission_rate DECIMAL DEFAULT 20,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'blocked')),
  total_earnings DECIMAL DEFAULT 0,
  total_sales INT DEFAULT 0,
  password_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'affiliates' AND policyname = 'Service role can do everything'
  ) THEN
    CREATE POLICY "Service role can do everything" ON affiliates
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_affiliates_email ON affiliates(email);
CREATE INDEX IF NOT EXISTS idx_affiliates_slug ON affiliates(slug);
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON affiliates(status);

-- Table 2: affiliate_links
CREATE TABLE IF NOT EXISTS affiliate_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  product_type TEXT DEFAULT 'monthly',
  clicks INT DEFAULT 0,
  conversions INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE affiliate_links ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'affiliate_links' AND policyname = 'Service role can do everything'
  ) THEN
    CREATE POLICY "Service role can do everything" ON affiliate_links
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_affiliate_links_affiliate_id ON affiliate_links(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_slug ON affiliate_links(slug);

-- Table 3: affiliate_sales
CREATE TABLE IF NOT EXISTS affiliate_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE CASCADE,
  customer_email TEXT,
  product_type TEXT,
  sale_amount DECIMAL,
  commission_rate DECIMAL,
  commission_amount DECIMAL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  stripe_session_id TEXT,
  affiliate_ref TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE affiliate_sales ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'affiliate_sales' AND policyname = 'Service role can do everything'
  ) THEN
    CREATE POLICY "Service role can do everything" ON affiliate_sales
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_affiliate_sales_affiliate_id ON affiliate_sales(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_sales_status ON affiliate_sales(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_sales_stripe_session ON affiliate_sales(stripe_session_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_affiliates_updated_at ON affiliates;
CREATE TRIGGER update_affiliates_updated_at
  BEFORE UPDATE ON affiliates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
`;

export async function POST() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return NextResponse.json(
      { error: 'DATABASE_URL not configured. Cannot execute DDL migration.' },
      { status: 500 }
    );
  }

  // Only allow postgres/supabase URLs
  if (!databaseUrl.includes('supabase.co') && !databaseUrl.includes('postgresql')) {
    return NextResponse.json(
      { error: 'DATABASE_URL must be a PostgreSQL/Supabase connection string.' },
      { status: 400 }
    );
  }

  try {
    // Dynamic import of pg since it may not be available in all environments
    const { Client } = await import('pg');

    const client = new Client({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
    });

    await client.connect();

    const results: { statement: string; success: boolean; error?: string }[] = [];

    // Split and execute statements
    const statements = MIGRATION_SQL
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        await client.query(stmt);
        results.push({ statement: stmt.substring(0, 80).replace(/\n/g, ' '), success: true });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        results.push({
          statement: stmt.substring(0, 80).replace(/\n/g, ' '),
          success: false,
          error: errorMsg,
        });
      }
    }

    // Verify tables
    const verification: Record<string, { exists: boolean; columns?: string[]; error?: string }> = {};
    const tables = ['affiliates', 'affiliate_links', 'affiliate_sales'];

    for (const table of tables) {
      try {
        const res = await client.query(
          `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
          [table]
        );
        verification[table] = {
          exists: res.rows.length > 0,
          columns: res.rows.map(r => `${r.column_name}(${r.data_type})`),
        };
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        verification[table] = { exists: false, error: errorMsg };
      }
    }

    await client.end();

    const allTablesExist = tables.every(t => verification[t]?.exists);

    return NextResponse.json({
      success: allTablesExist,
      message: allTablesExist
        ? 'All 3 affiliate tables created successfully!'
        : 'Some tables may not have been created. Check verification results.',
      results,
      verification,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Migration failed', details: errorMsg },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Check if tables exist via REST API (no DDL needed)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
  };

  const results: Record<string, { exists: boolean; error?: string }> = {};
  const tables = ['affiliates', 'affiliate_links', 'affiliate_sales'];

  for (const table of tables) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=id&limit=1`, {
        headers,
        cache: 'no-store',
      });
      results[table] = { exists: res.ok };
      if (!res.ok) {
        const text = await res.text();
        results[table].error = `${res.status}: ${text}`;
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      results[table] = { exists: false, error: errorMsg };
    }
  }

  const allExist = Object.values(results).every(r => r.exists);

  return NextResponse.json({
    all_tables_exist: allExist,
    tables: results,
    message: allExist
      ? 'All affiliate tables are ready!'
      : 'Some tables are missing. Run POST /api/migrate-affiliate to create them.',
  });
}
