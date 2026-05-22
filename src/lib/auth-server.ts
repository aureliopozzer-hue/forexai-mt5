import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { randomUUID } from 'crypto';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  credits: number;
  isPro: boolean;
  createdAt: string | null; // from Supabase created_at, used for trial calculation
}

// ======================== SUPABASE REST API ========================
// Uses Supabase PostgreSQL via REST API for Vercel serverless compatibility.
// Falls back to session-based user when Supabase is unreachable.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface SupabaseUser {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  is_pro: boolean;
  credits: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Supabase REST API headers */
const supabaseHeaders = () => ({
  'apikey': SUPABASE_SECRET_KEY,
  'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`,
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
});

/** Check if Supabase is configured */
function isSupabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_SECRET_KEY);
}

/** Fetch user from Supabase by email — exported for verify-subscription */
export async function fetchUserByEmail(email: string): Promise<SupabaseUser | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=*&order=created_at.desc&limit=1`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: supabaseHeaders(),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const users: SupabaseUser[] = await res.json();
    return users.length > 0 ? users[0] : null;
  } catch {
    return null;
  }
}

/** Fetch user from Supabase by ID */
async function fetchUserById(id: string): Promise<SupabaseUser | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(id)}&select=*&limit=1`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: supabaseHeaders(),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const users: SupabaseUser[] = await res.json();
    return users.length > 0 ? users[0] : null;
  } catch {
    return null;
  }
}

/** Create user in Supabase with UUID */
async function createUser(email: string, name: string | null, image: string | null): Promise<SupabaseUser | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const userId = randomUUID();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        ...supabaseHeaders(),
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        id: userId,
        email,
        name: name || null,
        avatar_url: image || null,
        is_pro: false,
        credits: 100,
      }),
    });
    if (!res.ok) {
      const errorText = await res.text();
      // If duplicate email, try fetching the existing user
      if (errorText.includes('23505') || res.status === 409) {
        return fetchUserByEmail(email);
      }
      return null;
    }
    const users: SupabaseUser[] = await res.json();
    return users.length > 0 ? users[0] : null;
  } catch {
    return null;
  }
}

/** Convert Supabase user to AuthenticatedUser */
function toAuthUser(su: SupabaseUser): AuthenticatedUser {
  return {
    id: su.id,
    email: su.email,
    name: su.name,
    image: su.avatar_url,
    credits: su.credits,
    isPro: su.is_pro,
    createdAt: su.created_at || null,
  };
}

/**
 * Create a session-based fallback user when Supabase is unreachable.
 * This prevents the auth redirect loop — if the user has a valid NextAuth
 * session, they ARE authenticated, even if Supabase is temporarily down.
 */
function createSessionFallbackUser(
  email: string,
  name: string | null,
  image: string | null,
): AuthenticatedUser {
  return {
    id: email, // Use email as ID for fallback
    email,
    name,
    image,
    credits: 100, // Optimistic default (backward compat)
    isPro: false,
    createdAt: null, // No created_at available in fallback — server will determine trial
  };
}

// ======================== MAIN AUTH FUNCTIONS ========================

/**
 * Get authenticated user — ALWAYS returns a user if the NextAuth session is valid.
 *
 * Priority:
 * 1. Check NextAuth session → if no session, return null (truly unauthenticated)
 * 2. Try Supabase lookup → if found, return actual user with real credits
 * 3. Try Supabase create → if user doesn't exist, create them
 * 4. FALLBACK: Return session-based user with optimistic defaults
 *    (This prevents the Google redirect loop when Supabase is down)
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return null; // Truly unauthenticated

    const email = session.user.email;
    const name = session.user.name ?? null;
    const image = session.user.image ?? null;

    // Try Supabase
    if (isSupabaseConfigured()) {
      // Step 1: Try to find existing user
      const existingUser = await fetchUserByEmail(email);
      if (existingUser) {
        return toAuthUser(existingUser);
      }

      // Step 2: Try to create user
      const newUser = await createUser(email, name, image);
      if (newUser) {
        return toAuthUser(newUser);
      }
    }

    // Step 3: Supabase failed or not configured — use session fallback
    // CRITICAL: We MUST return a user here because the session IS valid.
    // Returning null would cause the client to redirect to Google login
    // in an infinite loop.
    console.warn(`[getAuthenticatedUser] Using session fallback for: ${email}`);
    return createSessionFallbackUser(email, name, image);
  } catch (err) {
    console.error('[getAuthenticatedUser] Error:', err);
    return null;
  }
}

/**
 * Create or get user — used by POST /api/credits after login.
 */
export async function getOrCreateUser(
  email: string,
  name?: string | null,
  image?: string | null,
): Promise<AuthenticatedUser> {
  // Try Supabase
  if (isSupabaseConfigured()) {
    const existing = await fetchUserByEmail(email);
    if (existing) return toAuthUser(existing);

    const created = await createUser(email, name ?? null, image ?? null);
    if (created) return toAuthUser(created);
  }

  // Fallback — always return a user
  return createSessionFallbackUser(email, name ?? null, image ?? null);
}

/**
 * Consume credits — uses Supabase REST API with retry.
 *
 * Returns:
 *   >= 0 → new credit balance
 *   -1   → insufficient credits
 *   -2   → database error / user not found
 *   999  → Pro user (unlimited)
 */
export async function consumeCredits(userId: string, amount: number): Promise<number> {
  if (!isSupabaseConfigured()) {
    // Supabase not configured — can't deduct credits
    // Return 100 - amount as optimistic result (will be wrong but lets the app function)
    console.warn('[consumeCredits] Supabase not configured — optimistic deduction');
    return Math.max(0, 100 - amount);
  }

  const MAX_RETRIES = 3;

  // Read current credits from Supabase
  const user = await fetchUserById(userId);
  if (!user) {
    // Might be a session-based fallback user — try by email
    // But we only have the ID... if ID looks like an email, try that
    if (userId.includes('@')) {
      const byEmail = await fetchUserByEmail(userId);
      if (byEmail) {
        return deductCreditsFromUser(byEmail, amount);
      }
    }
    console.error(`[consumeCredits] User NOT FOUND: ${userId}`);
    return -2;
  }

  return deductCreditsFromUser(user, amount);

  async function deductCreditsFromUser(su: SupabaseUser, amt: number): Promise<number> {
    // Pro users have unlimited credits
    if (su.is_pro) return 999;

    // Check sufficient credits
    if (su.credits < amt) return -1;

    const newCredits = su.credits - amt;

    // Try CAS update with retries
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const currentUser = attempt === 1 ? su : await fetchUserById(su.id);
      if (!currentUser) return -2;
      if (currentUser.is_pro) return 999;
      if (currentUser.credits < amt) return -1;

      const target = currentUser.credits - amt;

      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(currentUser.id)}&credits=eq.${currentUser.credits}`,
          {
            method: 'PATCH',
            cache: 'no-store',
            headers: {
              ...supabaseHeaders(),
              'Prefer': 'return=representation',
            },
            body: JSON.stringify({
              credits: target,
              updated_at: new Date().toISOString(),
            }),
          },
        );
        if (!res.ok) continue;
        const users: SupabaseUser[] = await res.json();
        if (users.length > 0) {
          return users[0].credits;
        }
        // CAS miss — retry
      } catch {
        // Network error — retry
      }
    }

    // All CAS retries failed — do a direct write as last resort
    try {
      const finalUser = await fetchUserById(su.id);
      if (!finalUser) return -2;
      if (finalUser.is_pro) return 999;
      if (finalUser.credits < amt) return -1;

      const finalCredits = finalUser.credits - amt;
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(su.id)}`,
        {
          method: 'PATCH',
          cache: 'no-store',
          headers: {
            ...supabaseHeaders(),
            'Prefer': 'return=representation',
          },
          body: JSON.stringify({
            credits: finalCredits,
            updated_at: new Date().toISOString(),
          }),
        },
      );
      if (!res.ok) return -2;
      const users: SupabaseUser[] = await res.json();
      return users.length > 0 ? users[0].credits : finalCredits;
    } catch {
      return -2;
    }
  }
}

/**
 * Set user Pro status in Supabase — used after Stripe payment verification.
 * Also updates Stripe customer/subscription/price info.
 */
export async function setUserProStatus(
  email: string,
  data: {
    isPro: boolean;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
  },
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    console.error('[setUserProStatus] Supabase not configured');
    return false;
  }

  try {
    // First, ensure the user exists in Supabase
    let user = await fetchUserByEmail(email);

    if (!user) {
      // User doesn't exist yet — create them as Pro
      const newUserId = randomUUID();
      const createRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          ...supabaseHeaders(),
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          id: newUserId,
          email,
          is_pro: data.isPro,
          credits: 100,
          stripe_customer_id: data.stripeCustomerId || null,
          stripe_subscription_id: data.stripeSubscriptionId || null,
          stripe_price_id: data.stripePriceId || null,
        }),
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        // If duplicate email, update instead
        if (errText.includes('23505') || createRes.status === 409) {
          // Fall through to the update path below
          user = await fetchUserByEmail(email);
        } else {
          console.error('[setUserProStatus] Failed to create user:', errText);
          return false;
        }
      } else {
        const users: SupabaseUser[] = await createRes.json();
        if (users.length > 0) {
          console.log('[setUserProStatus] Created new Pro user:', email);
          return true;
        }
      }
    }

    if (!user) {
      console.error('[setUserProStatus] User not found and could not be created:', email);
      return false;
    }

    // Update the user — try with ALL columns first, then fallback to just is_pro
    // (the table might not have stripe_customer_id, stripe_subscription_id, stripe_price_id columns)
    const updateDataFull: Record<string, any> = {
      is_pro: data.isPro,
      updated_at: new Date().toISOString(),
    };

    if (data.stripeCustomerId !== undefined) {
      updateDataFull.stripe_customer_id = data.stripeCustomerId;
    }
    if (data.stripeSubscriptionId !== undefined) {
      updateDataFull.stripe_subscription_id = data.stripeSubscriptionId;
    }
    if (data.stripePriceId !== undefined) {
      updateDataFull.stripe_price_id = data.stripePriceId;
    }

    // Attempt 1: Full update with all columns
    let updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(user.id)}`,
      {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          ...supabaseHeaders(),
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(updateDataFull),
      },
    );

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      console.warn('[setUserProStatus] Full update failed, trying minimal update:', errText);

      // Attempt 2: Minimal update with just is_pro (stripe columns might not exist)
      const updateDataMinimal: Record<string, any> = {
        is_pro: data.isPro,
        updated_at: new Date().toISOString(),
      };

      updateRes = await fetch(
        `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(user.id)}`,
        {
          method: 'PATCH',
          cache: 'no-store',
          headers: {
            ...supabaseHeaders(),
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(updateDataMinimal),
        },
      );

      if (!updateRes.ok) {
        const errText2 = await updateRes.text();
        console.error('[setUserProStatus] Minimal update ALSO failed:', errText2);
        return false;
      }
    }

    const updatedUsers: SupabaseUser[] = await updateRes.json();
    if (updatedUsers.length > 0) {
      console.log('[setUserProStatus] User updated:', email, 'isPro:', data.isPro);
      return true;
    }

    // Even if no rows returned, check if the update actually worked
    const verifyUser = await fetchUserById(user.id);
    if (verifyUser && verifyUser.is_pro === data.isPro) {
      console.log('[setUserProStatus] Update verified (return=representation empty but DB updated):', email);
      return true;
    }

    console.error('[setUserProStatus] No rows updated for:', email);
    return false;
  } catch (err) {
    console.error('[setUserProStatus] Error:', err);
    return false;
  }
}

/**
 * Find user by Stripe Customer ID in Supabase — used by webhook.
 */
export async function fetchUserByStripeCustomerId(stripeCustomerId: string): Promise<AuthenticatedUser | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/users?stripe_customer_id=eq.${encodeURIComponent(stripeCustomerId)}&select=*&limit=1`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: supabaseHeaders(),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const users: SupabaseUser[] = await res.json();
    return users.length > 0 ? toAuthUser(users[0]) : null;
  } catch {
    return null;
  }
}

/**
 * Fetch user from Supabase by ID — public export for debug endpoints.
 */
export { fetchUserById };
