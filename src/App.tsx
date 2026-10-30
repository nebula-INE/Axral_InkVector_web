import React, { useState, useEffect, useCallback } from 'react';
import { Document, ToolType, BrushType, Layer, VPath, ShapeType, EraserMode, WidthBrushMode, ScreenTone } from './types';
import { useHistory } from './hooks/useHistory';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { Header } from './components/Header';
import { LayerPanel } from './components/LayerPanel';
import { PropertiesPanel } from './components/PropertiesPanel';
import { BrushStudio } from './components/BrushStudio';
import { MangaPanel } from './components/MangaPanel';
import { ShortcutsModal } from './components/ShortcutsModal';
import { EffectLineModal } from './components/EffectLineModal';
import { AutoTraceModal } from './components/AutoTraceModal';
import { CanvasSizeModal } from './components/CanvasSizeModal';
import { offsetDocumentContent } from './utils/geometry';
import { 
  Layers, 
  Sliders, 
  Paintbrush, 
  BookOpen, 
  Sparkles, 
  Info
} from 'lucide-react';

const INITIAL_DOC: Document = {
  id: 'doc-1',
  title: '無題のイラスト',
  width: 1920,
  height: 1080,
  activeLayerId: 'layer-lineart',
  symmetry: 'none',
  symmetryCenter: { x: 960, y: 540 },
  perspective: {
    enabled: false,
    mode: '1-point',
    vanishingPoints: [{ x: 960, y: 540 }],
    horizonY: 540,
  },
  webtoonMode: false,
  layers: [
    {
      id: 'layer-lineart',
      name: '線画 (Lineart)',
      visible: true,
      locked: false,
      opacity: 1.0,
      blendMode: 'source-over',
      paths: [],
    },
    {
      id: 'layer-color',
      name: '彩色 (Color)',
      visible: true,
      locked: false,
      opacity: 1.0,
      blendMode: 'multiply',
      paths: [],
    },
  ],
};

export const App: React.FC = () => {
  const { doc, setDoc, undo, redo, canUndo, canRedo } = useHistory(INITIAL_DOC);

  // Active Tool and Brush Settings
  const [tool, setTool] = useState<ToolType>('pen');
  const [shapeType, setShapeType] = useState<ShapeType>('rect');
  const [brushType, setBrushType] = useState<BrushType>('gpen');
  const [brushSize, setBrushSize] = useState<number>(4);
  const [strokeColor, setStrokeColor] = useState<string>('#18181b');
  const [fillColor, setFillColor] = useState<string>('none');
  const [stabilizer, setStabilizer] = useState<number>(4);

  // Killer Feature 1: Vector Eraser Mode & Radius
  const [eraserMode, setEraserMode] = useState<EraserMode>('intersection');
  const [eraserRadius, setEraserRadius] = useState<number>(24);

  // Killer Feature 2: Screentone
  const [activeTone, setActiveTone] = useState<ScreenTone>({
    type: 'dots',
    freq: 60,
    size: 2.5,
    angle: 45,
    density: 20,
  });

  // Killer Feature 3 & 5: Modals
  const [isEffectModalOpen, setIsEffectModalOpen] = useState(false);
  const [isTraceModalOpen, setIsTraceModalOpen] = useState(false);
  const [clipboardImageDataUrl, setClipboardImageDataUrl] = useState<string | null>(null);

  // Canvas Custom Size & Resize Modal
  const [isCanvasSizeModalOpen, setIsCanvasSizeModalOpen] = useState(false);
  const [canvasSizeModalMode, setCanvasSizeModalMode] = useState<'resize' | 'new'>('resize');

  // Killer Feature 4: Width Brush Mode
  const [widthBrushMode, setWidthBrushMode] = useState<WidthBrushMode>('thicken');

  // Recent color swatches history
  const [colorHistory, setColorHistory] = useState<string[]>([
    '#18181b', '#ffffff', '#4f46e5', '#ef4444', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'
  ]);

  const addColorHistory = useCallback((color: string) => {
    if (!color || color === 'none' || color === 'transparent') return;
    setColorHistory(prev => {
      const filtered = prev.filter(c => c.toLowerCase() !== color.toLowerCase());
      return [color, ...filtered].slice(0, 10);
    });
  }, []);

  // Canvas Viewport (Zoom, Rotation, Horizontal Flip)
  const [zoom, setZoom] = useState<number>(0.65);
  const [rotation, setRotation] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [fitTrigger, setFitTrigger] = useState<number>(0);

  // Selection
  const [selectedPathIds, setSelectedPathIds] = useState<string[]>([]);

  // Live stroke & fill color changes (updates selected shapes in real-time)
  const handleStrokeColorChange = useCallback((c: string) => {
    setStrokeColor(c);
    addColorHistory(c);
    if (selectedPathIds.length > 0) {
      const activeLayer = doc.layers.find(l => l.id === doc.activeLayerId);
      if (activeLayer) {
        const newPaths = activeLayer.paths.map(p => 
          selectedPathIds.includes(p.id) ? { ...p, strokeColor: c, strokeWidth: c === 'none' ? 0 : (p.strokeWidth || 3) } : p
        );
        setDoc({
          ...doc,
          layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: newPaths } : l)
        });
        setStatusMessage(`選択した図形の枠線色を変更: ${c === 'none' ? 'なし' : c}`);
      }
    }
  }, [doc, selectedPathIds, addColorHistory, setDoc]);

  const handleFillColorChange = useCallback((c: string) => {
    setFillColor(c);
    addColorHistory(c);
    if (selectedPathIds.length > 0) {
      const activeLayer = doc.layers.find(l => l.id === doc.activeLayerId);
      if (activeLayer) {
        const newPaths = activeLayer.paths.map(p => 
          selectedPathIds.includes(p.id) ? { ...p, fillColor: c, closed: c !== 'none' ? true : p.closed } : p
        );
        setDoc({
          ...doc,
          layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: newPaths } : l)
        });
        setStatusMessage(`選択した図形の塗り色を変更: ${c === 'none' ? 'なし' : c}`);
      }
    }
  }, [doc, selectedPathIds, addColorHistory, setDoc]);

  // Right Dock Tab
  const [activeTab, setActiveTab] = useState<'layers' | 'properties' | 'brush' | 'manga'>('brush');

  // Shortcuts Modal
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  // Status message in bottom bar
  const [statusMessage, setStatusMessage] = useState<string>('VektorStudio 準備完了 — ペンまたはツールを選択して描画');

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if focus is in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '0') {
        e.preventDefault();
        setRotation(0);
        setStatusMessage('キャンバスの回転をリセットしました');
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        setFitTrigger(t => t + 1);
      } else if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault();
        setZoom(1.0);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        // Delete selected paths
        if (selectedPathIds.length > 0) {
          const activeLayer = doc.layers.find(l => l.id === doc.activeLayerId);
          if (activeLayer) {
            const newPaths = activeLayer.paths.filter(p => !selectedPathIds.includes(p.id));
            setDoc({
              ...doc,
              layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: newPaths } : l),
            });
            setSelectedPathIds([]);
            setStatusMessage('選択パスを削除しました');
          }
        }
      } else if (e.key.toLowerCase() === 'p') {
        setTool('pen');
        setActiveTab('brush');
      } else if (e.key.toLowerCase() === 'u') {
        setTool('shape');
        const shapeName = shapeType === 'rect' ? '矩形' : shapeType === 'ellipse' ? '楕円' : shapeType === 'line' ? '直線' : shapeType === 'star' ? '星型' : '三角形';
        setStatusMessage(`シェイプツール: ${shapeName} (ドラッグで描画、Shiftで縦横比固定)`);
      } else if (e.key.toLowerCase() === 'a') {
        setTool('reshape');
        setActiveTab('properties');
        setStatusMessage('変形ツール: 輪郭クリックで点追加、ドラッグで移動、角丸/尖り切替');
      } else if (e.key.toLowerCase() === 'v') {
        setTool('select');
        setActiveTab('properties');
      } else if (e.key.toLowerCase() === 'e') {
        setTool('eraser');
        setStatusMessage('消しゴム: クリックまたはドラッグで線を消去');
      } else if (e.key.toLowerCase() === 'i') {
        setTool('eyedropper');
        setStatusMessage('スポイト: クリックして色を取得 (描画中はAlt+クリックでも可)');
      } else if (e.key.toLowerCase() === 't') {
        setTool('trim');
        setStatusMessage('交差点消しゴム: はみ出している線の区間をクリック');
      } else if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey) {
        setTool('scissors');
        setStatusMessage('パス切断: 切断したいストロークをクリック');
      } else if (e.key.toLowerCase() === 'w') {
        setTool('width');
        setStatusMessage('線幅編集: ストロークをクリックして横にドラッグ');
      } else if (e.key.toLowerCase() === 'b') {
        setTool('bucket');
        setStatusMessage('ベクターバケツ: 閉じた図形の内側をクリックして塗りつぶし');
      } else if (e.key.toLowerCase() === 'm') {
        setTool('mesh');
        setActiveTab('properties');
      } else if (e.key.toLowerCase() === 'h') {
        setTool('hand');
      } else if (e.key.toLowerCase() === 'x') {
        // Swap colors
        const temp = strokeColor;
        handleStrokeColorChange(fillColor === 'none' ? '#ffffff' : fillColor);
        handleFillColorChange(temp === 'none' ? '#18181b' : temp);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [doc, setDoc, undo, redo, selectedPathIds, strokeColor, fillColor, shapeType, handleStrokeColorChange, handleFillColorChange]);

  // Global Clipboard Image Paste (下描きスケッチのCtrl+V対応)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = ev => {
              if (ev.target?.result) {
                setClipboardImageDataUrl(ev.target.result as string);
                setIsTraceModalOpen(true);
                setStatusMessage('クリップボードの画像を読み込みました (ベクター化設定中)');
              }
            };
            reader.readAsDataURL(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleCommitEffectLines = useCallback((paths: VPath[], name: string) => {
    const activeLayer = doc.layers.find(l => l.id === doc.activeLayerId);
    if (!activeLayer) return;

    setDoc({
      ...doc,
      layers: doc.layers.map(l =>
        l.id === activeLayer.id ? { ...l, paths: [...l.paths, ...paths] } : l
      ),
    });
    setSelectedPathIds(paths.map(p => p.id));
    setStatusMessage(`${name}をベクター生成しました (${paths.length}本のパス)`);
  }, [doc, setDoc]);

  const handleCommitTracePaths = useCallback((paths: VPath[], name: string) => {
    const newLayer: Layer = {
      id: crypto.randomUUID(),
      name: `${name} (${paths.length}本)`,
      visible: true,
      locked: false,
      opacity: 1.0,
      blendMode: 'source-over',
      paths,
    };

    setDoc({
      ...doc,
      layers: [newLayer, ...doc.layers],
      activeLayerId: newLayer.id,
    });
    setSelectedPathIds([]);
    setStatusMessage(`スケッチをベクター化して新規レイヤー「${newLayer.name}」に追加しました`);
  }, [doc, setDoc]);

  // Canvas Resize and New Canvas Handler
  const handleApplyCanvasSize = useCallback((
    newWidth: number,
    newHeight: number,
    mode: 'resize' | 'new',
    keepCentered: boolean,
    webtoon: boolean
  ) => {
    if (mode === 'new') {
      setDoc({
        ...doc,
        width: newWidth,
        height: newHeight,
        webtoonMode: webtoon,
        symmetryCenter: { x: newWidth / 2, y: newHeight / 2 },
        perspective: {
          ...doc.perspective,
          horizonY: newHeight / 2,
          vanishingPoints: [{ x: newWidth / 2, y: newHeight / 2 }],
        },
        layers: doc.layers.map(l => ({ ...l, paths: [] })),
      });
      setSelectedPathIds([]);
      setFitTrigger(t => t + 1);
      setStatusMessage(`新規キャンバスを作成しました (${newWidth} × ${newHeight}px)`);
      return;
    }

    // Resize Mode: Keep drawings centered if keepCentered is true
    const oldW = doc.width;
    const oldH = doc.height;
    const dx = keepCentered ? (newWidth - oldW) / 2 : 0;
    const dy = keepCentered ? (newHeight - oldH) / 2 : 0;

    let shiftedDoc = doc;
    if (keepCentered && (dx !== 0 || dy !== 0)) {
      shiftedDoc = offsetDocumentContent(doc, dx, dy);
    }

    setDoc({
      ...shiftedDoc,
      width: newWidth,
      height: newHeight,
      webtoonMode: webtoon,
      symmetryCenter: { x: newWidth / 2, y: newHeight / 2 },
    });
    setFitTrigger(t => t + 1);
    setStatusMessage(`キャンバスサイズを変更しました (${newWidth} × ${newHeight}px / 既存描画中央維持)`);
  }, [doc, setDoc]);

  const rightTabs = [
    { id: 'brush', label: 'ブラシ', icon: <Paintbrush className="w-4 h-4" /> },
    { id: 'properties', label: 'プロパティ', icon: <Sliders className="w-4 h-4" /> },
    { id: 'layers', label: 'レイヤー', icon: <Layers className="w-4 h-4" /> },
    { id: 'manga', label: '漫画・効果', icon: <BookOpen className="w-4 h-4" /> },
  ] as const;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      {/* Top Header */}
      <Header
        doc={doc}
        onUpdateDoc={setDoc}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        zoom={zoom}
        onZoomChange={setZoom}
        rotation={rotation}
        onRotationChange={setRotation}
        stabilizer={stabilizer}
        onStabilizerChange={setStabilizer}
        flipH={flipH}
        onToggleFlipH={() => {
          setFlipH(f => !f);
          setStatusMessage(!flipH ? 'キャンバスを左右反転表示中' : '左右反転を解除しました');
        }}
        onFitToScreen={() => setFitTrigger(t => t + 1)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onStatusChange={setStatusMessage}
        onOpenCanvasModal={mode => {
          setCanvasSizeModalMode(mode);
          setIsCanvasSizeModalOpen(true);
        }}
      />

      {/* Main Workspace: Left Toolbar + Canvas + Right Dock */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Toolbar */}
        <Toolbar
          tool={tool}
          onSelectTool={t => {
            setTool(t);
            if (t === 'pen') setActiveTab('brush');
            else if (t === 'reshape' || t === 'mesh') setActiveTab('properties');
            else if (t === 'balloon' || t === 'panel' || t === 'focus_line') setActiveTab('manga');
          }}
          shapeType={shapeType}
          onShapeTypeChange={st => {
            setShapeType(st);
            setTool('shape');
          }}
          strokeColor={strokeColor}
          onStrokeColorChange={handleStrokeColorChange}
          fillColor={fillColor}
          onFillColorChange={handleFillColorChange}
          colorHistory={colorHistory}
          eraserMode={eraserMode}
          onEraserModeChange={setEraserMode}
          eraserRadius={eraserRadius}
          onEraserRadiusChange={setEraserRadius}
          widthBrushMode={widthBrushMode}
          onWidthBrushModeChange={setWidthBrushMode}
          onOpenEffectModal={() => setIsEffectModalOpen(true)}
          onOpenTraceModal={() => {
            setClipboardImageDataUrl(null);
            setIsTraceModalOpen(true);
          }}
        />

        {/* Center Drawing Canvas */}
        <main className="flex-1 h-full relative overflow-hidden">
          <Canvas
            doc={doc}
            onUpdateDoc={setDoc}
            tool={tool}
            brushType={brushType}
            brushSize={brushSize}
            strokeColor={strokeColor}
            fillColor={fillColor}
            stabilizer={stabilizer}
            zoom={zoom}
            onZoomChange={setZoom}
            rotation={rotation}
            onRotationChange={setRotation}
            selectedPathIds={selectedPathIds}
            onSelectPaths={setSelectedPathIds}
            onUndo={undo}
            onRedo={redo}
            onStatusChange={setStatusMessage}
            onStrokeColorChange={handleStrokeColorChange}
            flipH={flipH}
            shapeType={shapeType}
            fitTrigger={fitTrigger}
            onAddColorHistory={addColorHistory}
            eraserMode={eraserMode}
            eraserRadius={eraserRadius}
            widthBrushMode={widthBrushMode}
            activeTone={activeTone}
          />
        </main>

        {/* Right Dock Panel */}
        <aside className="w-80 bg-zinc-900 border-l border-zinc-800 flex flex-col z-20 shrink-0 select-none">
          {/* Tab Navigation Header */}
          <div className="flex items-center border-b border-zinc-800 bg-zinc-950/60 p-1 gap-1">
            {rightTabs.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-zinc-800 text-indigo-400 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Active Tab Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'brush' && (
              <BrushStudio
                currentBrush={brushType}
                onSelectBrush={setBrushType}
                brushSize={brushSize}
                onBrushSizeChange={setBrushSize}
                strokeColor={strokeColor}
              />
            )}
            {activeTab === 'properties' && (
              <PropertiesPanel
                doc={doc}
                onUpdateDoc={setDoc}
                selectedPathIds={selectedPathIds}
                strokeColor={strokeColor}
                onStrokeColorChange={handleStrokeColorChange}
                fillColor={fillColor}
                onFillColorChange={handleFillColorChange}
                onStatusChange={setStatusMessage}
              />
            )}
            {activeTab === 'layers' && (
              <LayerPanel
                doc={doc}
                onUpdateDoc={setDoc}
                onStatusChange={setStatusMessage}
              />
            )}
            {activeTab === 'manga' && (
              <MangaPanel
                doc={doc}
                onUpdateDoc={setDoc}
                strokeColor={strokeColor}
                fillColor={fillColor}
                onStrokeColorChange={handleStrokeColorChange}
                onFillColorChange={handleFillColorChange}
                selectedPathIds={selectedPathIds}
                onStatusChange={setStatusMessage}
                activeTone={activeTone}
                onActiveToneChange={setActiveTone}
                onOpenEffectModal={() => setIsEffectModalOpen(true)}
              />
            )}
          </div>
        </aside>
      </div>

      {/* Bottom Status Bar */}
      <footer className="h-6 bg-zinc-900 border-t border-zinc-800/80 px-3 flex items-center justify-between text-[11px] text-zinc-400 z-30 select-none">
        <div className="flex items-center gap-2 truncate">
          <Info className="w-3 h-3 text-indigo-400 shrink-0" />
          <span className="truncate">{statusMessage}</span>
        </div>

        <div className="flex items-center gap-4 shrink-0 font-mono text-[10px] text-zinc-500">
          <button
            onClick={() => {
              setCanvasSizeModalMode('resize');
              setIsCanvasSizeModalOpen(true);
            }}
            title="キャンバスサイズ設定・リサイズ (クリックして変更)"
            className="hover:text-indigo-400 transition-colors cursor-pointer flex items-center gap-1 text-zinc-400 hover:underline"
          >
            <span>{doc.width} × {doc.height}px</span>
            <span className="text-[9px] text-zinc-500 bg-zinc-800 px-1 rounded">サイズ変更</span>
          </button>
          <span>ツール: <strong className="text-zinc-300 uppercase">{tool}</strong></span>
          <span>選択: <strong className="text-zinc-300">{selectedPathIds.length}</strong></span>
          <span>Undo: <strong className="text-zinc-300">{canUndo ? '可' : '不可'}</strong></span>
        </div>
      </footer>

      {/* Shortcuts Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Killer Feature 3: Action Focus Lines, Speed Lines, and Burst Flash Modal */}
      <EffectLineModal
        isOpen={isEffectModalOpen}
        onClose={() => setIsEffectModalOpen(false)}
        canvasWidth={doc.width}
        canvasHeight={doc.height}
        onCommitPaths={handleCommitEffectLines}
      />

      {/* Killer Feature 5: Sketch Auto-Trace Modal */}
      <AutoTraceModal
        isOpen={isTraceModalOpen}
        onClose={() => setIsTraceModalOpen(false)}
        canvasWidth={doc.width}
        canvasHeight={doc.height}
        onCommitPaths={handleCommitTracePaths}
        initialImageDataUrl={clipboardImageDataUrl}
      />

      {/* Canvas Size Customization & Resize Modal */}
      <CanvasSizeModal
        isOpen={isCanvasSizeModalOpen}
        onClose={() => setIsCanvasSizeModalOpen(false)}
        currentWidth={doc.width}
        currentHeight={doc.height}
        initialMode={canvasSizeModalMode}
        onApply={handleApplyCanvasSize}
      />
    </div>
  );
};
export default App;
