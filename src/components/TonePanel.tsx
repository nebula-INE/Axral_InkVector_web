import React, { useState } from 'react';
import { ScreenTone, VPath } from '../types';
import { CircleDot, Sliders, Check, Sparkles, RefreshCw } from 'lucide-react';

interface TonePanelProps {
  selectedPaths: VPath[];
  onApplyTone: (tone: ScreenTone | null) => void;
  activeTone: ScreenTone;
  onActiveToneChange: (tone: ScreenTone) => void;
}

export const TonePanel: React.FC<TonePanelProps> = ({
  selectedPaths,
  onApplyTone,
  activeTone,
  onActiveToneChange,
}) => {
  const [toneType, setToneType] = useState<ScreenTone['type']>(activeTone.type === 'none' ? 'dots' : activeTone.type);
  const [freq, setFreq] = useState<number>(activeTone.freq || 60);
  const [density, setDensity] = useState<number>(activeTone.density || 20);
  const [angle, setAngle] = useState<number>(activeTone.angle ?? 45);

  const freqPresets = [30, 40, 50, 60, 65, 85];
  const densityPresets = [5, 10, 20, 30, 40, 50, 60, 70];
  const anglePresets = [0, 30, 45, 60, 90];

  const currentTone: ScreenTone = {
    type: toneType,
    freq,
    size: 2.5,
    angle,
    density,
  };

  const handleApply = () => {
    onActiveToneChange(currentTone);
    onApplyTone(currentTone);
  };

  const handleClear = () => {
    onApplyTone(null);
  };

  // Mini canvas preview for screentone swatch
  const renderPreviewCanvas = () => {
    const s = 14;
    return (
      <div className="relative w-full h-24 rounded-lg overflow-hidden border border-zinc-700 bg-white flex items-center justify-center shadow-inner">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="tone-panel-preview"
              width={s}
              height={s}
              patternUnits="userSpaceOnUse"
              patternTransform={`rotate(${angle})`}
            >
              {toneType === 'dots' && (
                <circle
                  cx={s / 2}
                  cy={s / 2}
                  r={Math.max(1, (s / 2) * Math.sqrt(density / 100))}
                  fill="#18181b"
                />
              )}
              {toneType === 'lines' && (
                <line
                  x1="0"
                  y1={s / 2}
                  x2={s}
                  y2={s / 2}
                  stroke="#18181b"
                  strokeWidth={Math.max(1, s * (density / 100))}
                />
              )}
              {toneType === 'cross' && (
                <>
                  <line
                    x1="0"
                    y1={s / 2}
                    x2={s}
                    y2={s / 2}
                    stroke="#18181b"
                    strokeWidth={Math.max(1, s * (density / 200))}
                  />
                  <line
                    x1={s / 2}
                    y1="0"
                    x2={s / 2}
                    y2={s}
                    stroke="#18181b"
                    strokeWidth={Math.max(1, s * (density / 200))}
                  />
                </>
              )}
              {toneType === 'noise' && (
                <>
                  <circle cx={s * 0.25} cy={s * 0.25} r={density > 20 ? 1.5 : 1} fill="#18181b" />
                  <circle cx={s * 0.75} cy={s * 0.65} r={density > 40 ? 1.8 : 1} fill="#18181b" />
                  {density >= 30 && <circle cx={s * 0.3} cy={s * 0.8} r={1.2} fill="#18181b" />}
                  {density >= 50 && <circle cx={s * 0.85} cy={s * 0.2} r={1.5} fill="#18181b" />}
                </>
              )}
              {toneType === 'gradient' && (
                <circle
                  cx={s / 2}
                  cy={s / 2}
                  r={Math.max(1, (s / 2) * Math.sqrt(density / 100))}
                  fill="#18181b"
                />
              )}
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#tone-panel-preview)" />
        </svg>
        <span className="absolute bottom-1 right-2 text-[10px] bg-zinc-900/80 text-zinc-300 px-1.5 py-0.5 rounded backdrop-blur font-mono">
          {freq}L / {density}% / {angle}°
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3 text-xs text-zinc-300">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
          <CircleDot className="w-4 h-4 text-indigo-400" />
          スクリーントーン (Manga Tone)
        </span>
        {selectedPaths.length > 0 && (
          <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
            {selectedPaths.length}個のパスを選択中
          </span>
        )}
      </div>

      {/* Swatch Preview */}
      {renderPreviewCanvas()}

      {/* Pattern Type */}
      <div className="flex flex-col gap-1.5">
        <span className="text-zinc-400">パターン種別:</span>
        <div className="grid grid-cols-3 gap-1">
          {[
            { id: 'dots', label: '網点 (Dots)' },
            { id: 'lines', label: '万線 (Lines)' },
            { id: 'cross', label: 'カケアミ (Cross)' },
            { id: 'noise', label: '砂目 (Sand)' },
            { id: 'gradient', label: 'グラデ (Grad)' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setToneType(p.id as ScreenTone['type'])}
              className={`px-2 py-1.5 rounded border text-[11px] font-medium transition-colors ${
                toneType === p.id
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Frequency (L数) */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-zinc-400">
          <span>線数 (Frequency):</span>
          <span className="font-mono text-zinc-200">{freq} L</span>
        </div>
        <div className="flex gap-1">
          {freqPresets.map(f => (
            <button
              key={f}
              onClick={() => setFreq(f)}
              className={`flex-1 py-1 rounded text-[11px] font-mono border transition-colors ${
                freq === f
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-zinc-700'
              }`}
            >
              {f}L
            </button>
          ))}
        </div>
        <input
          type="range"
          min="20"
          max="90"
          value={freq}
          onChange={e => setFreq(Number(e.target.value))}
          className="w-full accent-indigo-500 h-1.5 bg-zinc-700 rounded-lg cursor-pointer"
        />
      </div>

      {/* Density (濃度%) */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-zinc-400">
          <span>濃度 (Density):</span>
          <span className="font-mono text-zinc-200">{density}%</span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {densityPresets.map(d => (
            <button
              key={d}
              onClick={() => setDensity(d)}
              className={`py-1 rounded text-[11px] font-mono border transition-colors ${
                density === d
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-zinc-700'
              }`}
            >
              {d}%
            </button>
          ))}
        </div>
        <input
          type="range"
          min="5"
          max="85"
          step="5"
          value={density}
          onChange={e => setDensity(Number(e.target.value))}
          className="w-full accent-indigo-500 h-1.5 bg-zinc-700 rounded-lg cursor-pointer"
        />
      </div>

      {/* Angle (角度) */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-zinc-400">
          <span>角度 (Angle):</span>
          <span className="font-mono text-zinc-200">{angle}°</span>
        </div>
        <div className="flex gap-1">
          {anglePresets.map(a => (
            <button
              key={a}
              onClick={() => setAngle(a)}
              className={`flex-1 py-1 rounded text-[11px] font-mono border transition-colors ${
                angle === a
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-zinc-700'
              }`}
            >
              {a}°
            </button>
          ))}
        </div>
        <input
          type="range"
          min="0"
          max="180"
          step="5"
          value={angle}
          onChange={e => setAngle(Number(e.target.value))}
          className="w-full accent-indigo-500 h-1.5 bg-zinc-700 rounded-lg cursor-pointer"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleApply}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg shadow-sm transition-colors"
        >
          <Check className="w-4 h-4" />
          {selectedPaths.length > 0 ? '選択パスに適用' : 'アクティブトーンに設定'}
        </button>
        {selectedPaths.length > 0 && (
          <button
            onClick={handleClear}
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg border border-zinc-700 transition-colors"
            title="トーンを消去"
          >
            解除
          </button>
        )}
      </div>
    </div>
  );
};
