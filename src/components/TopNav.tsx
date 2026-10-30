import React, { useState } from 'react';
import {
  Undo,
  Redo,
  Download,
  Upload,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Wand2,
  Columns,
  Sparkles,
} from 'lucide-react';

interface TopNavProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  setZoom: (z: number) => void;
  onExport: () => void;
  onOpenSvg: () => void;
  onAutoPanel: () => void;
  onSuggestColors: () => void;
  onSimplify: () => void;
  docWidth: number;
  docHeight: number;
}

export const TopNav: React.FC<TopNavProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  setZoom,
  onExport,
  onOpenSvg,
  onAutoPanel,
  onSuggestColors,
  onSimplify,
  docWidth,
  docHeight,
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  return (
    <header className="h-10 border-b border-[#2A2D35] bg-[#16181C] flex items-center justify-between px-3 text-xs select-none z-30 shrink-0">
      {/* Brand & Menus */}
      <div className="flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-1.5 font-bold text-sm tracking-wider text-[#5B8CFF]">
          <span className="w-5 h-5 rounded bg-[#5B8CFF] flex items-center justify-center text-black font-black text-xs">
            V
          </span>
          <span className="text-[#E8EAF0]">Vektor<span className="text-[#5B8CFF]">Studio</span></span>
        </div>

        {/* Quick Menu Actions */}
        <div className="flex items-center gap-1 text-[#E8EAF0]">
          <button
            onClick={onOpenSvg}
            className="flex items-center gap-1 px-2.5 py-1 rounded hover:bg-[#1C1F24] hover:text-[#5B8CFF] transition-colors"
          >
            <Upload size={14} />
            <span>開く (SVG)</span>
          </button>

          <button
            onClick={onExport}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#5B8CFF] hover:bg-[#4A7AEE] text-white font-medium transition-colors shadow-sm"
          >
            <Download size={14} />
            <span>書き出し</span>
          </button>
        </div>

        <div className="w-px h-4 bg-[#2A2D35]" />

        {/* Undo / Redo */}
        <div className="flex items-center gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="元に戻す (Ctrl+Z)"
            className={`p-1.5 rounded transition-colors ${
              canUndo
                ? 'hover:bg-[#1C1F24] text-[#E8EAF0]'
                : 'text-[#6B7280] opacity-40 cursor-not-allowed'
            }`}
          >
            <Undo size={14} />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="やり直し (Ctrl+Y)"
            className={`p-1.5 rounded transition-colors ${
              canRedo
                ? 'hover:bg-[#1C1F24] text-[#E8EAF0]'
                : 'text-[#6B7280] opacity-40 cursor-not-allowed'
            }`}
          >
            <Redo size={14} />
          </button>
        </div>

        <div className="w-px h-4 bg-[#2A2D35]" />

        {/* Assist Quick Triggers */}
        <div className="flex items-center gap-1">
          <button
            onClick={onSuggestColors}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[#1C1F24] text-[#E8EAF0] hover:text-[#A78BFA] transition-colors"
            title="配色パレット提案"
          >
            <Sparkles size={13} className="text-[#A78BFA]" />
            <span>配色提案</span>
          </button>

          <button
            onClick={onAutoPanel}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[#1C1F24] text-[#E8EAF0] hover:text-[#34D399] transition-colors"
            title="マンガのコマ割り自動生成"
          >
            <Columns size={13} className="text-[#34D399]" />
            <span>コマ自動分割</span>
          </button>

          <button
            onClick={onSimplify}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[#1C1F24] text-[#E8EAF0] hover:text-[#FBBF24] transition-colors"
            title="アンカーポイント軽量化"
          >
            <Wand2 size={13} className="text-[#FBBF24]" />
            <span>アンカー軽量化</span>
          </button>
        </div>
      </div>

      {/* Right Viewport Controls */}
      <div className="flex items-center gap-3">
        {/* Document Dimensions */}
        <span className="text-[#6B7280] text-[11px] font-mono">
          {docWidth} × {docHeight} px
        </span>

        <div className="w-px h-4 bg-[#2A2D35]" />

        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setZoom(Math.max(0.1, zoom * 0.85))}
            className="p-1 rounded hover:bg-[#1C1F24] text-[#E8EAF0]"
            title="ズームアウト"
          >
            <ZoomOut size={13} />
          </button>

          <span className="w-12 text-center font-mono text-[11px]">
            {Math.round(zoom * 100)}%
          </span>

          <button
            onClick={() => setZoom(Math.min(10.0, zoom * 1.15))}
            className="p-1 rounded hover:bg-[#1C1F24] text-[#E8EAF0]"
            title="ズームイン"
          >
            <ZoomIn size={13} />
          </button>

          <button
            onClick={() => setZoom(1.0)}
            className="px-1.5 py-0.5 rounded text-[10px] bg-[#1C1F24] hover:bg-[#2A2D35] text-[#E8EAF0]"
            title="100%にリセット"
          >
            100%
          </button>
        </div>
      </div>
    </header>
  );
};
