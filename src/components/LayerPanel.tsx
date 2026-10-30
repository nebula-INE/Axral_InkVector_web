import React from 'react';
import { Document, Layer, BlendMode } from '../types';
import { 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Copy,
  Layers as LayersIcon
} from 'lucide-react';

interface LayerPanelProps {
  doc: Document;
  onUpdateDoc: (newDoc: Document) => void;
  onStatusChange: (msg: string) => void;
}

export const LayerPanel: React.FC<LayerPanelProps> = ({
  doc,
  onUpdateDoc,
  onStatusChange,
}) => {
  const activeLayer = doc.layers.find(l => l.id === doc.activeLayerId) || doc.layers[0];

  const handleAddLayer = () => {
    const newLayer: Layer = {
      id: crypto.randomUUID(),
      name: `レイヤー ${doc.layers.length + 1}`,
      visible: true,
      locked: false,
      opacity: 1.0,
      blendMode: 'source-over',
      paths: [],
    };
    onUpdateDoc({
      ...doc,
      layers: [newLayer, ...doc.layers],
      activeLayerId: newLayer.id,
    });
    onStatusChange(`新規レイヤーを追加しました`);
  };

  const handleDeleteLayer = (id: string) => {
    if (doc.layers.length <= 1) {
      onStatusChange('最後のレイヤーは削除できません');
      return;
    }
    const newLayers = doc.layers.filter(l => l.id !== id);
    onUpdateDoc({
      ...doc,
      layers: newLayers,
      activeLayerId: doc.activeLayerId === id ? newLayers[0].id : doc.activeLayerId,
    });
    onStatusChange('レイヤーを削除しました');
  };

  const handleDuplicateLayer = (layer: Layer) => {
    const cloned: Layer = {
      ...layer,
      id: crypto.randomUUID(),
      name: `${layer.name} (コピー)`,
      paths: JSON.parse(JSON.stringify(layer.paths)),
    };
    const idx = doc.layers.findIndex(l => l.id === layer.id);
    const newLayers = [...doc.layers];
    newLayers.splice(idx, 0, cloned);
    onUpdateDoc({
      ...doc,
      layers: newLayers,
      activeLayerId: cloned.id,
    });
    onStatusChange('レイヤーを複製しました');
  };

  const handleMoveLayer = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= doc.layers.length) return;

    const newLayers = [...doc.layers];
    const temp = newLayers[idx];
    newLayers[idx] = newLayers[targetIdx];
    newLayers[targetIdx] = temp;

    onUpdateDoc({ ...doc, layers: newLayers });
  };

  const updateActiveLayer = (updates: Partial<Layer>) => {
    onUpdateDoc({
      ...doc,
      layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, ...updates } : l),
    });
  };

  return (
    <div className="flex flex-col h-full text-xs text-zinc-300">
      {/* Top Layer Controls */}
      <div className="flex items-center justify-between p-2.5 border-b border-zinc-800 bg-zinc-900/60">
        <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
          <LayersIcon className="w-3.5 h-3.5 text-indigo-400" />
          レイヤー ({doc.layers.length})
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleAddLayer}
            title="新規レイヤー追加"
            className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDuplicateLayer(activeLayer)}
            title="レイヤー複製"
            className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDeleteLayer(activeLayer.id)}
            disabled={doc.layers.length <= 1}
            title="レイヤー削除"
            className="p-1 rounded bg-zinc-800 hover:bg-red-900/50 text-zinc-400 hover:text-red-300 border border-zinc-700 disabled:opacity-30"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Active Layer Properties: Blend Mode & Opacity */}
      <div className="p-2.5 border-b border-zinc-800 bg-zinc-900/40 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-zinc-400">ブレンドモード:</span>
          <select
            value={activeLayer.blendMode}
            onChange={e => updateActiveLayer({ blendMode: e.target.value as BlendMode })}
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-zinc-200 focus:outline-none cursor-pointer"
          >
            <option value="source-over">通常 (Normal)</option>
            <option value="multiply">乗算 (Multiply)</option>
            <option value="screen">スクリーン (Screen)</option>
            <option value="overlay">オーバーレイ (Overlay)</option>
            <option value="lighten">比較(明) (Lighten)</option>
            <option value="color-dodge">覆い焼き(発光)</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-zinc-400">不透明度:</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(activeLayer.opacity * 100)}
              onChange={e => updateActiveLayer({ opacity: parseInt(e.target.value) / 100 })}
              className="w-24 accent-indigo-500 cursor-pointer"
            />
            <span className="w-8 text-right font-mono text-zinc-200">
              {Math.round(activeLayer.opacity * 100)}%
            </span>
          </div>
        </div>

        {/* Clipping Mask Toggle */}
        <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60">
          <span className="text-zinc-400">クリッピング:</span>
          <button
            onClick={() => updateActiveLayer({ clipped: !activeLayer.clipped })}
            disabled={doc.layers.indexOf(activeLayer) === doc.layers.length - 1}
            title="下のレイヤーの描画範囲でクリッピング (影塗り・ハイライト)"
            className={`px-2 py-0.5 rounded border text-xs font-medium transition-colors ${
              activeLayer.clipped
                ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
            } disabled:opacity-30`}
          >
            {activeLayer.clipped ? '✓ 下のレイヤーでクリッピング' : 'クリッピング無効'}
          </button>
        </div>
      </div>

      {/* Layers List (Top to Bottom) */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
        {doc.layers.map((layer, idx) => {
          const isActive = layer.id === activeLayer.id;
          return (
            <div
              key={layer.id}
              onClick={() => onUpdateDoc({ ...doc, activeLayerId: layer.id })}
              className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${
                layer.clipped ? 'ml-3 border-l-2 border-l-indigo-500' : ''
              } ${
                isActive
                  ? 'bg-indigo-950/40 border-indigo-600/60 shadow-sm'
                  : 'bg-zinc-800/40 border-zinc-800/80 hover:bg-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-2 overflow-hidden flex-1 mr-2">
                {layer.clipped && (
                  <span className="text-[10px] text-indigo-400 font-bold shrink-0" title="下のレイヤーにクリッピング中">
                    ↳
                  </span>
                )}
                {/* Visibility */}
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onUpdateDoc({
                      ...doc,
                      layers: doc.layers.map(l => l.id === layer.id ? { ...l, visible: !l.visible } : l),
                    });
                  }}
                  className="text-zinc-400 hover:text-zinc-100 p-0.5"
                >
                  {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-zinc-600" />}
                </button>

                {/* Lock */}
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onUpdateDoc({
                      ...doc,
                      layers: doc.layers.map(l => l.id === layer.id ? { ...l, locked: !l.locked } : l),
                    });
                  }}
                  className="text-zinc-400 hover:text-zinc-100 p-0.5"
                >
                  {layer.locked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5 text-zinc-600" />}
                </button>

                {/* Layer Name */}
                <input
                  type="text"
                  value={layer.name}
                  onClick={e => e.stopPropagation()}
                  onChange={e => {
                    onUpdateDoc({
                      ...doc,
                      layers: doc.layers.map(l => l.id === layer.id ? { ...l, name: e.target.value } : l),
                    });
                  }}
                  className="bg-transparent text-zinc-200 focus:outline-none focus:bg-zinc-800 rounded px-1 truncate flex-1"
                />

                <span className="text-[10px] text-zinc-500 shrink-0 font-mono">
                  {layer.paths.length}p
                </span>
              </div>

              {/* Move Layer Buttons */}
              <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => handleMoveLayer(idx, 'up')}
                  disabled={idx === 0}
                  className="p-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-20"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleMoveLayer(idx, 'down')}
                  disabled={idx === doc.layers.length - 1}
                  className="p-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-20"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
