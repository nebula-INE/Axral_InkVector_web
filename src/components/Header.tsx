import React, { useRef, useState } from 'react';
import { Document, SymmetryMode } from '../types';
import { 
  Undo2, 
  Redo2, 
  Download, 
  Upload, 
  RotateCcw, 
  HelpCircle,
  FlipHorizontal,
  Maximize2,
  Copy,
  Check,
  X,
  FilePlus
} from 'lucide-react';
import { documentToSvg, svgToDocument } from '../utils/svg';

interface HeaderProps {
  doc: Document;
  onUpdateDoc: (newDoc: Document) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoomChange: (z: number) => void;
  rotation: number;
  onRotationChange: (r: number) => void;
  stabilizer: number;
  onStabilizerChange: (s: number) => void;
  flipH: boolean;
  onToggleFlipH: () => void;
  onFitToScreen: () => void;
  onOpenShortcuts: () => void;
  onStatusChange: (msg: string) => void;
  onOpenCanvasModal?: (mode: 'resize' | 'new') => void;
}

export const Header: React.FC<HeaderProps> = ({
  doc,
  onUpdateDoc,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onZoomChange,
  rotation,
  onRotationChange,
  stabilizer,
  onStabilizerChange,
  flipH,
  onToggleFlipH,
  onFitToScreen,
  onOpenShortcuts,
  onStatusChange,
  onOpenCanvasModal,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportScale, setExportScale] = useState<1 | 2 | 4>(2);
  const [exportFormat, setExportFormat] = useState<'png' | 'webp' | 'svg'>('png');
  const [exportTransparent, setExportTransparent] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Advanced High-Res Export function
  const executeExport = (copyToClipboard = false) => {
    if (exportFormat === 'svg') {
      const svgStr = documentToSvg(doc);
      if (copyToClipboard) {
        navigator.clipboard.writeText(svgStr);
        setCopiedNotification(true);
        setTimeout(() => setCopiedNotification(false), 2000);
        onStatusChange('SVGコードをクリップボードにコピーしました');
        return;
      }
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.title || 'artwork'}.svg`;
      a.click();
      URL.revokeObjectURL(url);
      onStatusChange('SVGを書き出しました');
      setShowExportModal(false);
      return;
    }

    const scale = exportScale;
    const canvas = document.createElement('canvas');
    canvas.width = doc.width * scale;
    canvas.height = doc.height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const svgStr = documentToSvg(doc);
    const img = new Image();
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      if (!exportTransparent) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      const mime = exportFormat === 'webp' ? 'image/webp' : 'image/png';
      const ext = exportFormat === 'webp' ? 'webp' : 'png';

      if (copyToClipboard && navigator.clipboard && 'write' in navigator.clipboard) {
        canvas.toBlob(pngBlob => {
          if (!pngBlob) return;
          try {
            navigator.clipboard.write([
              new ClipboardItem({ 'image/png': pngBlob })
            ]);
            setCopiedNotification(true);
            setTimeout(() => setCopiedNotification(false), 2000);
            onStatusChange('画像をクリップボードにコピーしました');
          } catch {
            onStatusChange('クリップボードコピーに対応していません');
          }
        }, 'image/png');
        return;
      }

      canvas.toBlob(resBlob => {
        if (!resBlob) return;
        const resUrl = URL.createObjectURL(resBlob);
        const a = document.createElement('a');
        a.href = resUrl;
        a.download = `${doc.title || 'artwork'}_${scale}x.${ext}`;
        a.click();
        URL.revokeObjectURL(resUrl);
        onStatusChange(`${scale}倍高解像度 ${ext.toUpperCase()} を書き出しました (${canvas.width}×${canvas.height}px)`);
        setShowExportModal(false);
      }, mime);
    };
    img.src = url;
  };

  // Import SVG
  const handleImportSvg = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      const content = ev.target?.result as string;
      const importedDoc = svgToDocument(content);
      if (importedDoc) {
        onUpdateDoc(importedDoc);
        onStatusChange(`SVG「${file.name}」を正常に読み込みました`);
      } else {
        onStatusChange('SVGファイルの解析に失敗しました');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Canvas size presets
  const applyPreset = (w: number, h: number, webtoon = false) => {
    onUpdateDoc({
      ...doc,
      width: w,
      height: h,
      webtoonMode: webtoon,
      symmetryCenter: { x: w / 2, y: h / 2 },
    });
    onStatusChange(`キャンバスサイズ変更: ${w} × ${h}px`);
  };

  // Create new blank document
  const handleNewDoc = () => {
    onUpdateDoc({
      ...doc,
      layers: doc.layers.map(l => ({ ...l, paths: [] })),
    });
    onStatusChange('白紙の新規キャンバスを作成しました (Ctrl+Zで元に戻せます)');
  };

  return (
    <header className="h-12 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-3 z-30 select-none text-xs text-zinc-300">
      {/* Brand & Document Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 font-bold text-white text-sm tracking-wide">
          <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center text-white text-xs font-black shadow-sm shadow-indigo-500/50">
            V
          </div>
          <span>VektorStudio</span>
        </div>

        <input
          type="text"
          value={doc.title}
          onChange={e => onUpdateDoc({ ...doc, title: e.target.value })}
          className="bg-zinc-800/60 border border-zinc-700/60 rounded px-2 py-0.5 text-zinc-200 focus:outline-none focus:border-indigo-500 w-36 text-xs"
        />

        {/* Canvas Size Trigger Button */}
        <button
          onClick={() => onOpenCanvasModal?.('resize')}
          title="キャンバスサイズ設定・変更 (プリセット・数値入力・余白拡張)"
          className="flex items-center gap-1.5 bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700 rounded px-2.5 py-1 text-zinc-200 transition-colors cursor-pointer group"
        >
          <Maximize2 className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
          <span className="font-mono text-xs">{doc.width} × {doc.height}px</span>
          <span className="text-[10px] text-zinc-400 bg-zinc-700/50 px-1 py-0.5 rounded">設定</span>
        </button>
      </div>

      {/* Center Tools: Undo, Redo, Symmetry, Stabilizer */}
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-zinc-800/80 rounded border border-zinc-700/50 p-0.5">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="元に戻す (Ctrl+Z)"
            className="p-1.5 rounded hover:bg-zinc-700 text-zinc-300 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="やり直す (Ctrl+Y)"
            className="p-1.5 rounded hover:bg-zinc-700 text-zinc-300 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Symmetry Ruler */}
        <div className="flex items-center gap-1 bg-zinc-800/80 rounded border border-zinc-700/50 px-2 py-1">
          <span className="text-zinc-400 font-medium">定規:</span>
          <select
            value={doc.symmetry}
            onChange={e => onUpdateDoc({ ...doc, symmetry: e.target.value as SymmetryMode })}
            className="bg-transparent text-zinc-200 focus:outline-none cursor-pointer"
          >
            <option value="none" className="bg-zinc-800">なし</option>
            <option value="vertical" className="bg-zinc-800">左右対称</option>
            <option value="horizontal" className="bg-zinc-800">上下対称</option>
            <option value="cross" className="bg-zinc-800">4方向対称</option>
          </select>
        </div>

        {/* Stabilizer (手ブレ補正) */}
        <div className="flex items-center gap-1.5 bg-zinc-800/80 rounded border border-zinc-700/50 px-2 py-1">
          <span className="text-zinc-400 font-medium">手ブレ補正:</span>
          <input
            type="range"
            min="0"
            max="10"
            value={stabilizer}
            onChange={e => onStabilizerChange(parseInt(e.target.value))}
            className="w-16 accent-indigo-500 cursor-pointer"
          />
          <span className="w-3 text-right text-indigo-400 font-mono">{stabilizer}</span>
        </div>
      </div>

      {/* Right Controls: Flip, Fit, Zoom, Export, Help */}
      <div className="flex items-center gap-2">
        {/* Horizontal Flip View (左右反転表示) */}
        <button
          onClick={onToggleFlipH}
          title="左右反転表示 (デッサン・バランス確認)"
          className={`flex items-center gap-1 px-2 py-1 rounded border transition-colors ${
            flipH
              ? 'bg-indigo-600 text-white border-indigo-500 font-medium'
              : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
          }`}
        >
          <FlipHorizontal className="w-3.5 h-3.5" />
          <span>反転</span>
        </button>

        {/* Fit to Screen (画面全体フィット) */}
        <button
          onClick={onFitToScreen}
          title="画面全体フィット (Ctrl+0)"
          className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>フィット</span>
        </button>

        {/* Zoom */}
        <div className="flex items-center gap-1 bg-zinc-800/80 rounded border border-zinc-700/50 px-2 py-1">
          <span className="font-mono text-zinc-300 min-w-10 text-right">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => onZoomChange(1.0)}
            title="100%等倍表示 (Ctrl+1)"
            className="px-1 text-zinc-400 hover:text-white"
          >
            1:1
          </button>
        </div>

        {/* Rotation */}
        {rotation !== 0 && (
          <button
            onClick={() => onRotationChange(0)}
            title="回転リセット (Ctrl+Shift+0)"
            className="flex items-center gap-1 px-1.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-indigo-400 border border-zinc-700"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{Math.round(rotation)}°</span>
          </button>
        )}

        {/* New Canvas */}
        <button
          onClick={() => {
            if (onOpenCanvasModal) onOpenCanvasModal('new');
            else handleNewDoc();
          }}
          title="新規キャンバス (サイズ指定して白紙作成)"
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 transition-colors"
        >
          <FilePlus className="w-3.5 h-3.5 text-indigo-400" />
          <span>新規</span>
        </button>

        {/* SVG Import */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".svg"
          onChange={handleImportSvg}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          title="SVGを開く (Ctrl+O)"
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>開く</span>
        </button>

        {/* Export Modal Trigger */}
        <button
          onClick={() => setShowExportModal(true)}
          title="書き出し設定 (高解像度 PNG / WebP / SVG)"
          className="flex items-center gap-1.5 px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-sm transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>書き出し</span>
        </button>

        {/* Shortcuts Help */}
        <button
          onClick={onOpenShortcuts}
          title="ショートカット一覧"
          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {/* High-Resolution Export Modal */}
      {showExportModal && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => setShowExportModal(false)}
        >
          <div 
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 w-full max-w-md shadow-2xl flex flex-col gap-4 text-xs text-zinc-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="font-semibold text-sm text-white flex items-center gap-2">
                <Download className="w-4 h-4 text-indigo-400" />
                作品の書き出し (Export)
              </span>
              <button 
                onClick={() => setShowExportModal(false)}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Resolution Scale */}
            <div className="flex flex-col gap-1.5">
              <span className="text-zinc-400 font-medium">出力解像度倍率:</span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { scale: 1, label: '1倍 (等倍)', desc: `${doc.width}×${doc.height}px` },
                  { scale: 2, label: '2倍 (SNS推奨)', desc: `${doc.width * 2}×${doc.height * 2}px` },
                  { scale: 4, label: '4倍 (超高精細)', desc: `${doc.width * 4}×${doc.height * 4}px` },
                ].map(item => (
                  <button
                    key={item.scale}
                    onClick={() => setExportScale(item.scale as any)}
                    className={`flex flex-col items-center p-2 rounded-lg border text-center transition-all ${
                      exportScale === item.scale
                        ? 'bg-indigo-950/60 border-indigo-500 text-white font-medium'
                        : 'bg-zinc-800/40 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className="text-[10px] text-zinc-500 font-mono mt-0.5">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Format Selection */}
            <div className="flex flex-col gap-1.5">
              <span className="text-zinc-400 font-medium">フォーマット:</span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { fmt: 'png', label: 'PNG画像' },
                  { fmt: 'webp', label: 'WebP画像' },
                  { fmt: 'svg', label: 'SVGベクター' },
                ].map(item => (
                  <button
                    key={item.fmt}
                    onClick={() => setExportFormat(item.fmt as any)}
                    className={`py-1.5 rounded-lg border text-center transition-all ${
                      exportFormat === item.fmt
                        ? 'bg-indigo-600 border-indigo-400 text-white font-medium'
                        : 'bg-zinc-800/40 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Options */}
            {exportFormat !== 'svg' && (
              <label className="flex items-center gap-2 text-zinc-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={exportTransparent}
                  onChange={e => setExportTransparent(e.target.checked)}
                  className="rounded border-zinc-700 accent-indigo-500"
                />
                <span>背景を透過して書き出す (Transparent Background)</span>
              </label>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-3 border-t border-zinc-800">
              <button
                onClick={() => executeExport(true)}
                className="flex-1 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-medium flex items-center justify-center gap-1.5"
              >
                {copiedNotification ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedNotification ? 'コピー完了！' : '画像をクリップボードにコピー'}</span>
              </button>
              <button
                onClick={() => executeExport(false)}
                className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/30"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ファイルを保存</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
