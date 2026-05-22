import { NextRequest, NextResponse } from 'next/server';
import { getSnapshotQuotes } from '@/lib/finance-api';
import { FOREX_PAIRS, INDICES, METALS, CRYPTO, STOCKS, ETFS, BRAZIL, getInstruments } from '@/components/dashboard/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'forex';

    let instruments;
    switch (category) {
      case 'forex': instruments = FOREX_PAIRS; break;
      case 'indices': instruments = INDICES; break;
      case 'metals': instruments = METALS; break;
      case 'crypto': instruments = CRYPTO; break;
      case 'stocks': instruments = STOCKS; break;
      case 'etfs': instruments = ETFS; break;
      case 'brazil': instruments = BRAZIL; break;
      case 'favorites': instruments = getInstruments(category); break;
      default: instruments = FOREX_PAIRS;
    }

    // Yahoo Finance API has a limit on how many tickers we can request at once
    // Split into batches of 50 if needed
    const symbols = instruments.map(i => i.symbol);
    const BATCH_SIZE = 50;

    let data;
    if (symbols.length <= BATCH_SIZE) {
      data = await getSnapshotQuotes(symbols);
    } else {
      // Fetch in batches and merge
      let mergedBody: any[] = [];
      let meta: any = null;
      for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
        const batch = symbols.slice(i, i + BATCH_SIZE);
        const batchData = await getSnapshotQuotes(batch);
        if (batchData?.body) {
          if (Array.isArray(batchData.body)) {
            mergedBody = [...mergedBody, ...batchData.body];
          } else if (typeof batchData.body === 'object') {
            mergedBody = [...mergedBody, ...Object.values(batchData.body)];
          }
        }
        if (!meta && batchData?.meta) meta = batchData.meta;
      }
      data = { meta, body: mergedBody };
    }

    return NextResponse.json({
      success: true,
      category,
      instruments,
      data,
    });
  } catch (error: any) {
    console.error('Quotes API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
