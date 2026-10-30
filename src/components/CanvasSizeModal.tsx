import React, { useState, useEffect } from 'react';
import { Document } from '../types';
import { 
  Maximize2, 
  FilePlus, 
  Link, 
  Unlink, 
  ArrowLeftRight, 
  X, 
  Check, 
  BookOpen, 
  Monitor, 
  Smartphone,
  Layers
} from 'lucide-react';

export interface CanvasPreset {
  id: string;
  name: string;
  category: 'manga' | 'illust' | 'webtoon';
  width: number;
  height: number;
  description: string;
  webtoon?: boolean;
}

export const CANVAS_PRESETS: CanvasPreset[] = [
  // 漫画・同人誌
  { id: 'b5_print', name: 'B5 商業誌原稿 (600dpi相当)', category: 'manga', width: 2570, height: 3640, description: '商業漫画・同人誌の標準印刷サイズ' },
  { id: 'a4_print', name: 'A4 カラーイラスト (350dpi相当)', category: 'manga', width: 2894, height: 4093, description: 'A4本・イラスト集・高解像度印刷' },
  { id: 'b5_compact', name: 'B5 縮小判 (下描き・Web公開)', category: 'manga', width: 1820, height: 2570, description: '作業が軽快なB5黄金比率' },
  { id: 'a5_book', name: 'A5 単行本・同人誌', category: 'manga', width: 1748, height: 2480, description: 'A5サイズの文庫・同人誌' },
  { id: 'yonkoma', name: '4コマ漫画 (縦長)', category: 'manga', width: 1200, height: 3600, description: '縦に並べる4コマ漫画フォーマット' },

  // イラスト・WEB・SNS
  { id: 'fhd', name: 'Full HD (16:9)', category: 'illust', width: 1920, height: 1080, description: '標準PCディスプレイ・YouTube背景' },
  { id: '4k', name: '4K UHD (16:9)', category: 'illust', width: 3840, height: 2160, description: '超高精細4Kイラスト' },
  { id: 'square', name: '正方形・SNSアイコン (1:1)', category: 'illust', width: 1080, height: 1080, description: 'Instagram・Twitter/X アイコン' },
  { id: 'mobile_story', name: 'スマホ縦画面 (9:16)', category: 'illust', width: 1080, height: 1920, description: 'スマホ壁紙・ストーリー・TikTok' },
  { id: 'x_header', name: 'X / Twitter ヘッダー (3:1)', category: 'illust', width: 1500, height: 500, description: 'Twitter/X プロフィールヘッダー' },
  { id: 'pixiv_std', name: 'Pixiv イラスト標準 (B5比率)', category: 'illust', width: 2000, height: 2800, description: 'イラスト投稿サイト推奨サイズ' },

  // Webtoon
  { id: 'webtoon_std', name: 'Webtoon 標準 (1話単位)', category: 'webtoon', width: 800, height: 4800, description: 'スマホ縦スクロールフルカラー漫画', webtoon: true },
  { id: 'webtoon_long', name: 'Webtoon ロング (連載向け)', category: 'webtoon', width: 800, height: 9600, description: '長尺スクロール', webtoon: true },
  { id: 'webtoon_short', name: 'Webtoon ショート', category: 'webtoon', width: 800, height: 2400, description: '短編・プロローグ', webtoon: true },
];

interface CanvasSizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWidth: number;
  currentHeight: number;
  initialMode?: 'resize' | 'new';
  onApply: (width: number, height: number, mode: 'resize' | 'new', keepCentered: boolean, webtoon: boolean) => void;
}

export const CanvasSizeModal: React.FC<CanvasSizeModalProps> = ({
  isOpen,
  onClose,
  currentWidth,
  currentHeight,
  initialMode = 'resize',
  onApply,
}) => {
  const [modalMode, setModalMode] = useState<'resize' | 'new'>(initialMode);
  const [width, setWidth] = useState<number>(currentWidth);
  const [height, setHeight] = useState<number>(currentHeight);
  const [lockAspect, setLockAspect] = useState<boolean>(false);
  const [aspectRatio, setAspectRatio] = useState<number>(currentWidth / currentHeight);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<'manga' | 'illust' | 'webtoon'>('manga');
  const [keepCentered, setKeepCentered] = useState<boolean>(true);
  const [isWebtoon, setIsWebtoon] = useState<boolean>(false);

  // Sync with current props when opened
  useEffect(() => {
    if (isOpen) {
      setModalMode(initialMode);
      setWidth(currentWidth);
      setHeight(currentHeight);
      setAspectRatio(currentWidth / Math.max(1, currentHeight));
      // Match existing preset if any
      const match = CANVAS_PRESETS.find(p => p.width === currentWidth && p.height === currentHeight);
      if (match) {
        setSelectedPresetId(match.id);
        setActiveCategory(match.category);
        setIsWebtoon(!!match.webtoon);
      } else {
        setSelectedPresetId('');
      }
    }
  }, [isOpen, currentWidth, currentHeight, initialMode]);

  if (!isOpen) return null;

  const handleWidthChange = (val: number) => {
    const w = Math.max(100, Math.min(16000, val));
    setWidth(w);
    if (lockAspect && aspectRatio > 0) {
      setHeight(Math.round(w / aspectRatio));
    }
    setSelectedPresetId('');
  };

  const handleHeightChange = (val: number) => {
    const h = Math.max(100, Math.min(24000, val));
    setHeight(h);
    if (lockAspect && aspectRatio > 0) {
      setWidth(Math.round(h * aspectRatio));
    }
    setSelectedPresetId('');
  };

  const handleSwapOrientation = () => {
    const tempW = width;
    const tempH = height;
    setWidth(tempH);
    setHeight(tempW);
    setAspectRatio(tempH / Math.max(1, tempW));
    setSelectedPresetId('');
  };

  const handleSelectPreset = (p: CanvasPreset) => {
    setWidth(p.width);
    setHeight(p.height);
    setAspectRatio(p.width / p.height);
    setSelectedPresetId(p.id);
    setIsWebtoon(!!p.webtoon);
  };

  const handleConfirm = () => {
    onApply(width, height, modalMode, keepCentered, isWebtoon);
    onClose();
  };

  // Proportional visual preview
  const renderPreviewBox = () => {
    const maxBoxSize = 180;
    const isWider = width >= height;
    const boxW = isWider ? maxBoxSize : Math.max(40, (width / height) * maxBoxSize);
    const boxH = isWider ? Math.max(40, (height / width) * maxBoxSize) : maxBoxSize;

    // Relative to old size if in resize mode
    let oldBoxW = boxW;
    let oldBoxH = boxH;
    if (modalMode === 'resize') {
      const scale = boxW / width;
      oldBoxW = Math.max(10, currentWidth * scale);
      oldBoxH = Math.max(10, currentHeight * scale);
    }

    return (
      <div className="w-full h-48 bg-zinc-950 rounded-xl border border-zinc-800 flex flex-col items-center justify-center relative overflow-hidden p-4">
        <div 
          className="relative bg-zinc-800/80 border-2 border-indigo-500 rounded flex items-center justify-center shadow-lg transition-all"
          style={{ width: `${boxW}px`, height: `${boxH}px` }}
        >
          {modalMode === 'resize' && (
            <div 
              className="absolute border border-dashed border-amber-400 bg-amber-400/10 pointer-events-none rounded-xs"
              style={{
                width: `${Math.min(boxW, oldBoxW)}px`,
                height: `${Math.min(boxH, oldBoxH)}px`,
              }}
              title="元の描画領域 (中央維持)"
            />
          )}
          <span className="text-[10px] text-zinc-300 font-mono z-10 bg-zinc-900/80 px-1.5 py-0.5 rounded backdrop-blur">
            {width} × {height}
          </span>
        </div>

        <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
          <span>アスペクト比: {(width / height).toFixed(2)} : 1</span>
          {modalMode === 'resize' && (
            <span className="text-amber-400/90 flex items-center gap-1">
              <span className="w-2 h-2 border border-dashed border-amber-400 inline-block" />
              破線: 現在の描画
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <Maximize2 className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-zinc-100">
              {modalMode === 'resize' ? 'キャンバスサイズ変更' : '新規キャンバス作成'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="px-6 pt-4">
          <div className="flex p-1 bg-zinc-800 rounded-xl">
            <button
              onClick={() => setModalMode('resize')}
              className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors ${
                modalMode === 'resize'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              現在のキャンバスをリサイズ (描画維持)
            </button>
            <button
              onClick={() => setModalMode('new')}
              className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors ${
                modalMode === 'new'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FilePlus className="w-3.5 h-3.5" />
              新規キャンバス作成 (白紙)
            </button>
          </div>
        </div>

        {/* Body: Left Presets + Right Numeric Form & Preview */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-zinc-300">
          {/* Left: Presets Column */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="font-semibold text-zinc-200">プリセット規格</span>
              <div className="flex gap-1">
                {[
                  { id: 'manga', label: '漫画・印刷', icon: <BookOpen className="w-3 h-3" /> },
                  { id: 'illust', label: 'Web・SNS', icon: <Monitor className="w-3 h-3" /> },
                  { id: 'webtoon', label: 'Webtoon', icon: <Smartphone className="w-3 h-3" /> },
                ].map(c => (
                  <button
                    key={c.id}
                    onClick={() => setActiveCategory(c.id as any)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                      activeCategory === c.id
                        ? 'bg-zinc-700 text-white'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                    }`}
                  >
                    {c.icon}
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Presets List */}
            <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1">
              {CANVAS_PRESETS.filter(p => p.category === activeCategory).map(p => {
                const isSelected = selectedPresetId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPreset(p)}
                    className={`p-2.5 rounded-xl border text-left flex flex-col gap-0.5 transition-colors ${
                      isSelected
                        ? 'bg-indigo-600/15 border-indigo-500 text-zinc-100 shadow-xs'
                        : 'bg-zinc-800/40 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-100">{p.name}</span>
                      <span className="font-mono text-[10px] text-indigo-400">
                        {p.width} × {p.height}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400">{p.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Numeric Input & Preview */}
          <div className="flex flex-col gap-4">
            <span className="font-semibold text-zinc-200 border-b border-zinc-800 pb-2">
              カスタム数値指定
            </span>

            {/* Width, Height, Lock, Swap */}
            <div className="flex items-center gap-2">
              {/* Width Input */}
              <div className="flex-1 flex flex-col gap-1">
                <span className="text-[10px] text-zinc-400">幅 (Width):</span>
                <div className="flex items-center bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 focus-within:border-indigo-500">
                  <input
                    type="number"
                    value={width}
                    onChange={e => handleWidthChange(Number(e.target.value))}
                    step="10"
                    min="100"
                    max="16000"
                    className="w-full bg-transparent text-zinc-100 font-mono text-xs focus:outline-none"
                  />
                  <span className="text-[10px] text-zinc-500 ml-1">px</span>
                </div>
              </div>

              {/* Lock & Swap Controls */}
              <div className="flex flex-col gap-1 pt-3.5">
                <button
                  onClick={() => {
                    if (!lockAspect) {
                      setAspectRatio(width / Math.max(1, height));
                    }
                    setLockAspect(!lockAspect);
                  }}
                  title={lockAspect ? '縦横比固定を解除' : '現在の縦横比を固定'}
                  className={`p-1.5 rounded-lg border transition-colors ${
                    lockAspect
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border-zinc-700'
                  }`}
                >
                  {lockAspect ? <Link className="w-3.5 h-3.5" /> : <Unlink className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={handleSwapOrientation}
                  title="縦横向きを反転"
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-zinc-700 transition-colors"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Height Input */}
              <div className="flex-1 flex flex-col gap-1">
                <span className="text-[10px] text-zinc-400">高さ (Height):</span>
                <div className="flex items-center bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 focus-within:border-indigo-500">
                  <input
                    type="number"
                    value={height}
                    onChange={e => handleHeightChange(Number(e.target.value))}
                    step="10"
                    min="100"
                    max="24000"
                    className="w-full bg-transparent text-zinc-100 font-mono text-xs focus:outline-none"
                  />
                  <span className="text-[10px] text-zinc-500 ml-1">px</span>
                </div>
              </div>
            </div>

            {/* Resize Option (Keep centered) */}
            {modalMode === 'resize' && (
              <label className="flex items-center gap-2 cursor-pointer bg-zinc-800/40 p-2 rounded-lg border border-zinc-800">
                <input
                  type="checkbox"
                  checked={keepCentered}
                  onChange={e => setKeepCentered(e.target.checked)}
                  className="rounded bg-zinc-700 border-zinc-600 text-indigo-500 focus:ring-0"
                />
                <span className="text-[11px] text-zinc-300">
                  既存の描画内容をキャンバス中央に維持して余白を伸縮する (推奨)
                </span>
              </label>
            )}

            {/* Visual Preview Box */}
            {renderPreviewBox()}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
          <span className="text-xs text-zinc-400">
            {modalMode === 'resize'
              ? `変更後: ${width} × ${height}px (${(width >= currentWidth ? '+' : '')}${width - currentWidth}px, ${(height >= currentHeight ? '+' : '')}${height - currentHeight}px)`
              : `新規白紙キャンバス: ${width} × ${height}px`}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleConfirm}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium shadow-md flex items-center gap-1.5 transition-colors"
            >
              <Check className="w-4 h-4" />
              {modalMode === 'resize' ? 'サイズを変更' : '新規作成'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
