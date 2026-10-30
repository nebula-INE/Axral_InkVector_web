import React from 'react';
import { BrushType } from '../types';
import { BRUSH_PRESETS, BrushPreset } from '../utils/brushes';
import { Feather, PenTool, Edit3, Paintbrush, Wind, Highlighter } from 'lucide-react';

interface BrushStudioProps {
  currentBrush: BrushType;
  onSelectBrush: (b: BrushType) => void;
  brushSize: number;
  onBrushSizeChange: (s: number) => void;
  strokeColor: string;
}

export const BrushStudio: React.FC<BrushStudioProps> = ({
  currentBrush,
  onSelectBrush,
  brushSize,
  onBrushSizeChange,
  strokeColor,
}) => {
  const brushes: { id: BrushType; icon: React.ReactNode }[] = [
    { id: 'gpen', icon: <Feather className="w-4 h-4" /> },
    { id: 'pen', icon: <PenTool className="w-4 h-4" /> },
    { id: 'pencil', icon: <Edit3 className="w-4 h-4" /> },
    { id: 'marker', icon: <Highlighter className="w-4 h-4" /> },
    { id: 'watercolor', icon: <Paintbrush className="w-4 h-4" /> },
    { id: 'airbrush', icon: <Wind className="w-4 h-4" /> },
  ];

  const preset: BrushPreset = BRUSH_PRESETS[currentBrush];

  return (
    <div className="flex flex-col h-full text-xs text-zinc-300 p-3 overflow-y-auto gap-4">
      <span className="font-semibold text-zinc-200">ブラシスタジオ (Brush Studio)</span>

      {/* Brush Preset Cards */}
      <div className="grid grid-cols-2 gap-2">
        {brushes.map(b => {
          const p = BRUSH_PRESETS[b.id];
          const isSelected = currentBrush === b.id;
          return (
            <button
              key={b.id}
              onClick={() => {
                onSelectBrush(b.id);
                onBrushSizeChange(p.defaultSize);
              }}
              className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all ${
                isSelected
                  ? 'bg-indigo-950/60 border-indigo-500 shadow-sm'
                  : 'bg-zinc-800/40 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-1.5 font-medium text-zinc-100">
                <span className={isSelected ? 'text-indigo-400' : 'text-zinc-400'}>{b.icon}</span>
                <span>{p.nameJa}</span>
              </div>
              <span className="text-[10px] text-zinc-400 mt-1 line-clamp-1">{p.name}</span>
            </button>
          );
        })}
      </div>

      {/* Selected Brush Details */}
      <div className="flex flex-col gap-3 bg-zinc-800/30 p-3 rounded-lg border border-zinc-800">
        <div>
          <span className="font-semibold text-zinc-100">{preset.nameJa} ({preset.name})</span>
          <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">{preset.description}</p>
        </div>

        {/* Brush Size Slider */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">ブラシサイズ:</span>
            <span className="font-mono text-zinc-200">{brushSize}px</span>
          </div>
          <input
            type="range"
            min="1"
            max="80"
            step="0.5"
            value={brushSize}
            onChange={e => onBrushSizeChange(parseFloat(e.target.value))}
            className="w-full accent-indigo-500 cursor-pointer"
          />
        </div>

        {/* Pressure dynamics stroke curve preview */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-zinc-400">筆圧応答プレビュー:</span>
          <div className="h-14 bg-zinc-900 rounded border border-zinc-800 flex items-center justify-center p-2">
            <svg viewBox="0 0 200 40" className="w-full h-full overflow-visible">
              <path
                d="M 10 20 C 60 5, 140 35, 190 20"
                stroke={strokeColor}
                strokeWidth={brushSize}
                strokeLinecap="round"
                fill="none"
                opacity={preset.opacity}
              />
            </svg>
          </div>
        </div>

        {/* Preset Attributes */}
        <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-400 pt-1">
          <div className="bg-zinc-900/60 p-1.5 rounded border border-zinc-800">
            不透明度: <span className="text-zinc-200 font-mono">{Math.round(preset.opacity * 100)}%</span>
          </div>
          <div className="bg-zinc-900/60 p-1.5 rounded border border-zinc-800">
            カーブ: <span className="text-zinc-200">{preset.pressureResponse}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
