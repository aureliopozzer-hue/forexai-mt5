/**
 * Affiliate Database Client — Supabase REST API
 *
 * Existing Supabase tables:
 * - affiliates (id, name, email, cpf_cnpj, phone, pix_key, bank_name, bank_agency, bank_account,
 *               slug, commission_rate, status, total_earnings, total_sales, password_hash, created_at, updated_at)
 * - affiliate_sales (id, affiliate_id, referred_email, plan, amount, commission, status, hold_until, paid_at, created_at, updated_at)
 * - affiliate_links (id, affiliate_id, slug, product_type, clicks, conversions, created_at)
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function generateId(): string {
  return crypto.randomUUID();
}

function generateSlug(name: string): string {
  const base = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${base}-${suffix}`;
}

async function supabaseFetch(table: string, method: string, options: {
  select?: string;
  filter?: string;
  body?: Record<string, unknown>;
  prefer?: string;
} = {}): Promise<any> {
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

  if (res.status === 204) return null;
  if (!res.ok) {
    const text = await res.text();
    console.error(`[AffiliateDB] ${method} ${table} error:`, res.status, text);
    throw new Error(`Supabase ${method} ${table}: ${res.status} - ${text}`);
  }

  const ct = res.headers.get('content-type');
  return ct?.includes('json') ? res.json() : null;
}

// Simple hash for password (matching existing format)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ======================== AFFILIATE ========================

export interface Affiliate {
  id: string;
  email: string;
  name: string;
  cpfCnpj: string;
  phone: string;
  pixKey: string;
  pixType: string;
  slug: string;
  referralCode: string; // alias for slug, used by frontend
  commissionRate: number;
  status: 'active' | 'pending' | 'suspended';
  totalEarnings: number;
  totalEarned: number; // alias for totalEarnings, used by frontend
  totalPaid: number;
  totalSales: number;
  balance: number;
  clicks: number;
  conversions: number;
  createdAt: string;
  updatedAt: string;
}

/** Register a new affiliate */
export async function registerAffiliate(data: {
  email: string;
  name: string;
  pixKey: string;
  pixType: string;
  phone?: string;
  cpfCnpj?: string;
  password?: string;
}): Promise<Affiliate | null> {
  try {
    // Check if email already exists
    const existing = await supabaseFetch('affiliates', 'GET', {
      select: 'id',
      filter: `email=eq.${encodeURIComponent(data.email.toLowerCase().trim())}`,
    });
    if (Array.isArray(existing) && existing.length > 0) {
      throw new Error('EMAIL_EXISTS');
    }

    const now = new Date().toISOString();
    const slug = generateSlug(data.name);
    const passwordHash = data.password ? await hashPassword(data.password) : '';

    await supabaseFetch('affiliates', 'POST', {
      body: {
        email: data.email.toLowerCase().trim(),
        name: data.name,
        cpf_cnpj: data.cpfCnpj || data.pixKey,
        phone: data.phone || '',
        pix_key: data.pixKey,
        slug,
        commission_rate: 20,
        status: 'active', // Auto-approval
        total_earnings: 0,
        total_sales: 0,
        password_hash: passwordHash,
        created_at: now,
        updated_at: now,
      },
      prefer: 'return=representation',
    });

    // Create default affiliate link
    const affiliate = await findAffiliateByEmail(data.email);
    if (affiliate) {
      await supabaseFetch('affiliate_links', 'POST', {
        body: {
          affiliate_id: affiliate.id,
          slug: affiliate.slug,
          product_type: 'monthly',
          clicks: 0,
          conversions: 0,
          created_at: now,
        },
      });
    }

    return affiliate;
  } catch (err: any) {
    if (err.message === 'EMAIL_EXISTS') throw err;
    console.error('[AffiliateDB] registerAffiliate error:', err);
    return null;
  }
}

/** Find affiliate by email with clicks/conversions loaded */
export async function findAffiliateByEmail(email: string): Promise<Affiliate | null> {
  try {
    const rows = await supabaseFetch('affiliates', 'GET', {
      select: '*',
      filter: `email=eq.${encodeURIComponent(email.toLowerCase().trim())}`,
    });
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const affiliate = mapAffiliate(rows[0]);
    // Load clicks and conversions from affiliate_links
    const [clicks, conversions] = await Promise.all([
      getAffiliateClicks(affiliate.id),
      getAffiliateConversions(affiliate.id),
    ]);
    affiliate.clicks = clicks;
    affiliate.conversions = conversions;
    return affiliate;
  } catch (err) {
    console.error('[AffiliateDB] findAffiliateByEmail error:', err);
    return null;
  }
}

/** Find affiliate by slug (referral code) with clicks/conversions loaded */
export async function findAffiliateBySlug(slug: string): Promise<Affiliate | null> {
  try {
    const rows = await supabaseFetch('affiliates', 'GET', {
      select: '*',
      filter: `slug=eq.${encodeURIComponent(slug)}`,
    });
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const affiliate = mapAffiliate(rows[0]);
    // Load clicks and conversions from affiliate_links
    const [clicks, conversions] = await Promise.all([
      getAffiliateClicks(affiliate.id),
      getAffiliateConversions(affiliate.id),
    ]);
    affiliate.clicks = clicks;
    affiliate.conversions = conversions;
    return affiliate;
  } catch (err) {
    console.error('[AffiliateDB] findAffiliateBySlug error:', err);
    return null;
  }
}

/** Find affiliate by ID with clicks/conversions loaded */
export async function findAffiliateById(id: string): Promise<Affiliate | null> {
  try {
    const rows = await supabaseFetch('affiliates', 'GET', {
      select: '*',
      filter: `id=eq.${encodeURIComponent(id)}`,
    });
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const affiliate = mapAffiliate(rows[0]);
    // Load clicks and conversions from affiliate_links
    const [clicks, conversions] = await Promise.all([
      getAffiliateClicks(id),
      getAffiliateConversions(id),
    ]);
    affiliate.clicks = clicks;
    affiliate.conversions = conversions;
    return affiliate;
  } catch (err) {
    console.error('[AffiliateDB] findAffiliateById error:', err);
    return null;
  }
}

/** Get all affiliates (admin) */
export async function getAllAffiliates(): Promise<Affiliate[]> {
  try {
    const rows = await supabaseFetch('affiliates', 'GET', {
      select: '*',
      filter: 'order=created_at.desc',
    });
    if (!Array.isArray(rows)) return [];
    return rows.map(mapAffiliate);
  } catch (err) {
    console.error('[AffiliateDB] getAllAffiliates error:', err);
    return [];
  }
}

/** Update affiliate status (admin) */
export async function updateAffiliateStatus(id: string, status: 'active' | 'pending' | 'suspended'): Promise<boolean> {
  try {
    await supabaseFetch('affiliates', 'PATCH', {
      filter: `id=eq.${encodeURIComponent(id)}`,
      body: { status, updated_at: new Date().toISOString() },
    });
    return true;
  } catch (err) {
    console.error('[AffiliateDB] updateAffiliateStatus error:', err);
    return false;
  }
}

/** Increment affiliate clicks via affiliate_links table (atomic with RPC if available) */
export async function incrementAffiliateClicks(slug: string): Promise<void> {
  try {
    // Use Supabase RPC for atomic increment to avoid race conditions
    const url = `${SUPABASE_URL}/rest/v1/rpc/increment_affiliate_clicks`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ slug_param: slug }),
      cache: 'no-store',
    });
    if (!res.ok) {
      // Fallback: non-atomic read-then-write if RPC not available
      const links = await supabaseFetch('affiliate_links', 'GET', {
        select: 'id,clicks',
        filter: `slug=eq.${encodeURIComponent(slug)}`,
      });
      if (Array.isArray(links) && links.length > 0) {
        const link = links[0];
        await supabaseFetch('affiliate_links', 'PATCH', {
          filter: `id=eq.${encodeURIComponent(link.id)}`,
          body: { clicks: (link.clicks || 0) + 1 },
        });
      }
    }
  } catch (err) {
    console.error('[AffiliateDB] incrementAffiliateClicks error:', err);
  }
}

/** Get total clicks for an affiliate */
async function getAffiliateClicks(affiliateId: string): Promise<number> {
  try {
    const links = await supabaseFetch('affiliate_links', 'GET', {
      select: 'clicks',
      filter: `affiliate_id=eq.${encodeURIComponent(affiliateId)}`,
    });
    if (!Array.isArray(links)) return 0;
    return links.reduce((sum: number, l: any) => sum + (l.clicks || 0), 0);
  } catch {
    return 0;
  }
}

/** Get total conversions for an affiliate */
async function getAffiliateConversions(affiliateId: string): Promise<number> {
  try {
    const links = await supabaseFetch('affiliate_links', 'GET', {
      select: 'conversions',
      filter: `affiliate_id=eq.${encodeURIComponent(affiliateId)}`,
    });
    if (!Array.isArray(links)) return 0;
    return links.reduce((sum: number, l: any) => sum + (l.conversions || 0), 0);
  } catch {
    return 0;
  }
}

// ======================== AFFILIATE SALE ========================

export interface AffiliateSale {
  id: string;
  affiliateId: string;
  referredEmail: string;
  plan: string;
  amount: number;
  commission: number;
  status: 'pending' | 'approved' | 'paid' | 'cancelled';
  holdUntil: string;
  paidAt: string | null;
  createdAt: string;
}

/** Record a sale/commission for an affiliate */
export async function createAffiliateSale(data: {
  affiliateId: string;
  referredEmail: string;
  plan: string;
  amount: number;
  commission: number;
}): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    const holdUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    await supabaseFetch('affiliate_sales', 'POST', {
      body: {
        affiliate_id: data.affiliateId,
        referred_email: data.referredEmail.toLowerCase().trim(),
        plan: data.plan,
        amount: data.amount,
        commission: data.commission,
        status: 'pending',
        hold_until: holdUntil,
        paid_at: null,
        created_at: now,
        updated_at: now,
      },
    });

    // Update affiliate totals and increment conversions
    const affiliate = await findAffiliateById(data.affiliateId);
    if (affiliate) {
      await supabaseFetch('affiliates', 'PATCH', {
        filter: `id=eq.${encodeURIComponent(data.affiliateId)}`,
        body: {
          total_earnings: affiliate.totalEarnings + data.commission,
          total_sales: affiliate.totalSales + 1,
          updated_at: now,
        },
      });
      // Increment conversions count on affiliate_links
      await incrementAffiliateConversions(data.affiliateId);
    }

    return true;
  } catch (err) {
    console.error('[AffiliateDB] createAffiliateSale error:', err);
    return false;
  }
}

/** Get sales for an affiliate */
export async function getAffiliateSales(affiliateId: string): Promise<AffiliateSale[]> {
  try {
    const rows = await supabaseFetch('affiliate_sales', 'GET', {
      select: '*',
      filter: `affiliate_id=eq.${encodeURIComponent(affiliateId)}&order=created_at.desc`,
    });
    if (!Array.isArray(rows)) return [];
    return rows.map(mapSale);
  } catch (err) {
    console.error('[AffiliateDB] getAffiliateSales error:', err);
    return [];
  }
}

/** Get all sales (admin) */
export async function getAllSales(): Promise<AffiliateSale[]> {
  try {
    const rows = await supabaseFetch('affiliate_sales', 'GET', {
      select: '*',
      filter: 'order=created_at.desc',
    });
    if (!Array.isArray(rows)) return [];
    return rows.map(mapSale);
  } catch (err) {
    console.error('[AffiliateDB] getAllSales error:', err);
    return [];
  }
}

/** Mark sale as paid (admin) — also updates affiliate total_paid */
export async function markSalePaid(saleId: string): Promise<boolean> {
  try {
    // First get the sale to know the affiliate and commission
    const sales = await supabaseFetch('affiliate_sales', 'GET', {
      select: '*',
      filter: `id=eq.${encodeURIComponent(saleId)}`,
    });
    if (!Array.isArray(sales) || sales.length === 0) return false;
    const sale = sales[0];
    if (sale.status === 'paid') return true; // já pago

    const now = new Date().toISOString();
    // Mark sale as paid
    await supabaseFetch('affiliate_sales', 'PATCH', {
      filter: `id=eq.${encodeURIComponent(saleId)}`,
      body: { status: 'paid', paid_at: now, updated_at: now },
    });

    // Update affiliate total_paid
    const affiliate = await findAffiliateById(sale.affiliate_id);
    if (affiliate) {
      const newTotalPaid = affiliate.totalPaid + sale.commission;
      await supabaseFetch('affiliates', 'PATCH', {
        filter: `id=eq.${encodeURIComponent(sale.affiliate_id)}`,
        body: { total_paid: newTotalPaid, updated_at: now },
      });
    }
    return true;
  } catch (err) {
    console.error('[AffiliateDB] markSalePaid error:', err);
    return false;
  }
}

// ======================== AFFILIATE CLICK TRACKING ========================

/** Record a conversion (increment affiliate_links conversions) */
export async function incrementAffiliateConversions(affiliateId: string): Promise<void> {
  try {
    const links = await supabaseFetch('affiliate_links', 'GET', {
      select: 'id,conversions',
      filter: `affiliate_id=eq.${encodeURIComponent(affiliateId)}`,
    });
    if (Array.isArray(links) && links.length > 0) {
      const link = links[0];
      await supabaseFetch('affiliate_links', 'PATCH', {
        filter: `id=eq.${encodeURIComponent(link.id)}`,
        body: { conversions: (link.conversions || 0) + 1 },
      });
    }
  } catch (err) {
    console.error('[AffiliateDB] incrementAffiliateConversions error:', err);
  }
}

/** Record a click (increment affiliate_links clicks) */
export async function recordClick(data: {
  slug: string;
  affiliateId: string;
  ipAddress: string;
  userAgent: string;
}): Promise<void> {
  await incrementAffiliateClicks(data.slug);
}

// ======================== HELPERS ========================

function mapAffiliate(row: any): Affiliate {
  const slug = row.slug || '';
  const totalEarnings = row.total_earnings ?? row.totalEarnings ?? 0;
  const totalPaid = row.total_paid ?? 0;
  return {
    id: row.id,
    email: row.email || '',
    name: row.name || '',
    cpfCnpj: row.cpf_cnpj || row.cpfCnpj || '',
    phone: row.phone || '',
    pixKey: row.pix_key || row.pixKey || '',
    pixType: row.pix_type || row.pixType || 'cpf',
    slug,
    referralCode: slug, // alias for slug
    commissionRate: row.commission_rate ?? row.commissionRate ?? 20,
    status: row.status || 'pending',
    totalEarnings,
    totalEarned: totalEarnings, // alias for totalEarnings
    totalPaid,
    totalSales: row.total_sales ?? row.totalSales ?? 0,
    balance: totalEarnings - totalPaid, // ✅ saldo real = ganho - pago
    clicks: row._clicks ?? 0, // populado via getAffiliateClicks
    conversions: row._conversions ?? 0, // populado via getAffiliateConversions
    createdAt: row.created_at ?? row.createdAt ?? '',
    updatedAt: row.updated_at ?? row.updatedAt ?? '',
  };
}

function mapSale(row: any): AffiliateSale {
  return {
    id: row.id,
    affiliateId: row.affiliate_id ?? row.affiliateId ?? '',
    referredEmail: row.referred_email ?? row.referredEmail ?? '',
    plan: row.plan ?? '',
    amount: row.amount ?? 0,
    commission: row.commission ?? 0,
    status: row.status ?? 'pending',
    holdUntil: row.hold_until ?? row.holdUntil ?? '',
    paidAt: row.paid_at ?? row.paidAt ?? null,
    createdAt: row.created_at ?? row.createdAt ?? '',
  };
}
