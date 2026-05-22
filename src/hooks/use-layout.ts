'use client';

import { useState, useCallback, useEffect } from 'react';

export interface LayoutSection {
  id: string;
  name: string;
  icon: string;
  visible: boolean;
  order: number;
  locked?: boolean; // If true, can't be hidden (e.g., chart, analysis)
}

const STORAGE_KEY = 'forexAI-layout';

// Default sections — matches the current page layout order
const DEFAULT_SECTIONS: LayoutSection[] = [
  { id: 'priceCards', name: 'Cotações', icon: '💱', visible: true, order: 0 },
  { id: 'chart', name: 'Gráfico Principal', icon: '📈', visible: true, order: 1, locked: true },
  { id: 'analysis', name: 'Análise IA', icon: '🧠', visible: true, order: 2, locked: true },
  { id: 'heatmap', name: 'Mapa de Calor', icon: '🗺️', visible: true, order: 3 },
  { id: 'calendar', name: 'Calendário Econômico', icon: '📅', visible: true, order: 4 },
  { id: 'signals', name: 'Sinais de Mercado', icon: '📊', visible: true, order: 5 },
  { id: 'news', name: 'Notícias', icon: '📰', visible: true, order: 6 },
  { id: 'marketOverview', name: 'Visão Geral do Mercado', icon: '🌍', visible: true, order: 7 },
  { id: 'mt5', name: 'MT5 Auto-Trading', icon: '🤖', visible: true, order: 8 },
];

// Preset layouts
export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  sections: Partial<LayoutSection>[];
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: 'default',
    name: 'Padrão',
    description: 'Layout completo com todos os painéis',
    sections: DEFAULT_SECTIONS.map(s => ({ id: s.id, visible: true, order: s.order })),
  },
  {
    id: 'trader',
    name: 'Trader',
    description: 'Foco no gráfico e análise, menos distrações',
    sections: [
      { id: 'priceCards', visible: true, order: 0 },
      { id: 'chart', visible: true, order: 1 },
      { id: 'analysis', visible: true, order: 2 },
      { id: 'heatmap', visible: false, order: 3 },
      { id: 'calendar', visible: false, order: 4 },
      { id: 'signals', visible: true, order: 5 },
      { id: 'news', visible: false, order: 6 },
      { id: 'marketOverview', visible: false, order: 7 },
      { id: 'mt5', visible: true, order: 8 },
    ],
  },
  {
    id: 'analyst',
    name: 'Analista',
    description: 'Todos os painéis visíveis, layout equilibrado',
    sections: [
      { id: 'priceCards', visible: true, order: 0 },
      { id: 'chart', visible: true, order: 1 },
      { id: 'analysis', visible: true, order: 2 },
      { id: 'heatmap', visible: true, order: 3 },
      { id: 'calendar', visible: true, order: 4 },
      { id: 'signals', visible: true, order: 5 },
      { id: 'news', visible: true, order: 6 },
      { id: 'marketOverview', visible: true, order: 7 },
      { id: 'mt5', visible: true, order: 8 },
    ],
  },
];

function loadFromStorage(): LayoutSection[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to handle any new sections added later
      return DEFAULT_SECTIONS.map(defaultSection => {
        const stored = parsed.find((s: LayoutSection) => s.id === defaultSection.id);
        if (stored) {
          return {
            ...defaultSection,
            visible: defaultSection.locked ? true : stored.visible,
            order: stored.order,
          };
        }
        return defaultSection;
      });
    }
  } catch {}
  return null;
}

function saveToStorage(sections: LayoutSection[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sections));
  } catch {}
}

export interface UseLayoutReturn {
  sections: LayoutSection[];
  toggleVisibility: (id: string) => void;
  moveUp: (id: string) => void;
  moveDown: (id: string) => void;
  resetLayout: () => void;
  applyPreset: (presetId: string) => void;
  isVisible: (id: string) => boolean;
  getOrder: (id: string) => number;
  sortedSections: LayoutSection[];
  activePreset: string | null;
}

function detectPreset(secs: LayoutSection[]): string | null {
  for (const preset of LAYOUT_PRESETS) {
    const presetMap = new Map(preset.sections.map(s => [s.id, s]));
    const matches = secs.every(s => {
      const p = presetMap.get(s.id);
      return p && p.visible === s.visible && p.order === s.order;
    });
    if (matches) return preset.id;
  }
  return null;
}

export function useLayout(): UseLayoutReturn {
  const [sections, setSections] = useState<LayoutSection[]>(DEFAULT_SECTIONS);
  const [activePreset, setActivePreset] = useState<string | null>('default');
  const [initialized, setInitialized] = useState(false);

  // Load from localStorage after mount
  useEffect(() => {
    const stored = loadFromStorage();
    if (stored) {
      setSections(stored);
      // Detect which preset matches
      setActivePreset(detectPreset(stored));
    }
    setInitialized(true);
  }, []);

  const updateSections = useCallback((newSections: LayoutSection[]) => {
    setSections(newSections);
    saveToStorage(newSections);
    setActivePreset(detectPreset(newSections));
  }, []);

  const toggleVisibility = useCallback((id: string) => {
    setSections(prev => {
      const newSections = prev.map(s =>
        s.id === id && !s.locked ? { ...s, visible: !s.visible } : s
      );
      saveToStorage(newSections);
      setActivePreset(detectPreset(newSections));
      return newSections;
    });
  }, []);

  const moveUp = useCallback((id: string) => {
    setSections(prev => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex(s => s.id === id);
      if (idx <= 0) return prev;
      // Swap orders with previous
      const prevSection = sorted[idx - 1];
      const newSections = prev.map(s => {
        if (s.id === id) return { ...s, order: prevSection.order };
        if (s.id === prevSection.id) return { ...s, order: sorted[idx].order };
        return s;
      });
      saveToStorage(newSections);
      setActivePreset(detectPreset(newSections));
      return newSections;
    });
  }, []);

  const moveDown = useCallback((id: string) => {
    setSections(prev => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex(s => s.id === id);
      if (idx < 0 || idx >= sorted.length - 1) return prev;
      // Swap orders with next
      const nextSection = sorted[idx + 1];
      const newSections = prev.map(s => {
        if (s.id === id) return { ...s, order: nextSection.order };
        if (s.id === nextSection.id) return { ...s, order: sorted[idx].order };
        return s;
      });
      saveToStorage(newSections);
      setActivePreset(detectPreset(newSections));
      return newSections;
    });
  }, []);

  const resetLayout = useCallback(() => {
    updateSections(DEFAULT_SECTIONS.map(s => ({ ...s })));
  }, [updateSections]);

  const applyPreset = useCallback((presetId: string) => {
    const preset = LAYOUT_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    const presetMap = new Map(preset.sections.map(s => [s.id, s]));
    const newSections = DEFAULT_SECTIONS.map(defaultSection => {
      const p = presetMap.get(defaultSection.id);
      return {
        ...defaultSection,
        visible: defaultSection.locked ? true : (p?.visible ?? defaultSection.visible),
        order: p?.order ?? defaultSection.order,
      };
    });
    updateSections(newSections);
  }, [updateSections]);

  const isVisible = useCallback((id: string) => {
    return sections.find(s => s.id === id)?.visible ?? true;
  }, [sections]);

  const getOrder = useCallback((id: string) => {
    return sections.find(s => s.id === id)?.order ?? 0;
  }, [sections]);

  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  return {
    sections,
    toggleVisibility,
    moveUp,
    moveDown,
    resetLayout,
    applyPreset,
    isVisible,
    getOrder,
    sortedSections,
    activePreset,
  };
}
