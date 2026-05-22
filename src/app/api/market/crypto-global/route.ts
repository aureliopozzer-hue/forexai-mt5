import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';
import { getGlobalData } from '@/lib/coingecko-api';

export async function GET(request: NextRequest) {
  // Rate limit check — 'default' preset (120 req/min)
  const rateLimitResponse = withRateLimit(
    request,
    RATE_LIMIT_PRESETS.default.limit,
    RATE_LIMIT_PRESETS.default.windowMs,
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const result = await getGlobalData();

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch global crypto data from CoinGecko.' },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { success: true, data: result.data },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[API /market/crypto-global] Error:', message);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch global crypto market data.' },
      { status: 500 },
    );
  }
}
