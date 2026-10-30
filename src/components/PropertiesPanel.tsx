import React, { useState } from 'react';
import { Document, VPath } from '../types';
import { 
  createDefaultMesh 
} from '../utils/mesh';
import { 
  simplifyPolyline, 
  catmullRomToBezier,
  batchAdjustPathsWidth
} from '../utils/geometry';
import { 
  Sliders, 
  Trash2, 
  Copy, 
  ChevronRight, 
  Grid3X3, 
  RefreshCw,
  Sparkles
} from 'lucide-react';

interface PropertiesPanelProps {
  doc: Document;
  onUpdateDoc: (newDoc: Document) => void;
  selectedPathIds: string[];
  strokeColor: string;
  onStrokeColorChange: (c: string) => void;
  fillColor: string;
  onFillColorChange: (c: string) => void;
  onStatusChange: (msg: string) => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  doc,
  onUpdateDoc,
  selectedPathIds,
  strokeColor,
  onStrokeColorChange,
  fillColor,
  onFillColorChange,
  onStatusChange,
}) => {
  const [simplifyTolerance, setSimplifyTolerance] = useState<number>(1.5);
  const activeLayer = doc.layers.find(l => l.id === doc.activeLayerId);
  const selectedPaths = activeLayer 
    ? activeLayer.paths.filter(p => selectedPathIds.includes(p.id))
    : [];

  const firstPath: VPath | undefined = selectedPaths[0];

  const updateSelectedPaths = (updates: Partial<VPath>) => {
    if (!activeLayer) return;
    const newPaths = activeLayer.paths.map(p => {
      if (selectedPathIds.includes(p.id)) {
        return { ...p, ...updates };
      }
      return p;
    });
    onUpdateDoc({
      ...doc,
      layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: newPaths } : l),
    });
  };

  // Toggle Color Mesh
  const handleToggleMesh = () => {
    if (!firstPath) return;
    if (firstPath.mesh && firstPath.mesh.enabled) {
      updateSelectedPaths({ mesh: undefined });
      onStatusChange('カラーメッシュを解除しました');
    } else {
      const mesh = createDefaultMesh(3, 3, firstPath.fillColor !== 'none' ? firstPath.fillColor : fillColor);
      updateSelectedPaths({ mesh });
      onStatusChange('カラーメッシュを適用しました');
    }
  };

  // Resize Mesh Grid
  const handleMeshGridChange = (cols: number, rows: number) => {
    if (!firstPath || !firstPath.mesh) return;
    const mesh = createDefaultMesh(cols, rows, firstPath.mesh.colors[0] || '#5b8cff');
    updateSelectedPaths({ mesh });
  };

  // Simplify Path (Anchor points reduction)
  const handleSimplify = () => {
    if (!firstPath) return;
    const pts = firstPath.nodes.map(n => n.pos);
    const simplified = simplifyPolyline(pts, simplifyTolerance);
    const newNodes = catmullRomToBezier(simplified, firstPath.closed);

    const oldCnt = firstPath.nodes.length;
    const newCnt = newNodes.length;

    updateSelectedPaths({ nodes: newNodes });
    onStatusChange(`アンカー削減: ${oldCnt}点 → ${newCnt}点 (差分 -${oldCnt - newCnt})`);
  };

  // Delete Selected Paths
  const handleDeleteSelected = () => {
    if (!activeLayer || selectedPathIds.length === 0) return;
    const newPaths = activeLayer.paths.filter(p => !selectedPathIds.includes(p.id));
    onUpdateDoc({
      ...doc,
      layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: newPaths } : l),
    });
    onStatusChange(`${selectedPathIds.length}個のパスを削除しました`);
  };

  // Move Z-Order
  const handleBringToFront = () => {
    if (!activeLayer || selectedPathIds.length === 0) return;
    const selected = activeLayer.paths.filter(p => selectedPathIds.includes(p.id));
    const others = activeLayer.paths.filter(p => !selectedPathIds.includes(p.id));
    onUpdateDoc({
      ...doc,
      layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: [...others, ...selected] } : l),
    });
  };

  const handleSendToBack = () => {
    if (!activeLayer || selectedPathIds.length === 0) return;
    const selected = activeLayer.paths.filter(p => selectedPathIds.includes(p.id));
    const others = activeLayer.paths.filter(p => !selectedPathIds.includes(p.id));
    onUpdateDoc({
      ...doc,
      layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: [...selected, ...others] } : l),
    });
  };

  return (
    <div className="flex flex-col h-full text-xs text-zinc-300 p-3 overflow-y-auto gap-4">
      {/* Selection Summary */}
      <div className="bg-zinc-800/50 p-2.5 rounded-lg border border-zinc-800 flex items-center justify-between">
        <div>
          <span className="font-semibold text-zinc-200">
            {selectedPaths.length > 0 ? `選択中: ${selectedPaths.length}個` : 'パス未選択'}
          </span>
          {firstPath && (
            <div className="text-[11px] text-zinc-400 mt-0.5">
              ノード数: {firstPath.nodes.length}点 · {firstPath.closed ? '閉じたパス' : '開いたパス'}
            </div>
          )}
        </div>
        {selectedPaths.length > 0 && (
          <button
            onClick={handleDeleteSelected}
            title="選択パスを削除 (Delete)"
            className="p-1 rounded bg-zinc-800 hover:bg-red-900/50 text-red-400 border border-zinc-700"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Stroke & Fill Properties */}
      <div className="flex flex-col gap-2.5 bg-zinc-800/30 p-2.5 rounded-lg border border-zinc-800/80">
        <span className="font-semibold text-zinc-200">スタイル設定</span>

        {/* Stroke Color & Width */}
        <div className="flex items-center justify-between">
          <span className="text-zinc-400">線幅 (Stroke Width):</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0.5"
              max="60"
              step="0.5"
              value={firstPath ? firstPath.strokeWidth : 4}
              onChange={e => {
                const val = parseFloat(e.target.value);
                if (firstPath) updateSelectedPaths({ strokeWidth: val });
              }}
              className="w-20 accent-indigo-500 cursor-pointer"
            />
            <span className="w-8 text-right font-mono text-zinc-200">
              {firstPath ? firstPath.strokeWidth.toFixed(1) : '4.0'}px
            </span>
          </div>
        </div>

        {/* Batch Stroke Width Modulation */}
        {selectedPaths.length > 0 && activeLayer && (
          <div className="flex flex-col gap-1.5 pt-1.5 border-t border-zinc-800">
            <span className="text-[11px] font-medium text-zinc-300">線幅の一括修正 (Batch Mod)</span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => {
                  const updated = batchAdjustPathsWidth(selectedPaths, 'thicken');
                  const newPaths = activeLayer.paths.map(p => {
                    const u = updated.find(x => x.id === p.id);
                    return u || p;
                  });
                  onUpdateDoc({
                    ...doc,
                    layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: newPaths } : l),
                  });
                  onStatusChange('選択パスを一括で太くしました (+1.5px)');
                }}
                className="py-1 px-2 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-[11px] font-medium"
              >
                +1.5px 太く
              </button>
              <button
                onClick={() => {
                  const updated = batchAdjustPathsWidth(selectedPaths, 'thin');
                  const newPaths = activeLayer.paths.map(p => {
                    const u = updated.find(x => x.id === p.id);
                    return u || p;
                  });
                  onUpdateDoc({
                    ...doc,
                    layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: newPaths } : l),
                  });
                  onStatusChange('選択パスを一括で細くしました (-1.5px)');
                }}
                className="py-1 px-2 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-[11px] font-medium"
              >
                −1.5px 細く
              </button>
              <button
                onClick={() => {
                  const updated = batchAdjustPathsWidth(selectedPaths, 'taper');
                  const newPaths = activeLayer.paths.map(p => {
                    const u = updated.find(x => x.id === p.id);
                    return u || p;
                  });
                  onUpdateDoc({
                    ...doc,
                    layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: newPaths } : l),
                  });
                  onStatusChange('選択パスに入り抜き（尖り）を適用しました');
                }}
                className="py-1 px-2 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-[11px] font-medium"
              >
                入り・抜き付与 (▲)
              </button>
              <button
                onClick={() => {
                  const updated = batchAdjustPathsWidth(selectedPaths, 'normalize');
                  const newPaths = activeLayer.paths.map(p => {
                    const u = updated.find(x => x.id === p.id);
                    return u || p;
                  });
                  onUpdateDoc({
                    ...doc,
                    layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: newPaths } : l),
                  });
                  onStatusChange('選択パスの太さを均一化しました');
                }}
                className="py-1 px-2 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-[11px] font-medium"
              >
                均一化 (＝)
              </button>
            </div>
          </div>
        )}

        {/* Fill Color */}
        <div className="flex items-center justify-between">
          <span className="text-zinc-400">塗りつぶし (Fill):</span>
          <div className="flex items-center gap-2">
            <label className="w-6 h-6 rounded border border-zinc-700 overflow-hidden cursor-pointer">
              <input
                type="color"
                value={firstPath && firstPath.fillColor !== 'none' ? firstPath.fillColor : '#ffffff'}
                onChange={e => {
                  if (firstPath) updateSelectedPaths({ fillColor: e.target.value, closed: true });
                  onFillColorChange(e.target.value);
                }}
                className="opacity-0 w-full h-full cursor-pointer"
              />
            </label>
            <button
              onClick={() => {
                if (firstPath) updateSelectedPaths({ fillColor: 'none' });
                onFillColorChange('none');
              }}
              className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 text-[10px]"
            >
              透明
            </button>
          </div>
        </div>

        {/* Path Close Toggle */}
        {firstPath && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-zinc-400">パス開閉:</span>
            <button
              onClick={() => updateSelectedPaths({ closed: !firstPath.closed })}
              className={`px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
                firstPath.closed
                  ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400'
              }`}
            >
              {firstPath.closed ? '閉パス (Closed)' : '開パス (Open)'}
            </button>
          </div>
        )}
      </div>

      {/* Color Mesh Section */}
      <div className="flex flex-col gap-2.5 bg-zinc-800/30 p-2.5 rounded-lg border border-zinc-800/80">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
            <Grid3X3 className="w-3.5 h-3.5 text-indigo-400" />
            カラーメッシュ (Mesh)
          </span>
          <button
            onClick={handleToggleMesh}
            disabled={!firstPath}
            className={`px-2 py-0.5 rounded font-medium border text-xs transition-colors ${
              firstPath?.mesh?.enabled
                ? 'bg-indigo-600 text-white border-indigo-500'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
            } disabled:opacity-30`}
          >
            {firstPath?.mesh?.enabled ? '有効' : '無効'}
          </button>
        </div>

        {firstPath?.mesh?.enabled && (
          <div className="flex flex-col gap-2 pt-1 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">グリッド分割数:</span>
              <div className="flex items-center gap-1">
                {[2, 3, 4].map(n => (
                  <button
                    key={n}
                    onClick={() => handleMeshGridChange(n, n)}
                    className={`px-2 py-0.5 rounded border text-xs ${
                      firstPath.mesh?.cols === n
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                    }`}
                  >
                    {n}×{n}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid Colors Swatches */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-zinc-400">格子点カラー (各点をクリックで色変更):</span>
              <div 
                className="grid gap-1.5 p-2 bg-zinc-900 rounded border border-zinc-800 justify-center"
                style={{ gridTemplateColumns: `repeat(${firstPath.mesh.cols}, minmax(0, 1fr))` }}
              >
                {firstPath.mesh.colors.map((color, cIdx) => (
                  <label
                    key={cIdx}
                    className="w-6 h-6 rounded border border-zinc-600 overflow-hidden cursor-pointer shadow hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                  >
                    <input
                      type="color"
                      value={color}
                      onChange={e => {
                        const newColors = [...firstPath.mesh!.colors];
                        newColors[cIdx] = e.target.value;
                        updateSelectedPaths({
                          mesh: { ...firstPath.mesh!, colors: newColors }
                        });
                      }}
                      className="opacity-0 w-full h-full cursor-pointer"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Anchor Simplification */}
      <div className="flex flex-col gap-2 bg-zinc-800/30 p-2.5 rounded-lg border border-zinc-800/80">
        <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          アンカー軽量化 (最適化)
        </span>
        <div className="flex items-center justify-between">
          <span className="text-zinc-400">許容誤差:</span>
          <div className="flex items-center gap-1.5">
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.5"
              value={simplifyTolerance}
              onChange={e => setSimplifyTolerance(parseFloat(e.target.value))}
              className="w-20 accent-amber-500 cursor-pointer"
            />
            <span className="w-6 text-right font-mono text-zinc-200">{simplifyTolerance}</span>
          </div>
        </div>
        <button
          onClick={handleSimplify}
          disabled={!firstPath}
          className="w-full py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-medium transition-colors disabled:opacity-30"
        >
          アンカーポイントを削減
        </button>
      </div>

      {/* Layer Z-Order Controls */}
      {selectedPaths.length > 0 && (
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={handleBringToFront}
            className="flex-1 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700"
          >
            最前面へ
          </button>
          <button
            onClick={handleSendToBack}
            className="flex-1 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700"
          >
            最背面へ
          </button>
        </div>
      )}
    </div>
  );
};
