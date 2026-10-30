import React, { useState } from 'react';
import { Document, VPath, VNode, Point, ScreenTone } from '../types';
import { generatePalettes } from '../utils/palette';
import { 
  MessageSquare, 
  Sparkles, 
  LayoutGrid, 
  Palette, 
  CircleDot,
  Type
} from 'lucide-react';

import { TonePanel } from './TonePanel';

interface MangaPanelProps {
  doc: Document;
  onUpdateDoc: (newDoc: Document) => void;
  strokeColor: string;
  fillColor: string;
  onStrokeColorChange: (c: string) => void;
  onFillColorChange: (c: string) => void;
  selectedPathIds: string[];
  onStatusChange: (msg: string) => void;
  activeTone: ScreenTone;
  onActiveToneChange: (t: ScreenTone) => void;
  onOpenEffectModal?: () => void;
}

export const MangaPanel: React.FC<MangaPanelProps> = ({
  doc,
  onUpdateDoc,
  strokeColor,
  fillColor,
  onStrokeColorChange,
  onFillColorChange,
  selectedPathIds,
  onStatusChange,
  activeTone,
  onActiveToneChange,
  onOpenEffectModal,
}) => {
  const [balloonText, setBalloonText] = useState('セリフを入力…');
  const [verticalText, setVerticalText] = useState(true);
  const [focusCount, setFocusCount] = useState(48);
  const [panelCols, setPanelCols] = useState(2);
  const [panelRows, setPanelRows] = useState(2);
  const [gutter, setGutter] = useState(16);

  const activeLayer = doc.layers.find(l => l.id === doc.activeLayerId);
  const palettes = generatePalettes(strokeColor.startsWith('#') ? strokeColor : '#3a7bd5');

  // Insert Speech Balloon
  const handleAddBalloon = (shape: 'oval' | 'shout') => {
    if (!activeLayer) return;

    const cx = doc.width / 2;
    const cy = doc.height / 3;
    const rx = 100;
    const ry = 80;

    let nodes: VNode[] = [];

    if (shape === 'oval') {
      // Smooth cubic ellipse nodes
      const k = 0.5522847498;
      nodes = [
        { pos: { x: cx, y: cy - ry }, cpOut: { x: cx + rx * k, y: cy - ry }, cpIn: { x: cx - rx * k, y: cy - ry }, smooth: true },
        { pos: { x: cx + rx, y: cy }, cpIn: { x: cx + rx, y: cy - ry * k }, cpOut: { x: cx + rx, y: cy + ry * k }, smooth: true },
        { pos: { x: cx, y: cy + ry }, cpIn: { x: cx + rx * k, y: cy + ry }, cpOut: { x: cx - rx * k, y: cy + ry }, smooth: true },
        { pos: { x: cx - rx, y: cy }, cpIn: { x: cx - rx, y: cy + ry * k }, cpOut: { x: cx - rx, y: cy - ry * k }, smooth: true },
      ];
    } else {
      // Jagged shout balloon
      const pts: Point[] = [];
      const spikes = 14;
      for (let i = 0; i < spikes; i++) {
        const a1 = (i / spikes) * Math.PI * 2;
        const a2 = ((i + 0.5) / spikes) * Math.PI * 2;
        pts.push({ x: cx + Math.cos(a1) * rx, y: cy + Math.sin(a1) * ry });
        pts.push({ x: cx + Math.cos(a2) * (rx * 1.25), y: cy + Math.sin(a2) * (ry * 1.25) });
      }
      nodes = pts.map(p => ({ pos: p, smooth: false }));
    }

    const balloonPath: VPath = {
      id: crypto.randomUUID(),
      nodes,
      closed: true,
      strokeColor: '#000000',
      strokeWidth: 3,
      fillColor: '#ffffff',
      opacity: 1.0,
      brushType: 'pen',
      balloon: {
        tailPos: { x: cx - 40, y: cy + ry + 40 },
        text: balloonText,
        fontSize: 20,
        textColor: '#000000',
        verticalText,
        shape,
      },
      createdAt: Date.now(),
    };

    onUpdateDoc({
      ...doc,
      layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: [...l.paths, balloonPath] } : l),
    });
    onStatusChange('フキダシを配置しました');
  };

  // Generate Manga Panels (コマ割り)
  const handleGeneratePanels = () => {
    if (!activeLayer) return;

    const margin = 40;
    const availW = doc.width - margin * 2;
    const availH = doc.height - margin * 2;
    const cellW = (availW - (panelCols - 1) * gutter) / panelCols;
    const cellH = (availH - (panelRows - 1) * gutter) / panelRows;

    const panelPaths: VPath[] = [];

    for (let r = 0; r < panelRows; r++) {
      for (let c = 0; c < panelCols; c++) {
        const x = margin + c * (cellW + gutter);
        const y = margin + r * (cellH + gutter);

        const nodes: VNode[] = [
          { pos: { x, y } },
          { pos: { x: x + cellW, y } },
          { pos: { x: x + cellW, y: y + cellH } },
          { pos: { x, y: y + cellH } },
        ];

        panelPaths.push({
          id: crypto.randomUUID(),
          nodes,
          closed: true,
          strokeColor: '#000000',
          strokeWidth: 4,
          fillColor: 'none',
          opacity: 1.0,
          brushType: 'pen',
          panel: { gutter, borderColor: '#000000', borderWidth: 4 },
          createdAt: Date.now(),
        });
      }
    }

    onUpdateDoc({
      ...doc,
      layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: [...l.paths, ...panelPaths] } : l),
    });
    onStatusChange(`コマ割り生成: ${panelCols}列 × ${panelRows}段`);
  };

  // Generate Action Focus Lines (集中線)
  const handleGenerateFocusLines = () => {
    if (!activeLayer) return;

    const cx = doc.width / 2;
    const cy = doc.height / 2;
    const innerRadius = Math.min(doc.width, doc.height) * 0.22;
    const outerRadius = Math.max(doc.width, doc.height) * 0.9;

    const focusPaths: VPath[] = [];

    for (let i = 0; i < focusCount; i++) {
      const angle = (i / focusCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.05;
      const innerR = innerRadius * (0.85 + Math.random() * 0.3);
      const outerR = outerRadius;

      const pStart = {
        x: cx + Math.cos(angle) * innerR,
        y: cy + Math.sin(angle) * innerR,
      };
      const pEnd = {
        x: cx + Math.cos(angle) * outerR,
        y: cy + Math.sin(angle) * outerR,
      };

      focusPaths.push({
        id: crypto.randomUUID(),
        nodes: [{ pos: pStart }, { pos: pEnd }],
        closed: false,
        strokeColor: '#000000',
        strokeWidth: 2 + Math.random() * 3,
        fillColor: 'none',
        opacity: 0.9,
        brushType: 'gpen',
        createdAt: Date.now(),
      });
    }

    onUpdateDoc({
      ...doc,
      layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: [...l.paths, ...focusPaths] } : l),
    });
    onStatusChange(`集中線を生成しました (${focusCount}本)`);
  };

  // Apply Screen Tone to Selected Path
  const handleApplyTone = (type: ScreenTone['type']) => {
    if (!activeLayer || selectedPathIds.length === 0) {
      onStatusChange('トーンを適用するパスを選択してください');
      return;
    }

    const tone: ScreenTone = {
      type,
      freq: 20,
      size: 2.5,
      angle: 45,
    };

    const newPaths = activeLayer.paths.map(p => 
      selectedPathIds.includes(p.id) ? { ...p, tone } : p
    );

    onUpdateDoc({
      ...doc,
      layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: newPaths } : l),
    });
    onStatusChange(`ベクタートーンを適用: ${type}`);
  };

  return (
    <div className="flex flex-col h-full text-xs text-zinc-300 p-3 overflow-y-auto gap-4">
      <span className="font-semibold text-zinc-200">漫画 & アシスト (Manga & Assist)</span>

      {/* 1. Speech Balloons (フキダシ) */}
      <div className="flex flex-col gap-2.5 bg-zinc-800/30 p-2.5 rounded-lg border border-zinc-800">
        <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
          ベクターフキダシ
        </span>

        <input
          type="text"
          value={balloonText}
          onChange={e => setBalloonText(e.target.value)}
          placeholder="セリフを入力…"
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-100 focus:outline-none focus:border-indigo-500"
        />

        <div className="flex items-center justify-between">
          <span className="text-zinc-400">文字方向:</span>
          <button
            onClick={() => setVerticalText(!verticalText)}
            className={`px-2 py-0.5 rounded border text-xs font-medium transition-colors ${
              verticalText
                ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400'
            }`}
          >
            {verticalText ? '縦書き (日本語)' : '横書き'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => handleAddBalloon('oval')}
            className="py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-medium"
          >
            通常フキダシ
          </button>
          <button
            onClick={() => handleAddBalloon('shout')}
            className="py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-medium"
          >
            叫びフキダシ
          </button>
        </div>
      </div>

      {/* 2. Manga Panels (コマ割り) */}
      <div className="flex flex-col gap-2.5 bg-zinc-800/30 p-2.5 rounded-lg border border-zinc-800">
        <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
          <LayoutGrid className="w-3.5 h-3.5 text-indigo-400" />
          自動コマ割り
        </span>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center justify-between bg-zinc-900/60 p-1.5 rounded border border-zinc-800">
            <span className="text-zinc-400">段数:</span>
            <input
              type="number"
              min="1"
              max="6"
              value={panelRows}
              onChange={e => setPanelRows(parseInt(e.target.value) || 1)}
              className="w-10 bg-zinc-800 text-center rounded border border-zinc-700 text-zinc-100"
            />
          </div>
          <div className="flex items-center justify-between bg-zinc-900/60 p-1.5 rounded border border-zinc-800">
            <span className="text-zinc-400">列数:</span>
            <input
              type="number"
              min="1"
              max="4"
              value={panelCols}
              onChange={e => setPanelCols(parseInt(e.target.value) || 1)}
              className="w-10 bg-zinc-800 text-center rounded border border-zinc-700 text-zinc-100"
            />
          </div>
        </div>

        <button
          onClick={handleGeneratePanels}
          className="w-full py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-medium transition-colors"
        >
          コマ枠を生成
        </button>
      </div>

      {/* 3. Action Focus Lines (集中線) */}
      <div className="flex flex-col gap-2 bg-zinc-800/30 p-2.5 rounded-lg border border-zinc-800">
        <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          ベクター集中線ジェネレーター
        </span>

        <div className="flex items-center justify-between">
          <span className="text-zinc-400">線の本数:</span>
          <div className="flex items-center gap-1.5">
            <input
              type="range"
              min="20"
              max="96"
              step="4"
              value={focusCount}
              onChange={e => setFocusCount(parseInt(e.target.value))}
              className="w-20 accent-amber-500 cursor-pointer"
            />
            <span className="w-6 text-right font-mono text-zinc-200">{focusCount}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleGenerateFocusLines}
            className="flex-1 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-medium"
          >
            クイック集中線
          </button>
          <button
            onClick={() => onOpenEffectModal?.()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-medium"
            title="集中線・流線・ウニフラの高度なベクター生成"
          >
            <Sparkles className="w-3.5 h-3.5" />
            詳細生成
          </button>
        </div>
      </div>

      {/* 4. Manga Screen Tone Studio */}
      <div className="bg-zinc-800/30 p-2.5 rounded-lg border border-zinc-800">
        <TonePanel
          selectedPaths={activeLayer ? activeLayer.paths.filter(p => selectedPathIds.includes(p.id)) : []}
          onApplyTone={tone => {
            if (!activeLayer) return;
            const newPaths = activeLayer.paths.map(p => 
              selectedPathIds.includes(p.id) ? { ...p, tone: tone || undefined } : p
            );
            onUpdateDoc({
              ...doc,
              layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: newPaths } : l),
            });
            onStatusChange(tone ? `トーンを適用: ${tone.type}` : 'トーンを解除しました');
          }}
          activeTone={activeTone}
          onActiveToneChange={onActiveToneChange}
        />
      </div>

      {/* 5. Color Harmony Assistant (配色提案) */}
      <div className="flex flex-col gap-2 bg-zinc-800/30 p-2.5 rounded-lg border border-zinc-800">
        <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5 text-indigo-400" />
          配色提案 (現在の色から自動計算)
        </span>

        <div className="flex flex-col gap-2">
          {palettes.map((pal, pIdx) => (
            <div key={pIdx} className="flex flex-col gap-1">
              <span className="text-[10px] text-zinc-400">{pal.name}</span>
              <div className="flex items-center gap-1.5">
                {pal.colors.map((c, cIdx) => (
                  <button
                    key={cIdx}
                    onClick={() => {
                      onStrokeColorChange(c);
                      onStatusChange(`色を選択: ${c}`);
                    }}
                    title={c}
                    className="flex-1 h-5 rounded border border-zinc-700 shadow-sm hover:scale-105 transition-transform"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
