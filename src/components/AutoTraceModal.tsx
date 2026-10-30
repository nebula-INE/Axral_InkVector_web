import React, { useState, useEffect, useRef } from 'react';
import { VPath, AutoTraceConfig } from '../types';
import { vectorizeImage, TraceProgress } from '../utils/vectorize';
import { Upload, Image as ImageIcon, Sparkles, X, Check, Eye, Sliders, AlertCircle } from 'lucide-react';

interface AutoTraceModalProps {
  isOpen: boolean;
  onClose: () => void;
  canvasWidth: number;
  canvasHeight: number;
  onCommitPaths: (paths: VPath[], name: string) => void;
  initialImageDataUrl?: string | null;
}

export const AutoTraceModal: React.FC<AutoTraceModalProps> = ({
  isOpen,
  onClose,
  canvasWidth,
  canvasHeight,
  onCommitPaths,
  initialImageDataUrl,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [config, setConfig] = useState<AutoTraceConfig>({
    threshold: 140,
    invert: false,
    denoise: 1,
    smoothing: 2.0,
    strokeWidth: 2.5,
    strokeColor: '#18181b',
  });

  const [previewPaths, setPreviewPaths] = useState<VPath[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<TraceProgress>({ status: '', percent: 0 });
  const [showOriginal, setShowOriginal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Set initial image if provided (e.g. from clipboard paste)
  useEffect(() => {
    if (initialImageDataUrl) {
      loadImage(initialImageDataUrl);
    }
  }, [initialImageDataUrl]);

  const loadImage = (url: string) => {
    setImageSrc(url);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImageElement(img);
    };
    img.src = url;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = ev => {
        if (ev.target?.result) {
          loadImage(ev.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Run vectorization debounce when config or image changes
  useEffect(() => {
    if (!imageElement || !isOpen) return;

    let cancelled = false;
    const timeout = setTimeout(async () => {
      setIsProcessing(true);
      try {
        const paths = await vectorizeImage(
          imageElement,
          config,
          canvasWidth,
          canvasHeight,
          p => {
            if (!cancelled) setProgress(p);
          }
        );
        if (!cancelled) {
          setPreviewPaths(paths);
        }
      } catch (err) {
        console.error('Vectorize error:', err);
      } finally {
        if (!cancelled) setIsProcessing(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [imageElement, config, canvasWidth, canvasHeight, isOpen]);

  // Render preview canvas
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !isOpen) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pw = canvas.width;
    const ph = canvas.height;
    ctx.clearRect(0, 0, pw, ph);

    // Background paper
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pw, ph);

    if (!imageElement) return;

    const scale = Math.min(pw / canvasWidth, ph / canvasHeight) * 0.94;
    const offsetX = (pw - canvasWidth * scale) / 2;
    const offsetY = (ph - canvasHeight * scale) / 2;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Draw original image if toggled or faded in background
    if (showOriginal) {
      ctx.drawImage(imageElement, 0, 0, canvasWidth, canvasHeight);
    } else {
      // Faded original in background
      ctx.globalAlpha = 0.25;
      ctx.drawImage(imageElement, 0, 0, canvasWidth, canvasHeight);
      ctx.globalAlpha = 1.0;

      // Draw vectorized Bézier strokes
      ctx.strokeStyle = config.strokeColor;
      ctx.lineWidth = config.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (const p of previewPaths) {
        ctx.beginPath();
        for (let i = 0; i < p.nodes.length; i++) {
          const pt = p.nodes[i].pos;
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        if (p.closed) ctx.closePath();
        ctx.stroke();
      }
    }

    ctx.restore();
  }, [imageElement, previewPaths, showOriginal, config, canvasWidth, canvasHeight, isOpen]);

  if (!isOpen) return null;

  const handleCommit = () => {
    if (previewPaths.length === 0) return;
    onCommitPaths(previewPaths, '下描きベクター化');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-zinc-100">
              下描き・スケッチ画像のワンクリック・ベクター化
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Controls */}
          <div className="w-full md:w-80 border-r border-zinc-800 p-5 flex flex-col gap-4 overflow-y-auto text-xs text-zinc-300">
            {/* File Upload / Paste Area */}
            {!imageElement ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-700 hover:border-indigo-500 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-zinc-800/40 hover:bg-zinc-800/70"
              >
                <Upload className="w-8 h-8 text-zinc-500 mb-2" />
                <span className="font-medium text-zinc-200 mb-1">
                  画像を選択 または Ctrl+V で貼り付け
                </span>
                <span className="text-[11px] text-zinc-500">
                  スマホで撮った下描きやラフ線画 (PNG, JPEG, WebP)
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="flex items-center justify-between bg-zinc-800/70 p-2.5 rounded-lg border border-zinc-700">
                <div className="flex items-center gap-2 overflow-hidden">
                  <ImageIcon className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="truncate font-medium text-zinc-200">
                    画像読み込み済み ({previewPaths.length}個のベクターパス抽出)
                  </span>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline shrink-0 ml-2"
                >
                  変更
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            )}

            {/* Parameter Sliders */}
            <div className="flex flex-col gap-3.5">
              <div>
                <div className="flex justify-between text-zinc-400 mb-1">
                  <span>2値化しきい値 (Threshold):</span>
                  <span className="font-mono text-zinc-200">{config.threshold}</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="220"
                  value={config.threshold}
                  onChange={e => setConfig({ ...config, threshold: Number(e.target.value) })}
                  className="w-full accent-indigo-500 h-1.5 bg-zinc-700 rounded-lg"
                />
              </div>

              <div>
                <div className="flex justify-between text-zinc-400 mb-1">
                  <span>線の滑らかさ (Smoothing):</span>
                  <span className="font-mono text-zinc-200">{config.smoothing}</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="5.0"
                  step="0.25"
                  value={config.smoothing}
                  onChange={e => setConfig({ ...config, smoothing: Number(e.target.value) })}
                  className="w-full accent-indigo-500 h-1.5 bg-zinc-700 rounded-lg"
                />
              </div>

              <div>
                <div className="flex justify-between text-zinc-400 mb-1">
                  <span>ノイズ除去フィルター (Denoise):</span>
                  <span className="font-mono text-zinc-200">{config.denoise} パス</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="1"
                  value={config.denoise}
                  onChange={e => setConfig({ ...config, denoise: Number(e.target.value) })}
                  className="w-full accent-indigo-500 h-1.5 bg-zinc-700 rounded-lg"
                />
              </div>

              <div>
                <div className="flex justify-between text-zinc-400 mb-1">
                  <span>生成ベクター線幅 (Stroke Width):</span>
                  <span className="font-mono text-zinc-200">{config.strokeWidth}px</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  step="0.5"
                  value={config.strokeWidth}
                  onChange={e => setConfig({ ...config, strokeWidth: Number(e.target.value) })}
                  className="w-full accent-indigo-500 h-1.5 bg-zinc-700 rounded-lg"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={config.invert}
                  onChange={e => setConfig({ ...config, invert: e.target.checked })}
                  className="rounded bg-zinc-700 border-zinc-600 text-indigo-500 focus:ring-0"
                />
                <span>白黒反転 (黒背景の白い線を抽出)</span>
              </label>
            </div>

            {/* Toggle view button */}
            {imageElement && (
              <button
                onClick={() => setShowOriginal(s => !s)}
                className={`py-2 px-3 rounded-lg border font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  showOriginal
                    ? 'bg-zinc-700 text-white border-zinc-600'
                    : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                }`}
              >
                <Eye className="w-4 h-4" />
                {showOriginal ? 'ベクター抽出プレビューを表示' : '元画像と比較表示'}
              </button>
            )}
          </div>

          {/* Canvas Preview Area */}
          <div className="flex-1 bg-zinc-950 p-6 flex flex-col items-center justify-center relative">
            {isProcessing && (
              <div className="absolute top-4 right-6 flex items-center gap-2 bg-indigo-900/80 border border-indigo-500 text-indigo-200 px-3 py-1 rounded-full text-xs backdrop-blur shadow-md">
                <div className="w-2.5 h-2.5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                <span>{progress.status}</span>
              </div>
            )}

            <div className="w-full max-w-lg aspect-[16/10] bg-zinc-900 rounded-xl overflow-hidden shadow-2xl border border-zinc-800 flex items-center justify-center relative">
              {!imageElement ? (
                <div className="text-zinc-500 flex flex-col items-center gap-2 text-xs">
                  <ImageIcon className="w-10 h-10 opacity-30" />
                  <span>画像をアップロードまたは貼り付けてください</span>
                </div>
              ) : (
                <canvas
                  ref={previewCanvasRef}
                  width={640}
                  height={400}
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            <span className="text-[11px] text-zinc-500 mt-2">
              ※抽出された線はすべてベクター化され、後から太さやノードを自在に修正できます
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
          <span className="text-xs text-zinc-400">
            {previewPaths.length > 0 ? `${previewPaths.length}本のストロークを生成` : '画像を読み込んでください'}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleCommit}
              disabled={previewPaths.length === 0}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-white rounded-lg text-xs font-medium shadow-md flex items-center gap-1.5 transition-colors"
            >
              <Check className="w-4 h-4" />
              ベクターレイヤーに展開
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
