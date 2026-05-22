/**
 * Supabase REST API Database Client
 *
 * Primary database access method on Vercel (serverless),
 * where Prisma can't reach the PostgreSQL server directly (P1001 error).
 * Falls back gracefully if Supabase is not configured.
 *
 * Handles both camelCase and snake_case column names transparently:
 * - Prisma creates camelCase columns (isPro, stripeCustomerId)
 * - Manual PostgreSQL tables often use snake_case (is_pro, stripe_customer_id)
 * - We send camelCase in PATCH/POST and fall back to snake_case if that fails
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/** Check if Supabase REST API is configured */
export function isSupabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

/** Generate a CUID-like ID (compatible with Prisma's @default(cuid())) */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  const random2 = Math.random().toString(36).substring(2, 10);
  return `cl${timestamp}${random}${random2}`.substring(0, 25);
}

/**
 * Convert camelCase to snake_case for PostgreSQL column compatibility.
 * If the Prisma-created table has camelCase columns, these won't match,
 * but that's handled by the fallback mechanism in PATCH operations.
 */
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/** Convert an object's keys from camelCase to snake_case */
function toSnakeCaseKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[toSnakeCase(key)] = value;
  }
  return result;
}

/** Internal fetch wrapper for Supabase REST API */
async function supabaseFetch(table: string, method: string, options: {
  select?: string;
  filter?: string;
  body?: Record<string, unknown>;
  prefer?: string;
} = {}): Promise<any> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
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

  // 204 No Content means success but no body (common for PATCH without return=representation)
  if (res.status === 204) return null;

  if (!res.ok) {
    const text = await res.text();
    console.error(`[Supabase] ${method} ${table} error:`, res.status, text);
    throw new Error(`Supabase ${method} ${table}: ${res.status}`);
  }

  const ct = res.headers.get('content-type');
  return ct?.includes('json') ? res.json() : null;
}

/**
 * PATCH with automatic camelCase → snake_case fallback.
 * Uses Prefer: return=representation to verify the update actually modified a row.
 * If no rows were updated, tries snake_case keys.
 */
async function supabasePatchWithFallback(
  table: string,
  filter: string,
  body: Record<string, unknown>,
): Promise<boolean> {
  // First attempt: camelCase keys + return representation to verify
  try {
    const result = await supabaseFetch(table, 'PATCH', {
      filter,
      body,
      prefer: 'return=representation',
    });
    // If representation returned, the PATCH matched at least one row
    if (Array.isArray(result) && result.length > 0) {
      return true;
    }
    // PATCH returned no rows — might be a column name mismatch
    // or the filter matched nothing. Try snake_case.
    console.warn('[Supabase] camelCase PATCH matched 0 rows, trying snake_case');
  } catch (err: any) {
    const errMsg = err?.message || '';
    if (errMsg.includes('404') || errMsg.includes('400') || errMsg.includes('415') || errMsg.includes('PGRST204')) {
      console.warn('[Supabase] camelCase PATCH failed, trying snake_case:', errMsg);
    } else {
      throw err;
    }
  }

  // Second attempt: snake_case keys (works if table was created manually in PostgreSQL)
  try {
    const snakeBody = toSnakeCaseKeys(body);
    const result = await supabaseFetch(table, 'PATCH', {
      filter,
      body: snakeBody,
      prefer: 'return=representation',
    });
    if (Array.isArray(result) && result.length > 0) {
      return true;
    }
    // Neither camelCase nor snake_case matched any rows
    console.error('[Supabase] PATCH matched 0 rows for both camelCase and snake_case');
    return false;
  } catch (err: any) {
    console.error('[Supabase] snake_case PATCH also failed:', err?.message);
    throw err;
  }
}

export interface SupabaseUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  isPro: boolean;
  credits: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
}

function mapRow(row: any): SupabaseUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? null,
    avatarUrl: row.avatarUrl ?? row.avatarurl ?? row.avatar_url ?? null,
    isPro: row.isPro ?? row.ispro ?? row.is_pro ?? false,
    credits: row.credits ?? 100,
    stripeCustomerId: row.stripeCustomerId ?? row.stripecustomerid ?? row.stripe_customer_id ?? null,
    stripeSubscriptionId: row.stripeSubscriptionId ?? row.stripesubscriptionid ?? row.stripe_subscription_id ?? null,
    stripePriceId: row.stripePriceId ?? row.stripepriceid ?? row.stripe_price_id ?? null,
  };
}

/** Find user by email */
export async function findUserByEmail(email: string): Promise<SupabaseUser | null> {
  try {
    const rows = await supabaseFetch('User', 'GET', {
      select: '*',
      filter: `email=eq.${encodeURIComponent(email)}`,
    });
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return mapRow(rows[0]);
  } catch (err) {
    console.error('[Supabase] findUserByEmail error:', err);
    return null;
  }
}

/** Find user by ID */
export async function findUserById(id: string): Promise<SupabaseUser | null> {
  try {
    const rows = await supabaseFetch('User', 'GET', {
      select: '*',
      filter: `id=eq.${encodeURIComponent(id)}`,
    });
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return mapRow(rows[0]);
  } catch (err) {
    console.error('[Supabase] findUserById error:', err);
    return null;
  }
}

/** Find user by Stripe customer ID */
export async function findUserByStripeCustomerId(customerId: string): Promise<SupabaseUser | null> {
  try {
    // Try camelCase first
    let rows = await supabaseFetch('User', 'GET', {
      select: '*',
      filter: `stripeCustomerId=eq.${encodeURIComponent(customerId)}`,
    });
    // If no results, try snake_case column name
    if (!Array.isArray(rows) || rows.length === 0) {
      rows = await supabaseFetch('User', 'GET', {
        select: '*',
        filter: `stripe_customer_id=eq.${encodeURIComponent(customerId)}`,
      });
    }
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return mapRow(rows[0]);
  } catch (err) {
    console.error('[Supabase] findUserByStripeCustomerId error:', err);
    return null;
  }
}

/** Create or update user (upsert). Returns user with 100 credits for new users. */
export async function upsertUser(email: string, name?: string | null, image?: string | null): Promise<SupabaseUser | null> {
  try {
    const existing = await findUserByEmail(email);

    if (existing) {
      // Update name/image if provided
      const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (name != null) updateData.name = name;
      if (image != null) updateData.avatarUrl = image;

      await supabasePatchWithFallback(
        'User',
        `email=eq.${encodeURIComponent(email)}`,
        updateData,
      );
      return { ...existing, name: name ?? existing.name, avatarUrl: image ?? existing.avatarUrl };
    }

    // Create new user with 100 free credits
    const now = new Date().toISOString();
    await supabaseFetch('User', 'POST', {
      body: {
        id: generateId(),
        email,
        name: name || null,
        avatarUrl: image || null,
        isPro: false,
        credits: 100,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        stripePriceId: null,
        createdAt: now,
        updatedAt: now,
      },
      prefer: 'return=representation',
    });

    return await findUserByEmail(email);
  } catch (err) {
    console.error('[Supabase] upsertUser error:', err);
    return null;
  }
}

/** Consume credits. Returns new balance, or -1 if insufficient, or 999 for Pro. */
export async function consumeCredits(userId: string, amount: number): Promise<number> {
  try {
    const user = await findUserById(userId);
    if (!user) return -1;
    if (user.isPro) return 999;
    if (user.credits < amount) return -1;

    const newCredits = user.credits - amount;
    await supabasePatchWithFallback(
      'User',
      `id=eq.${encodeURIComponent(userId)}`,
      { credits: newCredits, updatedAt: new Date().toISOString() },
    );
    return newCredits;
  } catch (err) {
    console.error('[Supabase] consumeCredits error:', err);
    return -1;
  }
}

/** Set user as Pro with Stripe data. Verifies persistence after update. */
export async function setUserPro(email: string, data: {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
}): Promise<boolean> {
  try {
    const lowerEmail = email.toLowerCase().trim();
    const patchOk = await supabasePatchWithFallback(
      'User',
      `email=eq.${encodeURIComponent(lowerEmail)}`,
      { isPro: true, ...data, updatedAt: new Date().toISOString() },
    );

    if (!patchOk) {
      // PATCH matched 0 rows — user might not exist yet. Try creating them first.
      console.warn('[Supabase] setUserPro: PATCH matched 0 rows, creating user first:', lowerEmail);
      try {
        await supabaseFetch('User', 'POST', {
          body: {
            id: generateId(),
            email: lowerEmail,
            name: null,
            avatarUrl: null,
            isPro: true,
            credits: 100,
            ...data,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          prefer: 'return=representation',
        });
        console.log('[Supabase] setUserPro: created new Pro user:', lowerEmail);
        return true;
      } catch (createErr: any) {
        // If create fails (e.g., duplicate email), the user might exist with different case
        // Try a case-insensitive lookup
        console.warn('[Supabase] setUserPro: create failed, trying ilike filter:', createErr?.message);
        try {
          await supabaseFetch('User', 'PATCH', {
            filter: `email=ilike.${encodeURIComponent(lowerEmail)}`,
            body: { isPro: true, ...data, updatedAt: new Date().toISOString() },
            prefer: 'return=representation',
          });
        } catch {}
      }
    }

    // Verify the update actually persisted by reading back
    const user = await findUserByEmail(lowerEmail);
    if (!user?.isPro) {
      console.error('[Supabase] setUserPro: PATCH completed but isPro still false for:', lowerEmail);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Supabase] setUserPro error:', err);
    return false;
  }
}

/** Remove Pro status from user */
export async function removeUserPro(filterBy: 'email' | 'stripeCustomerId', value: string): Promise<boolean> {
  try {
    const filterKey = filterBy === 'email' ? 'email' : 'stripeCustomerId';
    await supabasePatchWithFallback(
      'User',
      `${filterKey}=eq.${encodeURIComponent(value)}`,
      { isPro: false, stripeSubscriptionId: null, stripePriceId: null, updatedAt: new Date().toISOString() },
    );
    return true;
  } catch (err) {
    console.error('[Supabase] removeUserPro error:', err);
    return false;
  }
}

/** Update subscription status by Stripe customer ID */
export async function updateSubscription(customerId: string, isActive: boolean, priceId?: string): Promise<boolean> {
  try {
    // Try camelCase filter first
    let filter = `stripeCustomerId=eq.${encodeURIComponent(customerId)}`;
    try {
      await supabasePatchWithFallback('User', filter, {
        isPro: isActive,
        stripePriceId: priceId || null,
        updatedAt: new Date().toISOString(),
      });
      return true;
    } catch {
      // Try snake_case filter
      filter = `stripe_customer_id=eq.${encodeURIComponent(customerId)}`;
      await supabasePatchWithFallback('User', filter, {
        isPro: isActive,
        stripePriceId: priceId || null,
        updatedAt: new Date().toISOString(),
      });
      return true;
    }
  } catch (err) {
    console.error('[Supabase] updateSubscription error:', err);
    return false;
  }
}
