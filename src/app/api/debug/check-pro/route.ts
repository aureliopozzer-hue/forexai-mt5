import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const dynamic = 'force-dynamic';

/**
 * GET /api/debug/check-pro — Debug Pro status and optionally force-set it.
 * ?setPro=true — Force set current user as Pro
 */
export async function GET(request: Request) {
  const logs: string[] = [];

  try {
    logs.push(`SUPABASE_URL: ${SUPABASE_URL || 'NOT SET'}`);
    logs.push(`SUPABASE_KEY: ${SUPABASE_SECRET_KEY ? 'SET (' + SUPABASE_SECRET_KEY.substring(0, 8) + '...)' : 'NOT SET'}`);

    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    logs.push(`Session email: ${email || 'NOT LOGGED IN'}`);

    if (!email) {
      return NextResponse.json({ logs, error: 'Not authenticated' });
    }

    // Fetch raw user data from Supabase
    const headers = {
      'apikey': SUPABASE_SECRET_KEY,
      'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`,
      'Content-Type': 'application/json',
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=*&limit=1`, {
      cache: 'no-store',
      headers,
    });

    logs.push(`Supabase fetch status: ${res.status}`);

    if (!res.ok) {
      const errText = await res.text();
      logs.push(`Supabase error: ${errText}`);
      return NextResponse.json({ logs, error: 'Supabase fetch failed' });
    }

    const users = await res.json();
    if (users.length === 0) {
      logs.push('User NOT FOUND in Supabase');
    } else {
      const user = users[0];
      logs.push(`User found: ${JSON.stringify(user)}`);
      logs.push(`Columns: ${Object.keys(user).join(', ')}`);
    }

    // If setPro=true, force update is_pro
    const url = new URL(request.url);
    if (url.searchParams.get('setPro') === 'true' && users.length > 0) {
      const userId = users[0].id;
      logs.push(`\n--- Setting is_pro=true for user ${userId} ---`);

      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          ...headers,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          is_pro: true,
          stripe_customer_id: 'manual-activation',
          stripe_subscription_id: 'manual-activation',
          stripe_price_id: 'manual',
          updated_at: new Date().toISOString(),
        }),
      });

      logs.push(`Update status: ${updateRes.status}`);
      const updateText = await updateRes.text();
      logs.push(`Update response: ${updateText}`);

      if (updateRes.ok) {
        // Verify
        const verifyRes = await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=*&limit=1`, {
          cache: 'no-store',
          headers,
        });
        if (verifyRes.ok) {
          const verifyUsers = await verifyRes.json();
          if (verifyUsers.length > 0) {
            logs.push(`After update: is_pro=${verifyUsers[0].is_pro}`);
          }
        }
      }
    }

    return NextResponse.json({ logs });
  } catch (err: any) {
    logs.push(`ERROR: ${err.message}`);
    return NextResponse.json({ logs, error: err.message }, { status: 500 });
  }
}
