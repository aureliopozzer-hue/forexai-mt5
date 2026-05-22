import { createServer, IncomingMessage, ServerResponse } from 'http'
import { Server } from 'socket.io'

// ============================================================
// Configuration
// ============================================================

const PORT = 3004
const LOG_PREFIX = '[CryptoStream]'

// Binance symbol to Yahoo Finance symbol mapping
const BINANCE_TO_YAHOO: Record<string, string> = {
  BTCUSDT: 'BTC-USD',
  ETHUSDT: 'ETH-USD',
  SOLUSDT: 'SOL-USD',
  XRPUSDT: 'XRP-USD',
  BNBUSDT: 'BNB-USD',
  ADAUSDT: 'ADA-USD',
  DOGEUSDT: 'DOGE-USD',
  AVAXUSDT: 'AVAX-USD',
  DOTUSDT: 'DOT-USD',
  LINKUSDT: 'LINK-USD',
  LTCUSDT: 'LTC-USD',
  ATOMUSDT: 'ATOM-USD',
  UNIUSDT: 'UNI7083-USD',
  NEARUSDT: 'NEAR-USD',
  APTUSDT: 'APT-USD',
  ARBUSDT: 'ARB11841-USD',
  OPUSDT: 'OP-USD',
  FILUSDT: 'FIL-USD',
  AAVEUSDT: 'AAVE-USD',
  INJUSDT: 'INJ-USD',
  SUIUSDT: 'SUI20947-USD',
  TONUSDT: 'TON11419-USD',
  PEPEUSDT: 'PEPE24478-USD',
  SHIBUSDT: 'SHIB-USD',
  TRXUSDT: 'TRX-USD',
}

// Yahoo to Binance reverse mapping
const YAHOO_TO_BINANCE: Record<string, string> = {}
for (const [binanceSym, yahooSym] of Object.entries(BINANCE_TO_YAHOO)) {
  YAHOO_TO_BINANCE[yahooSym] = binanceSym
}

// Binance stream symbols (all lowercase for WebSocket stream names)
const STREAM_SYMBOLS = Object.keys(BINANCE_TO_YAHOO).map(s => s.toLowerCase())
const BINANCE_WS_URL = `wss://stream.binance.com:9443/ws/${STREAM_SYMBOLS.map(s => `${s}@ticker`).join('/')}`

// ============================================================
// Types
// ============================================================

interface CryptoPrice {
  symbol: string           // Yahoo format: "BTC-USD"
  binanceSymbol: string    // Binance format: "BTCUSDT"
  price: number
  change24h: number
  changePercent24h: number
  high24h: number
  low24h: number
  volume24h: number
  quoteVolume24h: number
  trades: number
  timestamp: number
}

interface BinanceTickerMessage {
  e: string    // Event type
  E: number    // Event time
  s: string    // Symbol
  p: string    // Price change
  P: string    // Price change percent
  w: string    // Weighted average price
  c: string    // Last price
  Q: string    // Last quantity
  o: string    // Open price
  h: string    // High price
  l: string    // Low price
  v: string    // Total traded base asset volume
  q: string    // Total traded quote asset volume
  O: number    // Statistics open time
  C: number    // Statistics close time
  F: number    // First trade ID
  L: number    // Last trade ID
  n: number    // Total number of trades
}

// ============================================================
// State
// ============================================================

// Cached prices indexed by Binance symbol
const priceCache = new Map<string, CryptoPrice>()

// Track client subscriptions (socketId -> Set of Yahoo symbols)
const clientSubscriptions = new Map<string, Set<string>>()

// Binance WebSocket connection state
let binanceWs: any = null
let reconnectAttempts = 0
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let isShuttingDown = false

// ============================================================
// Binance WebSocket Connection
// ============================================================

function connectBinance() {
  if (isShuttingDown) return

  try {
    log(`Connecting to Binance WebSocket: ${BINANCE_WS_URL.substring(0, 80)}...`)

    // Use Bun's built-in WebSocket client
    binanceWs = new WebSocket(BINANCE_WS_URL)

    binanceWs.addEventListener('open', () => {
      log('Connected to Binance WebSocket')
      reconnectAttempts = 0
    })

    binanceWs.addEventListener('message', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as BinanceTickerMessage

        if (data.e === '24hrTicker') {
          const binanceSymbol = data.s
          const yahooSymbol = BINANCE_TO_YAHOO[binanceSymbol]

          if (!yahooSymbol) return

          const priceUpdate: CryptoPrice = {
            symbol: yahooSymbol,
            binanceSymbol: binanceSymbol,
            price: parseFloat(data.c),
            change24h: parseFloat(data.p),
            changePercent24h: parseFloat(data.P),
            high24h: parseFloat(data.h),
            low24h: parseFloat(data.l),
            volume24h: parseFloat(data.v),
            quoteVolume24h: parseFloat(data.q),
            trades: data.n,
            timestamp: data.E,
          }

          // Update cache
          priceCache.set(binanceSymbol, priceUpdate)

          // Emit to all connected clients
          emitPriceUpdate(priceUpdate)
        }
      } catch (parseErr) {
        logError('Failed to parse Binance message', parseErr)
      }
    })

    binanceWs.addEventListener('close', (event: CloseEvent) => {
      log(`Binance WebSocket closed (code: ${event.code}, reason: ${event.reason || 'none'})`)
      binanceWs = null
      scheduleReconnect()
    })

    binanceWs.addEventListener('error', (event: Event) => {
      logError('Binance WebSocket error', event)
      // The 'close' event will fire after error, which handles reconnection
    })
  } catch (err) {
    logError('Failed to create Binance WebSocket connection', err)
    scheduleReconnect()
  }
}

function scheduleReconnect() {
  if (isShuttingDown) return
  if (reconnectTimer) return

  // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)
  reconnectAttempts++

  log(`Reconnecting to Binance in ${delay}ms (attempt ${reconnectAttempts})`)

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connectBinance()
  }, delay)
}

function disconnectBinance() {
  if (binanceWs) {
    try {
      binanceWs.close()
    } catch (e) {
      // Ignore close errors
    }
    binanceWs = null
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

// ============================================================
// Socket.io Server
// ============================================================

const httpServer = createServer()

const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// Health check middleware - runs before Socket.io processes the request
// Since Socket.io uses path: '/', it intercepts all HTTP requests.
// We use engine.io middleware to handle health checks before Socket.io takes over.
io.engine.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
  const url = req.url || '/'

  // Health check endpoint
  if (url === '/health' || url.startsWith('/health?')) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      service: 'crypto-stream',
      connections: io.sockets.sockets.size,
      streams: priceCache.size,
      binanceConnected: binanceWs !== null && binanceWs.readyState === WebSocket.OPEN,
      cachedSymbols: Array.from(priceCache.keys()),
    }))
    return
  }

  next()
})

// ============================================================
// Price Emission
// ============================================================

function emitPriceUpdate(price: CryptoPrice) {
  // Emit to all connected clients
  // Clients can filter on their end based on their subscriptions
  io.emit('crypto-price', price)
}

function emitSnapshot(socket: any) {
  const snapshot = Array.from(priceCache.values())

  // If client has specific subscriptions, filter snapshot
  const subs = clientSubscriptions.get(socket.id)
  if (subs && subs.size > 0) {
    const filtered = snapshot.filter(p => subs.has(p.symbol) || subs.has(p.binanceSymbol))
    socket.emit('crypto-snapshot', filtered)
  } else {
    // No subscriptions = send everything
    socket.emit('crypto-snapshot', snapshot)
  }
}

// ============================================================
// Socket.io Connection Handling
// ============================================================

io.on('connection', (socket) => {
  log(`Client connected: ${socket.id} (total: ${io.sockets.sockets.size})`)

  // Initialize empty subscriptions for this client
  clientSubscriptions.set(socket.id, new Set())

  // Send current cached prices immediately
  try {
    emitSnapshot(socket)
  } catch (err) {
    logError(`Failed to send snapshot to ${socket.id}`, err)
  }

  // Handle health-check event (alternative to HTTP endpoint)
  socket.on('health-check', (callback: (data: object) => void) => {
    try {
      if (typeof callback === 'function') {
        callback({
          status: 'ok',
          service: 'crypto-stream',
          connections: io.sockets.sockets.size,
          streams: priceCache.size,
          binanceConnected: binanceWs !== null && binanceWs.readyState === WebSocket.OPEN,
        })
      }
    } catch (err) {
      logError(`Error handling health-check from ${socket.id}`, err)
    }
  })

  // Handle subscribe event
  socket.on('subscribe', (symbols: string[]) => {
    try {
      const subs = clientSubscriptions.get(socket.id) || new Set()

      for (const sym of symbols) {
        const normalized = sym.toUpperCase()
        // Try to resolve: could be a Yahoo symbol or Binance symbol
        const binanceSymbol = YAHOO_TO_BINANCE[normalized] || (BINANCE_TO_YAHOO[normalized] ? normalized : null)
        const yahooSymbol = binanceSymbol ? BINANCE_TO_YAHOO[binanceSymbol] : null

        if (yahooSymbol && binanceSymbol) {
          subs.add(yahooSymbol)
          subs.add(binanceSymbol)
        } else {
          // Store as-is, let the client handle unknown symbols
          subs.add(sym)
        }
      }

      clientSubscriptions.set(socket.id, subs)
      log(`Client ${socket.id} subscribed to: ${symbols.join(', ')} (total subs: ${subs.size})`)

      // Send latest cached prices for newly subscribed symbols
      const relevantPrices: CryptoPrice[] = []
      for (const sym of symbols) {
        const normalized = sym.toUpperCase()
        const cachedPrice = priceCache.get(normalized)
        if (cachedPrice) {
          relevantPrices.push(cachedPrice)
        } else {
          // Try as Yahoo symbol
          const binanceSym = YAHOO_TO_BINANCE[normalized]
          if (binanceSym && priceCache.has(binanceSym)) {
            relevantPrices.push(priceCache.get(binanceSym)!)
          }
        }
      }
      if (relevantPrices.length > 0) {
        socket.emit('crypto-snapshot', relevantPrices)
      }
    } catch (err) {
      logError(`Error handling subscribe from ${socket.id}`, err)
    }
  })

  // Handle unsubscribe event
  socket.on('unsubscribe', (symbols: string[]) => {
    try {
      const subs = clientSubscriptions.get(socket.id)
      if (!subs) return

      for (const sym of symbols) {
        const normalized = sym.toUpperCase()
        subs.delete(normalized)
        // Also remove the mapped symbol
        const binanceSymbol = YAHOO_TO_BINANCE[normalized]
        if (binanceSymbol) {
          subs.delete(binanceSymbol)
          const yahooSymbol = BINANCE_TO_YAHOO[binanceSymbol]
          if (yahooSymbol) subs.delete(yahooSymbol)
        }
        const yahooSymbol = BINANCE_TO_YAHOO[normalized]
        if (yahooSymbol) {
          subs.delete(yahooSymbol)
          const binSym = YAHOO_TO_BINANCE[yahooSymbol]
          if (binSym) subs.delete(binSym)
        }
      }

      log(`Client ${socket.id} unsubscribed from: ${symbols.join(', ')} (remaining subs: ${subs.size})`)
    } catch (err) {
      logError(`Error handling unsubscribe from ${socket.id}`, err)
    }
  })

  // Handle disconnect
  socket.on('disconnect', (reason) => {
    log(`Client disconnected: ${socket.id} (reason: ${reason}, remaining: ${io.sockets.sockets.size})`)
    clientSubscriptions.delete(socket.id)
  })

  // Handle errors
  socket.on('error', (error) => {
    logError(`Socket error (${socket.id})`, error)
  })
})

// ============================================================
// Logging
// ============================================================

function log(message: string) {
  console.log(`${LOG_PREFIX} ${new Date().toISOString()} ${message}`)
}

function logError(message: string, error: any) {
  console.error(`${LOG_PREFIX} ${new Date().toISOString()} ${message}`, error instanceof Error ? error.message : String(error))
}

// ============================================================
// Graceful Shutdown
// ============================================================

function shutdown() {
  log('Shutting down...')
  isShuttingDown = true

  disconnectBinance()

  io.disconnectSockets()
  io.close()

  httpServer.close(() => {
    log('Server closed')
    process.exit(0)
  })

  // Force exit after 5s if graceful shutdown hangs
  setTimeout(() => {
    log('Forcing shutdown after timeout')
    process.exit(1)
  }, 5000)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

// ============================================================
// Start Server
// ============================================================

httpServer.listen(PORT, () => {
  log(`Crypto Stream server running on port ${PORT}`)
  log(`Supporting ${STREAM_SYMBOLS.length} crypto pairs: ${STREAM_SYMBOLS.slice(0, 5).join(', ')}... and ${STREAM_SYMBOLS.length - 5} more`)

  // Connect to Binance
  connectBinance()
})
