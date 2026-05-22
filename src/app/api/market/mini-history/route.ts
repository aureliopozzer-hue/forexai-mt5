import { NextRequest, NextResponse } from 'next/server';
import { getHistory } from '@/lib/finance-api';

// Delay helper to avoid rate limiting
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols');

    if (!symbolsParam) {
      return NextResponse.json(
        { success: false, error: 'Symbols parameter is required' },
        { status: 400 }
      );
    }

    const symbols = symbolsParam.split(',').map(s => s.trim()).filter(Boolean);

    if (symbols.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid symbols provided' },
        { status: 400 }
      );
    }

    // Process symbols in smaller batches with delays to avoid rate limiting
    // Batch size of 5 with 500ms delay between batches
    const BATCH_SIZE = 5;
    const BATCH_DELAY = 500;
    const allResults: { symbol: string; points: any[] }[] = [];

    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = symbols.slice(i, i + BATCH_SIZE);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (symbol) => {
          try {
            const data = await getHistory(symbol, '1d');
            if (!data?.body) return { symbol, points: [] };

            const body = data.body;
            let items: any[];

            if (Array.isArray(body)) {
              items = body;
            } else if (typeof body === 'object') {
              items = Object.values(body);
            } else {
              items = [];
            }

            // Take last 30 data points for sparkline
            const validItems = items
              .filter((item: any) => (item.close || 0) > 0)
              .slice(-30);

            const points = validItems.map((item: any) => ({
              date: item.date || '',
              close: item.close || 0,
            }));

            return { symbol, points };
          } catch (err) {
            console.error(`Mini-history error for ${symbol}:`, err);
            return { symbol, points: [] };
          }
        })
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          allResults.push(result.value);
        }
      }

      // Add delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < symbols.length) {
        await delay(BATCH_DELAY);
      }
    }

    // Build the response map
    const sparklineData: Record<string, Array<{ date: string; close: number }>> = {};
    for (const { symbol, points } of allResults) {
      if (points.length > 0) {
        sparklineData[symbol] = points;
      }
    }

    return NextResponse.json({
      success: true,
      data: sparklineData,
    });
  } catch (error: any) {
    console.error('Mini-history API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
