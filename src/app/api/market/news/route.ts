import { NextRequest, NextResponse } from 'next/server';
import { getMarketNews } from '@/lib/finance-api';

const MOCK_NEWS = [
  { title: 'Fed signals potential rate pause amid cooling inflation', link: '#', publisher: 'Reuters', publishTime: new Date().toISOString(), source: 'Reuters', description: 'Federal Reserve officials suggest a more cautious approach to monetary policy as inflation shows signs of moderating.', guid: '1', sentiment: 'positivo' },
  { title: 'European stocks rally on strong earnings reports', link: '#', publisher: 'Bloomberg', publishTime: new Date(Date.now() - 3600000).toISOString(), source: 'Bloomberg', description: 'Major European indices surged as key companies reported better-than-expected quarterly results.', guid: '2', sentiment: 'positivo' },
  { title: 'Oil prices drop as OPEC+ considers increasing production', link: '#', publisher: 'CNBC', publishTime: new Date(Date.now() - 7200000).toISOString(), source: 'CNBC', description: 'Crude oil futures fell sharply after reports that OPEC+ may unwind production cuts earlier than expected.', guid: '3', sentiment: 'negativo' },
  { title: 'Bitcoin reaches new monthly high above $67,000', link: '#', publisher: 'CoinDesk', publishTime: new Date(Date.now() - 10800000).toISOString(), source: 'CoinDesk', description: 'Bitcoin continues its recovery rally, driven by institutional inflows and growing ETF adoption.', guid: '4', sentiment: 'positivo' },
  { title: 'USD/BRL weakens as Brazilian central bank holds rates steady', link: '#', publisher: 'Valor', publishTime: new Date(Date.now() - 14400000).toISOString(), source: 'Valor', description: 'The Brazilian real strengthened against the dollar after the Copom decided to maintain the Selic rate.', guid: '5', sentiment: 'neutro' },
  { title: 'Gold prices surge on geopolitical tensions', link: '#', publisher: 'MarketWatch', publishTime: new Date(Date.now() - 18000000).toISOString(), source: 'MarketWatch', description: 'Safe-haven demand pushed gold to new highs as investors seek protection from global uncertainty.', guid: '6', sentiment: 'positivo' },
  { title: 'Asian markets mixed ahead of key economic data releases', link: '#', publisher: 'Nikkei', publishTime: new Date(Date.now() - 21600000).toISOString(), source: 'Nikkei', description: 'Markets in Asia traded in narrow ranges as traders await manufacturing data from China and Japan.', guid: '7', sentiment: 'neutro' },
  { title: 'Tech sector leads Wall Street gains in early trading', link: '#', publisher: 'WSJ', publishTime: new Date(Date.now() - 25200000).toISOString(), source: 'WSJ', description: 'Nasdaq composite jumped over 1% as semiconductor and AI-related stocks continued their upward momentum.', guid: '8', sentiment: 'positivo' },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker') || undefined;

    let data;
    try {
      data = await getMarketNews(ticker);
    } catch {
      data = null;
    }

    const newsBody = data?.body?.length ? data.body : MOCK_NEWS;

    return NextResponse.json({
      success: true,
      data: { body: newsBody },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: true, data: { body: MOCK_NEWS } },
      { status: 200 }
    );
  }
}
