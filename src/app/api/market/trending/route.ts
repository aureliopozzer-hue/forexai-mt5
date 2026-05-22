import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';
import { getTrendingCoins } from '@/lib/coingecko-api';

export async function GET(request: NextRequest) {
  // Rate limit check — 'default' preset (120 req/min)
  const rateLimitResponse = withRateLimit(
    request,
    RATE_LIMIT_PRESETS.default.limit,
    RATE_LIMIT_PRESETS.default.windowMs,
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const coins = await getTrendingCoins();

    // Transform TrendingCoin[] into the simplified response format
    const data = coins.map(coin => ({
      id: coin.item.id,
      name: coin.item.name,
      symbol: coin.item.symbol,
      marketCapRank: coin.item.market_cap_rank,
      priceBtc: coin.item.price_btc,
      score: coin.item.score,
    }));

    return NextResponse.json(
      { success: true, data },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
        },
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[API /market/trending] Error:', message);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch trending coins.' },
      { status: 500 },
    );
  }
}
