'use client';

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp, TrendingDown, Maximize2, Minimize2,
  ZoomIn, ZoomOut, RotateCcw, Crosshair, Activity, AlertTriangle, RefreshCw
} from 'lucide-react';
// Type-only imports — erased at runtime, safe for SSR
import type {
  IChartApi,
  ISeriesApi,
  Time,
  CandlestickData,
  HistogramData,
  MouseEventParams,
} from 'lightweight-charts';
import { Instrument, AIAnalysis, HistoryDataPoint, formatPrice } from './types';

export interface TimeframeConfig {
  label: string;
  value: string;
  apiInterval: string;
  limit: number;
  isDaily: boolean;
}

export const TIMEFRAMES: TimeframeConfig[] = [
  { label: 'M1',  value: '1m',  apiInterval: '1m',  limit: 120,  isDaily: false },
  { label: 'M5',  value: '5m',  apiInterval: '5m',  limit: 144,  isDaily: false },
  { label: 'M15', value: '15m', apiInterval: '15m', limit: 96,   isDaily: false },
  { label: 'M30', value: '30m', apiInterval: '30m', limit: 96,   isDaily: false },
  { label: 'H1',  value: '1h',  apiInterval: '1h',  limit: 168,  isDaily: false },
  { label: 'H4',  value: '4h',  apiInterval: '1h',  limit: 672,  isDaily: false },
  { label: '1D',  value: '1d',  apiInterval: '1d',  limit: 180,  isDaily: true  },
];

export const DEFAULT_TIMEFRAME = '1d';

interface MainChartProps {
  instrument: Instrument | null;
  historyData: HistoryDataPoint[];
  aiAnalysis: AIAnalysis | null;
  loadingHistory: boolean;
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  onRefresh?: () => void;
  reloadKey?: number;
}

// Aggregate 1h candles into 4h candles
// Uses UTC hours for consistent bucketing across timezones (crypto trades 24/7)
function aggregateTo4h(data: HistoryDataPoint[]): HistoryDataPoint[] {
  if (data.length === 0) return [];
  const result: HistoryDataPoint[] = [];
  let group: HistoryDataPoint[] = [];

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const d = new Date(item.date);
    if (isNaN(d.getTime())) continue;

    // Use UTC hours for consistent bucketing (important for crypto which trades 24/7)
    const hourBucket = Math.floor(d.getUTCHours() / 4) * 4;
    group.push(item);

    const nextItem = data[i + 1];
    let isLastInBucket = false;

    if (!nextItem) {
      isLastInBucket = true;
    } else {
      const nextD = new Date(nextItem.date);
      if (!isNaN(nextD.getTime())) {
        const nextHourBucket = Math.floor(nextD.getUTCHours() / 4) * 4;
        // Also check if the date changed (UTC date)
        const currentDateStr = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
        const nextDateStr = `${nextD.getUTCFullYear()}-${nextD.getUTCMonth()}-${nextD.getUTCDate()}`;
        if (nextHourBucket !== hourBucket || nextDateStr !== currentDateStr) {
          isLastInBucket = true;
        }
      } else {
        isLastInBucket = true;
      }
    }

    if (isLastInBucket && group.length > 0) {
      result.push({
        date: group[0].date,
        open: group[0].open,
        high: Math.max(...group.map(g => g.high)),
        low: Math.min(...group.map(g => g.low)),
        close: group[group.length - 1].close,
        volume: group.reduce((sum, g) => sum + (g.volume || 0), 0),
      });
      group = [];
    }
  }

  return result;
}

// Convert date string to TradingView Time format
// For daily data: use 'yyyy-MM-dd' string to avoid timezone shifting issues
// For intraday data: use Unix timestamp in seconds
function dateToTime(dateStr: string, isDaily: boolean): Time | null {
  try {
    if (isDaily) {
      // For daily candles, extract just the date portion to avoid timezone issues
      // Yahoo Finance returns daily data with timezone-adjusted timestamps (e.g., 23:00 UTC for London)
      // Using date string ensures the candle appears on the correct calendar date
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) {
        // Try as plain date string
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          return dateStr as Time;
        }
        return null;
      }
      // Format as YYYY-MM-DD in UTC to match TradingView's daily date axis
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}` as Time;
    }
    // For intraday data, use Unix timestamp for precise time positioning
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.getTime() / 1000 as Time;
  } catch {
    return null;
  }
}

export function MainChart({ instrument, historyData, aiAnalysis, loadingHistory, timeframe, onTimeframeChange, onRefresh, reloadKey }: MainChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const priceLinesRef = useRef<any[]>([]);
  const markersRef = useRef<any[]>([]);
  const prevInstrumentRef = useRef<string | null>(null);
  const prevReloadKeyRef = useRef<number>(0);

  // Track chart initialization state
  const [chartReady, setChartReady] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);

  // Keep a ref to the latest chartLineData so the async init can use it
  const chartLineDataRef = useRef<any[]>([]);

  // Keep a ref to the latest volumeData so the async init can use it
  const volumeDataRef = useRef<HistogramData<Time>[]>([]);

  // Track previous chartLineData to detect incremental vs full changes
  const prevChartDataRef = useRef<CandlestickData<Time>[]>([]);
  // Track last instrument symbol that was successfully fed to the chart
  const lastChartedSymbolRef = useRef<string | null>(null);

  // Track the last candle's raw data for direct series.update() on live price changes.
  // This bypasses the chartLineData useMemo pipeline entirely for last-candle updates,
  // which is the official TradingView recommended approach for real-time data.
  // Key: store { time, open, high, low, close } of the last candle we've pushed to the series.
  const lastCandleRef = useRef<CandlestickData<Time> | null>(null);

  const [hoveredPrice, setHoveredPrice] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [crosshairMode, setCrosshairMode] = useState<number>(0); // 0 = Normal, 1 = Magnet

  const currentTf = TIMEFRAMES.find(t => t.value === timeframe) || TIMEFRAMES[TIMEFRAMES.length - 1];

  // Process data for the chart
  const processedData = timeframe === '4h' ? aggregateTo4h(historyData) : historyData;

  // Initialize chart — uses DYNAMIC IMPORT to avoid SSR issues on Netlify
  useEffect(() => {
    let cancelled = false;
    let cleanupFn: (() => void) | null = null;

    const initChart = async (attempt = 0): Promise<void> => {
      try {
        // Dynamic import — only loads on the client, safe for SSR/Netlify
        const { createChart, ColorType, CrosshairMode, LineStyle, CandlestickSeries, HistogramSeries } = await import('lightweight-charts');

        if (cancelled || !chartContainerRef.current) return;

        const container = chartContainerRef.current;

        // Robustness: wait for container to have proper dimensions
        // On Netlify, the container might have 0 dimensions on first render
        if (container.clientWidth === 0 || container.clientHeight === 0) {
          if (attempt < 10) {
            await new Promise(r => setTimeout(r, 200));
            return initChart(attempt + 1);
          }
          console.warn('[Chart] Container has 0 dimensions after 10 retries, creating with fallback size');
        }

        const chartWidth = container.clientWidth || 800;
        const chartHeight = container.clientHeight || 400;

        const chart = createChart(container, {
          layout: {
            background: { type: ColorType.Solid, color: '#0a0e17' },
            textColor: '#4a5568',
            fontSize: 11,
            fontFamily: "'Inter', -apple-system, sans-serif",
          },
          grid: {
            vertLines: { color: '#1a1f2e15', style: LineStyle.Dotted },
            horzLines: { color: '#1a1f2e15', style: LineStyle.Dotted },
          },
          crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: {
              color: '#22d3ee40',
              width: 1,
              style: LineStyle.Dashed,
              labelBackgroundColor: '#1e293b',
            },
            horzLine: {
              color: '#22d3ee40',
              width: 1,
              style: LineStyle.Dashed,
              labelBackgroundColor: '#1e293b',
            },
          },
          rightPriceScale: {
            borderColor: '#1a1f2e40',
            scaleMargins: { top: 0.1, bottom: 0.2 },
            textColor: '#64748b',
            autoScale: true,
            alignLabels: true,
            borderVisible: true,
            entireTextOnly: false,
          },
          leftPriceScale: {
            visible: false,
          },
          timeScale: {
            borderColor: '#1a1f2e40',
            timeVisible: !currentTf.isDaily,
            secondsVisible: false,
            fixLeftEdge: false,
            fixRightEdge: false,
            borderVisible: true,
            rightOffset: 12,
            minBarSpacing: 2,
            visible: true,
          },
          handleScroll: {
            mouseWheel: true,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: false,
          },
          handleScale: {
            axisPressedMouseMove: true,
            mouseWheel: true,
            pinch: true,
            axisDoubleClickReset: true,
          },
          width: chartWidth,
          height: chartHeight,
        });

        if (cancelled) { chart.remove(); return; }
        chartRef.current = chart;

        // Main price series — CandlestickSeries for proper OHLC bars
        // Colors: white for up (bullish/buy), red for down (bearish/sell)
        const priceSeries = chart.addSeries(CandlestickSeries, {
          upColor: '#ffffff',
          downColor: '#ef5350',
          borderUpColor: '#ffffff',
          borderDownColor: '#ef5350',
          wickUpColor: '#ffffff',
          wickDownColor: '#ef5350',
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 4,
          crosshairMarkerBorderColor: '#22d3ee',
          crosshairMarkerBackgroundColor: '#0a0e17',
          priceLineVisible: true,
          lastValueVisible: true,
        });
        priceSeriesRef.current = priceSeries;

        // Volume histogram series — shows trading volume at the bottom ~20% of the chart
        const volumeSeries = chart.addSeries(HistogramSeries, {
          priceFormat: { type: 'volume' },
          priceScaleId: 'volume',
          priceLineVisible: false,
          lastValueVisible: false,
        });
        volumeSeriesRef.current = volumeSeries;

        // Configure the volume price scale — occupies bottom 20% of chart, axis labels hidden
        chart.priceScale('volume').applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
          visible: false,
        });

        // Crosshair move handler
        chart.subscribeCrosshairMove((param: MouseEventParams<Time>) => {
          if (param.time && param.seriesData) {
            const candleData = param.seriesData.get(priceSeries) as CandlestickData<Time> | undefined;
            if (candleData) {
              setHoveredPrice(candleData.close);
            }
          } else {
            setHoveredPrice(null);
          }
        });

        // Resize observer
        const observer = new ResizeObserver(entries => {
          for (const entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) {
              chart.applyOptions({ width, height });
            }
          }
        });
        observer.observe(container);
        resizeObserverRef.current = observer;

        // If data was already loaded before chart was ready, apply it now
        if (chartLineDataRef.current.length >= 2) {
          try {
            priceSeries.setData(chartLineDataRef.current);
            chart.timeScale().fitContent();
          } catch (err) {
            console.error('[Chart] Error setting data after init:', err);
          }
        }
        if (volumeDataRef.current.length >= 2) {
          try {
            volumeSeries.setData(volumeDataRef.current);
          } catch (err) {
            console.error('[Chart] Error setting volume data after init:', err);
          }
        }

        setChartReady(true);
        setChartError(null);

        // Store cleanup function
        cleanupFn = () => {
          observer.disconnect();
          try { chart.remove(); } catch {}
          chartRef.current = null;
          priceSeriesRef.current = null;
          volumeSeriesRef.current = null;
          resizeObserverRef.current = null;
          setChartReady(false);
        };
      } catch (err: any) {
        if (!cancelled) {
          console.error('[Chart] Failed to initialize:', err);
          setChartError('Erro ao carregar gráfico. Recarregue a página.');
          setChartReady(false);
        }
      }
    };

    initChart();

    return () => {
      cancelled = true;
      if (cleanupFn) cleanupFn();
    };
  }, []);

  // Pre-compute valid candlestick data from processedData
  const chartLineData = useMemo(() => {
    if (processedData.length === 0) return [];

    const data: CandlestickData<Time>[] = [];
    let skippedDates = 0;

    for (const item of processedData) {
      const time = dateToTime(item.date, currentTf.isDaily);
      if (time === null) {
        skippedDates++;
        continue;
      }
      // Use full OHLC data for candlestick chart
      data.push({
        time,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      });
    }

    if (skippedDates > 0 && skippedDates === processedData.length) {
      console.warn(`[Chart] All ${processedData.length} dates failed to parse. First date: "${processedData[0]?.date}"`);
    }

    // Sort by time (works for both string dates and numeric timestamps)
    data.sort((a, b) => {
      const aTime = typeof a.time === 'string' ? a.time : (a.time as number);
      const bTime = typeof b.time === 'string' ? b.time : (b.time as number);
      if (typeof aTime === 'string' && typeof bTime === 'string') {
        return aTime < bTime ? -1 : aTime > bTime ? 1 : 0;
      }
      return (aTime as number) - (bTime as number);
    });

    // Remove duplicates (same timestamp)
    const unique: CandlestickData<Time>[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i === 0 || data[i].time !== data[i-1].time) {
        unique.push(data[i]);
      }
    }

    // Client-side spike filter: remove candles with unreasonable price jumps
    // Uses lenient thresholds to avoid filtering valid volatile candles (news events, etc.)
    // that TradingView would show normally. Backend now also uses 15x/30x thresholds.
    if (unique.length >= 5) {
      const ranges = unique.map(d => (d.high - d.low)).filter(r => r > 0);
      if (ranges.length > 0) {
        const sortedRanges = [...ranges].sort((a, b) => a - b);
        const medianRange = sortedRanges[Math.floor(sortedRanges.length / 2)];

        if (medianRange > 0) {
          // Calculate median close-to-close percentage change
          const pctChanges: number[] = [];
          for (let i = 1; i < unique.length; i++) {
            const prevClose = unique[i - 1].close;
            const currClose = unique[i].close;
            if (prevClose > 0) {
              pctChanges.push(Math.abs(currClose - prevClose) / prevClose);
            }
          }
          const medianPctChange = pctChanges.length > 0
            ? [...pctChanges].sort((a, b) => a - b)[Math.floor(pctChanges.length / 2)]
            : 0;

          const filtered: CandlestickData<Time>[] = [];
          for (let i = 0; i < unique.length; i++) {
            const d = unique[i];
            const range = d.high - d.low;

            // Skip candles with range > 15x median (lenient — avoids removing valid volatile candles)
            if (range > medianRange * 15) continue;

            // Skip candles with close-to-close jump > 30x median
            if (i > 0 && medianPctChange > 0) {
              const prevClose = unique[i - 1].close;
              const pctChange = Math.abs(d.close - prevClose) / prevClose;
              if (pctChange > medianPctChange * 30) continue;
            }

            // Validate OHLC consistency
            // Use small epsilon tolerance for floating-point comparison
            const eps = Math.max(d.open, d.close) * 0.0001;
            if (d.high < Math.max(d.open, d.close) - eps) continue;
            if (d.low > Math.min(d.open, d.close) + eps) continue;

            filtered.push(d);
          }

          return filtered;
        }
      }
    }

    return unique;
  }, [processedData, currentTf.isDaily]);

  // Pre-compute volume histogram data from processedData, aligned with the spike-filtered chartLineData
  const volumeData = useMemo(() => {
    if (chartLineData.length === 0 || processedData.length === 0) return [];

    // Create a set of valid times from the spike-filtered candlestick data
    // This ensures volume bars only appear for candles that passed the filter
    const validTimes = new Set(chartLineData.map(d => d.time));

    const data: HistogramData<Time>[] = [];

    for (const item of processedData) {
      const time = dateToTime(item.date, currentTf.isDaily);
      if (time === null || !validTimes.has(time)) continue;
      if (!item.volume || item.volume <= 0) continue;

      // Green for bullish (close >= open), red for bearish — muted with alpha transparency
      const isBullish = item.close >= item.open;
      data.push({
        time,
        value: item.volume,
        color: isBullish ? '#10b98140' : '#ef535040',
      });
    }

    // Sort by time (same logic as chartLineData)
    data.sort((a, b) => {
      const aTime = typeof a.time === 'string' ? a.time : (a.time as number);
      const bTime = typeof b.time === 'string' ? b.time : (b.time as number);
      if (typeof aTime === 'string' && typeof bTime === 'string') {
        return aTime < bTime ? -1 : aTime > bTime ? 1 : 0;
      }
      return (aTime as number) - (bTime as number);
    });

    return data;
  }, [chartLineData, processedData, currentTf.isDaily]);

  // Keep the refs in sync with the memos
  useEffect(() => {
    chartLineDataRef.current = chartLineData;
  }, [chartLineData]);
  useEffect(() => {
    volumeDataRef.current = volumeData;
  }, [volumeData]);

  // Detect instrument changes and clear chart for clean transition
  // Uses a flag to also force a full setData on the next data update
  // Also responds to reloadKey changes from the parent (ensures chart reloads on asset switch)
  const forceFullReloadRef = useRef(false);

  useEffect(() => {
    const currentSymbol = instrument?.symbol || null;
    const instrumentChanged = prevInstrumentRef.current !== currentSymbol;
    const reloadTriggered = reloadKey !== undefined && reloadKey !== prevReloadKeyRef.current;

    if (instrumentChanged || reloadTriggered) {
      // Instrument changed (or reload triggered) — clear series data immediately for clean transition
      if (priceSeriesRef.current) {
        try {
          priceSeriesRef.current.setData([]);
        } catch (err) {
          console.error('[Chart] Error clearing data on instrument change:', err);
        }
      }
      if (volumeSeriesRef.current) {
        try { volumeSeriesRef.current.setData([]); } catch {}
      }
      // Reset the chart line data refs so stale data doesn't persist
      chartLineDataRef.current = [];
      volumeDataRef.current = [];
      // Reset previous data tracking so next load is treated as full reload (not incremental)
      prevChartDataRef.current = [];
      // Reset last candle ref so direct update effect doesn't interfere
      lastCandleRef.current = null;
      // Set flag to force full reload on next data update
      forceFullReloadRef.current = true;
      // Reset the charted symbol so symbol change detection works correctly
      lastChartedSymbolRef.current = null;
      // Remove AI markers and price lines
      try { (priceSeriesRef.current as any)?.setMarkers?.([]); } catch {}
      for (const line of priceLinesRef.current) {
        if (line && priceSeriesRef.current) {
          try { priceSeriesRef.current.removePriceLine(line); } catch {}
        }
      }
      priceLinesRef.current = [];
      markersRef.current = [];
      // Reset chart viewport to default (scrolled to the right)
      try { chartRef.current?.timeScale()?.scrollToRealTime(); } catch {}
    }
    prevInstrumentRef.current = currentSymbol;
    if (reloadKey !== undefined) prevReloadKeyRef.current = reloadKey;
  }, [instrument?.symbol, reloadKey]);

  // Whether the chart has enough data to render (at least 2 points)
  const chartHasData = chartLineData.length >= 2;

  // Feed pre-computed data to chart when it changes
  // This effect handles FULL DATA LOADS only (initial load, instrument switch, timeframe switch).
  // Live last-candle updates are handled by the separate "DIRECT LIVE LAST-CANDLE UPDATE" effect
  // below, which uses series.update() following the official TradingView recommendation.
  //
  // CRITICAL: Do NOT use series.update() here for incremental updates. The direct update effect
  // is the single source of truth for series.update() calls. Mixing setData() and update()
  // in the same rendering cycle causes the last candle to break.
  useEffect(() => {
    if (!chartReady || !priceSeriesRef.current) return;

    const currentSymbol = instrument?.symbol || null;
    const symbolChanged = lastChartedSymbolRef.current !== null && lastChartedSymbolRef.current !== currentSymbol;

    // Always consume the forceFullReload flag, even when data is empty,
    // to prevent it from accumulating and causing stale state
    const forceFullReload = forceFullReloadRef.current;
    if (forceFullReload) {
      forceFullReloadRef.current = false;
    }

    if (chartLineData.length < 2) {
      try {
        priceSeriesRef.current.setData([]);
        prevChartDataRef.current = [];
        lastCandleRef.current = null;
        // Don't update lastChartedSymbolRef on empty data — keep tracking the last charted symbol
      } catch (err) {
        console.error('Chart clear error:', err);
      }
      return;
    }

    // If the symbol changed or forceFullReload is set, always do a full setData()
    if (forceFullReload || symbolChanged) {
      try {
        priceSeriesRef.current.setData(chartLineData);
        chartRef.current?.timeScale().fitContent();
        lastCandleRef.current = chartLineData.length > 0 ? chartLineData[chartLineData.length - 1] : null;
        lastChartedSymbolRef.current = currentSymbol;
      } catch (err) {
        console.error('Chart data error (forced reload):', err);
      }
      prevChartDataRef.current = chartLineData;
      return;
    }

    const prevData = prevChartDataRef.current;
    const prevWasEmpty = prevData.length < 2;

    // Determine if this is a full data change or just an incremental last-candle update
    const lengthDiff = chartLineData.length - prevData.length;
    const lastTimeIsSameOrNewer = chartLineData.length > 0 && prevData.length > 0 &&
      chartLineData[chartLineData.length - 1].time >= prevData[prevData.length - 1].time;

    const overlapCount = Math.min(chartLineData.length, prevData.length);
    const prevTimesMatch = prevWasEmpty || (
      (lengthDiff === 0
        ? chartLineData.slice(0, -1).every((item, idx) => item.time === prevData[idx].time)
        : chartLineData.slice(0, overlapCount).every((item, idx) => item.time === prevData[idx].time)
      )
    );

    const isIncrementalUpdate =
      !prevWasEmpty &&
      (lengthDiff === 0 || lengthDiff === 1) &&
      lastTimeIsSameOrNewer &&
      prevTimesMatch;

    // For incremental updates, just update the ref — the direct update effect handles series.update()
    if (isIncrementalUpdate) {
      prevChartDataRef.current = chartLineData;
      lastCandleRef.current = chartLineData.length > 0 ? chartLineData[chartLineData.length - 1] : null;
      return; // SKIP — the direct update effect handles this
    }

    // Full data change (instrument switch, timeframe change, initial load) — use setData()
    try {
      priceSeriesRef.current.setData(chartLineData);
      chartRef.current?.timeScale().fitContent();
      lastCandleRef.current = chartLineData.length > 0 ? chartLineData[chartLineData.length - 1] : null;
      lastChartedSymbolRef.current = currentSymbol;
    } catch (err) {
      console.error('Chart data error:', err);
    }

    prevChartDataRef.current = chartLineData;
  }, [chartLineData, chartReady, instrument?.symbol]);

  // Feed volume histogram data to the volume series
  // Uses setData() for all updates — volume bars don't have the "last candle breaking" issue
  // that candlestick series has, so setData() is safe and simpler than incremental updates.
  useEffect(() => {
    if (!chartReady || !volumeSeriesRef.current) return;
    if (forceFullReloadRef.current) return; // Don't interfere with pending full reload

    try {
      volumeSeriesRef.current.setData(volumeData.length >= 2 ? volumeData : []);
    } catch (err) {
      console.error('Volume data error:', err);
    }
  }, [volumeData, chartReady]);

  // ========== DIRECT LIVE LAST-CANDLE UPDATE ==========
  // This is the PRIMARY mechanism for real-time price updates.
  // It watches `processedData` for last-candle changes and directly calls series.update()
  // on the chart series, completely bypassing the chartLineData useMemo pipeline.
  // This follows the official TradingView pattern:
  //   https://tradingview.github.io/lightweight-charts/tutorials/demos/realtime-updates
  //
  // Why this is needed: The chartLineData useMemo recomputes on every processedData change,
  // which can cause setData() to be called instead of update() due to spike filter changes,
  // array length differences, or race conditions. setData() causes the last candle to
  // "break" (appear as a vertical line/wick without a body).
  useEffect(() => {
    if (!chartReady || !priceSeriesRef.current) return;
    if (processedData.length === 0) return;
    if (forceFullReloadRef.current) return; // Don't interfere with pending full reload

    const lastRaw = processedData[processedData.length - 1];
    const time = dateToTime(lastRaw.date, currentTf.isDaily);
    if (time === null) return;

    // Construct the candle data point
    const candle: CandlestickData<Time> = {
      time,
      open: lastRaw.open,
      high: lastRaw.high,
      low: lastRaw.low,
      close: lastRaw.close,
    };

    // Validate OHLC consistency (skip if invalid)
    const eps = Math.max(candle.open, candle.close) * 0.0001;
    if (candle.high < Math.max(candle.open, candle.close) - eps) return;
    if (candle.low > Math.min(candle.open, candle.close) + eps) return;

    const prev = lastCandleRef.current;

    // If we have no previous candle, this is likely an initial load — skip,
    // the chartLineData effect will handle it via setData()
    if (!prev) return;

    // If the time changed, this might be a new candle period.
    // Only use update() if the time is the same (updating current candle)
    // or newer (new candle period started).
    if (time < prev.time) return; // Data went backwards, skip — let chartLineData handle it

    // If the time is the same AND all OHLC values are the same, nothing to update
    if (time === prev.time &&
        candle.open === prev.open &&
        candle.high === prev.high &&
        candle.low === prev.low &&
        candle.close === prev.close) {
      return;
    }

    // If the time changed (new candle period), only update if we haven't already
    // pushed this new candle via the chartLineData effect
    if (time !== prev.time) {
      // Check if the chartLineData effect already pushed this new candle
      const currentChartData = prevChartDataRef.current;
      if (currentChartData.length > 0 && currentChartData[currentChartData.length - 1].time === time) {
        // Already pushed via chartLineData, just update the ref
        lastCandleRef.current = candle;
        return;
      }
    }

    // Directly update the series — this is the TradingView-recommended way
    // to handle real-time data updates without re-rendering the entire chart.
    try {
      priceSeriesRef.current.update(candle);
      lastCandleRef.current = candle;
    } catch (err) {
      // Silently fail — the chartLineData effect will handle it on next full update
    }

    // Also update the volume histogram for the last bar
    if (volumeSeriesRef.current && lastRaw.volume > 0) {
      const isBullish = lastRaw.close >= lastRaw.open;
      try {
        volumeSeriesRef.current.update({
          time,
          value: lastRaw.volume,
          color: isBullish ? '#10b98140' : '#ef535040',
        });
      } catch {
        // Silently fail — the volumeData effect will handle it on next full update
      }
    }
  }, [processedData, chartReady, currentTf.isDaily]);

  // Update time scale options when timeframe changes
  // Also force a full data reload since the data format changes (daily vs intraday)
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      timeScale: {
        timeVisible: !currentTf.isDaily,
        secondsVisible: false,
      },
    });
    // Force full reload on timeframe change since data format changes
    forceFullReloadRef.current = true;
  }, [currentTf.isDaily, timeframe]);

  // Add AI analysis markers: Entry, Stop Loss, Gain, Support/Resistance zones
  // IMPORTANT: Do NOT include processedData in the dependency array!
  // Including it caused this effect to re-run every 5 seconds on live price updates,
  // which called fitContent() and interfered with series.update(), breaking the last candle.
  useEffect(() => {
    if (!chartReady || !priceSeriesRef.current) return;

    // Remove existing price lines
    for (const line of priceLinesRef.current) {
      if (line && priceSeriesRef.current) {
        try { priceSeriesRef.current.removePriceLine(line); } catch {}
      }
    }
    priceLinesRef.current = [];

    // Remove existing markers
    try { (priceSeriesRef.current as any).setMarkers?.([]); } catch {}
    markersRef.current = [];

    if (!aiAnalysis) return;

    // Dynamic import for LineStyle enum
    import('lightweight-charts').then(({ LineStyle }) => {
      if (!priceSeriesRef.current) return;

      const sym = instrument?.symbol || '';
      const isBuy = aiAnalysis.direction === 'BUY';
      const isSell = aiAnalysis.direction === 'SELL';

      const priceLines: any[] = [];

      // ========== ENTRY POINT (most prominent — cyan, thick) ==========
      const entryPrice = isBuy ? aiAnalysis.tradePoints?.buyPoint : isSell ? aiAnalysis.tradePoints?.sellPoint : 0;
      if (entryPrice > 0) {
        priceLines.push({
          price: entryPrice,
          color: '#22d3ee',
          lineWidth: 3,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `  🎯 ENTRADA: ${formatPrice(entryPrice, sym)}`,
        });
      }

      // ========== STOP LOSS (prominent red) ==========
      const slPrice = isBuy ? aiAnalysis.tradePoints?.stopLossBuy : isSell ? aiAnalysis.tradePoints?.stopLossSell : 0;
      if (slPrice > 0) {
        priceLines.push({
          price: slPrice,
          color: '#ef4444',
          lineWidth: 3,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `  🛑 STOP: ${formatPrice(slPrice, sym)}`,
        });
      }

      // ========== TAKE PROFIT (prominent green) ==========
      const tpPrice = isBuy ? aiAnalysis.tradePoints?.takeProfitBuy : isSell ? aiAnalysis.tradePoints?.takeProfitSell : 0;
      if (tpPrice > 0) {
        priceLines.push({
          price: tpPrice,
          color: '#10b981',
          lineWidth: 3,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `  ✅ GANHO: ${formatPrice(tpPrice, sym)}`,
        });
      }

      // ========== SUPPORT/RESISTANCE from keyLevels ==========
      if (aiAnalysis.keyLevels?.resistance > 0) {
        priceLines.push({
          price: aiAnalysis.keyLevels.resistance,
          color: '#ef444460',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `  RES: ${formatPrice(aiAnalysis.keyLevels.resistance, sym)}`,
        });
      }

      if (aiAnalysis.keyLevels?.support > 0) {
        priceLines.push({
          price: aiAnalysis.keyLevels.support,
          color: '#10b98160',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `  SUP: ${formatPrice(aiAnalysis.keyLevels.support, sym)}`,
        });
      }

      if (aiAnalysis.keyLevels?.pivot > 0) {
        priceLines.push({
          price: aiAnalysis.keyLevels.pivot,
          color: '#f59e0b40',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: false,
          title: `  PIVÔ`,
        });
      }

      // ========== RISK ZONE — invisible lines to shade the zone ==========
      if (entryPrice > 0 && slPrice > 0) {
        const riskMid = (entryPrice + slPrice) / 2;
        priceLines.push({ price: riskMid, color: '#ef444415', lineWidth: 0, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: '' });
      }

      if (entryPrice > 0 && tpPrice > 0) {
        const rewardMid = (entryPrice + tpPrice) / 2;
        priceLines.push({ price: rewardMid, color: '#10b98115', lineWidth: 0, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: '' });
      }

      // ========== Opposite direction (faded) ==========
      if (isBuy && aiAnalysis.tradePoints?.sellPoint > 0) {
        priceLines.push({ price: aiAnalysis.tradePoints.sellPoint, color: '#ef444430', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: 'Venda' });
      }
      if (isSell && aiAnalysis.tradePoints?.buyPoint > 0) {
        priceLines.push({ price: aiAnalysis.tradePoints.buyPoint, color: '#10b98130', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: 'Compra' });
      }
      if (isBuy && aiAnalysis.tradePoints?.stopLossSell > 0) {
        priceLines.push({ price: aiAnalysis.tradePoints.stopLossSell, color: '#ef444420', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: '' });
      }
      if (isSell && aiAnalysis.tradePoints?.stopLossBuy > 0) {
        priceLines.push({ price: aiAnalysis.tradePoints.stopLossBuy, color: '#ef444420', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: '' });
      }
      if (isBuy && aiAnalysis.tradePoints?.takeProfitSell > 0) {
        priceLines.push({ price: aiAnalysis.tradePoints.takeProfitSell, color: '#10b98120', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: '' });
      }
      if (isSell && aiAnalysis.tradePoints?.takeProfitBuy > 0) {
        priceLines.push({ price: aiAnalysis.tradePoints.takeProfitBuy, color: '#10b98120', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: '' });
      }

      const createdLines = priceLines.map(pl => priceSeriesRef.current?.createPriceLine(pl));
      priceLinesRef.current = createdLines;

      // Add prominent markers at last data point — use chartLineDataRef for the time
      // (NOT processedData, to avoid re-running this effect on every live price update)
      const currentChartData = chartLineDataRef.current;
      if (currentChartData.length > 0 && (isBuy || isSell)) {
        const lastTime = currentChartData[currentChartData.length - 1].time;
        if (lastTime) {
          try {
            (priceSeriesRef.current as any).setMarkers?.([
              {
                time: lastTime,
                position: isBuy ? 'belowBar' : 'aboveBar',
                color: isBuy ? '#10b981' : '#ef4444',
                shape: isBuy ? 'arrowUp' : 'arrowDown',
                text: isBuy ? '▲ COMPRA' : '▼ VENDA',
              },
            ]);
          } catch {}
        }
      }

      // Only fitContent on initial marker placement — NOT on every live update
      // This prevents the chart from relayouting and breaking the last candle
      setTimeout(() => {
        chartRef.current?.timeScale().fitContent();
      }, 100);
    }).catch(err => {
      console.error('[Chart] Failed to add AI markers:', err);
    });
  }, [aiAnalysis, instrument?.symbol, chartReady]);

  // Last price info
  const lastClose = processedData.length > 0 ? processedData[processedData.length - 1]?.close : 0;
  const prevClose = processedData.length > 1 ? processedData[processedData.length - 2]?.close : 0;
  const priceChange = lastClose - prevClose;
  const isPositive = priceChange >= 0;

  const displayPrice = hoveredPrice || lastClose;

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
    setTimeout(() => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    }, 100);
  }, []);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (!chartRef.current) return;
    const ts = chartRef.current.timeScale();
    const range = ts.getVisibleLogicalRange();
    if (!range) return;
    const barCount = range.to - range.from;
    const center = (range.from + range.to) / 2;
    const newBarCount = barCount * 0.7;
    ts.setVisibleLogicalRange({
      from: center - newBarCount / 2,
      to: center + newBarCount / 2,
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!chartRef.current) return;
    const ts = chartRef.current.timeScale();
    const range = ts.getVisibleLogicalRange();
    if (!range) return;
    const barCount = range.to - range.from;
    const center = (range.from + range.to) / 2;
    const newBarCount = barCount * 1.4;
    ts.setVisibleLogicalRange({
      from: center - newBarCount / 2,
      to: center + newBarCount / 2,
    });
  }, []);

  const handleResetView = useCallback(() => {
    if (!chartRef.current) return;
    chartRef.current.timeScale().fitContent();
  }, []);

  const toggleCrosshair = useCallback(() => {
    import('lightweight-charts').then(({ CrosshairMode }) => {
      const newMode = crosshairMode === 0 ? CrosshairMode.Magnet : CrosshairMode.Normal;
      setCrosshairMode(newMode === CrosshairMode.Normal ? 0 : 1);
      if (chartRef.current) {
        chartRef.current.applyOptions({
          crosshair: { mode: newMode },
        });
      }
    });
  }, [crosshairMode]);

  // Compute current price change for the last close
  const priceChangePercent = prevClose > 0 ? ((priceChange / prevClose) * 100).toFixed(2) : '0.00';

  const chartHeight = isFullscreen ? 'h-[calc(100vh-80px)]' : 'h-[650px]';

  // Determine if AI analysis is active
  const hasAI = !!aiAnalysis;
  const isBuy = aiAnalysis?.direction === 'BUY';
  const isSell = aiAnalysis?.direction === 'SELL';

  return (
    <Card className={`border-border/40 bg-card/80 backdrop-blur-sm ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''}`}>
      <CardHeader className="pb-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {/* Instrument Info */}
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold">{instrument?.name || 'Selecione'}</span>
            </CardTitle>

            {displayPrice > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-base font-bold text-foreground">
                  {formatPrice(displayPrice, instrument?.symbol || '')}
                </span>
                {!hoveredPrice && lastClose > 0 && (
                  <span className={`font-mono text-xs font-semibold flex items-center gap-0.5 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {isPositive ? '+' : ''}{priceChange.toFixed(prevClose >= 100 ? 2 : prevClose >= 1 ? 4 : 6)}
                    ({isPositive ? '+' : ''}{priceChangePercent}%)
                  </span>
                )}
              </div>
            )}

            <Badge variant="outline" className="text-[10px] border-border/50 font-mono">
              {instrument?.symbol}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {/* Timeframe selector */}
            <div className="flex items-center gap-0 bg-secondary/50 rounded-md p-0.5">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.value}
                  className={`px-2 py-1 rounded text-[10px] font-semibold transition-all ${
                    timeframe === tf.value
                      ? 'bg-cyan-500/20 text-cyan-400 shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                  }`}
                  onClick={() => onTimeframeChange(tf.value)}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            {/* Chart controls */}
            <div className="flex items-center gap-0.5 bg-secondary/50 rounded-md p-0.5">
              <button
                onClick={() => onRefresh?.()}
                className="p-1 rounded text-muted-foreground hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                title="Recarregar dados"
                disabled={loadingHistory}
              >
                <RefreshCw className={`w-3 h-3 ${loadingHistory ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={toggleCrosshair}
                className={`p-1 rounded transition-colors ${
                  crosshairMode === 1 ? 'text-cyan-400 bg-cyan-500/15' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                }`}
                title="Crosshair mode"
              >
                <Crosshair className="w-3 h-3" />
              </button>
              <button onClick={handleZoomIn} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors" title="Zoom in">
                <ZoomIn className="w-3 h-3" />
              </button>
              <button onClick={handleZoomOut} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors" title="Zoom out">
                <ZoomOut className="w-3 h-3" />
              </button>
              <button onClick={handleResetView} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors" title="Reset view">
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>

            {/* Fullscreen toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
              title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* AI Legend — only shows after analysis */}
        {hasAI && (
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <Badge className={`text-[10px] font-bold px-2 py-0.5 ${
              isBuy ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
              isSell ? 'bg-red-500/20 text-red-400 border-red-500/30' :
              'bg-amber-500/20 text-amber-400 border-amber-500/30'
            }`}>
              {isBuy ? '↗ COMPRA' : isSell ? '↘ VENDA' : '— ESPERAR'}
            </Badge>

            <div className="flex items-center gap-1">
              <div className="w-4 h-0.5 rounded" style={{ borderTop: '2px dashed #22d3ee' }} />
              <span className="text-[9px] font-mono text-cyan-400">Entrada</span>
            </div>

            <div className="flex items-center gap-1">
              <div className="w-4 h-0.5 rounded" style={{ borderTop: '2px dashed #ef4444' }} />
              <span className="text-[9px] font-mono text-red-400">Stop Loss</span>
            </div>

            <div className="flex items-center gap-1">
              <div className="w-4 h-0.5 rounded" style={{ borderTop: '2px dashed #10b981' }} />
              <span className="text-[9px] font-mono text-emerald-400">Take Profit</span>
            </div>

            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 bg-red-400/60 rounded" style={{ borderTop: '1px dashed #ef444460' }} />
              <span className="text-[9px] font-mono text-red-400/60">Resistência</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 bg-emerald-400/60 rounded" style={{ borderTop: '1px dashed #10b98160' }} />
              <span className="text-[9px] font-mono text-emerald-400/60">Suporte</span>
            </div>

            <span className="text-[9px] text-amber-400 font-mono">R:R {aiAnalysis.riskReward?.ratio || '—'}</span>

            <div className="flex-1" />
            <span className="text-[9px] text-muted-foreground/50 hidden sm:inline">
              Scroll = Zoom · Arraste = Mover
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0 relative">
        {/* Loading overlay */}
        {loadingHistory && (
          <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#0a0e17]/80 backdrop-blur-sm ${chartHeight}`}>
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-muted-foreground">
              Carregando {instrument?.name || 'dados'} ({currentTf.label})...
            </span>
          </div>
        )}

        {/* Chart initialization error */}
        {!loadingHistory && chartError && (
          <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#0a0e17]/90 ${chartHeight}`}>
            <AlertTriangle className="w-10 h-10 text-red-400/50" />
            <p className="text-sm text-red-400">{chartError}</p>
            <p className="text-[10px] text-muted-foreground/70">Recarregue a página (F5) para tentar novamente</p>
          </div>
        )}

        {/* No data message */}
        {!loadingHistory && !chartError && !chartHasData && (
          <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#0a0e17]/90 ${chartHeight}`}>
            <Activity className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Sem dados para {currentTf.label}</p>
            <p className="text-xs text-muted-foreground/70">Tente H1 ou 1D para dados mais completos</p>
            <p className="text-[10px] text-muted-foreground/50">Se o problema persistir, aguarde alguns segundos e tente novamente</p>
          </div>
        )}

        {/* Watermark */}
        {instrument && chartHasData && (
          <div className={`absolute inset-0 z-0 pointer-events-none flex items-center justify-center ${chartHeight}`}>
            <div className="text-[52px] font-bold text-muted-foreground/[0.03] select-none tracking-wider">
              {instrument.name}
            </div>
          </div>
        )}

        {/* Chart container */}
        <div
          ref={chartContainerRef}
          className={chartHeight}
        />

        {/* AI Overlay Info Box — bottom left after analysis */}
        {hasAI && (isBuy || isSell) && (
          <div className="absolute bottom-4 left-4 z-20 bg-[#0a0e17]/90 backdrop-blur-md rounded-lg border border-border/40 p-3 min-w-[140px] sm:min-w-[180px]">
            <div className="flex items-center gap-1.5 mb-2">
              <div className={`w-2 h-2 rounded-full ${isBuy ? 'bg-emerald-400' : 'bg-red-400'} animate-pulse`} />
              <span className={`text-xs font-bold ${isBuy ? 'text-emerald-400' : 'text-red-400'}`}>
                {isBuy ? 'COMPRA' : 'VENDA'}
              </span>
              <span className="text-[9px] text-muted-foreground ml-auto">
                {aiAnalysis.successProbability}% acerto
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-cyan-400">Entrada</span>
                <span className="font-mono text-xs font-bold text-cyan-400">
                  {formatPrice(isBuy ? (aiAnalysis.tradePoints?.buyPoint || 0) : (aiAnalysis.tradePoints?.sellPoint || 0), instrument?.symbol || '')}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[10px] text-red-400">Stop Loss</span>
                <span className="font-mono text-xs font-bold text-red-400">
                  {formatPrice(isBuy ? (aiAnalysis.tradePoints?.stopLossBuy || 0) : (aiAnalysis.tradePoints?.stopLossSell || 0), instrument?.symbol || '')}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[10px] text-emerald-400">Take Profit</span>
                <span className="font-mono text-xs font-bold text-emerald-400">
                  {formatPrice(isBuy ? (aiAnalysis.tradePoints?.takeProfitBuy || 0) : (aiAnalysis.tradePoints?.takeProfitSell || 0), instrument?.symbol || '')}
                </span>
              </div>

              <div className="pt-1 border-t border-border/30 flex justify-between items-center">
                <span className="text-[10px] text-muted-foreground">R:R</span>
                <span className="font-mono text-xs font-bold text-amber-400">{aiAnalysis.riskReward?.ratio || '—'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Risk/Reward Visual Zone Indicator — bottom right */}
        {hasAI && (isBuy || isSell) && (
          <div className="absolute bottom-4 right-4 z-20 bg-[#0a0e17]/90 backdrop-blur-md rounded-lg border border-border/40 p-2.5 min-w-[110px] sm:min-w-[140px]">
            <p className="text-[9px] text-muted-foreground font-semibold mb-2">Zonas de Risco/Retorno</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-red-500/30 border border-red-500/50" />
                <span className="text-[9px] text-red-400">Zona de Risco</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-emerald-500/30 border border-emerald-500/50" />
                <span className="text-[9px] text-emerald-400">Zona de Ganho</span>
              </div>
              {aiAnalysis.keyLevels && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-0.5 border-t border-dashed border-red-400/60" />
                    <span className="text-[9px] text-red-400/60">Resistência</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-0.5 border-t border-dashed border-emerald-400/60" />
                    <span className="text-[9px] text-emerald-400/60">Suporte</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
