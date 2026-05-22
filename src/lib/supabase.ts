import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// ======================== CLIENT-SAFE INSTANCE ========================
// Uses the publishable/anon key — safe for browser, respects RLS policies
let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;
  browserClient = createClient(supabaseUrl, supabaseAnonKey);
  return browserClient;
}

// ======================== SERVER-ONLY INSTANCE ========================
// Uses the service_role key — bypasses RLS, ONLY for server-side API routes
let serverClient: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient {
  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Required for server-side database operations.');
  }
  if (serverClient) return serverClient;
  serverClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return serverClient;
}

// ======================== SAFE SERVER CLIENT ========================
// Returns null instead of throwing when service key is missing
export function getSupabaseServerClientSafe(): SupabaseClient | null {
  if (!supabaseServiceKey) return null;
  return getSupabaseServerClient();
}

// ======================== DATABASE TYPES ========================
export interface UserRow {
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

// Helper to convert DB row to our app's interface
export function userRowToApp(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    image: row.avatar_url,
    credits: row.credits,
    isPro: row.is_pro,
  };
}
// env fix trigger 1779436138
