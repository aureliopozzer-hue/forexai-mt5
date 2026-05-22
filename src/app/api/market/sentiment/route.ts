import { NextRequest, NextResponse } from 'next/server';


// ======================== IN-MEMORY SENTIMENT CACHE ========================

interface SentimentCacheEntry {
  data: SentimentResult;
  timestamp: number;
}

interface SentimentResult {
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  summary: string;
  keyFactors: string[];
  source: 'llm' | 'keyword';
}

const sentimentCache = new Map<string, SentimentCacheEntry>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function getCachedSentiment(key: string): SentimentResult | null {
  const entry = sentimentCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  if (entry) sentimentCache.delete(key); // expired
  return null;
}

function setCachedSentiment(key: string, data: SentimentResult): void {
  // Evict old entries if cache is too large
  if (sentimentCache.size > 200) {
    const oldest = [...sentimentCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < 30; i++) sentimentCache.delete(oldest[i][0]);
  }
  sentimentCache.set(key, { data, timestamp: Date.now() });
}

// ======================== KEYWORD-BASED FALLBACK ========================

const BULLISH_KEYWORDS_PT = [
  'alta', 'valorização', 'crescimento', 'subida', 'ganho', 'positivo', 'rally',
  'recuperação', 'otimismo', 'superou', 'rompeu', 'favorável', 'impulso', 'fortaleceu',
  'salto', 'expansão', 'lucro', 'rentável', 'dividendo', 'upgrade', 'compra',
  'bullish', 'surpresa', 'acima', 'recorde', 'histórico', 'demanda', 'aquecimento',
];

const BEARISH_KEYWORDS_PT = [
  'queda', 'perda', 'negativo', 'baixa', 'desvalorização', 'risco', 'receio',
  'preocupação', 'instabilidade', 'volatilidade', 'crise', 'recessão', 'inflação',
  'juros', 'pessimismo', 'venda', 'bearish', 'fraqueza', 'pressão', '退缩',
  'desaquecimento', 'deflação', 'default', 'downgrade', 'abaixo', 'rompimento',
  'liquidação', 'correção', 'estagnação',
];

function keywordBasedSentiment(headlines: string[]): SentimentResult {
  let bullishScore = 0;
  let bearishScore = 0;
  const matchedFactors: string[] = [];

  for (const headline of headlines) {
    const lower = headline.toLowerCase();

    for (const keyword of BULLISH_KEYWORDS_PT) {
      if (lower.includes(keyword)) {
        bullishScore++;
        if (matchedFactors.length < 4) {
          matchedFactors.push(keyword.charAt(0).toUpperCase() + keyword.slice(1));
        }
        break; // one match per headline per category
      }
    }

    for (const keyword of BEARISH_KEYWORDS_PT) {
      if (lower.includes(keyword)) {
        bearishScore++;
        if (matchedFactors.length < 4) {
          matchedFactors.push(keyword.charAt(0).toUpperCase() + keyword.slice(1));
        }
        break;
      }
    }
  }

  const total = bullishScore + bearishScore;
  let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  let confidence = 30;

  if (total > 0) {
    const ratio = bullishScore / total;
    if (ratio > 0.6) {
      sentiment = 'bullish';
      confidence = Math.min(75, 40 + Math.round((ratio - 0.5) * 200));
    } else if (ratio < 0.4) {
      sentiment = 'bearish';
      confidence = Math.min(75, 40 + Math.round((0.5 - ratio) * 200));
    } else {
      sentiment = 'neutral';
      confidence = 35;
    }
  }

  const summaryMap = {
    bullish: `Notícias majoritariamente positivas (${bullishScore} sinais de alta vs ${bearishScore} de baixa).`,
    bearish: `Notícias majoritariamente negativas (${bearishScore} sinais de baixa vs ${bullishScore} de alta).`,
    neutral: `Notícias mistas sem direção clara (${bullishScore} alta, ${bearishScore} baixa).`,
  };

  return {
    sentiment,
    confidence,
    summary: summaryMap[sentiment],
    keyFactors: matchedFactors.length > 0 ? matchedFactors : ['Análise baseada em palavras-chave'],
    source: 'keyword',
  };
}

// ======================== LLM SENTIMENT ANALYSIS ========================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let zaiInstance: any = null;

async function getZAI() {
  if (!zaiInstance) {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

async function llmSentimentAnalysis(instrument: string, headlines: string[]): Promise<SentimentResult> {
  const zai = await getZAI();

  const headlinesText = headlines
    .slice(0, 15) // Limit to 15 headlines for token efficiency
    .map((h, i) => `${i + 1}. ${h}`)
    .join('\n');

  const systemPrompt = `Você é um analista de mercado financeiro. Analise as seguintes manchetes de notícias sobre ${instrument} e determine o sentimento de mercado. Responda em JSON com: { sentiment: 'bullish'|'bearish'|'neutral', confidence: 0-100, summary: 'resumo em 1 frase', keyFactors: ['fator1', 'fator2'] }`;

  const userMessage = `Manchetes sobre ${instrument}:\n\n${headlinesText}\n\nAnalise o sentimento dessas notícias e responda APENAS com o JSON solicitado, sem texto adicional.`;

  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    thinking: { type: 'disabled' },
  });

  const response = completion.choices[0]?.message?.content;

  if (!response) {
    throw new Error('Resposta vazia da IA');
  }

  // Parse JSON from response — handle potential markdown wrapping
  let jsonStr = response.trim();
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }

  const parsed = JSON.parse(jsonStr);

  // Validate and normalize
  const validSentiments = ['bullish', 'bearish', 'neutral'];
  const sentiment = validSentiments.includes(parsed.sentiment) ? parsed.sentiment : 'neutral';
  const confidence = typeof parsed.confidence === 'number'
    ? Math.min(100, Math.max(0, Math.round(parsed.confidence)))
    : 50;
  const summary = typeof parsed.summary === 'string' ? parsed.summary : 'Sentimento analisado pela IA';
  const keyFactors = Array.isArray(parsed.keyFactors)
    ? parsed.keyFactors.slice(0, 5).map(String)
    : ['Análise por IA'];

  return {
    sentiment,
    confidence,
    summary,
    keyFactors,
    source: 'llm',
  };
}

// ======================== API ROUTE HANDLER ========================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { instrument, headlines } = body;

    if (!instrument || typeof instrument !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Instrumento não informado' },
        { status: 400 }
      );
    }

    if (!headlines || !Array.isArray(headlines) || headlines.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Manchetes não informadas' },
        { status: 400 }
      );
    }

    // Check cache first
    const cacheKey = `${instrument}:${headlines.slice(0, 5).join('|')}`;
    const cached = getCachedSentiment(cacheKey);
    if (cached) {
      return NextResponse.json({
        success: true,
        sentiment: cached,
        cached: true,
      });
    }

    // Try LLM analysis first, fallback to keyword-based
    let result: SentimentResult;
    try {
      result = await llmSentimentAnalysis(instrument, headlines);
    } catch (llmError: any) {
      console.warn('[Sentiment] LLM falhou, usando fallback por palavras-chave:', llmError?.message || llmError);
      result = keywordBasedSentiment(headlines);
    }

    // Cache the result
    setCachedSentiment(cacheKey, result);

    return NextResponse.json({
      success: true,
      sentiment: result,
      cached: false,
    });
  } catch (error: any) {
    console.error('[Sentiment] Error:', error?.message || error);
    return NextResponse.json(
      { success: false, error: 'Erro ao analisar sentimento' },
      { status: 500 }
    );
  }
}
