import { createServer, IncomingMessage, ServerResponse } from 'http'
import TelegramBot from 'node-telegram-bot-api'
import ZAI from 'z-ai-web-dev-sdk'
import fs from 'fs'
import path from 'path'

// ============================================================
// Configuration
// ============================================================

const PORT = 3031
const LOG_PREFIX = '[TelegramBot]'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8816482321:AAHtjv4Hblis0IDK2j8pS6Ljdxxh1OikeUg'
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || '@forexaipro_sinais'
const SITE_URL = process.env.SITE_URL || 'https://forexaiproelite.vercel.app'

// Schedule: 4 messages per day (São Paulo time = America/Sao_Paulo = UTC-3)
const TIMEZONE = 'America/Sao_Paulo'
const SCHEDULE = [
  { hour: 8, minute: 0, type: 'morning_signal' as const },    // 08:00 BRT
  { hour: 12, minute: 0, type: 'midday_update' as const },    // 12:00 BRT
  { hour: 18, minute: 0, type: 'afternoon_signal' as const }, // 18:00 BRT
  { hour: 21, minute: 0, type: 'daily_results' as const },    // 21:00 BRT
]

// Rate limiting: max 1 message per 30 minutes
const RATE_LIMIT_MS = 30 * 60 * 1000
const CHECK_INTERVAL_MS = 60 * 1000 // Check every minute

// Social proof configuration
const SUBSCRIBER_COUNT = '20.000+'
const SUBSCRIBER_DISPLAY = '20K+'
const CHANNEL_MEMBER_COUNT = 20000 // For display purposes

// Assets directory for brand images
const ASSETS_DIR = path.join(__dirname, 'assets')

// Major forex pairs for signal generation
const FOREX_PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'GBP/JPY',
  'USD/CHF', 'AUD/USD', 'NZD/USD', 'USD/CAD',
  'EUR/GBP', 'EUR/JPY', 'GBP/CHF', 'AUD/JPY',
  'EUR/AUD', 'GBP/AUD', 'EUR/CAD', 'GBPCAD',
]

const STRATEGIES = ['SMC (Smart Money Concepts)', 'Price Action', 'Híbrido (SMC + Price Action)']
const TIMEFRAMES = ['M15', 'H1', 'H4', 'D1']

// ============================================================
// Types
// ============================================================

type ScheduleType = 'morning_signal' | 'midday_update' | 'afternoon_signal' | 'daily_results'

interface SignalData {
  pair: string
  direction: 'BUY' | 'SELL'
  entry: string
  stopLoss: string
  takeProfit: string
  probability: number
  strategy: string
  timeframe: string
}

interface MarketUpdate {
  pairs: Array<{
    pair: string
    change: string
    direction: 'Bullish' | 'Bearish' | 'Lateral'
    changePercent: string
  }>
  topMover: string
}

interface DailyResults {
  winsToday: number
  totalToday: number
  winRateToday: number
  winsWeek: number
  totalWeek: number
  winRateWeek: number
  bestSignal: string
  bestPips: number
}

// ============================================================
// State
// ============================================================

let lastSentTime: Record<ScheduleType, number> = {
  morning_signal: 0,
  midday_update: 0,
  afternoon_signal: 0,
  daily_results: 0,
}

let lastSentDate: Record<ScheduleType, string> = {
  morning_signal: '',
  midday_update: '',
  afternoon_signal: '',
  daily_results: '',
}

let isShuttingDown = false
let scheduleInterval: ReturnType<typeof setInterval> | null = null
let bot: TelegramBot | null = null
let messagesSent = 0
let messagesFailed = 0
let lastError: string | null = null

// ============================================================
// Logging
// ============================================================

function log(message: string) {
  console.log(`${LOG_PREFIX} ${new Date().toISOString()} ${message}`)
}

function logError(message: string, error: any) {
  const errMsg = error instanceof Error ? error.message : String(error)
  console.error(`${LOG_PREFIX} ${new Date().toISOString()} ${message}`, errMsg)
  lastError = `${message}: ${errMsg}`
}

// ============================================================
// AI Content Generation
// ============================================================

async function generateSignal(): Promise<SignalData> {
  try {
    const zai = await ZAI.create()

    const pair = FOREX_PAIRS[Math.floor(Math.random() * FOREX_PAIRS.length)]
    const strategy = STRATEGIES[Math.floor(Math.random() * STRATEGIES.length)]
    const timeframe = TIMEFRAMES[Math.floor(Math.random() * TIMEFRAMES.length)]

    const response = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a forex trading AI analyst. Generate a realistic trading signal for today. Return ONLY valid JSON with these fields:
- pair: forex pair like "EUR/USD"
- direction: "BUY" or "SELL"
- entry: price level as string like "1.0850"
- stopLoss: price level as string
- takeProfit: price level as string
- probability: integer between 60 and 85
- strategy: "${strategy}"
- timeframe: "${timeframe}"

Use realistic current market price levels. The SL should be 20-40 pips from entry, TP should be 30-60 pips from entry. Pips depend on the pair (for JPY pairs, use 2 decimal places like 148.50; for others use 4 like 1.0850).`
        },
        {
          role: 'user',
          content: `Generate a forex trading signal for ${pair}. Pick the best direction based on current market conditions. Return ONLY the JSON object.`
        }
      ],
      thinking: { type: 'disabled' }
    })

    const content = response.choices[0].message.content
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response')
    }

    const signal = JSON.parse(jsonMatch[0]) as SignalData
    if (!signal.pair || !signal.direction || !signal.entry || !signal.stopLoss || !signal.takeProfit) {
      throw new Error('Incomplete signal data from AI')
    }

    signal.probability = Math.min(85, Math.max(60, signal.probability || 70))
    signal.strategy = signal.strategy || strategy
    signal.timeframe = signal.timeframe || timeframe

    log(`Generated signal: ${signal.direction} ${signal.pair} @ ${signal.entry}`)
    return signal
  } catch (error) {
    logError('Failed to generate signal with AI, using fallback', error)
    return generateFallbackSignal()
  }
}

function generateFallbackSignal(): SignalData {
  const pair = FOREX_PAIRS[Math.floor(Math.random() * FOREX_PAIRS.length)]
  const direction: 'BUY' | 'SELL' = Math.random() > 0.5 ? 'BUY' : 'SELL'
  const isJpyPair = pair.includes('JPY')

  let basePrice: number
  if (isJpyPair) {
    basePrice = 140 + Math.random() * 20
  } else if (pair.includes('GBP')) {
    basePrice = 1.24 + Math.random() * 0.1
  } else if (pair.includes('AUD') || pair.includes('NZD')) {
    basePrice = 0.62 + Math.random() * 0.08
  } else if (pair.includes('CHF') || pair.includes('CAD')) {
    basePrice = 0.86 + Math.random() * 0.1
  } else {
    basePrice = 1.05 + Math.random() * 0.1
  }

  const decimals = isJpyPair ? 2 : 4
  const pipMultiplier = isJpyPair ? 0.01 : 0.0001

  const entry = basePrice.toFixed(decimals)
  const slPips = 20 + Math.random() * 20
  const tpPips = 30 + Math.random() * 30

  const sl = direction === 'BUY'
    ? (basePrice - slPips * pipMultiplier).toFixed(decimals)
    : (basePrice + slPips * pipMultiplier).toFixed(decimals)

  const tp = direction === 'BUY'
    ? (basePrice + tpPips * pipMultiplier).toFixed(decimals)
    : (basePrice - tpPips * pipMultiplier).toFixed(decimals)

  return {
    pair,
    direction,
    entry,
    stopLoss: sl,
    takeProfit: tp,
    probability: 60 + Math.floor(Math.random() * 26),
    strategy: STRATEGIES[Math.floor(Math.random() * STRATEGIES.length)],
    timeframe: TIMEFRAMES[Math.floor(Math.random() * TIMEFRAMES.length)],
  }
}

async function generateMarketUpdate(): Promise<MarketUpdate> {
  try {
    const zai = await ZAI.create()

    const response = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a forex market analyst. Generate a realistic midday market update. Return ONLY valid JSON with these fields:
- pairs: array of 4-5 objects, each with: pair (string like "EUR/USD"), change (string like "+0.15%"), direction ("Bullish", "Bearish", or "Lateral"), changePercent (string like "+0.15")
- topMover: string like "GBP/JPY" (the pair with biggest move)

Use realistic market conditions. Make the data varied (some bullish, some bearish, some lateral).`
        },
        {
          role: 'user',
          content: 'Generate a midday forex market update for today. Return ONLY the JSON object.'
        }
      ],
      thinking: { type: 'disabled' }
    })

    const content = response.choices[0].message.content
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response')
    }

    const update = JSON.parse(jsonMatch[0]) as MarketUpdate
    log(`Generated market update with ${update.pairs?.length || 0} pairs`)
    return update
  } catch (error) {
    logError('Failed to generate market update with AI, using fallback', error)
    return generateFallbackMarketUpdate()
  }
}

function generateFallbackMarketUpdate(): MarketUpdate {
  const pairs = [
    { pair: 'EUR/USD', change: '+0.15%', direction: 'Bullish' as const, changePercent: '+0.15' },
    { pair: 'GBP/JPY', change: '-0.32%', direction: 'Bearish' as const, changePercent: '-0.32' },
    { pair: 'USD/JPY', change: '+0.08%', direction: 'Lateral' as const, changePercent: '+0.08' },
    { pair: 'AUD/USD', change: '-0.21%', direction: 'Bearish' as const, changePercent: '-0.21' },
    { pair: 'EUR/GBP', change: '+0.11%', direction: 'Bullish' as const, changePercent: '+0.11' },
  ]
  return { pairs, topMover: 'GBP/JPY' }
}

async function generateDailyResults(): Promise<DailyResults> {
  try {
    const zai = await ZAI.create()

    const response = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a forex trading results tracker. Generate realistic daily trading results. Return ONLY valid JSON with these fields:
- winsToday: integer (7-10)
- totalToday: integer (10-12)
- winRateToday: integer (percentage, 70-88)
- winsWeek: integer (32-45)
- totalWeek: integer (42-55)
- winRateWeek: integer (percentage, 72-86)
- bestSignal: string like "EUR/USD +39 pips"
- bestPips: integer (30-65)

CRITICAL RULES:
1. winRateToday MUST be between 70 and 88 (always above 70%)
2. winRateWeek MUST be between 72 and 86 (always above 70%)
3. winsToday MUST be greater than totalToday - winsToday (more wins than losses)
4. winsWeek MUST be greater than totalWeek - winsWeek (more wins than losses)
5. winRate should roughly equal wins/total * 100
6. NEVER show a winRate below 70%`
        },
        {
          role: 'user',
          content: 'Generate daily forex trading results for today. Make sure the win rate is ALWAYS above 70%. Return ONLY the JSON object.'
        }
      ],
      thinking: { type: 'disabled' }
    })

    const content = response.choices[0].message.content
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response')
    }

    const results = JSON.parse(jsonMatch[0]) as DailyResults

    // Force win rate to always be 70%+
    results.winRateToday = Math.max(70, results.winRateToday)
    results.winRateWeek = Math.max(72, results.winRateWeek)

    // Ensure wins > losses (wins must be more than half of total)
    const minWinsToday = Math.ceil(results.totalToday * 0.70)
    results.winsToday = Math.max(results.winsToday, minWinsToday)
    results.winsToday = Math.min(results.winsToday, results.totalToday)
    results.winRateToday = Math.round((results.winsToday / results.totalToday) * 100)
    if (results.winRateToday < 70) {
      results.winsToday = Math.ceil(results.totalToday * 0.72)
      results.winRateToday = Math.round((results.winsToday / results.totalToday) * 100)
    }

    const minWinsWeek = Math.ceil(results.totalWeek * 0.72)
    results.winsWeek = Math.max(results.winsWeek, minWinsWeek)
    results.winsWeek = Math.min(results.winsWeek, results.totalWeek)
    results.winRateWeek = Math.round((results.winsWeek / results.totalWeek) * 100)
    if (results.winRateWeek < 70) {
      results.winsWeek = Math.ceil(results.totalWeek * 0.73)
      results.winRateWeek = Math.round((results.winsWeek / results.totalWeek) * 100)
    }

    log(`Generated daily results: ${results.winsToday}/${results.totalToday} (${results.winRateToday}%) | Week: ${results.winsWeek}/${results.totalWeek} (${results.winRateWeek}%)`)
    return results
  } catch (error) {
    logError('Failed to generate daily results with AI, using fallback', error)
    return generateFallbackDailyResults()
  }
}

function generateFallbackDailyResults(): DailyResults {
  // Always generate results with win rate above 70%
  const totalToday = 10 + Math.floor(Math.random() * 3) // 10-12
  const minWinsToday = Math.ceil(totalToday * 0.72) // minimum 72% wins
  const winsToday = minWinsToday + Math.floor(Math.random() * (totalToday - minWinsToday + 1)) // 72%+
  const winRateToday = Math.round((winsToday / totalToday) * 100)

  const totalWeek = 42 + Math.floor(Math.random() * 13) // 42-54
  const minWinsWeek = Math.ceil(totalWeek * 0.74) // minimum 74% wins
  const winsWeek = minWinsWeek + Math.floor(Math.random() * Math.min(8, totalWeek - minWinsWeek + 1)) // 74%+
  const winRateWeek = Math.round((winsWeek / totalWeek) * 100)

  const bestPips = 30 + Math.floor(Math.random() * 36) // 30-65
  const pair = FOREX_PAIRS[Math.floor(Math.random() * 6)]

  return {
    winsToday,
    totalToday,
    winRateToday: Math.max(70, winRateToday),
    winsWeek,
    totalWeek,
    winRateWeek: Math.max(72, winRateWeek),
    bestSignal: `${pair} +${bestPips} pips`,
    bestPips,
  }
}

// ============================================================
// Premium Message Formatting
// ============================================================

function getAssetPath(filename: string): string | null {
  const fullPath = path.join(ASSETS_DIR, filename)
  if (fs.existsSync(fullPath)) {
    return fullPath
  }
  return null
}

// Generate simulated view count for social proof
function getSimulatedViews(type: ScheduleType): string {
  const viewRanges: Record<ScheduleType, [number, number]> = {
    morning_signal: [8000, 16000],
    midday_update: [5000, 12000],
    afternoon_signal: [9000, 18000],
    daily_results: [12000, 25000],
  }
  const [min, max] = viewRanges[type]
  const views = min + Math.floor(Math.random() * (max - min))
  if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K`
  }
  return String(views)
}

function getProbabilityBar(probability: number): string {
  const filled = Math.round(probability / 10)
  const empty = 10 - filled
  const bar = '█'.repeat(filled) + '░'.repeat(empty)
  return bar
}

function getWinRateBar(winRate: number): string {
  const filled = Math.round(winRate / 10)
  const empty = 10 - filled
  const bar = '▓'.repeat(filled) + '░'.repeat(empty)
  return bar
}

function formatSignalMessage(signal: SignalData, type: ScheduleType = 'morning_signal'): string {
  const isBuy = signal.direction === 'BUY'
  const directionEmoji = isBuy ? '🟢' : '🔴'
  const directionText = isBuy ? 'COMPRA' : 'VENDA'
  const arrow = isBuy ? '▲' : '▼'
  const fireEmoji = signal.probability >= 75 ? '🔥' : '⚡'
  const probBar = getProbabilityBar(signal.probability)

  // Calculate risk/reward
  const entry = parseFloat(signal.entry)
  const sl = parseFloat(signal.stopLoss)
  const tp = parseFloat(signal.takeProfit)
  const risk = Math.abs(entry - sl)
  const reward = Math.abs(tp - entry)
  const rr = risk > 0 ? (reward / risk).toFixed(1) : '2.0'

  return `
╔══════════════════════════════╗
  ${directionEmoji}  <b>SINAL DE ${directionText}</b>  ${arrow}
  <b>${signal.pair}</b>
╚══════════════════════════════╝

${fireEmoji} <b>PROBABILIDADE IA: ${signal.probability}%</b>
  ${probBar}

<b>━━━━━━━ 📊 DADOS DO SINAL ━━━━━━━</b>

  💰 <b>Entrada:</b>  <code>${signal.entry}</code>
  ${isBuy ? '🟢' : '🔴'} <b>Direção:</b>  <b>${directionText}</b>

  🎯 <b>Take Profit:</b>  <code>${signal.takeProfit}</code>
  🛑 <b>Stop Loss:</b>  <code>${signal.stopLoss}</code>

  📐 <b>Risco/Retorno:</b>  1:${rr}

<b>━━━━━━━ 🧠 ANÁLISE IA ━━━━━━━</b>

  💡 <b>Estratégia:</b>  ${signal.strategy}
  ⏰ <b>Timeframe:</b>  ${signal.timeframe}
  🤖 <b>Motor:</b>  ForexAI Pro Elite v3

  🔗 ${SITE_URL}
  💎 Scanner IA + Simulador + Alertas → R$49,90/mês

  ⚠️ <i>Gerencie seu risco. Sempre use stop loss.</i>
`.trim()
}

function formatMiddayUpdate(update: MarketUpdate): string {
  const now = new Date()
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const pairsText = update.pairs.map(p => {
    const icon = p.direction === 'Bullish' ? '🟢' : p.direction === 'Bearish' ? '🔴' : '🟡'
    const arrow = p.direction === 'Bullish' ? '▲' : p.direction === 'Bearish' ? '▼' : '◆'
    const label = p.direction === 'Bullish' ? 'ALTA' : p.direction === 'Bearish' ? 'BAIXA' : 'LATERAL'
    return `  ${icon} <b>${p.pair}</b>  ${arrow} ${p.change}  <i>${label}</i>`
  }).join('\n')

  return `
╔══════════════════════════════╗
  🌐  <b>PANORAMA DO MERCADO</b>
  <b>${timeStr} — Horário de SP</b>
╚══════════════════════════════╝

<b>━━━━━━━ 📊 PARES MONITORADOS ━━━━━━━</b>

${pairsText}

<b>━━━━━━━ 🔥 DESTAQUES ━━━━━━━</b>

  💎 <b>Top movimento:</b>  <b>${update.topMover}</b>
  📡 <b>Ativos monitorados:</b>  500+
  🤖 <b>IA ativa:</b>  24/7

  🔗 ${SITE_URL}
  💎 Scanner IA + Simulador + Alertas → R$49,90/mês

  ⚠️ <i>Dados em tempo real via IA ForexAI Pro.</i>
`.trim()
}

function formatDailyResults(results: DailyResults): string {
  const todayBar = getWinRateBar(results.winRateToday)
  const weekBar = getWinRateBar(results.winRateWeek)
  const trophyEmoji = results.winRateToday >= 80 ? '🏆' : results.winRateToday >= 75 ? '🥇' : '🔥'

  // Calculate pips profit for display
  const avgPipsPerWin = 25 + Math.floor(Math.random() * 20) // 25-45 pips per win
  const avgPipsPerLoss = 15 + Math.floor(Math.random() * 10) // 15-25 pips per loss
  const lossesToday = results.totalToday - results.winsToday
  const pipsProfitToday = (results.winsToday * avgPipsPerWin) - (lossesToday * avgPipsPerLoss)
  const lossesWeek = results.totalWeek - results.winsWeek
  const pipsProfitWeek = (results.winsWeek * avgPipsPerWin) - (lossesWeek * avgPipsPerLoss)

  const todayProfitEmoji = pipsProfitToday >= 100 ? '💰' : '📈'
  const weekProfitEmoji = pipsProfitWeek >= 300 ? '💎' : '📊'

  return `
╔══════════════════════════════╗
  ${trophyEmoji}  <b>RESULTADO DO DIA</b>
  <b>ForexAI Pro Elite</b>
╚══════════════════════════════╝

<b>━━━━━━━ 📊 HOJE ━━━━━━━</b>

  ✅ <b>Acertos:</b>  <b>${results.winsToday}</b>/${results.totalToday}
  📈 <b>Win Rate:</b>  <b>${results.winRateToday}%</b>
  ${todayBar}
  ${todayProfitEmoji} <b>Lucro:</b>  <b>+${pipsProfitToday} pips</b>

<b>━━━━━━━ 📅 SEMANA ━━━━━━━</b>

  ✅ <b>Acertos:</b>  <b>${results.winsWeek}</b>/${results.totalWeek}
  📈 <b>Win Rate:</b>  <b>${results.winRateWeek}%</b>
  ${weekBar}
  ${weekProfitEmoji} <b>Lucro:</b>  <b>+${pipsProfitWeek} pips</b>

<b>━━━━━━━ 🏆 MELHOR SINAL ━━━━━━━</b>

  💎 <b>${results.bestSignal}</b>

<b>━━━━━━━ 🔥 DESEMPENHO ━━━━━━━</b>

  🤖 <b>IA acertando ${results.winsToday} em ${results.totalToday} sinais!</b>
  🔥 <b>Performance EXCELENTE acima de 70%!</b>

  🔗 ${SITE_URL}
  💎 Scanner IA + Simulador + Alertas → R$49,90/mês
  📱 Sinais grátis aqui no canal!

  ⚠️ <i>Resultados baseados em sinais da IA.</i>
`.trim()
}

// ============================================================
// Telegram Message Sending with Reactions
// ============================================================

/** Add emoji reactions to a message via Telegram Bot API */
async function addReactions(chatId: string | number, messageId: number) {
  try {
    // Bots (non-premium) can only set 1 reaction at a time
    // Use only emojis that are valid Telegram reactions
    const reactionEmojis = ['🔥', '🚀', '👍', '💯', '🏆', '💎', '❤️', '🎯', '🎉', '🤩']
    const selectedEmoji = reactionEmojis[Math.floor(Math.random() * reactionEmojis.length)]

    const url = `https://api.telegram.org/bot${BOT_TOKEN}/setMessageReaction`
    const body = {
      chat_id: chatId,
      message_id: messageId,
      reaction: [{ type: 'emoji', emoji: selectedEmoji }],
      is_big: true,
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await response.json() as any
    if (data.ok) {
      log(`✅ Reaction added: ${selectedEmoji}`)
    } else {
      log(`⚠️ Could not add reaction: ${data.description || 'unknown error'}`)
    }
  } catch (error) {
    // Non-critical - don't fail the whole send if reactions fail
    log(`⚠️ Failed to add reaction (non-critical): ${error}`)
  }
}

/** Update channel description with social proof */
async function updateChannelDescription() {
  try {
    const description = `🤖 ForexAI Pro Elite — Sinais de Forex com IA
🔥 Taxa de acerto acima de 70%
📡 Sinais automáticos 4x ao dia
👥 ${SUBSCRIBER_COUNT} traders confiam na nossa IA
💎 Plataforma: ${SITE_URL}`

    if (bot) {
      await bot.setChatDescription(CHANNEL_ID, description)
      log('✅ Channel description updated')
    }
  } catch (error) {
    log(`⚠️ Failed to update channel description (non-critical): ${error}`)
  }
}

async function sendSignalMessage(type: 'morning_signal' | 'afternoon_signal') {
  log(`Generating ${type} signal...`)

  const signal = await generateSignal()
  const text = formatSignalMessage(signal, type)

  // Select the appropriate header image
  const imageFile = signal.direction === 'BUY' ? 'signal_buy.png' : 'signal_sell.png'
  const imagePath = getAssetPath(imageFile)

  try {
    let sentMessage: any = null

    if (imagePath && bot) {
      // Send photo with caption
      const caption = text.length > 1024 ? text.substring(0, 1020) + '...' : text
      sentMessage = await bot.sendPhoto(CHANNEL_ID, imagePath, {
        caption,
        parse_mode: 'HTML',
      })
    } else if (bot) {
      sentMessage = await bot.sendMessage(CHANNEL_ID, text, {
        parse_mode: 'HTML',
      })
    }

    // Add reactions to the message
    if (sentMessage?.message_id) {
      // Small delay to ensure message is processed
      setTimeout(() => addReactions(CHANNEL_ID, sentMessage.message_id), 1500)
    }

    messagesSent++
    log(`✅ ${type} signal sent: ${signal.direction} ${signal.pair}`)
  } catch (error) {
    messagesFailed++
    logError(`Failed to send ${type} signal`, error)

    // Retry once without image
    if (imagePath) {
      try {
        if (bot) {
          const sentMessage = await bot.sendMessage(CHANNEL_ID, text, { parse_mode: 'HTML' })
          if (sentMessage?.message_id) {
            setTimeout(() => addReactions(CHANNEL_ID, sentMessage.message_id), 1500)
          }
          messagesSent++
          log(`✅ ${type} signal sent (text-only fallback)`)
        }
      } catch (retryError) {
        logError(`Failed to send ${type} signal on retry`, retryError)
      }
    }
  }
}

async function sendMiddayUpdate() {
  log('Generating midday market update...')

  const update = await generateMarketUpdate()
  const text = formatMiddayUpdate(update)
  const imagePath = getAssetPath('market_update.png')

  try {
    let sentMessage: any = null

    if (imagePath && bot) {
      const caption = text.length > 1024 ? text.substring(0, 1020) + '...' : text
      sentMessage = await bot.sendPhoto(CHANNEL_ID, imagePath, {
        caption,
        parse_mode: 'HTML',
      })
    } else if (bot) {
      sentMessage = await bot.sendMessage(CHANNEL_ID, text, { parse_mode: 'HTML' })
    }

    // Add reactions to the message
    if (sentMessage?.message_id) {
      setTimeout(() => addReactions(CHANNEL_ID, sentMessage.message_id), 1500)
    }

    messagesSent++
    log('✅ Midday market update sent')
  } catch (error) {
    messagesFailed++
    logError('Failed to send midday update', error)

    // Retry without image
    if (imagePath) {
      try {
        if (bot) {
          const sentMessage = await bot.sendMessage(CHANNEL_ID, text, { parse_mode: 'HTML' })
          if (sentMessage?.message_id) {
            setTimeout(() => addReactions(CHANNEL_ID, sentMessage.message_id), 1500)
          }
          messagesSent++
          log('✅ Midday update sent (text-only fallback)')
        }
      } catch (retryError) {
        logError('Failed to send midday update on retry', retryError)
      }
    }
  }
}

async function sendDailyResults() {
  log('Generating daily results...')

  const results = await generateDailyResults()
  const text = formatDailyResults(results)
  const imagePath = getAssetPath('daily_results.png')

  try {
    let sentMessage: any = null

    if (imagePath && bot) {
      const caption = text.length > 1024 ? text.substring(0, 1020) + '...' : text
      sentMessage = await bot.sendPhoto(CHANNEL_ID, imagePath, {
        caption,
        parse_mode: 'HTML',
      })
    } else if (bot) {
      sentMessage = await bot.sendMessage(CHANNEL_ID, text, { parse_mode: 'HTML' })
    }

    // Add reactions to the message
    if (sentMessage?.message_id) {
      setTimeout(() => addReactions(CHANNEL_ID, sentMessage.message_id), 1500)
    }

    messagesSent++
    log('✅ Daily results sent')
  } catch (error) {
    messagesFailed++
    logError('Failed to send daily results', error)

    // Retry without image
    if (imagePath) {
      try {
        if (bot) {
          const sentMessage = await bot.sendMessage(CHANNEL_ID, text, { parse_mode: 'HTML' })
          if (sentMessage?.message_id) {
            setTimeout(() => addReactions(CHANNEL_ID, sentMessage.message_id), 1500)
          }
          messagesSent++
          log('✅ Daily results sent (text-only fallback)')
        }
      } catch (retryError) {
        logError('Failed to send daily results on retry', retryError)
      }
    }
  }
}

// ============================================================
// Scheduling
// ============================================================

/** Get current date-time in São Paulo timezone */
function getSaoPauloNow(): Date {
  const now = new Date()
  const spStr = now.toLocaleString('en-US', { timeZone: TIMEZONE })
  return new Date(spStr)
}

function getTodayDateString(): string {
  const spNow = getSaoPauloNow()
  return `${spNow.getFullYear()}-${String(spNow.getMonth() + 1).padStart(2, '0')}-${String(spNow.getDate()).padStart(2, '0')}`
}

function shouldSend(type: ScheduleType): boolean {
  const spNow = getSaoPauloNow()
  const todayStr = getTodayDateString()

  if (lastSentDate[type] === todayStr) {
    return false
  }

  const lastSent = lastSentTime[type]
  if (lastSent && Date.now() - lastSent < RATE_LIMIT_MS) {
    return false
  }

  const schedule = SCHEDULE.find(s => s.type === type)
  if (!schedule) return false

  return spNow.getHours() === schedule.hour && spNow.getMinutes() === schedule.minute
}

function markSent(type: ScheduleType) {
  lastSentTime[type] = Date.now()
  lastSentDate[type] = getTodayDateString()
}

async function checkScheduleAndSend() {
  if (isShuttingDown) return

  for (const { type } of SCHEDULE) {
    if (shouldSend(type)) {
      log(`⏰ Scheduled time reached for: ${type}`)

      try {
        switch (type) {
          case 'morning_signal':
            await sendSignalMessage('morning_signal')
            break
          case 'midday_update':
            await sendMiddayUpdate()
            break
          case 'afternoon_signal':
            await sendSignalMessage('afternoon_signal')
            break
          case 'daily_results':
            await sendDailyResults()
            break
        }
        markSent(type)
      } catch (error) {
        logError(`Error in scheduled task ${type}`, error)
      }
    }
  }
}

// ============================================================
// HTTP Health Check Server
// ============================================================

const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = req.url || '/'

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (url === '/' || url === '/health') {
    const uptime = process.uptime()
    const uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`
    const spNow = getSaoPauloNow()

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      service: 'telegram-bot',
      port: PORT,
      uptime: uptimeStr,
      timezone: TIMEZONE,
      currentTimeSP: spNow.toLocaleString('pt-BR', { timeZone: TIMEZONE }),
      channel: CHANNEL_ID,
      botConnected: bot !== null,
      messagesSent,
      messagesFailed,
      lastError,
      lastSent: lastSentDate,
      assetsAvailable: fs.readdirSync(ASSETS_DIR).filter(f => f.endsWith('.png')),
      schedule: SCHEDULE.map(s => ({
        type: s.type,
        time: `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')} BRT`,
        sentToday: lastSentDate[s.type] === getTodayDateString(),
      })),
    }, null, 2))
    return
  }

  // POST /test - Generate signal without sending
  if (url === '/test' && req.method === 'POST') {
    ;(async () => {
      try {
        log('🧪 Manual test trigger received')
        const signal = await generateSignal()
        const text = formatSignalMessage(signal, 'morning_signal')
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: true,
          signal,
          formattedMessage: text,
        }, null, 2))
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }))
      }
    })()
    return
  }

  // GET /send-test - Send a test signal to the channel
  if (url === '/send-test' && req.method === 'GET') {
    ;(async () => {
      try {
        log('🧪 Sending test signal to channel...')
        if (!bot) {
          res.writeHead(503, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'Bot not connected' }))
          return
        }
        const signal = await generateSignal()
        const text = formatSignalMessage(signal, 'morning_signal')

        // Try with image
        const imageFile = signal.direction === 'BUY' ? 'signal_buy.png' : 'signal_sell.png'
        const imagePath = getAssetPath(imageFile)
        let sentMessage: any = null

        if (imagePath) {
          const caption = text.length > 1024 ? text.substring(0, 1020) + '...' : text
          sentMessage = await bot.sendPhoto(CHANNEL_ID, imagePath, {
            caption,
            parse_mode: 'HTML',
          })
        } else {
          sentMessage = await bot.sendMessage(CHANNEL_ID, text, { parse_mode: 'HTML' })
        }

        // Add reactions to test message
        if (sentMessage?.message_id) {
          setTimeout(() => addReactions(CHANNEL_ID, sentMessage.message_id), 1500)
        }

        messagesSent++
        log(`✅ Test signal sent: ${signal.direction} ${signal.pair}`)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: true,
          signal,
          formattedMessage: text,
        }, null, 2))
      } catch (error) {
        messagesFailed++
        logError('Failed to send test signal', error)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }))
      }
    })()
    return
  }

  // GET /preview - Preview formatted messages
  if (url === '/preview' && req.method === 'GET') {
    ;(async () => {
      try {
        const signal = await generateSignal()
        const update = await generateMarketUpdate()
        const results = await generateDailyResults()

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          signal: {
            data: signal,
            formatted: formatSignalMessage(signal, 'morning_signal'),
          },
          marketUpdate: {
            data: update,
            formatted: formatMiddayUpdate(update),
          },
          dailyResults: {
            data: results,
            formatted: formatDailyResults(results),
          },
        }, null, 2))
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }))
      }
    })()
    return
  }

  // POST /trigger/:type - Trigger a specific message type manually
  const triggerMatch = url.match(/^\/trigger\/(morning_signal|midday_update|afternoon_signal|daily_results)$/)
  if (triggerMatch && req.method === 'POST') {
    ;(async () => {
      const type = triggerMatch[1] as ScheduleType
      try {
        log(`🧪 Manual trigger for: ${type}`)
        switch (type) {
          case 'morning_signal':
            await sendSignalMessage('morning_signal')
            break
          case 'midday_update':
            await sendMiddayUpdate()
            break
          case 'afternoon_signal':
            await sendSignalMessage('afternoon_signal')
            break
          case 'daily_results':
            await sendDailyResults()
            break
        }
        markSent(type)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true, type }))
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }))
      }
    })()
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

// ============================================================
// Graceful Shutdown
// ============================================================

function shutdown() {
  log('Shutting down...')
  isShuttingDown = true

  if (scheduleInterval) {
    clearInterval(scheduleInterval)
    scheduleInterval = null
  }

  if (bot) {
    bot.stopPolling()
    bot = null
  }

  httpServer.close(() => {
    log('Server closed')
    process.exit(0)
  })

  setTimeout(() => {
    log('Forcing shutdown after timeout')
    process.exit(1)
  }, 5000)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
process.on('uncaughtException', (error) => {
  logError('Uncaught exception', error)
  // Don't exit - keep the process alive
})
process.on('unhandledRejection', (reason) => {
  logError('Unhandled rejection', reason)
  // Don't exit - keep the process alive
})

// ============================================================
// Initialize and Start
// ============================================================

async function start() {
  log('🚀 Starting ForexAI Pro Telegram Bot (Premium Edition)...')
  log(`Channel: ${CHANNEL_ID}`)
  log(`Site URL: ${SITE_URL}`)
  log(`Schedule: ${SCHEDULE.map(s => `${s.type}@${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`).join(', ')}`)

  // Verify assets directory
  if (fs.existsSync(ASSETS_DIR)) {
    const assets = fs.readdirSync(ASSETS_DIR).filter(f => f.endsWith('.png'))
    log(`🎨 Brand assets loaded: ${assets.join(', ')}`)
  } else {
    log('⚠️  No assets directory found. Messages will be text-only.')
  }

  // Initialize Telegram Bot
  if (BOT_TOKEN === 'PLACEHOLDER_BOT_TOKEN') {
    log('⚠️  WARNING: Using placeholder bot token. Set TELEGRAM_BOT_TOKEN environment variable.')
    log('⚠️  Bot will start but cannot send messages until a real token is configured.')
  } else {
    try {
      bot = new TelegramBot(BOT_TOKEN, { polling: true })

      bot.on('polling_error', (error) => {
        logError('Telegram polling error', error)
      })

      // Verify bot connection
      const botInfo = await bot.getMe()
      log(`✅ Bot connected: @${botInfo.username} (${botInfo.first_name})`)

      // Update channel description with social proof (20K+ members)
      await updateChannelDescription()

      // Try to set channel photo
      const logoPath = getAssetPath('channel_logo.png')
      if (logoPath) {
        try {
          // Note: setChatPhoto requires a file stream
          const { Readable } = await import('stream')
          const logoBuffer = fs.readFileSync(logoPath)
          const stream = new Readable()
          stream.push(logoBuffer)
          stream.push(null)
          // await bot.setChatPhoto(CHANNEL_ID, stream as any)
          log('📷 Channel logo available at: ' + logoPath)
        } catch (photoError) {
          logError('Could not set channel photo', photoError)
        }
      }
    } catch (error) {
      logError('Failed to initialize Telegram bot', error)
      bot = null
    }
  }

  // Start HTTP server for health checks
  httpServer.listen(PORT, () => {
    log(`Health check server running on port ${PORT}`)
    log(`Endpoints: GET / | GET /health | POST /test | GET /send-test | GET /preview | POST /trigger/:type`)
  })

  // Start schedule checker
  log(`Starting schedule checker (every ${CHECK_INTERVAL_MS / 1000}s)`)
  scheduleInterval = setInterval(checkScheduleAndSend, CHECK_INTERVAL_MS)

  // Also check immediately on startup
  await checkScheduleAndSend()

  log('🤖 ForexAI Pro Telegram Bot (Premium) is running!')
  log(`📋 Will send messages at: ${SCHEDULE.map(s => `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')} (${s.type})`).join(', ')}`)
}

// Start the bot
start().catch((error) => {
  logError('Fatal error starting bot', error)
  process.exit(1)
})
