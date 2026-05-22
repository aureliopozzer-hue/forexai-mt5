import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';
import { getCryptoMarketData } from '@/lib/coingecko-api';

export async function GET(request: NextRequest) {
  // Rate limit check — 'default' preset (120 req/min)
  const rateLimitResponse = withRateLimit(
    request,
    RATE_LIMIT_PRESETS.default.limit,
    RATE_LIMIT_PRESETS.default.windowMs,
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols');

    if (!symbolsParam) {
      return NextResponse.json(
        { success: false, error: 'Missing "symbols" query parameter. Example: ?symbols=BTC-USD,ETH-USD,SOL-USD' },
        { status: 400 },
      );
    }

    const symbols = symbolsParam
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);

    if (symbols.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid symbols provided.' },
        { status: 400 },
      );
    }

    const data = await getCryptoMarketData(symbols);

    return NextResponse.json(
      { success: true, data },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[API /market/crypto-market] Error:', message);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch crypto market data.' },
      { status: 500 },
    );
  }
}
