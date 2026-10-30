import React, { useState, useEffect, useRef } from 'react';
import { Point, VPath, FocusLineConfig, SpeedLineConfig, BurstLineConfig } from '../types';
import { generateVectorFocusLines, generateVectorSpeedLines, generateVectorBurstLines } from '../utils/geometry';
import { Sparkles, Zap, Wind, X, Check, RefreshCw } from 'lucide-react';

interface EffectLineModalProps {
  isOpen: boolean;
  onClose: () => void;
  canvasWidth: number;
  canvasHeight: number;
  onCommitPaths: (paths: VPath[], name: string) => void;
}

export const EffectLineModal: React.FC<EffectLineModalProps> = ({
  isOpen,
  onClose,
  canvasWidth,
  canvasHeight,
  onCommitPaths,
}) => {
  const [tab, setTab] = useState<'focus' | 'speed' | 'burst'>('focus');
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [seed, setSeed] = useState(0);

  // Focus line config
  const [focusConfig, setFocusConfig] = useState<FocusLineConfig>({
    count: 64,
    innerRadiusRatio: 0.22,
    outerRadiusRatio: 0.85,
    strokeWidth: 3,
    taper: true,
    jitter: 0.5,
  });

  // Speed line config
  const [speedConfig, setSpeedConfig] = useState<SpeedLineConfig>({
    count: 48,
    angle: 30,
    length: 600,
    strokeWidth: 3,
    jitter: 0.5,
    taper: true,
  });

  // Burst line config
  const [burstConfig, setBurstConfig] = useState<BurstLineConfig>({
    count: 24,
    innerRadius: 120,
    outerRadius: 280,
    strokeWidth: 4,
    raggedness: 0.6,
  });

  // Center position (default to middle of canvas)
  const [center, setCenter] = useState<Point>({ x: canvasWidth / 2, y: canvasHeight / 2 });

  useEffect(() => {
    setCenter({ x: canvasWidth / 2, y: canvasHeight / 2 });
  }, [canvasWidth, canvasHeight]);

  // Generate paths for preview
  const generateCurrentPaths = (): VPath[] => {
    if (tab === 'focus') {
      return generateVectorFocusLines(center, canvasWidth, canvasHeight, focusConfig);
    } else if (tab === 'speed') {
      return generateVectorSpeedLines(canvasWidth, canvasHeight, speedConfig);
    } else {
      return [generateVectorBurstLines(center, burstConfig)];
    }
  };

  // Render preview
  useEffect(() => {
    if (!isOpen) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pw = canvas.width;
    const ph = canvas.height;
    ctx.clearRect(0, 0, pw, ph);

    // Background paper
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pw, ph);

    // Subtle grid
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let x = 0; x < pw; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ph);
      ctx.stroke();
    }
    for (let y = 0; y < ph; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(pw, y);
      ctx.stroke();
    }

    // Scale from document coordinate to preview canvas
    const scale = Math.min(pw / canvasWidth, ph / canvasHeight) * 0.92;
    const offsetX = (pw - canvasWidth * scale) / 2;
    const offsetY = (ph - canvasHeight * scale) / 2;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Document border
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2 / scale;
    ctx.strokeRect(0, 0, canvasWidth, canvasHeight);

    // Draw generated vector paths
    const paths = generateCurrentPaths();
    for (const p of paths) {
      if (p.fillColor && p.fillColor !== 'none') {
        ctx.fillStyle = p.fillColor;
        ctx.beginPath();
        for (let i = 0; i < p.nodes.length; i++) {
          const pt = p.nodes[i].pos;
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        if (p.closed) ctx.closePath();
        ctx.fill();
      }

      ctx.strokeStyle = p.strokeColor || '#000000';
      ctx.lineWidth = p.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < p.nodes.length; i++) {
        const pt = p.nodes[i].pos;
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      if (p.closed) ctx.closePath();
      ctx.stroke();
    }

    // If focus or burst, draw center crosshair
    if (tab === 'focus' || tab === 'burst') {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(center.x, center.y, 6 / scale, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }, [isOpen, tab, focusConfig, speedConfig, burstConfig, center, seed, canvasWidth, canvasHeight]);

  if (!isOpen) return null;

  const handleApply = () => {
    const paths = generateCurrentPaths();
    const name = tab === 'focus' ? '集中線' : tab === 'speed' ? '流線' : 'ウニフラ';
    onCommitPaths(paths, name);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-semibold text-zinc-100">
              漫画効果線ベクター自動ジェネレーター
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body: Tabs + Settings on Left, Live Canvas on Right */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Controls */}
          <div className="w-full md:w-80 border-r border-zinc-800 p-5 flex flex-col gap-4 overflow-y-auto text-xs text-zinc-300">
            {/* Tabs */}
            <div className="flex p-1 bg-zinc-800 rounded-xl">
              {[
                { id: 'focus', label: '集中線', icon: <Zap className="w-3.5 h-3.5" /> },
                { id: 'speed', label: '流線・スピード線', icon: <Wind className="w-3.5 h-3.5" /> },
                { id: 'burst', label: 'ウニフラ', icon: <Sparkles className="w-3.5 h-3.5" /> },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id as any)}
                  className={`flex-1 py-1.5 flex items-center justify-center gap-1 rounded-lg font-medium transition-colors ${
                    tab === t.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>

            {/* Focus Line Settings */}
            {tab === 'focus' && (
              <div className="flex flex-col gap-3.5">
                <div>
                  <div className="flex justify-between text-zinc-400 mb-1">
                    <span>線の本数 (Density):</span>
                    <span className="font-mono text-zinc-200">{focusConfig.count}本</span>
                  </div>
                  <input
                    type="range"
                    min="16"
                    max="160"
                    step="4"
                    value={focusConfig.count}
                    onChange={e => setFocusConfig({ ...focusConfig, count: Number(e.target.value) })}
                    className="w-full accent-indigo-500 h-1.5 bg-zinc-700 rounded-lg"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-zinc-400 mb-1">
                    <span>中央の余白 (Inner Radius):</span>
                    <span className="font-mono text-zinc-200">
                      {Math.round(focusConfig.innerRadiusRatio * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.6"
                    step="0.01"
                    value={focusConfig.innerRadiusRatio}
                    onChange={e =>
                      setFocusConfig({ ...focusConfig, innerRadiusRatio: Number(e.target.value) })
                    }
                    className="w-full accent-indigo-500 h-1.5 bg-zinc-700 rounded-lg"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-zinc-400 mb-1">
                    <span>線の太さ (Stroke Width):</span>
                    <span className="font-mono text-zinc-200">{focusConfig.strokeWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.5"
                    value={focusConfig.strokeWidth}
                    onChange={e =>
                      setFocusConfig({ ...focusConfig, strokeWidth: Number(e.target.value) })
                    }
                    className="w-full accent-indigo-500 h-1.5 bg-zinc-700 rounded-lg"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-zinc-400 mb-1">
                    <span>揺らぎ / ランダム感 (Jitter):</span>
                    <span className="font-mono text-zinc-200">
                      {Math.round(focusConfig.jitter * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={focusConfig.jitter}
                    onChange={e => setFocusConfig({ ...focusConfig, jitter: Number(e.target.value) })}
                    className="w-full accent-indigo-500 h-1.5 bg-zinc-700 rounded-lg"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={focusConfig.taper}
                    onChange={e => setFocusConfig({ ...focusConfig, taper: e.target.checked })}
                    className="rounded bg-zinc-700 border-zinc-600 text-indigo-500 focus:ring-0"
                  />
                  <span>中心へ向かって細くなる入り抜き効果 (Taper)</span>
                </label>
              </div>
            )}

            {/* Speed Line Settings */}
            {tab === 'speed' && (
              <div className="flex flex-col gap-3.5">
                <div>
                  <div className="flex justify-between text-zinc-400 mb-1">
                    <span>角度 (Angle):</span>
                    <span className="font-mono text-zinc-200">{speedConfig.angle}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="180"
                    step="5"
                    value={speedConfig.angle}
                    onChange={e => setSpeedConfig({ ...speedConfig, angle: Number(e.target.value) })}
                    className="w-full accent-indigo-500 h-1.5 bg-zinc-700 rounded-lg"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-zinc-400 mb-1">
                    <span>線の本数 (Count):</span>
                    <span className="font-mono text-zinc-200">{speedConfig.count}本</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="120"
                    step="2"
                    value={speedConfig.count}
                    onChange={e => setSpeedConfig({ ...speedConfig, count: Number(e.target.value) })}
                    className="w-full accent-indigo-500 h-1.5 bg-zinc-700 rounded-lg"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-zinc-400 mb-1">
                    <span>線の長さ (Length):</span>
                    <span className="font-mono text-zinc-200">{speedConfig.length}px</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="1800"
                    step="50"
                    value={speedConfig.length}
                    onChange={e => setSpeedConfig({ ...speedConfig, length: Number(e.target.value) })}
                    className="w-full accent-indigo-500 h-1.5 bg-zinc-700 rounded-lg"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-zinc-400 mb-1">
                    <span>線の太さ (Stroke Width):</span>
                    <span className="font-mono text-zinc-200">{speedConfig.strokeWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.5"
                    value={speedConfig.strokeWidth}
                    onChange={e =>
                      setSpeedConfig({ ...speedConfig, strokeWidth: Number(e.target.value) })
                    }
                    className="w-full accent-indigo-500 h-1.5 bg-zinc-700 rounded-lg"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={speedConfig.taper}
                    onChange={e => setSpeedConfig({ ...speedConfig, taper: e.target.checked })}
                    className="rounded bg-zinc-700 border-zinc-600 text-indigo-500 focus:ring-0"
                  />
                  <span>先端の尖り (入り・抜き)</span>
                </label>
              </div>
            )}

            {/* Burst Flash Settings */}
            {tab === 'burst' && (
              <div className="flex flex-col gap-3.5">
                <div>
                  <div className="flex justify-between text-zinc-400 mb-1">
                    <span>トゲの数 (Spikes):</span>
                    <span className="font-mono text-zinc-200">{burstConfig.count}本</span>
                  </div>
                  <input
                    type="range"
                    min="8"
                    max="64"
                    step="2"
                    value={burstConfig.count}
                    onChange={e => setBurstConfig({ ...burstConfig, count: Number(e.target.value) })}
                    className="w-full accent-indigo-500 h-1.5 bg-zinc-700 rounded-lg"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-zinc-400 mb-1">
                    <span>内径 (Inner Radius):</span>
                    <span className="font-mono text-zinc-200">{burstConfig.innerRadius}px</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="400"
                    step="10"
                    value={burstConfig.innerRadius}
                    onChange={e =>
                      setBurstConfig({ ...burstConfig, innerRadius: Number(e.target.value) })
                    }
                    className="w-full accent-indigo-500 h-1.5 bg-zinc-700 rounded-lg"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-zinc-400 mb-1">
                    <span>外径 (Outer Radius):</span>
                    <span className="font-mono text-zinc-200">{burstConfig.outerRadius}px</span>
                  </div>
                  <input
                    type="range"
                    min="80"
                    max="800"
                    step="20"
                    value={burstConfig.outerRadius}
                    onChange={e =>
                      setBurstConfig({ ...burstConfig, outerRadius: Number(e.target.value) })
                    }
                    className="w-full accent-indigo-500 h-1.5 bg-zinc-700 rounded-lg"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-zinc-400 mb-1">
                    <span>ギザギザ乱数度 (Raggedness):</span>
                    <span className="font-mono text-zinc-200">
                      {Math.round(burstConfig.raggedness * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={burstConfig.raggedness}
                    onChange={e =>
                      setBurstConfig({ ...burstConfig, raggedness: Number(e.target.value) })
                    }
                    className="w-full accent-indigo-500 h-1.5 bg-zinc-700 rounded-lg"
                  />
                </div>
              </div>
            )}

            {/* Random Seed Button */}
            <button
              onClick={() => setSeed(s => s + 1)}
              className="flex items-center justify-center gap-1.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-300 font-medium transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              乱数を再生成 (バリエーション切替)
            </button>
          </div>

          {/* Live Preview Canvas */}
          <div className="flex-1 bg-zinc-950 p-6 flex flex-col items-center justify-center relative">
            <span className="absolute top-4 left-6 text-xs text-zinc-400 font-medium">
              リアルタイムプレビュー (ベクターパス生成)
            </span>
            <div className="w-full max-w-lg aspect-[16/10] bg-zinc-900 rounded-xl overflow-hidden shadow-2xl border border-zinc-800 flex items-center justify-center">
              <canvas
                ref={previewCanvasRef}
                width={640}
                height={400}
                className="w-full h-full object-contain cursor-crosshair"
                onClick={e => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = (e.clientX - rect.left) / rect.width;
                  const y = (e.clientY - rect.top) / rect.height;
                  setCenter({ x: x * canvasWidth, y: y * canvasHeight });
                }}
              />
            </div>
            <span className="text-[11px] text-zinc-500 mt-2">
              ※プレビュー内をクリックすると中心位置を変更できます
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
          <span className="text-xs text-zinc-400">
            生成される線はすべて後からアンカーポイント変形や太さ編集が可能なベクターです
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleApply}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium shadow-md flex items-center gap-1.5 transition-colors"
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
