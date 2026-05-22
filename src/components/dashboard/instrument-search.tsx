'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, TrendingUp, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Instrument, QuoteData, ALL_INSTRUMENTS, CATEGORY_META, MarketCategory, getVal as getValUtil, getInstruments } from './types';

// Common broker/trading platform aliases mapped to instrument IDs
// Users often search for broker symbols like JP225, US500, NAS100, etc.
const SEARCH_ALIASES: Record<string, string[]> = {
  // Indices - Americas
  sp500:    ['us500', 'us500cash', 'spx', 'spx500', 'sp500', 'us500'],
  dji:      ['us30', 'dow30', 'dj30', 'us30cash', 'ym'],
  nasdaq:   ['nas100', 'nd100', 'nasdaq100', 'ndx100', 'ustech100', 'nq'],
  nasdaq100:['nas100', 'nd100', 'ndx100', 'ustech100', 'nq'],
  russell:  ['rus2000', 'rty', 'rt'],
  vix:      ['vixindex'],
  tsx:      ['cad60'],
  ipc:      ['mx35', 'mex35'],
  ibov:     ['br50', 'brazil50', 'win'],
  dollar:   ['dxy', 'usdx'],
  us10y:    ['us10', 'tnx', '10y'],
  us30y:    ['us30y', 'tyx', '30y'],
  // Indices - Europe
  ftse:     ['uk100', 'ftse100', 'uk100cash'],
  dax:      ['ger40', 'de40', 'dax40', 'ger40cash'],
  cac40:    ['fr40', 'frc40'],
  eurostoxx:['eu50', 'euro50', 'stoxx50'],
  ibex:     ['es35'],
  ftsemib:  ['it40', 'itmib'],
  aex:      ['nl25', 'dutch25'],
  smi:      ['ch20', 'swiss20'],
  omx:      ['se30'],
  atx:      ['at20', 'austrian20'],
  // Indices - Asia-Pacific
  nikkei:   ['jp225', 'jpn225', 'nk225', 'n225', 'japan225', 'jp225cash'],
  topix:    ['tpx', 'jptopix'],
  hangseng: ['hk50', 'hsi50', 'hkg50', 'hk33'],
  shanghai: ['cn50', 'shcomp', 'shcomposite'],
  shenzhen: ['szcomp', 'szcomponent'],
  csi300:   ['cn300', 'csi', 'csi300'],
  kospi:    ['kr200', 'korea200'],
  taiex:    ['tw50', 'taiwan50'],
  asx:      ['au200', 'aussie200'],
  sti:      ['sg30', 'singapore30'],
  nz50:     ['nz50', 'nzx', 'newzealand50'],
  nifty:    ['in50', 'nifty50', 'india50'],
  sensex:   ['bsensex'],
  set:      ['th50'],
  tadawul:  ['sa40', 'saudi40', 'tasi'],
  jse:      ['za40', 'southafrica40', 'jsetop40'],
  // Metals & Commodities
  gold:     ['xauusd', 'xau', 'goldusd'],
  silver:   ['xagusd', 'xag', 'silverusd'],
  platinum: ['xptusd', 'xpt'],
  palladium:['xpdusd', 'xpd'],
  copper:   ['xcu', 'hg'],
  oil:      ['wti', 'cl', 'usoil'],
  brent:    ['brentoil', 'ukoil', 'uk Brent'],
  natgas:   ['ng', 'natural', 'gas'],
  wheat:    ['zw', 'zwheat'],
  corn:     ['zc', 'zcorn'],
  coffee:   ['kc', 'kcoffee'],
  sugar:    ['sb'],
  cocoa:    ['cc'],
  // Crypto
  btc:      ['bitcoin', 'xbtusd'],
  eth:      ['ethereum'],
  // Forex
  eurusd:   ['eurusd', 'eur/usd'],
  gbpusd:   ['gbpusd', 'gbp/usd'],
  usdjpy:   ['usdjpy', 'usd/jpy'],
};

// Build a lookup from alias -> instrument IDs
const ALIAS_TO_IDS: Map<string, Set<string>> = new Map();
for (const [id, aliases] of Object.entries(SEARCH_ALIASES)) {
  for (const alias of aliases) {
    const key = alias.toLowerCase();
    if (!ALIAS_TO_IDS.has(key)) ALIAS_TO_IDS.set(key, new Set());
    ALIAS_TO_IDS.get(key)!.add(id);
  }
}

interface InstrumentSearchProps {
  instruments: Instrument[];
  quotes: Record<string, QuoteData>;
  onSelect: (instrument: Instrument) => void;
  selectedSymbol: string | null;
  category: MarketCategory;
}

// Popular/trending instruments to show when search is empty
const TRENDING_SYMBOLS = ['EURUSD=X', 'BTC-USD', 'NVDA', '^GSPC', 'GC=F', 'AAPL', 'SPY', '^BVSP'];

export function InstrumentSearch({ instruments, quotes, onSelect, selectedSymbol, category }: InstrumentSearchProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Search across ALL instruments globally (includes broker aliases)
  const filtered = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase().trim();
    const terms = q.split(/\s+/);

    // Check if the full search matches a known alias
    const aliasMatch = ALIAS_TO_IDS.get(q);
    const matchedIds = aliasMatch || new Set<string>();

    // Also try each individual term as alias
    for (const term of terms) {
      const termAlias = ALIAS_TO_IDS.get(term);
      if (termAlias) for (const id of termAlias) matchedIds.add(id);
    }

    return ALL_INSTRUMENTS.filter(inst => {
      // Match by alias
      if (matchedIds.has(inst.id)) return true;
      // Match by standard fields
      const searchable = `${inst.name} ${inst.symbol} ${inst.id} ${inst.category} ${inst.sector || ''}`.toLowerCase();
      return terms.every(term => searchable.includes(term));
    }).slice(0, 30);
  }, [search]);

  // Trending/popular instruments to show when opening
  const trending = useMemo(() => {
    return TRENDING_SYMBOLS.map(sym => ALL_INSTRUMENTS.find(i => i.symbol === sym)).filter(Boolean) as Instrument[];
  }, []);

  // Category instruments for quick access
  const categoryInstruments = useMemo(() => {
    return getInstruments(category).slice(0, 8);
  }, [category]);

  // Group filtered results by category
  const groupedResults = useMemo(() => {
    const groups: Record<string, Instrument[]> = {};
    for (const inst of filtered) {
      if (!groups[inst.category]) groups[inst.category] = [];
      groups[inst.category].push(inst);
    }
    return groups;
  }, [filtered]);

  const allVisibleItems = useMemo(() => {
    return filtered.length > 0 ? filtered : [];
  }, [filtered]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    const total = allVisibleItems.length;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, total - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && selectedIndex >= 0 && selectedIndex < total) {
      e.preventDefault();
      const inst = allVisibleItems[selectedIndex];
      if (inst) {
        onSelect(inst);
        setSearch('');
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearch('');
      setSelectedIndex(-1);
    }
  };

  const handleSelect = (inst: Instrument) => {
    onSelect(inst);
    setSearch('');
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  // Count total instruments
  const totalInstruments = ALL_INSTRUMENTS.length;

  if (!isOpen) {
    return (
      <button
        onClick={() => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary/80 transition-colors text-muted-foreground hover:text-foreground border border-border/30"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="text-[11px]">Buscar ativo...</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1 py-0.5 text-[9px] font-mono bg-background/60 border border-border/40 rounded">
          ⌘K
        </kbd>
      </button>
    );
  }

  const renderInstrumentRow = (inst: Instrument, idx: number, globalIdx: number) => {
    const quote = quotes[inst.symbol];
    const changePct = getValUtil(quote?.regularMarketChangePercent);
    const isPositive = changePct >= 0;
    const isSelected = selectedSymbol === inst.symbol;
    const isHighlighted = globalIdx === selectedIndex;
    const catMeta = CATEGORY_META[inst.category as MarketCategory];

    return (
      <button
        key={`${inst.id}-${inst.category}`}
        className={`w-full flex items-center justify-between px-3 py-2 transition-colors text-left ${
          isSelected
            ? 'animate-search-selected border-l-2 border-cyan-400'
            : isHighlighted
              ? 'bg-cyan-500/10'
              : 'hover:bg-secondary/40'
        }`}
        onClick={() => handleSelect(inst)}
        onMouseEnter={() => setSelectedIndex(globalIdx)}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-sm shrink-0">{inst.flag}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-medium truncate ${isSelected ? 'text-cyan-300' : ''}`}>{inst.name}</span>
              <Badge
                variant="outline"
                className={`text-[8px] px-1 py-0 h-4 shrink-0 ${
                  catMeta?.color === 'cyan' ? 'border-cyan-500/30 text-cyan-400' :
                  catMeta?.color === 'violet' ? 'border-violet-500/30 text-violet-400' :
                  catMeta?.color === 'amber' ? 'border-amber-500/30 text-amber-400' :
                  catMeta?.color === 'orange' ? 'border-orange-500/30 text-orange-400' :
                  catMeta?.color === 'yellow' ? 'border-yellow-500/30 text-yellow-400' :
                  catMeta?.color === 'emerald' ? 'border-emerald-500/30 text-emerald-400' :
                  catMeta?.color === 'rose' ? 'border-rose-500/30 text-rose-400' :
                  catMeta?.color === 'lime' ? 'border-lime-500/30 text-lime-400' :
                  'border-border/30 text-muted-foreground'
                }`}
              >
                {catMeta?.label || inst.category}
              </Badge>
              {isSelected && (
                <span className="flex h-1.5 w-1.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-400" />
                </span>
              )}
              {inst.sector && (
                <span className="text-[8px] text-muted-foreground/60 hidden sm:inline">{inst.sector}</span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">{inst.symbol}</span>
          </div>
        </div>
        <span className={`text-[10px] font-mono font-semibold shrink-0 ml-2 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {isPositive ? '+' : ''}{changePct.toFixed(2)}%
        </span>
      </button>
    );
  };

  return (
    <div ref={containerRef} className="relative z-50">
      <div className="flex items-center gap-1">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelectedIndex(-1); }}
            onKeyDown={handleKeyDown}
            placeholder={`Buscar entre ${totalInstruments} ativos...`}
            className="h-8 pl-8 pr-8 text-xs bg-secondary/50 border-border/40 focus:border-cyan-500/50 w-full sm:w-64"
            autoFocus
          />
          <button
            onClick={() => { setSearch(''); setIsOpen(false); setSelectedIndex(-1); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 -m-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Search Results Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-[calc(100vw-2rem)] sm:w-96 max-w-96 bg-card border border-border/50 rounded-lg shadow-2xl shadow-black/40 z-50 overflow-hidden max-h-[70vh] flex flex-col">
          {search.trim() && filtered.length > 0 ? (
            <div className="overflow-y-auto flex-1">
              {Object.entries(groupedResults).map(([cat, insts]) => {
                const catMeta = CATEGORY_META[cat as MarketCategory];
                let globalOffset = 0;
                // Calculate global offset for this category
                for (const [prevCat, prevInsts] of Object.entries(groupedResults)) {
                  if (prevCat === cat) break;
                  globalOffset += prevInsts.length;
                }

                return (
                  <div key={cat}>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary/30 border-b border-border/20 sticky top-0">
                      <span className="text-[10px]">{catMeta?.emoji || '📌'}</span>
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {catMeta?.label || cat}
                      </span>
                      <span className="text-[9px] text-muted-foreground/50 ml-auto">{insts.length}</span>
                    </div>
                    {insts.map((inst, i) => renderInstrumentRow(inst, i, globalOffset + i))}
                  </div>
                );
              })}
            </div>
          ) : search.trim() && filtered.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-muted-foreground">Nenhum ativo encontrado para &quot;{search}&quot;</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">Tente buscar por nome, símbolo ou categoria</p>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1">
              {/* Trending */}
              <div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary/30 border-b border-border/20">
                  <TrendingUp className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Em Alta</span>
                </div>
                {trending.map((inst, i) => renderInstrumentRow(inst, i, i))}
              </div>

              {/* Current Category Quick Access */}
              <div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary/30 border-b border-border/20">
                  <Star className="w-3 h-3 text-cyan-400" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {CATEGORY_META[category]?.label || category}
                  </span>
                </div>
                {categoryInstruments.map((inst, i) => renderInstrumentRow(inst, i, trending.length + i))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-border/20 px-3 py-1.5 bg-secondary/20 flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground/60">{totalInstruments} ativos disponíveis</span>
            <div className="flex items-center gap-2 text-[9px] text-muted-foreground/60">
              <span>↑↓ navegar</span>
              <span>↵ selecionar</span>
              <span>esc fechar</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
