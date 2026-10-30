import React, { useState } from 'react';
import { ToolType, ShapeType, EraserMode, WidthBrushMode } from '../types';
import { 
  PenTool, 
  MousePointer, 
  Scissors, 
  PaintBucket, 
  Hand, 
  Grid3X3, 
  MessageSquare, 
  Spline, 
  Sparkles, 
  Maximize2, 
  SlidersHorizontal,
  Eraser,
  Pipette,
  Square,
  Circle,
  Minus,
  Star,
  Triangle,
  ArrowLeftRight,
  Ban,
  Wand2,
  ImageDown,
  CircleDot
} from 'lucide-react';

interface ToolbarProps {
  tool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  shapeType: ShapeType;
  onShapeTypeChange: (st: ShapeType) => void;
  strokeColor: string;
  onStrokeColorChange: (color: string) => void;
  fillColor: string;
  onFillColorChange: (color: string) => void;
  colorHistory: string[];
  eraserMode?: EraserMode;
  onEraserModeChange?: (mode: EraserMode) => void;
  eraserRadius?: number;
  onEraserRadiusChange?: (radius: number) => void;
  widthBrushMode?: WidthBrushMode;
  onWidthBrushModeChange?: (mode: WidthBrushMode) => void;
  onOpenEffectModal?: () => void;
  onOpenTraceModal?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  tool,
  onSelectTool,
  shapeType,
  onShapeTypeChange,
  strokeColor,
  onStrokeColorChange,
  fillColor,
  onFillColorChange,
  colorHistory,
  eraserMode = 'intersection',
  onEraserModeChange,
  eraserRadius = 24,
  onEraserRadiusChange,
  widthBrushMode = 'thicken',
  onWidthBrushModeChange,
  onOpenEffectModal,
  onOpenTraceModal,
}) => {
  const [showShapeMenu, setShowShapeMenu] = useState(false);

  const shapeIcon = () => {
    switch (shapeType) {
      case 'rect': return <Square className="w-4 h-4" />;
      case 'ellipse': return <Circle className="w-4 h-4" />;
      case 'line': return <Minus className="w-4 h-4" />;
      case 'star': return <Star className="w-4 h-4 fill-amber-400/30" />;
      case 'polygon': return <Triangle className="w-4 h-4" />;
    }
  };

  const shapeLabel = () => {
    switch (shapeType) {
      case 'rect': return '矩形';
      case 'ellipse': return '楕円';
      case 'line': return '直線';
      case 'star': return '星型';
      case 'polygon': return '三角形';
    }
  };

  const tools: { id: ToolType; label: string; shortcut: string; icon: React.ReactNode }[] = [
    { id: 'pen', label: 'ペン / ブラシ', shortcut: 'P', icon: <PenTool className="w-4 h-4" /> },
    { 
      id: 'shape', 
      label: `シェイプ (${shapeLabel()})`, 
      shortcut: 'U', 
      icon: shapeIcon()
    },
    { id: 'reshape', label: '変形・ノード編集 (Scratch風)', shortcut: 'A', icon: <Spline className="w-4 h-4 text-sky-400" /> },
    { id: 'bucket', label: 'ベクターバケツ / 塗りつぶし', shortcut: 'B', icon: <PaintBucket className="w-4 h-4 text-emerald-400" /> },
    { id: 'select', label: '選択・変形', shortcut: 'V', icon: <MousePointer className="w-4 h-4" /> },
    { id: 'eraser', label: '通常消しゴム', shortcut: 'E', icon: <Eraser className="w-4 h-4" /> },
    { id: 'eyedropper', label: 'スポイト', shortcut: 'I / Alt', icon: <Pipette className="w-4 h-4" /> },
    { id: 'trim', label: '交差点消しゴム', shortcut: 'T', icon: <Scissors className="w-4 h-4 text-amber-400" /> },
    { id: 'scissors', label: 'パス切断 (ハサミ)', shortcut: 'C', icon: <Scissors className="w-4 h-4" /> },
    { id: 'width', label: '線幅編集', shortcut: 'W', icon: <SlidersHorizontal className="w-4 h-4" /> },
    { id: 'mesh', label: 'カラーメッシュ', shortcut: 'M', icon: <Grid3X3 className="w-4 h-4" /> },
    { id: 'balloon', label: 'フキダシ作成 (ドラッグ配置)', shortcut: 'Alt+B', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'panel', label: 'コマ割り (ドラッグ配置)', shortcut: 'Alt+P', icon: <Maximize2 className="w-4 h-4" /> },
    { id: 'focus_line', label: '集中線・効果線', shortcut: 'Alt+F', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'hand', label: '手のひら / パン', shortcut: 'H / Space', icon: <Hand className="w-4 h-4" /> },
  ];

  const swapColors = () => {
    const temp = strokeColor;
    onStrokeColorChange(fillColor === 'none' ? '#ffffff' : fillColor);
    onFillColorChange(temp === 'none' ? '#18181b' : temp);
  };

  const [showEraserMenu, setShowEraserMenu] = useState(false);
  const [showWidthMenu, setShowWidthMenu] = useState(false);

  return (
    <aside className="w-16 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-2 z-20 shrink-0 select-none overflow-y-auto scrollbar-none">
      {/* Tool Buttons */}
      <div className="flex flex-col gap-1 w-full px-2 items-center relative">
        {tools.map(t => {
          const isActive = tool === t.id;
          return (
            <div key={t.id} className="relative">
              <button
                onClick={() => {
                  onSelectTool(t.id);
                  if (t.id === 'shape') {
                    setShowShapeMenu(!showShapeMenu);
                    setShowEraserMenu(false);
                    setShowWidthMenu(false);
                  } else if (t.id === 'eraser' || t.id === 'trim') {
                    setShowEraserMenu(!showEraserMenu);
                    setShowShapeMenu(false);
                    setShowWidthMenu(false);
                  } else if (t.id === 'width') {
                    setShowWidthMenu(!showWidthMenu);
                    setShowShapeMenu(false);
                    setShowEraserMenu(false);
                  } else if (t.id === 'focus_line') {
                    onOpenEffectModal?.();
                  } else {
                    setShowShapeMenu(false);
                    setShowEraserMenu(false);
                    setShowWidthMenu(false);
                  }
                }}
                title={`${t.label} (${t.shortcut})`}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                }`}
              >
                {t.icon}
              </button>

              {/* Shape sub-menu popover */}
              {t.id === 'shape' && showShapeMenu && (
                <div 
                  className="absolute left-12 top-0 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl p-1.5 flex flex-col gap-1 z-50 w-28 animate-in fade-in zoom-in-95 duration-100"
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    onClick={() => { onShapeTypeChange('rect'); setShowShapeMenu(false); }}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${shapeType === 'rect' ? 'bg-indigo-600 text-white font-medium' : 'text-zinc-300 hover:bg-zinc-800'}`}
                  >
                    <Square className="w-3.5 h-3.5" /> 矩形
                  </button>
                  <button
                    onClick={() => { onShapeTypeChange('ellipse'); setShowShapeMenu(false); }}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${shapeType === 'ellipse' ? 'bg-indigo-600 text-white font-medium' : 'text-zinc-300 hover:bg-zinc-800'}`}
                  >
                    <Circle className="w-3.5 h-3.5" /> 楕円
                  </button>
                  <button
                    onClick={() => { onShapeTypeChange('line'); setShowShapeMenu(false); }}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${shapeType === 'line' ? 'bg-indigo-600 text-white font-medium' : 'text-zinc-300 hover:bg-zinc-800'}`}
                  >
                    <Minus className="w-3.5 h-3.5" /> 直線
                  </button>
                  <button
                    onClick={() => { onShapeTypeChange('star'); setShowShapeMenu(false); }}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${shapeType === 'star' ? 'bg-indigo-600 text-white font-medium' : 'text-zinc-300 hover:bg-zinc-800'}`}
                  >
                    <Star className="w-3.5 h-3.5 text-amber-400" /> 星型
                  </button>
                  <button
                    onClick={() => { onShapeTypeChange('polygon'); setShowShapeMenu(false); }}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${shapeType === 'polygon' ? 'bg-indigo-600 text-white font-medium' : 'text-zinc-300 hover:bg-zinc-800'}`}
                  >
                    <Triangle className="w-3.5 h-3.5 text-emerald-400" /> 三角形
                  </button>
                </div>
              )}

              {/* Vector Eraser Submenu */}
              {t.id === 'eraser' && showEraserMenu && (
                <div 
                  className="absolute left-12 top-0 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-2.5 flex flex-col gap-2 z-50 w-44 animate-in fade-in zoom-in-95 duration-100 text-xs text-zinc-300"
                  onClick={e => e.stopPropagation()}
                >
                  <span className="font-semibold text-zinc-100 text-[11px]">消しゴムモード</span>
                  <div className="flex flex-col gap-1">
                    {[
                      { id: 'intersection', label: '交点まで消去 (推奨)' },
                      { id: 'segment', label: '触れた部分消去' },
                      { id: 'stroke', label: '線全体を一発消去' },
                    ].map(m => (
                      <button
                        key={m.id}
                        onClick={() => {
                          onEraserModeChange?.(m.id as EraserMode);
                          setShowEraserMenu(false);
                        }}
                        className={`px-2 py-1.5 rounded text-left transition-colors font-medium text-[11px] ${
                          eraserMode === m.id
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'hover:bg-zinc-800 text-zinc-300'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  <div className="border-t border-zinc-800 pt-1.5 flex flex-col gap-1">
                    <div className="flex justify-between text-[10px] text-zinc-400">
                      <span>消しゴム半径:</span>
                      <span className="font-mono text-zinc-200">{eraserRadius}px</span>
                    </div>
                    <input
                      type="range"
                      min="8"
                      max="60"
                      value={eraserRadius}
                      onChange={e => onEraserRadiusChange?.(Number(e.target.value))}
                      className="w-full accent-indigo-500 h-1 bg-zinc-700 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Width Tool Submenu */}
              {t.id === 'width' && showWidthMenu && (
                <div 
                  className="absolute left-12 top-0 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-2.5 flex flex-col gap-1.5 z-50 w-44 animate-in fade-in zoom-in-95 duration-100 text-xs text-zinc-300"
                  onClick={e => e.stopPropagation()}
                >
                  <span className="font-semibold text-zinc-100 text-[11px]">線幅修正ブラシ</span>
                  <div className="flex flex-col gap-1">
                    {[
                      { id: 'thicken', label: '太くする (+)' },
                      { id: 'thin', label: '細くする (−)' },
                      { id: 'taper', label: '抜き・入り付与 (▲)' },
                      { id: 'normalize', label: '均一化 (＝)' },
                    ].map(w => (
                      <button
                        key={w.id}
                        onClick={() => {
                          onWidthBrushModeChange?.(w.id as WidthBrushMode);
                          setShowWidthMenu(false);
                        }}
                        className={`px-2 py-1.5 rounded text-left transition-colors font-medium text-[11px] ${
                          widthBrushMode === w.id
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'hover:bg-zinc-800 text-zinc-300'
                        }`}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Separator */}
        <div className="w-8 h-px bg-zinc-800 my-1" />

        {/* Killer Action 1: Manga Effect Lines */}
        <button
          onClick={() => onOpenEffectModal?.()}
          title="漫画効果線ジェネレーター (集中線・流線・ウニフラ)"
          className="w-10 h-10 rounded-lg flex items-center justify-center text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 border border-amber-400/20 transition-all shadow-xs"
        >
          <Sparkles className="w-4 h-4" />
        </button>

        {/* Killer Action 2: Auto-Trace Sketch */}
        <button
          onClick={() => onOpenTraceModal?.()}
          title="下描きスケッチのワンクリック・ベクター自動化 (Ctrl+V貼り付け対応)"
          className="w-10 h-10 rounded-lg flex items-center justify-center text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 border border-indigo-500/20 transition-all shadow-xs"
        >
          <ImageDown className="w-4 h-4" />
        </button>
      </div>

      <div className="my-auto py-1" />

      {/* Scratch-Style Color Controls: Independent Fill & Stroke with Transparent toggle */}
      <div className="flex flex-col items-center w-full px-1.5 py-2 border-t border-zinc-800/80 gap-2">
        <div className="flex items-center justify-between w-full px-1 text-[10px] text-zinc-400 font-medium">
          <span>カラー</span>
          <button
            onClick={swapColors}
            title="塗り/枠線を反転 (X)"
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeftRight className="w-3 h-3" />
          </button>
        </div>

        {/* 塗り (Fill) Swatch & None Toggle */}
        <div className="flex items-center gap-1 w-full justify-between bg-zinc-950/60 p-1 rounded-md border border-zinc-800/80">
          <label
            title={`塗り色: ${fillColor}`}
            className="relative w-6 h-6 rounded border border-zinc-700 shadow cursor-pointer overflow-hidden flex items-center justify-center shrink-0"
            style={{ backgroundColor: fillColor === 'none' ? 'transparent' : fillColor }}
          >
            {fillColor === 'none' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-0.5 bg-red-500 -rotate-45" />
              </div>
            )}
            <input
              type="color"
              value={fillColor.startsWith('#') ? fillColor : '#ffffff'}
              onChange={e => onFillColorChange(e.target.value)}
              className="opacity-0 w-full h-full cursor-pointer absolute inset-0"
            />
          </label>
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-400 font-medium leading-tight">塗り</span>
            <span className="text-[8px] text-zinc-500 font-mono truncate max-w-[28px]">
              {fillColor === 'none' ? 'なし' : fillColor.replace('#', '')}
            </span>
          </div>
          <button
            onClick={() => onFillColorChange(fillColor === 'none' ? '#ffffff' : 'none')}
            title={fillColor === 'none' ? '白で塗る' : '透明 (塗りなし)'}
            className={`p-1 rounded text-xs transition-colors shrink-0 ${fillColor === 'none' ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
          >
            <Ban className="w-3 h-3" />
          </button>
        </div>

        {/* 枠線 (Stroke) Swatch & None Toggle */}
        <div className="flex items-center gap-1 w-full justify-between bg-zinc-950/60 p-1 rounded-md border border-zinc-800/80">
          <label
            title={`枠線色: ${strokeColor}`}
            className="relative w-6 h-6 rounded border border-zinc-700 shadow cursor-pointer overflow-hidden flex items-center justify-center shrink-0"
            style={{ backgroundColor: strokeColor === 'none' ? 'transparent' : strokeColor }}
          >
            {strokeColor === 'none' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-0.5 bg-red-500 -rotate-45" />
              </div>
            )}
            <input
              type="color"
              value={strokeColor.startsWith('#') ? strokeColor : '#18181b'}
              onChange={e => onStrokeColorChange(e.target.value)}
              className="opacity-0 w-full h-full cursor-pointer absolute inset-0"
            />
          </label>
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-400 font-medium leading-tight">枠線</span>
            <span className="text-[8px] text-zinc-500 font-mono truncate max-w-[28px]">
              {strokeColor === 'none' ? 'なし' : strokeColor.replace('#', '')}
            </span>
          </div>
          <button
            onClick={() => onStrokeColorChange(strokeColor === 'none' ? '#18181b' : 'none')}
            title={strokeColor === 'none' ? '黒線' : '枠線なし'}
            className={`p-1 rounded text-xs transition-colors shrink-0 ${strokeColor === 'none' ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
          >
            <Ban className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Color History Palette (Recent Swatches) */}
      {colorHistory && colorHistory.length > 0 && (
        <div className="flex flex-col items-center gap-1 w-full px-2 pt-2 border-t border-zinc-800/80">
          <span className="text-[9px] text-zinc-500 scale-90">履歴</span>
          <div className="grid grid-cols-2 gap-1 w-full justify-items-center">
            {colorHistory.slice(0, 6).map((c, idx) => (
              <button
                key={idx}
                onClick={() => {
                  if (tool === 'bucket') {
                    onFillColorChange(c);
                  } else {
                    onStrokeColorChange(c);
                  }
                }}
                title={`カラー履歴: ${c} (クリックで適用)`}
                className="w-4 h-4 rounded border border-zinc-700 hover:scale-110 transition-transform shadow-xs"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};

