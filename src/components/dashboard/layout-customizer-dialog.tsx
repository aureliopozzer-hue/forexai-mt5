'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { LayoutSection, LAYOUT_PRESETS, UseLayoutReturn } from '@/hooks/use-layout';
import { ChevronUp, ChevronDown, RotateCcw, Lock } from 'lucide-react';

interface LayoutCustomizerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layout: UseLayoutReturn;
}

export function LayoutCustomizerDialog({ open, onOpenChange, layout }: LayoutCustomizerDialogProps) {
  const { sections, sortedSections, toggleVisibility, moveUp, moveDown, resetLayout, applyPreset, activePreset } = layout;

  const visibleCount = sections.filter(s => s.visible).length;
  const hiddenCount = sections.filter(s => !s.visible).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="text-lg">⚙️</span>
            Personalizar Layout
          </DialogTitle>
          <DialogDescription className="text-xs">
            Reorganize e oculte seções do dashboard. O gráfico e a análise IA são sempre visíveis.
          </DialogDescription>
        </DialogHeader>

        {/* Preset Buttons */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Modelos</p>
          <div className="grid grid-cols-3 gap-2">
            {LAYOUT_PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset.id)}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border transition-all text-center ${
                  activePreset === preset.id
                    ? 'bg-cyan-500/10 border-cyan-500/30 shadow-sm shadow-cyan-500/5'
                    : 'bg-secondary/20 border-border/30 hover:bg-secondary/40 hover:border-border/50'
                }`}
              >
                <span className={`text-xs font-semibold ${activePreset === preset.id ? 'text-cyan-400' : 'text-foreground'}`}>
                  {preset.name}
                </span>
                <span className="text-[9px] text-muted-foreground leading-tight">{preset.description}</span>
              </button>
            ))}
          </div>
        </div>

        <Separator className="bg-border/30" />

        {/* Section List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Seções</p>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>{visibleCount} visível{visibleCount !== 1 ? 'is' : ''}</span>
              {hiddenCount > 0 && (
                <>
                  <span>·</span>
                  <span>{hiddenCount} oculta{hiddenCount !== 1 ? 's' : ''}</span>
                </>
              )}
            </div>
          </div>

          <div className="space-y-1 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
            {sortedSections.map((section, idx) => (
              <SectionRow
                key={section.id}
                section={section}
                isFirst={idx === 0}
                isLast={idx === sortedSections.length - 1}
                onToggle={() => toggleVisibility(section.id)}
                onMoveUp={() => moveUp(section.id)}
                onMoveDown={() => moveDown(section.id)}
              />
            ))}
          </div>
        </div>

        <Separator className="bg-border/30" />

        {/* Preview */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Pré-visualização</p>
          <div className="bg-secondary/20 rounded-lg p-3 border border-border/20">
            <div className="space-y-1">
              {sortedSections.filter(s => s.visible).map(section => (
                <div
                  key={section.id}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] ${
                    section.locked
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                      : 'bg-secondary/40 text-muted-foreground border border-border/20'
                  }`}
                >
                  <span>{section.icon}</span>
                  <span className="font-medium truncate">{section.name}</span>
                  {section.locked && <Lock className="w-2.5 h-2.5 ml-auto opacity-50" />}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Reset Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={resetLayout}
          className="w-full border-border/40 text-muted-foreground hover:text-foreground hover:border-border/60 text-xs gap-1.5"
        >
          <RotateCcw className="w-3 h-3" />
          Restaurar Padrão
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function SectionRow({
  section,
  isFirst,
  isLast,
  onToggle,
  onMoveUp,
  onMoveDown,
}: {
  section: LayoutSection;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
        section.visible
          ? section.locked
            ? 'bg-cyan-500/5 border-cyan-500/15'
            : 'bg-secondary/20 border-border/25'
          : 'bg-secondary/10 border-border/15 opacity-50'
      }`}
    >
      {/* Icon + Name */}
      <span className="text-sm">{section.icon}</span>
      <span className={`text-xs font-medium flex-1 truncate ${section.visible ? 'text-foreground' : 'text-muted-foreground'}`}>
        {section.name}
      </span>

      {/* Locked indicator */}
      {section.locked && (
        <Lock className="w-3 h-3 text-cyan-400/50" />
      )}

      {/* Up/Down Arrows */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="p-0.5 rounded hover:bg-secondary/60 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          title="Mover para cima"
        >
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="p-0.5 rounded hover:bg-secondary/60 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          title="Mover para baixo"
        >
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Visibility Toggle */}
      <Switch
        checked={section.visible}
        onCheckedChange={onToggle}
        disabled={section.locked}
        className="scale-75 data-[state=checked]:bg-cyan-500 data-[state=unchecked]:bg-muted-foreground/30"
      />
    </div>
  );
}
