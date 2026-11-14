import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  Document, ToolType, Point, VPath, VNode, Layer, BrushType, BoundingBox, ShapeType,
  EraserMode, WidthBrushMode, ScreenTone
} from '../types';
import { 
  dist, evalCubicBezier, flattenVPath, getPathBoundingBox, getCombinedBoundingBox,
  trimPathAtIntersections, catmullRomToBezier, getSymmetricPoints,
  simplifyPolyline, isPointInVPath, splitVPathAtPoint, insertNodeInSegment, transformPath,
  createShapeNodes, toggleNodeSmoothness, deleteNodeFromPath, eraseVectorPathAtPoint,
  modifyPathStrokeWidth, findNearestPointOnVPath, closePathIfEndpointsMeet,
  findEnclosedRegionWithGaps, recognizeQuickShape, QuickShapeResult, cleanStrayDots, simplifyVPath
} from '../utils/geometry';
import { renderMesh, createDefaultMesh } from '../utils/mesh';
import { calculateStrokeWidth, BRUSH_PRESETS } from '../utils/brushes';
import { 
  Check, X, Type, Spline, CircleDot, Square, Trash2, SlidersHorizontal, PenTool,
  Undo2, Redo2, PaintBucket, Eraser, Pipette, Sparkles, Wand2, Lightbulb, ChevronDown, ChevronUp
} from 'lucide-react';

interface CanvasProps {
  doc: Document;
  onUpdateDoc: (newDoc: Document) => void;
  tool: ToolType;
  brushType: BrushType;
  brushSize: number;
  strokeColor: string;
  fillColor: string;
  stabilizer: number;
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  rotation: number;
  onRotationChange: (newRot: number) => void;
  selectedPathIds: string[];
  onSelectPaths: (ids: string[]) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  statusMessage?: string;
  onStatusChange: (msg: string) => void;
  onStrokeColorChange?: (c: string) => void;
  flipH?: boolean;
  shapeType?: ShapeType;
  fitTrigger?: number;
  onAddColorHistory?: (c: string) => void;
  eraserMode?: EraserMode;
  eraserRadius?: number;
  widthBrushMode?: WidthBrushMode;
  onWidthBrushModeChange?: (mode: WidthBrushMode) => void;
  onSelectTool?: (tool: ToolType) => void;
  activeTone?: ScreenTone;
}

type TransformHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate' | 'body';

export const TOOL_HINTS: Partial<Record<ToolType, { title: string; main: string; tip: string; shortcut?: string }>> = {
  pen: {
    title: 'ペン作画 (Gペン / 鉛筆 / 筆)',
    shortcut: 'P',
    main: '描いた線の終わりで約0.4秒静止すると、綺麗な直線・正円・四角形に自動吸着します (QuickShape)',
    tip: 'キャンバス上で右クリックすると、手元に8方向クイックメニューをいつでも呼び出せます',
  },
  bucket: {
    title: '隙間閉じスマートバケツ',
    shortcut: 'G',
    main: '線画に最大35pxの隙間があっても外に漏れず自動補完して塗れます（塗りは自動で線画の下層に配置）',
    tip: 'レイヤーパネルで「線画参照」に設定すると、別レイヤーの線画を参照して綺麗に塗り分けられます',
  },
  eraser: {
    title: 'ベクター消しゴム',
    shortcut: 'E',
    main: '交点まで一発消去 / なぞった部分消去 / 触れた線全体消去を上部バーで切り替え可能',
    tip: '交差する不要なはみ出し線も「交点まで消去」モードで一瞬で綺麗に消去できます',
  },
  width: {
    title: '線幅修正ブラシ',
    shortcut: 'W',
    main: '描いた後の線をなぞるだけで、部分的に太く・細く・入り抜き(強弱)を自由自在に修正できます',
    tip: '作画中に「W」キーを押すだけで、画面移動なしにその場で線幅修正ブラシに切り替わります',
  },
  reshape: {
    title: 'アンカーポイント変形',
    shortcut: 'A',
    main: '青いアンカーポイントをドラッグして曲線の形状を直感的に修正。角丸(曲線)と尖り(直線)もワンタップ切替',
    tip: 'サブバーの「曲線単純化」を押すと、余分なアンカーポイントを自動整理して美しいなめらかな線になります',
  },
  eyedropper: {
    title: 'カラーピッカー (スポイト)',
    shortcut: 'I',
    main: 'キャンバス上の任意の色をクリックして取得します。画面上の拡大ルーペで1px単位で色を拾えます',
    tip: 'ペンやバケツ使用中でも、Altキーを押しながらクリックすると即座にスポイトできます',
  },
  select: {
    title: '選択・自由変形',
    shortcut: 'V',
    main: '図形をクリックして選択。周囲の青いハンドルで拡大・縮小・回転・移動ができます',
    tip: 'Shiftキーを押しながら角ハンドルをドラッグすると、縦横比を維持したまま拡大縮小できます',
  },
  shape: {
    title: '図形ツール',
    shortcut: 'U',
    main: 'ドラッグして長方形・楕円・星形・矢印・多角形を作成。Shiftキーで正方形・正円に固定できます',
    tip: '作成後に「アンカーポイント変形(A)」に切り替えると、頂点を自由に動かして変形できます',
  },
  panel: {
    title: 'マンガコマ割りツール',
    main: 'キャンバス上をドラッグしてマンガのコマ枠を一発作成。枠線の太さや角丸も自由に調整可能',
    tip: '「コマ割り分割」ツールでコマ枠を縦や斜めにスパッと分割できます',
  },
  balloon: {
    title: 'セリフ・フキダシツール',
    main: 'ドラッグしてフキダシを作成。ダブルクリックで縦書き/横書きのセリフ文字を直接入力できます',
    tip: 'しっぽの青い丸ハンドルをドラッグすると、喋っているキャラクターの口元へ自然に伸ばせます',
  },
  focus_line: {
    title: '集中線エフェクト',
    main: 'アクションシーンや感情表現に使える集中線エフェクトをワンクリックで自動生成',
    tip: '線の本数や密度、中心の抜き半径をリアルタイムにスライダーで調整できます',
  },
  speed_line: {
    title: '流線 (スピード線)',
    main: '疾走感や動きの方向を表現するスピード線をワンクリックで描画',
    tip: '線の本数や角度、長さをスライダーでリアルタイムに調整できます',
  },
  mesh: {
    title: 'グラデーションメッシュ',
    main: '図形内部の格子ポイントを動かして、滑らかで立体的なカラーグラデーションを作成できます',
    tip: '格子ピンをクリックして色を変えると、プロ品質の複雑な陰影やハイライトを表現できます',
  },
  hand: {
    title: '手のひらツール',
    shortcut: 'H',
    main: 'キャンバスを自由につかんでスクロール移動します',
    tip: 'どのツール使用中でも、スペースキーまたはマウスホイール中央ドラッグで画面を移動できます',
  },
  scissors: {
    title: 'パス切断 (ハサミ) ツール',
    shortcut: 'C',
    main: 'ベクター線の切断したい箇所をクリックすると、パスを2つに分割できます',
    tip: '切断した端点はアンカーポイント変形ツールで個別に動かせます',
  },
  trim: {
    title: '交点トリミング',
    shortcut: 'T',
    main: '交差している線の不要なはみ出し部分をクリックして一発消去します',
    tip: 'ベクター消しゴムの「交点まで消去」モードでも同じ操作が可能です',
  },
};

export const Canvas: React.FC<CanvasProps> = ({
  doc,
  onUpdateDoc,
  tool,
  brushType,
  brushSize,
  strokeColor,
  fillColor,
  stabilizer,
  zoom,
  onZoomChange,
  rotation,
  onRotationChange,
  selectedPathIds,
  onSelectPaths,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  statusMessage,
  onStatusChange,
  onStrokeColorChange,
  flipH = false,
  shapeType = 'rect',
  fitTrigger,
  onAddColorHistory,
  eraserMode = 'intersection',
  eraserRadius = 24,
  widthBrushMode = 'thicken',
  onWidthBrushModeChange,
  onSelectTool,
  activeTone,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pan offset (in screen pixels)
  const [pan, setPan] = useState<Point>({ x: 100, y: 80 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<Point>({ x: 0, y: 0 });

  // Hover position & Loupe state
  const [hoverDocPt, setHoverDocPt] = useState<Point | null>(null);
  const [hoverScreenPt, setHoverScreenPt] = useState<Point | null>(null);
  const [eyedropperColor, setEyedropperColor] = useState<string | null>(null);

  // QuickShape Procreate-style shape snap
  const [quickShapePreview, setQuickShapePreview] = useState<QuickShapeResult | null>(null);
  const quickShapeTimerRef = useRef<number | null>(null);

  // Canvas Stylus / Right-click Radial Quick Menu
  const [radialMenuPos, setRadialMenuPos] = useState<Point | null>(null);

  // Beginner Action Hint Banner state
  const [isHintCollapsed, setIsHintCollapsed] = useState(false);

  // Current drawing stroke
  const isDrawingRef = useRef(false);
  const strokePointsRef = useRef<{ pt: Point; pressure: number; time: number }[]>([]);

  // Eraser state
  const isErasingRef = useRef(false);

  // Selection Transform state (move, scale, rotate)
  const [activeHandle, setActiveHandle] = useState<TransformHandle | null>(null);
  const transformStateRef = useRef<{
    handle: TransformHandle;
    startDocPt: Point;
    startScreenPt: Point;
    origBBox: BoundingBox;
    origPaths: VPath[];
  } | null>(null);

  // Rubber-band selection box
  const [rubberBand, setRubberBand] = useState<{ start: Point; current: Point } | null>(null);

  // Direct canvas drag creation for Panel / Balloon
  const [dragCreation, setDragCreation] = useState<{ start: Point; current: Point } | null>(null);

  // Reshape node selection & drag state (Scratch-style)
  const [selectedNode, setSelectedNode] = useState<{ pathId: string; nodeIndex: number } | null>(null);
  const [draggedNode, setDraggedNode] = useState<{
    pathId: string;
    nodeIndex: number;
    type: 'pos' | 'cpIn' | 'cpOut';
    origPos: Point;
    origCpIn?: Point;
    origCpOut?: Point;
    smooth?: boolean;
  } | null>(null);

  // Dynamic stroke width drag state
  const widthDragRef = useRef<{
    pathId: string;
    startPt: Point;
    origWidth: number;
  } | null>(null);

  // Mesh editing state
  const [draggedMeshPin, setDraggedMeshPin] = useState<{
    pathId: string;
    pinIndex: number;
    startPt: Point;
    hasDragged: boolean;
  } | null>(null);

  // Speech Balloon Tail Dragging state
  const [draggedBalloonTail, setDraggedBalloonTail] = useState<{ pathId: string } | null>(null);

  // Speech Balloon Inline Text Editing Overlay
  const [editingBalloon, setEditingBalloon] = useState<{
    pathId: string;
    text: string;
    fontSize: number;
    verticalText: boolean;
    textColor: string;
    screenPos: Point;
  } | null>(null);

  // Multi-touch gestures tracking
  const touchPointersRef = useRef<Map<number, Point>>(new Map());
  const initialTouchDistRef = useRef<number>(0);
  const initialTouchAngleRef = useRef<number>(0);
  const touchCountHistoryRef = useRef<number>(0);

  // Center canvas on first load
  useEffect(() => {
    if (containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current;
      setPan({
        x: Math.max(40, (clientWidth - doc.width * zoom) / 2),
        y: Math.max(40, (clientHeight - doc.height * zoom) / 2),
      });
    }
  }, []);

  // Fit to screen handler triggered by fitTrigger prop or Ctrl+0
  const handleFitToScreen = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const padding = 80;
    const availW = Math.max(100, clientWidth - padding);
    const availH = Math.max(100, clientHeight - padding);
    const scale = Math.min(availW / doc.width, availH / doc.height, 2.0);
    const newZoom = Math.max(0.1, Math.min(scale, 1.5));
    onZoomChange(Number(newZoom.toFixed(2)));
    onRotationChange(0);
    setPan({
      x: (clientWidth - doc.width * newZoom) / 2,
      y: (clientHeight - doc.height * newZoom) / 2,
    });
    onStatusChange('全体表示にフィットしました');
  }, [doc.width, doc.height, onZoomChange, onRotationChange, onStatusChange]);

  useEffect(() => {
    if (fitTrigger && fitTrigger > 0) {
      handleFitToScreen();
    }
  }, [fitTrigger, handleFitToScreen]);

  // Coordinate transforms with flipH and rotation support
  const toDoc = useCallback((screenX: number, screenY: number): Point => {
    let x = screenX - pan.x;
    let y = screenY - pan.y;

    const cx = (doc.width * zoom) / 2;
    const cy = (doc.height * zoom) / 2;

    if (flipH) {
      x = 2 * cx - x;
    }

    if (rotation !== 0) {
      const rad = (-rotation * Math.PI) / 180;
      const dx = x - cx;
      const dy = y - cy;
      x = cx + (dx * Math.cos(rad) - dy * Math.sin(rad));
      y = cy + (dx * Math.sin(rad) + dy * Math.cos(rad));
    }

    return {
      x: x / zoom,
      y: y / zoom,
    };
  }, [pan, zoom, rotation, flipH, doc.width, doc.height]);

  const toScreen = useCallback((docX: number, docY: number): Point => {
    let x = docX * zoom;
    let y = docY * zoom;

    const cx = (doc.width * zoom) / 2;
    const cy = (doc.height * zoom) / 2;

    if (rotation !== 0) {
      const rad = (rotation * Math.PI) / 180;
      const dx = x - cx;
      const dy = y - cy;
      x = cx + (dx * Math.cos(rad) - dy * Math.sin(rad));
      y = cy + (dx * Math.sin(rad) + dy * Math.cos(rad));
    }

    if (flipH) {
      x = 2 * cx - x;
    }

    return {
      x: x + pan.x,
      y: y + pan.y,
    };
  }, [pan, zoom, rotation, flipH, doc.width, doc.height]);

  // Main Render Loop
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Apply viewport transform
    ctx.save();
    ctx.translate(pan.x, pan.y);

    const cx = (doc.width * zoom) / 2;
    const cy = (doc.height * zoom) / 2;

    if (flipH) {
      ctx.translate(cx, cy);
      ctx.scale(-1, 1);
      ctx.translate(-cx, -cy);
    }

    if (rotation !== 0) {
      ctx.translate(cx, cy);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }

    ctx.scale(zoom, zoom);

    // Document Paper background
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, doc.width, doc.height);
    ctx.restore();

    // Perspective Guides
    if (doc.perspective && doc.perspective.enabled) {
      renderPerspectiveGuides(ctx, doc);
    }

    // Layers Rendering with Clipping Mask Support
    // Layer stack order: index (length-1) is bottom, index 0 is top
    const layersBottomToTop = [...doc.layers].reverse();

    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }
    const offCanvas = offscreenCanvasRef.current;
    if (offCanvas.width !== doc.width || offCanvas.height !== doc.height) {
      offCanvas.width = doc.width;
      offCanvas.height = doc.height;
    }
    const offCtx = offCanvas.getContext('2d');

    let i = 0;
    while (i < layersBottomToTop.length) {
      const baseLayer = layersBottomToTop[i];
      if (!baseLayer.visible) {
        i++;
        continue;
      }

      // Check if subsequent layers are clipped to baseLayer
      let hasClipped = false;
      let j = i + 1;
      while (j < layersBottomToTop.length && layersBottomToTop[j].clipped) {
        hasClipped = true;
        j++;
      }

      if (!hasClipped && !baseLayer.clipped) {
        // Normal unclipped layer: render directly
        ctx.save();
        ctx.globalAlpha = baseLayer.opacity;
        ctx.globalCompositeOperation = baseLayer.blendMode || 'source-over';
        for (const path of baseLayer.paths) {
          renderPath(ctx, path, !!baseLayer.isDraft);
        }
        ctx.restore();
        i++;
      } else if (offCtx) {
        // Clipping group: render base layer on offscreen canvas, then clipped layers with source-atop
        offCtx.clearRect(0, 0, doc.width, doc.height);

        // Render base
        offCtx.save();
        offCtx.globalAlpha = baseLayer.opacity;
        offCtx.globalCompositeOperation = 'source-over';
        for (const path of baseLayer.paths) {
          renderPath(offCtx, path, !!baseLayer.isDraft);
        }
        offCtx.restore();

        // Render all clipped layers above it
        for (let k = i + 1; k < j; k++) {
          const clipLayer = layersBottomToTop[k];
          if (!clipLayer.visible) continue;
          offCtx.save();
          offCtx.globalAlpha = clipLayer.opacity;
          offCtx.globalCompositeOperation = 'source-atop';
          for (const path of clipLayer.paths) {
            renderPath(offCtx, path, !!clipLayer.isDraft);
          }
          offCtx.restore();
        }

        // Composite the whole group onto main canvas
        ctx.save();
        ctx.globalCompositeOperation = baseLayer.blendMode || 'source-over';
        ctx.drawImage(offCanvas, 0, 0);
        ctx.restore();

        i = j; // skip processed clipped layers
      } else {
        i++;
      }
    }

    // Live Inking Stroke
    if (isDrawingRef.current && strokePointsRef.current.length > 1) {
      ctx.save();
      const pts = strokePointsRef.current;

      // Scratch-style live fill preview for open stroke
      if (fillColor && fillColor !== 'none' && fillColor !== 'transparent') {
        ctx.fillStyle = fillColor;
        ctx.beginPath();
        ctx.moveTo(pts[0].pt.x, pts[0].pt.y);
        for (let k = 1; k < pts.length; k++) {
          const xc = (pts[k - 1].pt.x + pts[k].pt.x) / 2;
          const yc = (pts[k - 1].pt.y + pts[k].pt.y) / 2;
          ctx.quadraticCurveTo(pts[k - 1].pt.x, pts[k - 1].pt.y, xc, yc);
        }
        ctx.closePath();
        ctx.fill();
      }

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0].pt.x, pts[0].pt.y);
      for (let k = 1; k < pts.length; k++) {
        const xc = (pts[k - 1].pt.x + pts[k].pt.x) / 2;
        const yc = (pts[k - 1].pt.y + pts[k].pt.y) / 2;
        ctx.quadraticCurveTo(pts[k - 1].pt.x, pts[k - 1].pt.y, xc, yc);
      }
      ctx.stroke();

      // Symmetric live preview
      if (doc.symmetry !== 'none') {
        const symPointsList: Point[][] = [];
        const numS = getSymmetricPoints(pts[0].pt, doc.symmetry, doc.symmetryCenter).length;
        for (let s = 1; s < numS; s++) symPointsList.push([]);
        for (const ptEntry of pts) {
          const syms = getSymmetricPoints(ptEntry.pt, doc.symmetry, doc.symmetryCenter);
          for (let s = 1; s < syms.length; s++) {
            symPointsList[s - 1].push(syms[s]);
          }
        }
        for (const symPts of symPointsList) {
          if (symPts.length > 1) {
            if (fillColor && fillColor !== 'none' && fillColor !== 'transparent') {
              ctx.fillStyle = fillColor;
              ctx.beginPath();
              ctx.moveTo(symPts[0].x, symPts[0].y);
              for (let k = 1; k < symPts.length; k++) {
                const xc = (symPts[k - 1].x + symPts[k].x) / 2;
                const yc = (symPts[k - 1].y + symPts[k].y) / 2;
                ctx.quadraticCurveTo(symPts[k - 1].x, symPts[k - 1].y, xc, yc);
              }
              ctx.closePath();
              ctx.fill();
            }

            ctx.beginPath();
            ctx.moveTo(symPts[0].x, symPts[0].y);
            for (let k = 1; k < symPts.length; k++) {
              const xc = (symPts[k - 1].x + symPts[k].x) / 2;
              const yc = (symPts[k - 1].y + symPts[k].y) / 2;
              ctx.quadraticCurveTo(symPts[k - 1].x, symPts[k - 1].y, xc, yc);
            }
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }

    // Live QuickShape Snapping Preview (Procreate style)
    if (quickShapePreview) {
      ctx.save();
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = Math.max(brushSize, 2);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      buildPath2D(ctx, {
        nodes: quickShapePreview.nodes,
        closed: quickShapePreview.closed,
      });
      ctx.stroke();

      // Render anchor control points
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0891b2';
      ctx.lineWidth = 1.5;
      for (const node of quickShapePreview.nodes) {
        ctx.beginPath();
        ctx.arc(node.pos.x, node.pos.y, 4 / zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    // Direct drag creation preview for Panel or Balloon
    if (dragCreation) {
      ctx.save();
      const x = Math.min(dragCreation.start.x, dragCreation.current.x);
      const y = Math.min(dragCreation.start.y, dragCreation.current.y);
      const w = Math.abs(dragCreation.current.x - dragCreation.start.x);
      const h = Math.abs(dragCreation.current.y - dragCreation.start.y);

      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([6 / zoom, 4 / zoom]);

      if (tool === 'balloon') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (tool === 'panel') {
        ctx.fillStyle = 'rgba(79, 70, 229, 0.08)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
      }
      ctx.restore();
    }

    // Symmetry Guide
    if (doc.symmetry !== 'none') {
      renderSymmetryGuide(ctx, doc);
    }

    ctx.restore(); // Restore document viewport

    // Tool Overlays in Screen space
    renderToolOverlays(ctx);

    ctx.restore();
  }, [doc, pan, zoom, rotation, flipH, strokeColor, fillColor, brushSize, tool, shapeType, selectedPathIds, rubberBand, dragCreation, draggedBalloonTail, hoverDocPt, hoverScreenPt, eyedropperColor, quickShapePreview]);

  useEffect(() => {
    let animId: number;
    const loop = () => {
      render();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [render]);

  const renderPath = (ctx: CanvasRenderingContext2D, path: VPath, isDraft = false) => {
    if (path.nodes.length === 0) return;

    ctx.save();
    ctx.globalAlpha = isDraft ? Math.min(path.opacity, 0.65) : path.opacity;

    if (path.mesh && path.mesh.enabled) {
      const bbox = getPathBoundingBox(path);
      if (bbox.width > 0 && bbox.height > 0) {
        ctx.save();
        ctx.beginPath();
        buildPath2D(ctx, path);
        ctx.clip();
        renderMesh(ctx, path.mesh, bbox);
        ctx.restore();
      }
    } else if (path.fillColor && path.fillColor !== 'none' && path.fillColor !== 'transparent') {
      ctx.fillStyle = isDraft ? 'rgba(96, 165, 250, 0.22)' : path.fillColor;
      ctx.beginPath();
      buildPath2D(ctx, path);
      ctx.fill();
    }

    if (path.tone && path.tone.type !== 'none' && !isDraft) {
      renderTonePattern(ctx, path);
    }

    if (path.strokeColor && path.strokeColor !== 'none' && path.strokeWidth > 0) {
      ctx.strokeStyle = isDraft ? '#60a5fa' : path.strokeColor;
      ctx.lineWidth = path.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      buildPath2D(ctx, path);
      ctx.stroke();
    }

    if (path.balloon) {
      renderSpeechBalloon(ctx, path);
    }

    ctx.restore();
  };

  const buildPath2D = (ctx: CanvasRenderingContext2D, path: { nodes: VNode[]; closed: boolean }) => {
    const nodes = path.nodes;
    if (nodes.length === 0) return;
    ctx.moveTo(nodes[0].pos.x, nodes[0].pos.y);

    const numSegs = path.closed ? nodes.length : nodes.length - 1;
    for (let i = 0; i < numSegs; i++) {
      const n1 = nodes[i];
      const n2 = nodes[(i + 1) % nodes.length];
      const cp1 = n1.cpOut ?? n1.pos;
      const cp2 = n2.cpIn ?? n2.pos;
      const end = n2.pos;
      ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
    }

    if (path.closed) ctx.closePath();
  };

  const renderTonePattern = (ctx: CanvasRenderingContext2D, path: VPath) => {
    if (!path.tone || path.tone.type === 'none') return;
    const tone = path.tone;
    const bbox = getPathBoundingBox(path);
    if (bbox.width <= 0 || bbox.height <= 0) return;

    ctx.save();
    ctx.beginPath();
    buildPath2D(ctx, path);
    ctx.clip();

    const density = (tone.density ?? 20) / 100;
    const freqVal = tone.freq || 60;
    // Standard manga halftone raster spacing based on line frequency (30L..85L)
    const spacing = Math.max(4, (1200 / freqVal) * 0.65);

    const angleRad = ((tone.angle ?? 45) * Math.PI) / 180;
    const cx = bbox.centerX;
    const cy = bbox.centerY;

    ctx.translate(cx, cy);
    ctx.rotate(angleRad);

    const diag = Math.sqrt(bbox.width * bbox.width + bbox.height * bbox.height) * 1.5;
    const minX = -diag / 2;
    const maxX = diag / 2;
    const minY = -diag / 2;
    const maxY = diag / 2;

    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#000000';

    if (tone.type === 'dots') {
      const radius = Math.max(0.6, (spacing / 2) * Math.sqrt(density));
      for (let y = minY; y <= maxY; y += spacing) {
        for (let x = minX; x <= maxX; x += spacing) {
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (tone.type === 'lines') {
      const lineWidth = Math.max(0.8, spacing * density);
      ctx.lineWidth = lineWidth;
      for (let y = minY; y <= maxY; y += spacing) {
        ctx.beginPath();
        ctx.moveTo(minX, y);
        ctx.lineTo(maxX, y);
        ctx.stroke();
      }
    } else if (tone.type === 'cross') {
      const lineWidth = Math.max(0.8, spacing * density * 0.75);
      ctx.lineWidth = lineWidth;
      for (let y = minY; y <= maxY; y += spacing) {
        ctx.beginPath();
        ctx.moveTo(minX, y);
        ctx.lineTo(maxX, y);
        ctx.stroke();
      }
      for (let x = minX; x <= maxX; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x, minY);
        ctx.lineTo(x, maxY);
        ctx.stroke();
      }
    } else if (tone.type === 'noise') {
      // Deterministic sand tone based on grid
      const countPerCell = Math.max(1, Math.round(density * 6));
      for (let y = minY; y <= maxY; y += spacing) {
        for (let x = minX; x <= maxX; x += spacing) {
          for (let k = 0; k < countPerCell; k++) {
            const seed = Math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453;
            const rx = (seed - Math.floor(seed)) * spacing;
            const seed2 = Math.sin(y * 12.9898 + x * 78.233 + k * 19.123) * 43758.5453;
            const ry = (seed2 - Math.floor(seed2)) * spacing;
            ctx.fillRect(x + rx, y + ry, 1.2, 1.2);
          }
        }
      }
    } else if (tone.type === 'gradient') {
      // Gradient halftone dots: density increases across screen angle
      for (let y = minY; y <= maxY; y += spacing) {
        const localT = Math.max(0.05, Math.min(1.0, (y - minY) / (maxY - minY)));
        const localDensity = density * localT * 1.6;
        const radius = Math.max(0.5, (spacing / 2) * Math.sqrt(Math.min(0.85, localDensity)));
        for (let x = minX; x <= maxX; x += spacing) {
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  };


  const renderSpeechBalloon = (ctx: CanvasRenderingContext2D, path: VPath) => {
    const balloon = path.balloon!;
    const bbox = getPathBoundingBox(path);

    // Draw balloon tail triangle towards tailPos if set
    if (balloon.tailPos) {
      const cx = bbox.centerX;
      const cy = bbox.centerY;
      const tx = balloon.tailPos.x;
      const ty = balloon.tailPos.y;
      const angle = Math.atan2(ty - cy, tx - cx);
      const perp = angle + Math.PI / 2;
      const baseWidth = Math.max(12, (balloon.fontSize || 18) * 0.75);

      // Tail root coordinates on the balloon oval boundary
      const edgeX = cx + (Math.cos(angle) * (bbox.width / 2)) * 0.88;
      const edgeY = cy + (Math.sin(angle) * (bbox.height / 2)) * 0.88;

      const p1 = {
        x: edgeX + Math.cos(perp) * baseWidth,
        y: edgeY + Math.sin(perp) * baseWidth,
      };
      const p2 = {
        x: edgeX - Math.cos(perp) * baseWidth,
        y: edgeY - Math.sin(perp) * baseWidth,
      };

      ctx.save();
      ctx.fillStyle = path.fillColor && path.fillColor !== 'none' ? path.fillColor : '#ffffff';
      ctx.strokeStyle = path.strokeColor && path.strokeColor !== 'none' ? path.strokeColor : '#27272a';
      ctx.lineWidth = path.strokeWidth || 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(tx, ty);
      ctx.lineTo(p2.x, p2.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    if (!balloon.text) return;

    ctx.save();
    ctx.font = `${balloon.fontSize || 18}px sans-serif`;
    ctx.fillStyle = balloon.textColor || '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (balloon.verticalText) {
      const chars = balloon.text.split('');
      const lineHeight = (balloon.fontSize || 18) * 1.25;
      const totalH = chars.length * lineHeight;
      let startY = bbox.centerY - totalH / 2 + lineHeight / 2;

      for (const char of chars) {
        ctx.fillText(char, bbox.centerX, startY);
        startY += lineHeight;
      }
    } else {
      ctx.fillText(balloon.text, bbox.centerX, bbox.centerY);
    }
    ctx.restore();
  };

  const renderSymmetryGuide = (ctx: CanvasRenderingContext2D, doc: Document) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.65)';
    ctx.lineWidth = 1.5 / zoom;
    ctx.setLineDash([6 / zoom, 6 / zoom]);

    const c = doc.symmetryCenter;
    if (doc.symmetry === 'vertical' || doc.symmetry === 'cross') {
      ctx.beginPath();
      ctx.moveTo(c.x, 0);
      ctx.lineTo(c.x, doc.height);
      ctx.stroke();
    }
    if (doc.symmetry === 'horizontal' || doc.symmetry === 'cross') {
      ctx.beginPath();
      ctx.moveTo(0, c.y);
      ctx.lineTo(doc.width, c.y);
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.fillStyle = '#6366f1';
    ctx.beginPath();
    ctx.arc(c.x, c.y, 5 / zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const renderPerspectiveGuides = (ctx: CanvasRenderingContext2D, doc: Document) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(236, 72, 153, 0.35)';
    ctx.lineWidth = 1.0 / zoom;

    ctx.beginPath();
    ctx.moveTo(0, doc.perspective.horizonY);
    ctx.lineTo(doc.width, doc.perspective.horizonY);
    ctx.stroke();

    for (const vp of doc.perspective.vanishingPoints) {
      ctx.fillStyle = '#ec4899';
      ctx.beginPath();
      ctx.arc(vp.x, vp.y, 4 / zoom, 0, Math.PI * 2);
      ctx.fill();

      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
        ctx.beginPath();
        ctx.moveTo(vp.x, vp.y);
        ctx.lineTo(vp.x + Math.cos(angle) * 3000, vp.y + Math.sin(angle) * 3000);
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  // Render Tool Overlays in Screen coordinates
  const renderToolOverlays = (ctx: CanvasRenderingContext2D) => {
    const activeLayer = doc.layers.find(l => l.id === doc.activeLayerId);
    if (!activeLayer) return;

    // 1. Rubber-band selection box
    if (rubberBand) {
      const p1 = toScreen(rubberBand.start.x, rubberBand.start.y);
      const p2 = toScreen(rubberBand.current.x, rubberBand.current.y);
      const rx = Math.min(p1.x, p2.x);
      const ry = Math.min(p1.y, p2.y);
      const rw = Math.abs(p2.x - p1.x);
      const rh = Math.abs(p2.y - p1.y);

      ctx.fillStyle = 'rgba(99, 102, 241, 0.12)';
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);
    }

    // 2. Reshape Tool Overlays
    if (tool === 'reshape') {
      const pathsToInspect = selectedPathIds.length > 0 
        ? activeLayer.paths.filter(p => selectedPathIds.includes(p.id))
        : activeLayer.paths;

      for (const p of pathsToInspect) {
        for (let idx = 0; idx < p.nodes.length; idx++) {
          const n = p.nodes[idx];
          const scrPos = toScreen(n.pos.x, n.pos.y);

          if (n.cpIn) {
            const scrCpIn = toScreen(n.cpIn.x, n.cpIn.y);
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(scrPos.x, scrPos.y);
            ctx.lineTo(scrCpIn.x, scrCpIn.y);
            ctx.stroke();

            ctx.fillStyle = '#a5b4fc';
            ctx.beginPath();
            ctx.arc(scrCpIn.x, scrCpIn.y, 4, 0, Math.PI * 2);
            ctx.fill();
          }

          if (n.cpOut) {
            const scrCpOut = toScreen(n.cpOut.x, n.cpOut.y);
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(scrPos.x, scrPos.y);
            ctx.lineTo(scrCpOut.x, scrCpOut.y);
            ctx.stroke();

            ctx.fillStyle = '#a5b4fc';
            ctx.beginPath();
            ctx.arc(scrCpOut.x, scrCpOut.y, 4, 0, Math.PI * 2);
            ctx.fill();
          }

          // Outer halo for selected anchor point
          const isNodeSelected = selectedNode && selectedNode.pathId === p.id && selectedNode.nodeIndex === idx;
          if (isNodeSelected) {
            ctx.save();
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2.5;
            ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
            ctx.beginPath();
            ctx.arc(scrPos.x, scrPos.y, 11, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }

          // Scratch style: Circles for smooth/curved nodes, Squares for pointed/corner nodes
          ctx.beginPath();
          if (n.smooth) {
            ctx.arc(scrPos.x, scrPos.y, isNodeSelected ? 6.5 : 5, 0, Math.PI * 2);
            ctx.fillStyle = isNodeSelected ? '#38bdf8' : '#2563eb';
          } else {
            const s = isNodeSelected ? 10 : 8;
            ctx.rect(scrPos.x - s / 2, scrPos.y - s / 2, s, s);
            ctx.fillStyle = isNodeSelected ? '#fbbf24' : '#ef4444';
          }
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.fill();
          ctx.stroke();
        }
      }

      // Scratch-style Ghost Insertion Node on Line Hover (when not dragging a node)
      if (!draggedNode && hoverDocPt) {
        let bestHit: { pt: Point; pathId: string } | null = null;
        let bestDist = Infinity;
        const allPathsToProbe = [
          ...activeLayer.paths.filter(p => selectedPathIds.includes(p.id)),
          ...activeLayer.paths.filter(p => !selectedPathIds.includes(p.id)),
        ];

        for (const p of allPathsToProbe) {
          const hit = findNearestPointOnVPath(p, hoverDocPt, 22);
          if (hit && hit.distance < bestDist) {
            bestDist = hit.distance;
            bestHit = { pt: hit.pt, pathId: p.id };
          }
        }

        if (bestHit) {
          const scr = toScreen(bestHit.pt.x, bestHit.pt.y);
          ctx.save();
          // Subtle pulsating halo
          ctx.beginPath();
          ctx.arc(scr.x, scr.y, 11, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
          ctx.fill();

          // Ghost node circle
          ctx.beginPath();
          ctx.arc(scr.x, scr.y, 6, 0, Math.PI * 2);
          ctx.fillStyle = '#38bdf8';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.fill();
          ctx.stroke();

          // '+' icon inside ghost node
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 1.8;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(scr.x - 3, scr.y);
          ctx.lineTo(scr.x + 3, scr.y);
          ctx.moveTo(scr.x, scr.y - 3);
          ctx.lineTo(scr.x, scr.y + 3);
          ctx.stroke();

          // Floating hint badge
          ctx.font = '10px sans-serif';
          ctx.fillStyle = '#0f172a';
          const hint = 'クリックして点を追加＆変形';
          const hintW = ctx.measureText(hint).width + 12;
          const hintX = scr.x + 12;
          const hintY = scr.y - 10;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.beginPath();
          ctx.roundRect(hintX, hintY - 12, hintW, 18, 4);
          ctx.fill();
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = '#e0f2fe';
          ctx.fillText(hint, hintX + 6, hintY + 1);

          ctx.restore();
        }
      }

      // Endpoint magnetic snapping visual indicator
      if (draggedNode && draggedNode.type === 'pos') {
        const path = activeLayer.paths.find(p => p.id === draggedNode.pathId);
        if (path && !path.closed && path.nodes.length >= 3) {
          const isEndpoint = draggedNode.nodeIndex === 0 || draggedNode.nodeIndex === path.nodes.length - 1;
          if (isEndpoint) {
            const otherIdx = draggedNode.nodeIndex === 0 ? path.nodes.length - 1 : 0;
            const otherNode = path.nodes[otherIdx];
            const scrOther = toScreen(otherNode.pos.x, otherNode.pos.y);
            const scrDragged = toScreen(path.nodes[draggedNode.nodeIndex].pos.x, path.nodes[draggedNode.nodeIndex].pos.y);
            const d = dist(scrOther, scrDragged);

            if (d < 35) {
              ctx.save();
              ctx.strokeStyle = '#10b981';
              ctx.lineWidth = 2;
              ctx.setLineDash([4, 4]);
              ctx.beginPath();
              ctx.moveTo(scrDragged.x, scrDragged.y);
              ctx.lineTo(scrOther.x, scrOther.y);
              ctx.stroke();
              ctx.setLineDash([]);

              ctx.beginPath();
              ctx.arc(scrOther.x, scrOther.y, 14, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
              ctx.fill();
              ctx.strokeStyle = '#10b981';
              ctx.lineWidth = 2.5;
              ctx.stroke();

              // Snap text
              ctx.font = 'bold 11px sans-serif';
              ctx.fillStyle = '#10b981';
              ctx.fillText('端点スナップ (結合して閉じる)', scrOther.x + 18, scrOther.y + 4);
              ctx.restore();
            }
          }
        }
      }
    }

    // 3. Selection & Transform Tool Overlays
    if (tool === 'select' && selectedPathIds.length > 0) {
      const selectedPaths = activeLayer.paths.filter(p => selectedPathIds.includes(p.id));
      if (selectedPaths.length > 0) {
        const bbox = getCombinedBoundingBox(selectedPaths);
        const tl = toScreen(bbox.minX, bbox.minY);
        const br = toScreen(bbox.maxX, bbox.maxY);
        const w = br.x - tl.x;
        const h = br.y - tl.y;

        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(tl.x, tl.y, w, h);
        ctx.setLineDash([]);

        const handlePts = [
          { handle: 'nw', x: tl.x, y: tl.y },
          { handle: 'n', x: tl.x + w / 2, y: tl.y },
          { handle: 'ne', x: br.x, y: tl.y },
          { handle: 'e', x: br.x, y: tl.y + h / 2 },
          { handle: 'se', x: br.x, y: br.y },
          { handle: 's', x: tl.x + w / 2, y: br.y },
          { handle: 'sw', x: tl.x, y: br.y },
          { handle: 'w', x: tl.x, y: tl.y + h / 2 },
        ];

        for (const hPt of handlePts) {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#6366f1';
          ctx.lineWidth = 2;
          ctx.fillRect(hPt.x - 4.5, hPt.y - 4.5, 9, 9);
          ctx.strokeRect(hPt.x - 4.5, hPt.y - 4.5, 9, 9);
        }

        const rotX = tl.x + w / 2;
        const rotY = tl.y - 24;
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(rotX, tl.y);
        ctx.lineTo(rotX, rotY);
        ctx.stroke();

        ctx.fillStyle = '#6366f1';
        ctx.beginPath();
        ctx.arc(rotX, rotY, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
    }

    // 4. Color Mesh Tool: Draggable pins
    if (tool === 'mesh') {
      const meshPaths = activeLayer.paths.filter(p => p.mesh && p.mesh.enabled);
      for (const p of meshPaths) {
        const bbox = getPathBoundingBox(p);
        const mesh = p.mesh!;
        for (let idx = 0; idx < mesh.pts.length; idx++) {
          const [u, v] = mesh.pts[idx];
          const docX = bbox.minX + u * bbox.width;
          const docY = bbox.minY + v * bbox.height;
          const scr = toScreen(docX, docY);

          ctx.fillStyle = mesh.colors[idx] || '#ffffff';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(scr.x, scr.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    // 5. Eraser Cursor Circle Overlay
    if ((tool === 'eraser' || tool === 'trim') && hoverScreenPt) {
      const scrRadius = Math.max(8, (eraserRadius || 24) * zoom);
      ctx.save();
      ctx.lineWidth = 1.5;
      if (eraserMode === 'intersection' || tool === 'trim') {
        ctx.strokeStyle = '#38bdf8'; // Sky blue for intersection
        ctx.setLineDash([4, 3]);
      } else if (eraserMode === 'segment') {
        ctx.strokeStyle = '#fbbf24'; // Amber for segment cut
        ctx.setLineDash([2, 2]);
      } else {
        ctx.strokeStyle = '#f87171'; // Red for stroke erase
      }
      ctx.beginPath();
      ctx.arc(hoverScreenPt.x, hoverScreenPt.y, scrRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 5b. Width Brush Cursor Overlay
    if (tool === 'width' && hoverScreenPt) {
      const scrRadius = Math.max(10, 35 * zoom);
      ctx.save();
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(hoverScreenPt.x, hoverScreenPt.y, scrRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#a855f7';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const symbol = widthBrushMode === 'thicken' ? '+' : widthBrushMode === 'thin' ? '−' : widthBrushMode === 'taper' ? '▲' : '＝';
      ctx.fillText(symbol, hoverScreenPt.x, hoverScreenPt.y);
      ctx.restore();
    }

    // 6. Eyedropper Magnifier Loupe Overlay
    if ((tool === 'eyedropper' || eyedropperColor) && hoverScreenPt) {
      const color = eyedropperColor || '#ffffff';
      const lx = hoverScreenPt.x + 18;
      const ly = hoverScreenPt.y - 18;

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 8;
      // Color circle
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(lx, ly, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Hex label
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(lx + 16, ly - 10, 65, 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px monospace';
      ctx.fillText(color.toUpperCase(), lx + 22, ly + 4);
      ctx.restore();
    }

    // 7. Intersection Eraser Hover Highlight
    if (tool === 'trim' && hoverDocPt) {
      for (const p of activeLayer.paths) {
        const samples = flattenVPath(p, 16);
        const near = samples.some(s => dist(s.pt, hoverDocPt) < 20);
        if (near) {
          const scr = toScreen(hoverDocPt.x, hoverDocPt.y);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(scr.x, scr.y, 10, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
      }
    }

    // 8. Speech Balloon Tail Drag Pin Handle (when balloon is selected or tool is balloon/select)
    const balloonPaths = activeLayer.paths.filter(p => p.balloon && p.balloon.tailPos);
    for (const p of balloonPaths) {
      const isSelected = selectedPathIds.includes(p.id);
      if (isSelected || tool === 'balloon') {
        const bbox = getPathBoundingBox(p);
        const scrCenter = toScreen(bbox.centerX, bbox.centerY);
        const scrTail = toScreen(p.balloon!.tailPos!.x, p.balloon!.tailPos!.y);

        ctx.save();
        // Dashed connection line from balloon center to tail tip
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(scrCenter.x, scrCenter.y);
        ctx.lineTo(scrTail.x, scrTail.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Interactive Pin Handle
        ctx.fillStyle = '#f59e0b';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(scrTail.x, scrTail.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Little center dot
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(scrTail.x, scrTail.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // 9. Shape Drawing Live Screen Preview (Rect, Ellipse, Line, Star, Polygon)
    if (tool === 'shape' && dragCreation) {
      const shapeResult = createShapeNodes(shapeType, dragCreation.start, dragCreation.current, false);
      const shapeNodes = shapeResult.nodes;
      if (shapeNodes.length > 0) {
        ctx.save();
        ctx.strokeStyle = strokeColor !== 'none' ? strokeColor : '#6366f1';
        ctx.lineWidth = strokeColor !== 'none' ? Math.max(1.5, brushSize * zoom) : 1.5;
        if (strokeColor === 'none') {
          ctx.setLineDash([4, 4]);
        }
        ctx.fillStyle = shapeType !== 'line' && fillColor !== 'none' ? fillColor : 'transparent';
        if (fillColor !== 'none' && shapeType !== 'line') {
          ctx.globalAlpha = 0.8;
        }

        ctx.beginPath();
        const first = toScreen(shapeNodes[0].pos.x, shapeNodes[0].pos.y);
        ctx.moveTo(first.x, first.y);
        const numSegs = shapeResult.closed ? shapeNodes.length : shapeNodes.length - 1;
        for (let i = 0; i < numSegs; i++) {
          const n1 = shapeNodes[i];
          const n2 = shapeNodes[(i + 1) % shapeNodes.length];
          const end = toScreen(n2.pos.x, n2.pos.y);
          if (n1.cpOut || n2.cpIn) {
            const cp1 = toScreen((n1.cpOut ?? n1.pos).x, (n1.cpOut ?? n1.pos).y);
            const cp2 = toScreen((n2.cpIn ?? n2.pos).x, (n2.cpIn ?? n2.pos).y);
            ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
          } else {
            ctx.lineTo(end.x, end.y);
          }
        }
        if (shapeResult.closed) {
          ctx.closePath();
          if (fillColor !== 'none') ctx.fill();
        }
        ctx.stroke();
        ctx.restore();
      }
    }
  };

  const hitTestTransformHandle = (screenPt: Point): TransformHandle | null => {
    if (tool !== 'select' || selectedPathIds.length === 0) return null;
    const activeLayer = doc.layers.find(l => l.id === doc.activeLayerId);
    if (!activeLayer) return null;

    const selectedPaths = activeLayer.paths.filter(p => selectedPathIds.includes(p.id));
    if (selectedPaths.length === 0) return null;

    const bbox = getCombinedBoundingBox(selectedPaths);
    const tl = toScreen(bbox.minX, bbox.minY);
    const br = toScreen(bbox.maxX, bbox.maxY);
    const w = br.x - tl.x;
    const h = br.y - tl.y;

    const rotX = tl.x + w / 2;
    const rotY = tl.y - 24;
    if (dist(screenPt, { x: rotX, y: rotY }) < 10) return 'rotate';

    const handles: { h: TransformHandle; pt: Point }[] = [
      { h: 'nw', pt: { x: tl.x, y: tl.y } },
      { h: 'n', pt: { x: tl.x + w / 2, y: tl.y } },
      { h: 'ne', pt: { x: br.x, y: tl.y } },
      { h: 'e', pt: { x: br.x, y: tl.y + h / 2 } },
      { h: 'se', pt: { x: br.x, y: br.y } },
      { h: 's', pt: { x: tl.x + w / 2, y: br.y } },
      { h: 'sw', pt: { x: tl.x, y: br.y } },
      { h: 'w', pt: { x: tl.x, y: tl.y + h / 2 } },
    ];

    for (const hPt of handles) {
      if (dist(screenPt, hPt.pt) < 9) return hPt.h;
    }

    if (screenPt.x >= tl.x && screenPt.x <= br.x && screenPt.y >= tl.y && screenPt.y <= br.y) {
      return 'body';
    }

    return null;
  };

  // Helper to pick color from canvas at screen coordinate
  const pickColorAtScreen = (screenX: number, screenY: number): string => {
    const canvas = canvasRef.current;
    if (!canvas) return '#000000';
    const ctx = canvas.getContext('2d');
    if (!ctx) return '#000000';

    const dpr = window.devicePixelRatio || 1;
    const px = Math.floor(screenX * dpr);
    const py = Math.floor(screenY * dpr);

    try {
      const data = ctx.getImageData(px, py, 1, 1).data;
      const toHex = (n: number) => n.toString(16).padStart(2, '0');
      return `#${toHex(data[0])}${toHex(data[1])}${toHex(data[2])}`;
    } catch {
      return '#000000';
    }
  };

  // Helper to erase paths at doc point using Vector Eraser
  const erasePathsAtPoint = (pt: Point, layer: Layer) => {
    const radius = (eraserRadius || 24) / zoom;
    let currentPaths = [...layer.paths];
    let changed = false;

    for (let i = currentPaths.length - 1; i >= 0; i--) {
      const p = currentPaths[i];
      const result = eraseVectorPathAtPoint(p, currentPaths, pt, eraserMode || 'intersection', radius);
      if (result.affected) {
        changed = true;
        currentPaths.splice(i, 1, ...result.modifiedPaths);
      }
    }

    if (changed) {
      onUpdateDoc({
        ...doc,
        layers: doc.layers.map(l => l.id === layer.id ? { ...l, paths: currentPaths } : l),
      });
      const modeLabel = eraserMode === 'intersection' ? '交点まで消去' : eraserMode === 'segment' ? '触れた部分消去' : '線全体消去';
      onStatusChange(`ベクター消しゴム (${modeLabel}): 適用中`);
    }
  };

  // ================= POINTER & GESTURE HANDLERS =================
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    touchPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    touchCountHistoryRef.current = Math.max(touchCountHistoryRef.current, touchPointersRef.current.size);

    if (touchPointersRef.current.size === 2) {
      const pts = Array.from(touchPointersRef.current.values());
      initialTouchDistRef.current = dist(pts[0], pts[1]);
      initialTouchAngleRef.current = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
      return;
    }

    if (tool === 'hand' || e.button === 1 || (e.altKey && tool !== 'eyedropper' && tool !== 'pen')) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const screenPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const docPt = toDoc(screenPt.x, screenPt.y);

    const activeLayer = doc.layers.find(l => l.id === doc.activeLayerId);
    if (!activeLayer || activeLayer.locked) {
      onStatusChange('現在のレイヤーはロックされています');
      return;
    }

    // --- Check Speech Balloon Tail Handle Hit ---
    for (const p of activeLayer.paths) {
      if (p.balloon && p.balloon.tailPos) {
        if (selectedPathIds.includes(p.id) || tool === 'balloon') {
          const scrTail = toScreen(p.balloon.tailPos.x, p.balloon.tailPos.y);
          if (dist(scrTail, screenPt) < 14) {
            setDraggedBalloonTail({ pathId: p.id });
            onSelectPaths([p.id]);
            onStatusChange('フキダシのしっぽをドラッグ中…');
            return;
          }
        }
      }
    }

    // --- TOOL: EYEDROPPER (or Alt+click) ---
    if (tool === 'eyedropper' || (e.altKey && (tool === 'pen' || tool === 'bucket'))) {
      const picked = pickColorAtScreen(screenPt.x, screenPt.y);
      if (onStrokeColorChange) {
        onStrokeColorChange(picked);
      }
      if (onAddColorHistory) {
        onAddColorHistory(picked);
      }
      onStatusChange(`スポイト: ${picked.toUpperCase()} を取得しました`);
      return;
    }

    // --- TOOL: ERASER (Stroke & Object Eraser) ---
    if (tool === 'eraser') {
      isErasingRef.current = true;
      erasePathsAtPoint(docPt, activeLayer);
      return;
    }

    // --- TOOL: PEN (Stylus Pressure Dynamics) ---
    if (tool === 'pen') {
      if (quickShapeTimerRef.current) {
        window.clearTimeout(quickShapeTimerRef.current);
        quickShapeTimerRef.current = null;
      }
      setQuickShapePreview(null);
      isDrawingRef.current = true;
      if (onAddColorHistory && strokeColor && strokeColor !== 'none') {
        onAddColorHistory(strokeColor);
      }
      const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
      strokePointsRef.current = [{ pt: docPt, pressure, time: Date.now() }];
      return;
    }

    // --- TOOL: SELECT (Move, Transform Handles, Rubberband) ---
    if (tool === 'select') {
      const handle = hitTestTransformHandle(screenPt);
      if (handle) {
        const selectedPaths = activeLayer.paths.filter(p => selectedPathIds.includes(p.id));
        setActiveHandle(handle);
        transformStateRef.current = {
          handle,
          startDocPt: docPt,
          startScreenPt: screenPt,
          origBBox: getCombinedBoundingBox(selectedPaths),
          origPaths: JSON.parse(JSON.stringify(selectedPaths)),
        };
        onStatusChange(handle === 'body' ? '移動中…' : handle === 'rotate' ? '回転中…' : '変形中…');
        return;
      }

      let hitPathId: string | null = null;
      for (let k = activeLayer.paths.length - 1; k >= 0; k--) {
        const p = activeLayer.paths[k];
        if (isPointInVPath(docPt, p) || flattenVPath(p, 16).some(s => dist(s.pt, docPt) < 10)) {
          hitPathId = p.id;
          break;
        }
      }

      if (hitPathId) {
        if (e.shiftKey) {
          onSelectPaths(
            selectedPathIds.includes(hitPathId)
              ? selectedPathIds.filter(id => id !== hitPathId)
              : [...selectedPathIds, hitPathId]
          );
        } else {
          onSelectPaths([hitPathId]);
        }
        return;
      }

      if (!e.shiftKey) onSelectPaths([]);
      setRubberBand({ start: docPt, current: docPt });
      return;
    }

    // --- TOOL: RESHAPE (Scratch-style node selection & deformation) ---
    if (tool === 'reshape') {
      const allPathsOrdered = [
        ...activeLayer.paths.filter(p => selectedPathIds.includes(p.id)),
        ...activeLayer.paths.filter(p => !selectedPathIds.includes(p.id)),
      ];

      // 1. Check existing anchor points and handles
      for (const p of allPathsOrdered) {
        for (let idx = 0; idx < p.nodes.length; idx++) {
          const n = p.nodes[idx];
          const scrPos = toScreen(n.pos.x, n.pos.y);
          if (dist(scrPos, screenPt) < 13) {
            setSelectedNode({ pathId: p.id, nodeIndex: idx });
            setDraggedNode({
              pathId: p.id,
              nodeIndex: idx,
              type: 'pos',
              origPos: { ...n.pos },
              origCpIn: n.cpIn ? { ...n.cpIn } : undefined,
              origCpOut: n.cpOut ? { ...n.cpOut } : undefined,
              smooth: n.smooth,
            });
            onSelectPaths([p.id]);
            onStatusChange(`点 #${idx + 1} を選択中 (ドラッグで移動、ダブルクリックで角丸/尖り切替)`);
            return;
          }
          if (n.cpIn && dist(toScreen(n.cpIn.x, n.cpIn.y), screenPt) < 10) {
            setSelectedNode({ pathId: p.id, nodeIndex: idx });
            setDraggedNode({
              pathId: p.id,
              nodeIndex: idx,
              type: 'cpIn',
              origPos: { ...n.pos },
              origCpIn: { ...n.cpIn },
              origCpOut: n.cpOut ? { ...n.cpOut } : undefined,
              smooth: n.smooth,
            });
            onSelectPaths([p.id]);
            return;
          }
          if (n.cpOut && dist(toScreen(n.cpOut.x, n.cpOut.y), screenPt) < 10) {
            setSelectedNode({ pathId: p.id, nodeIndex: idx });
            setDraggedNode({
              pathId: p.id,
              nodeIndex: idx,
              type: 'cpOut',
              origPos: { ...n.pos },
              origCpIn: n.cpIn ? { ...n.cpIn } : undefined,
              origCpOut: { ...n.cpOut },
              smooth: n.smooth,
            });
            onSelectPaths([p.id]);
            return;
          }
        }
      }

      // 2. Click on outline to insert anchor point and immediately start dragging (Scratch style)
      for (const p of allPathsOrdered) {
        const result = insertNodeInSegment(p, docPt, 22);
        if (result) {
          const { updatedPath, insertedIndex } = result;
          const newNode = updatedPath.nodes[insertedIndex];

          const newPaths = activeLayer.paths.map(x => x.id === p.id ? updatedPath : x);
          onUpdateDoc({
            ...doc,
            layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: newPaths } : l),
          });
          onSelectPaths([p.id]);
          setSelectedNode({ pathId: p.id, nodeIndex: insertedIndex });
          setDraggedNode({
            pathId: p.id,
            nodeIndex: insertedIndex,
            type: 'pos',
            origPos: { ...newNode.pos },
            origCpIn: newNode.cpIn ? { ...newNode.cpIn } : undefined,
            origCpOut: newNode.cpOut ? { ...newNode.cpOut } : undefined,
            smooth: newNode.smooth,
          });
          onStatusChange('線上に新しい点を追加しました (そのままドラッグして曲線をベンド)');
          return;
        }
      }

      // 3. Clicked on shape body (closed shape or open shape with virtual fill) -> select that shape
      for (let k = activeLayer.paths.length - 1; k >= 0; k--) {
        const p = activeLayer.paths[k];
        if (isPointInVPath(docPt, p, true)) {
          onSelectPaths([p.id]);
          setSelectedNode(null);
          onStatusChange('図形を選択しました (線の上をクリックして点を追加)');
          return;
        }
      }

      // 4. Clicked outside
      setSelectedNode(null);
      if (!e.shiftKey) onSelectPaths([]);
      return;
    }

    // --- TOOL: TRIM / INTERSECTION ERASER ---
    if (tool === 'trim') {
      isErasingRef.current = true;
      erasePathsAtPoint(docPt, activeLayer);
      return;
    }

    // --- TOOL: WIDTH (Brush & Segment Width Modulation) ---
    if (tool === 'width') {
      const mode = widthBrushMode || 'thicken';
      let modified = false;
      const newPaths = activeLayer.paths.map(p => {
        const samples = flattenVPath(p, 16);
        if (samples.some(s => dist(s.pt, docPt) < Math.max(30, (p.strokeWidth || 3) * 1.5))) {
          modified = true;
          return modifyPathStrokeWidth(p, docPt, mode, 1.0, 35);
        }
        return p;
      });

      if (modified) {
        widthDragRef.current = {
          pathId: 'brush',
          startPt: docPt,
          origWidth: 0,
        };
        onUpdateDoc({
          ...doc,
          layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: newPaths } : l),
        });
        const modeLabel = mode === 'thicken' ? '太く' : mode === 'thin' ? '細く' : mode === 'taper' ? '抜き・入り付与' : '均一化';
        onStatusChange(`線幅修正ブラシ (${modeLabel}): ドラッグして適用`);
        return;
      }
      return;
    }

    // --- TOOL: SCISSORS ---
    if (tool === 'scissors') {
      for (const p of activeLayer.paths) {
        const split = splitVPathAtPoint(p, docPt, 18);
        if (split) {
          const [p1, p2] = split;
          const newPaths = activeLayer.paths.filter(x => x.id !== p.id).concat([p1, p2]);
          onUpdateDoc({
            ...doc,
            layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: newPaths } : l),
          });
          onStatusChange('パスを切断しました');
          return;
        }
      }
      onStatusChange('切断したいパスの上をクリックしてください');
      return;
    }

    // --- TOOL: BUCKET (Scratch-style Vector Fill: Closed shapes or Open Strokes, with Gap-Closing) ---
    if (tool === 'bucket') {
      // 1. Check if clicked inside a closed or open shape's interior (virtual chord)
      for (let k = activeLayer.paths.length - 1; k >= 0; k--) {
        const p = activeLayer.paths[k];
        if (isPointInVPath(docPt, p, true)) {
          const newPaths = activeLayer.paths.map(x => x.id === p.id ? { ...x, fillColor } : x);
          onUpdateDoc({
            ...doc,
            layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: newPaths } : l),
          });
          onSelectPaths([p.id]);
          if (onAddColorHistory && fillColor !== 'none') onAddColorHistory(fillColor);
          onStatusChange(`内側の塗り色を適用: ${fillColor === 'none' ? '透明 (塗りなし)' : fillColor}`);
          return;
        }
      }

      // 2. Check if clicked on/near the stroke of an open or closed path
      for (let k = activeLayer.paths.length - 1; k >= 0; k--) {
        const p = activeLayer.paths[k];
        const samples = flattenVPath(p, 16);
        if (samples.some(s => dist(s.pt, docPt) < 22)) {
          const newPaths = activeLayer.paths.map(x => x.id === p.id ? { ...x, fillColor } : x);
          onUpdateDoc({
            ...doc,
            layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: newPaths } : l),
          });
          onSelectPaths([p.id]);
          if (onAddColorHistory && fillColor !== 'none') onAddColorHistory(fillColor);
          onStatusChange(`線の塗り色を適用: ${fillColor === 'none' ? '透明 (塗りなし)' : fillColor}`);
          return;
        }
      }

      // 3. Gap-Closing Smart Vector Bucket Fill (隙間閉じスマートベクターバケツ)
      // Reference layer support: if any layer is marked isReference, use its boundary lines
      const refLayer = doc.layers.find(l => l.isReference && l.visible);
      const boundaryPaths = refLayer ? refLayer.paths : activeLayer.paths;

      const region = findEnclosedRegionWithGaps(docPt, boundaryPaths, 35);
      if (region && region.length >= 3) {
        const fillNodes: VNode[] = region.map(pt => ({
          pos: { x: pt.x, y: pt.y },
          smooth: true,
        }));
        const targetColor = fillColor && fillColor !== 'none' && fillColor !== 'transparent' ? fillColor : '#3b82f6';
        const newFillPath: VPath = {
          id: 'fill_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          nodes: fillNodes,
          closed: true,
          strokeColor: 'none',
          strokeWidth: 0,
          fillColor: targetColor,
          opacity: 1,
          brushType: 'pen',
          createdAt: Date.now(),
        };

        // Prepend to active layer paths so painted fill sits underneath lineart
        onUpdateDoc({
          ...doc,
          layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: [newFillPath, ...l.paths] } : l),
        });
        if (onAddColorHistory && targetColor !== 'none') onAddColorHistory(targetColor);
        onStatusChange(refLayer 
          ? `線画参照スマートバケツ: 参照レイヤー「${refLayer.name}」を参照して塗りました (隙間閉じ 35px)`
          : `隙間閉じスマートバケツ: 線の隙間を閉じて領域を自動塗りつぶしました (隙間許容 35px)`
        );
        return;
      }

      onStatusChange('図形の内側または線の上をクリックして塗りつぶしてください');
      return;
    }

    // --- TOOL: MESH ---
    if (tool === 'mesh') {
      for (const p of activeLayer.paths) {
        if (!p.mesh || !p.mesh.enabled) {
          if (isPointInVPath(docPt, p)) {
            const mesh = createDefaultMesh(3, 3, fillColor !== 'none' ? fillColor : '#5b8cff');
            const newPaths = activeLayer.paths.map(x => x.id === p.id ? { ...x, mesh } : x);
            onUpdateDoc({
              ...doc,
              layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: newPaths } : l),
            });
            onSelectPaths([p.id]);
            onStatusChange('カラーメッシュを生成しました');
            return;
          }
        } else {
          const bbox = getPathBoundingBox(p);
          for (let idx = 0; idx < p.mesh.pts.length; idx++) {
            const [u, v] = p.mesh.pts[idx];
            const pt = { x: bbox.minX + u * bbox.width, y: bbox.minY + v * bbox.height };
            if (dist(toScreen(pt.x, pt.y), screenPt) < 12) {
              setDraggedMeshPin({ pathId: p.id, pinIndex: idx, startPt: docPt, hasDragged: false });
              onSelectPaths([p.id]);
              return;
            }
          }
        }
      }
      return;
    }

    // --- TOOL: PANEL, BALLOON & SHAPE ---
    if (tool === 'panel' || tool === 'balloon' || tool === 'shape') {
      setDragCreation({ start: docPt, current: docPt });
      return;
    }

    // --- TOOL: FOCUS LINE ---
    if (tool === 'focus_line') {
      createFocusLines(docPt);
      return;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // 1. Two-finger pinch zoom & rotation
    if (touchPointersRef.current.size === 2 && touchPointersRef.current.has(e.pointerId)) {
      touchPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pts = Array.from(touchPointersRef.current.values());
      const currentDist = dist(pts[0], pts[1]);
      if (initialTouchDistRef.current > 0) {
        const ratio = currentDist / initialTouchDistRef.current;
        onZoomChange(Math.max(0.08, Math.min(10.0, zoom * ratio)));
        initialTouchDistRef.current = currentDist;
      }
      const currentAngle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
      const angleDiff = ((currentAngle - initialTouchAngleRef.current) * 180) / Math.PI;
      onRotationChange((rotation + angleDiff) % 360);
      initialTouchAngleRef.current = currentAngle;
      return;
    }

    // 2. Pan
    if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
      return;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const screenPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const docPt = toDoc(screenPt.x, screenPt.y);
    setHoverDocPt(docPt);
    setHoverScreenPt(screenPt);

    const activeLayer = doc.layers.find(l => l.id === doc.activeLayerId);
    if (!activeLayer) return;

    // Speech Balloon Tail Dragging
    if (draggedBalloonTail) {
      const newPaths = activeLayer.paths.map(p => {
        if (p.id === draggedBalloonTail.pathId && p.balloon) {
          return {
            ...p,
            balloon: {
              ...p.balloon,
              tailPos: { x: docPt.x, y: docPt.y },
            }
          };
        }
        return p;
      });
      onUpdateDoc({
        ...doc,
        layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: newPaths } : l),
      });
      return;
    }

    // Eyedropper hover loupe
    if (tool === 'eyedropper' || e.altKey) {
      const color = pickColorAtScreen(screenPt.x, screenPt.y);
      setEyedropperColor(color);
    } else {
      setEyedropperColor(null);
    }

    // Eraser dragging
    if (isErasingRef.current && tool === 'eraser') {
      erasePathsAtPoint(docPt, activeLayer);
      return;
    }

    // Selection Transform Drag
    if (transformStateRef.current) {
      const { handle, startDocPt, origBBox, origPaths } = transformStateRef.current;
      const dx = docPt.x - startDocPt.x;
      const dy = docPt.y - startDocPt.y;

      let newPaths: VPath[] = [];

      if (handle === 'body') {
        newPaths = origPaths.map(p => transformPath(p, 1, 1, 0, { x: 0, y: 0 }, dx, dy));
      } else if (handle === 'rotate') {
        const center = { x: origBBox.centerX, y: origBBox.centerY };
        const a1 = Math.atan2(startDocPt.y - center.y, startDocPt.x - center.x);
        const a2 = Math.atan2(docPt.y - center.y, docPt.x - center.x);
        const rotRad = a2 - a1;
        newPaths = origPaths.map(p => transformPath(p, 1, 1, rotRad, center, 0, 0));
      } else {
        let sx = 1.0, sy = 1.0;
        let pivot = { x: origBBox.centerX, y: origBBox.centerY };

        if (handle === 'se') {
          pivot = { x: origBBox.minX, y: origBBox.minY };
          sx = Math.max(0.05, (origBBox.width + dx) / Math.max(1, origBBox.width));
          sy = Math.max(0.05, (origBBox.height + dy) / Math.max(1, origBBox.height));
        } else if (handle === 'nw') {
          pivot = { x: origBBox.maxX, y: origBBox.maxY };
          sx = Math.max(0.05, (origBBox.width - dx) / Math.max(1, origBBox.width));
          sy = Math.max(0.05, (origBBox.height - dy) / Math.max(1, origBBox.height));
        } else if (handle === 'e') {
          pivot = { x: origBBox.minX, y: origBBox.centerY };
          sx = Math.max(0.05, (origBBox.width + dx) / Math.max(1, origBBox.width));
        } else if (handle === 's') {
          pivot = { x: origBBox.centerX, y: origBBox.minY };
          sy = Math.max(0.05, (origBBox.height + dy) / Math.max(1, origBBox.height));
        } else if (handle === 'w') {
          pivot = { x: origBBox.maxX, y: origBBox.centerY };
          sx = Math.max(0.05, (origBBox.width - dx) / Math.max(1, origBBox.width));
        } else if (handle === 'n') {
          pivot = { x: origBBox.centerX, y: origBBox.maxY };
          sy = Math.max(0.05, (origBBox.height - dy) / Math.max(1, origBBox.height));
        } else if (handle === 'ne') {
          pivot = { x: origBBox.minX, y: origBBox.maxY };
          sx = Math.max(0.05, (origBBox.width + dx) / Math.max(1, origBBox.width));
          sy = Math.max(0.05, (origBBox.height - dy) / Math.max(1, origBBox.height));
        } else if (handle === 'sw') {
          pivot = { x: origBBox.maxX, y: origBBox.minY };
          sx = Math.max(0.05, (origBBox.width - dx) / Math.max(1, origBBox.width));
          sy = Math.max(0.05, (origBBox.height + dy) / Math.max(1, origBBox.height));
        }

        if (e.shiftKey) {
          const uniformS = (sx + sy) / 2;
          sx = uniformS;
          sy = uniformS;
        }

        newPaths = origPaths.map(p => transformPath(p, sx, sy, 0, pivot, 0, 0));
      }

      onUpdateDoc({
        ...doc,
        layers: doc.layers.map(l => l.id === activeLayer.id ? {
          ...l,
          paths: l.paths.map(p => {
            const found = newPaths.find(np => np.id === p.id);
            return found || p;
          })
        } : l),
      });
      return;
    }

    // Rubber-band
    if (rubberBand) {
      setRubberBand({ start: rubberBand.start, current: docPt });
      return;
    }

    // Drag Creation
    if (dragCreation) {
      setDragCreation({ start: dragCreation.start, current: docPt });
      return;
    }

    // Continuous Vector Drag Eraser (Intersection, Segment, Stroke)
    if (isErasingRef.current && (tool === 'eraser' || tool === 'trim')) {
      erasePathsAtPoint(docPt, activeLayer);
      return;
    }

    // Stroke Width Brush Drag
    if (widthDragRef.current && tool === 'width') {
      const mode = widthBrushMode || 'thicken';
      let modified = false;
      const newPaths = activeLayer.paths.map(p => {
        const samples = flattenVPath(p, 16);
        if (samples.some(s => dist(s.pt, docPt) < Math.max(30, (p.strokeWidth || 3) * 1.5))) {
          modified = true;
          return modifyPathStrokeWidth(p, docPt, mode, 0.4, 35);
        }
        return p;
      });

      if (modified) {
        onUpdateDoc({
          ...doc,
          layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: newPaths } : l),
        });
      }
      return;
    }

    // Freehand Inking with Stabilizer + QuickShape Hold Detection
    if (isDrawingRef.current && tool === 'pen') {
      const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
      const pts = strokePointsRef.current;
      const last = pts[pts.length - 1];

      const alpha = Math.max(0.1, 1 - stabilizer * 0.08);
      const smoothedPt = {
        x: last.pt.x + (docPt.x - last.pt.x) * alpha,
        y: last.pt.y + (docPt.y - last.pt.y) * alpha,
      };

      pts.push({ pt: smoothedPt, pressure, time: Date.now() });

      // QuickShape detection timer (420ms stationary hold)
      if (quickShapeTimerRef.current) {
        window.clearTimeout(quickShapeTimerRef.current);
      }
      quickShapeTimerRef.current = window.setTimeout(() => {
        if (isDrawingRef.current && strokePointsRef.current.length > 6) {
          const rawPts = strokePointsRef.current.map(p => p.pt);
          const detected = recognizeQuickShape(rawPts);
          if (detected) {
            setQuickShapePreview(detected);
            onStatusChange(`✦ QuickShape: ${detected.label} を認識！(ペンを離して確定)`);
          }
        }
      }, 420);

      return;
    }

    // Reshape Node Dragging
    if (draggedNode && tool === 'reshape') {
      const path = activeLayer.paths.find(p => p.id === draggedNode.pathId);
      if (!path) return;

      const updatedNodes = path.nodes.map((n, idx) => {
        if (idx !== draggedNode.nodeIndex) return n;

        if (draggedNode.type === 'pos') {
          let targetX = docPt.x;
          let targetY = docPt.y;

          // Magnetic snap if dragging endpoint close to opposite endpoint of open path
          if (!path.closed && path.nodes.length >= 3) {
            const isEndpoint = draggedNode.nodeIndex === 0 || draggedNode.nodeIndex === path.nodes.length - 1;
            if (isEndpoint) {
              const otherIdx = draggedNode.nodeIndex === 0 ? path.nodes.length - 1 : 0;
              const otherPos = path.nodes[otherIdx].pos;
              if (dist(docPt, otherPos) < 22) {
                targetX = otherPos.x;
                targetY = otherPos.y;
              }
            }
          }

          const dx = targetX - n.pos.x;
          const dy = targetY - n.pos.y;
          return {
            ...n,
            pos: { x: targetX, y: targetY },
            cpIn: n.cpIn ? { x: n.cpIn.x + dx, y: n.cpIn.y + dy } : undefined,
            cpOut: n.cpOut ? { x: n.cpOut.x + dx, y: n.cpOut.y + dy } : undefined,
          };
        } else if (draggedNode.type === 'cpIn') {
          const newCpIn = { x: docPt.x, y: docPt.y };
          let newCpOut = n.cpOut;

          if (n.smooth && n.cpOut) {
            const angle = Math.atan2(newCpIn.y - n.pos.y, newCpIn.x - n.pos.x);
            const lenOut = dist(n.pos, n.cpOut);
            newCpOut = {
              x: n.pos.x - Math.cos(angle) * lenOut,
              y: n.pos.y - Math.sin(angle) * lenOut,
            };
          }
          return { ...n, cpIn: newCpIn, cpOut: newCpOut };
        } else {
          const newCpOut = { x: docPt.x, y: docPt.y };
          let newCpIn = n.cpIn;

          if (n.smooth && n.cpIn) {
            const angle = Math.atan2(newCpOut.y - n.pos.y, newCpOut.x - n.pos.x);
            const lenIn = dist(n.pos, n.cpIn);
            newCpIn = {
              x: n.pos.x - Math.cos(angle) * lenIn,
              y: n.pos.y - Math.sin(angle) * lenIn,
            };
          }
          return { ...n, cpIn: newCpIn, cpOut: newCpOut };
        }
      });

      const newPaths = activeLayer.paths.map(p => p.id === path.id ? { ...p, nodes: updatedNodes } : p);
      onUpdateDoc({
        ...doc,
        layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: newPaths } : l),
      });
      return;
    }

    // Mesh Pin Dragging
    if (draggedMeshPin && tool === 'mesh') {
      const path = activeLayer.paths.find(p => p.id === draggedMeshPin.pathId);
      if (!path || !path.mesh) return;

      if (dist(docPt, draggedMeshPin.startPt) > 5) {
        setDraggedMeshPin({ ...draggedMeshPin, hasDragged: true });
      }

      const bbox = getPathBoundingBox(path);
      const u = (docPt.x - bbox.minX) / Math.max(1, bbox.width);
      const v = (docPt.y - bbox.minY) / Math.max(1, bbox.height);

      const newPts = [...path.mesh.pts];
      newPts[draggedMeshPin.pinIndex] = [u, v];

      const newPaths = activeLayer.paths.map(p => 
        p.id === path.id ? { ...p, mesh: { ...path.mesh!, pts: newPts } } : p
      );
      onUpdateDoc({
        ...doc,
        layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: newPaths } : l),
      });
      return;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    touchPointersRef.current.delete(e.pointerId);

    if (touchPointersRef.current.size === 0) {
      if (touchCountHistoryRef.current === 2) {
        onUndo();
        onStatusChange('2本指タップ: 元に戻す');
      } else if (touchCountHistoryRef.current === 3) {
        onRedo();
        onStatusChange('3本指タップ: やり直す');
      }
      touchCountHistoryRef.current = 0;
    }

    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (isErasingRef.current) {
      isErasingRef.current = false;
      return;
    }

    if (widthDragRef.current) {
      widthDragRef.current = null;
      return;
    }

    if (draggedBalloonTail) {
      setDraggedBalloonTail(null);
      onStatusChange('フキダシのしっぽを配置しました');
      return;
    }

    const activeLayer = doc.layers.find(l => l.id === doc.activeLayerId);

    // Finish Selection Transform
    if (transformStateRef.current) {
      transformStateRef.current = null;
      setActiveHandle(null);
      return;
    }

    // Finish Rubber-band Selection
    if (rubberBand && activeLayer) {
      const minX = Math.min(rubberBand.start.x, rubberBand.current.x);
      const maxX = Math.max(rubberBand.start.x, rubberBand.current.x);
      const minY = Math.min(rubberBand.start.y, rubberBand.current.y);
      const maxY = Math.max(rubberBand.start.y, rubberBand.current.y);

      const hitIds: string[] = [];
      for (const p of activeLayer.paths) {
        const b = getPathBoundingBox(p);
        if (b.minX <= maxX && b.maxX >= minX && b.minY <= maxY && b.maxY >= minY) {
          hitIds.push(p.id);
        }
      }

      onSelectPaths(hitIds);
      setRubberBand(null);
      onStatusChange(`${hitIds.length}個のパスを選択しました`);
      return;
    }

    // Finish Direct Drag Creation (Panel or Balloon)
    if (dragCreation && activeLayer) {
      const { start, current } = dragCreation;
      const x = Math.min(start.x, current.x);
      const y = Math.min(start.y, current.y);
      const w = Math.max(20, Math.abs(current.x - start.x));
      const h = Math.max(20, Math.abs(current.y - start.y));

      setDragCreation(null);

      if (tool === 'balloon') {
        const cx = x + w / 2;
        const cy = y + h / 2;
        const rx = w / 2;
        const ry = h / 2;
        const k = 0.5522847498;
        const nodes: VNode[] = [
          { pos: { x: cx, y: cy - ry }, cpOut: { x: cx + rx * k, y: cy - ry }, cpIn: { x: cx - rx * k, y: cy - ry }, smooth: true },
          { pos: { x: cx + rx, y: cy }, cpIn: { x: cx + rx, y: cy - ry * k }, cpOut: { x: cx + rx, y: cy + ry * k }, smooth: true },
          { pos: { x: cx, y: cy + ry }, cpIn: { x: cx + rx * k, y: cy + ry }, cpOut: { x: cx - rx * k, y: cy + ry }, smooth: true },
          { pos: { x: cx - rx, y: cy }, cpIn: { x: cx - rx, y: cy + ry * k }, cpOut: { x: cx - rx, y: cy - ry * k }, smooth: true },
        ];
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
            tailPos: { x: cx - 20, y: cy + ry + 25 },
            text: 'セリフを入力…',
            fontSize: 20,
            textColor: '#000000',
            verticalText: true,
            shape: 'oval',
          },
          createdAt: Date.now(),
        };
        onUpdateDoc({
          ...doc,
          layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: [...l.paths, balloonPath] } : l),
        });
        onSelectPaths([balloonPath.id]);
        onStatusChange('フキダシを配置しました (ダブルクリックでセリフ編集)');
        return;
      } else if (tool === 'panel') {
        const panelNodes: VNode[] = [
          { pos: { x, y } },
          { pos: { x: x + w, y } },
          { pos: { x: x + w, y: y + h } },
          { pos: { x, y: y + h } },
        ];
        const panelPath: VPath = {
          id: crypto.randomUUID(),
          nodes: panelNodes,
          closed: true,
          strokeColor: '#000000',
          strokeWidth: 4,
          fillColor: 'none',
          opacity: 1.0,
          brushType: 'pen',
          createdAt: Date.now(),
        };
        onUpdateDoc({
          ...doc,
          layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: [...l.paths, panelPath] } : l),
        });
        onSelectPaths([panelPath.id]);
        onStatusChange('コマ枠を配置しました');
        return;
      } else if (tool === 'shape') {
        const shapeResult = createShapeNodes(shapeType, start, current, e.shiftKey);
        if (shapeResult.nodes.length >= 2) {
          const shapePath: VPath = {
            id: crypto.randomUUID(),
            nodes: shapeResult.nodes,
            closed: shapeResult.closed,
            strokeColor: strokeColor,
            strokeWidth: strokeColor === 'none' ? 0 : brushSize,
            fillColor: fillColor && fillColor !== 'transparent' ? fillColor : 'none',
            opacity: 1.0,
            brushType: 'pen',
            createdAt: Date.now(),
          };
          onUpdateDoc({
            ...doc,
            layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: [...l.paths, shapePath] } : l),
          });
          onSelectPaths([shapePath.id]);
          if (onAddColorHistory) {
            if (strokeColor && strokeColor !== 'none') onAddColorHistory(strokeColor);
            if (fillColor && fillColor !== 'none') onAddColorHistory(fillColor);
          }
          const label = shapeType === 'rect' ? '矩形' : shapeType === 'ellipse' ? '楕円' : shapeType === 'line' ? '直線' : shapeType === 'star' ? '星型' : '三角形';
          onStatusChange(`${label}シェイプを配置しました`);
          return;
        }
      }
    }

    // Finish Stroke Width Drag
    if (widthDragRef.current) {
      widthDragRef.current = null;
      return;
    }

    // Clear quick shape timer
    if (quickShapeTimerRef.current) {
      window.clearTimeout(quickShapeTimerRef.current);
      quickShapeTimerRef.current = null;
    }

    // Finish Freehand Pen Stroke
    if (isDrawingRef.current && tool === 'pen') {
      isDrawingRef.current = false;
      const rawPoints = strokePointsRef.current;
      strokePointsRef.current = [];

      if (!activeLayer) return;

      // If QuickShape was snapped and recognized
      if (quickShapePreview) {
        const shape = quickShapePreview;
        setQuickShapePreview(null);

        const newPath: VPath = {
          id: crypto.randomUUID(),
          nodes: shape.nodes,
          closed: shape.closed,
          strokeColor,
          strokeWidth: brushSize,
          fillColor: fillColor && fillColor !== 'transparent' ? fillColor : 'none',
          opacity: 1,
          brushType,
          pressures: shape.nodes.map(() => 1.0),
          createdAt: Date.now(),
        };

        onUpdateDoc({
          ...doc,
          layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: [...l.paths, newPath] } : l),
        });
        onStatusChange(`✦ QuickShape: ${shape.label} を確定しました`);
        return;
      }

      if (rawPoints.length < 2 || !activeLayer) return;

      const simplified = simplifyPolyline(rawPoints.map(r => r.pt), 1.5);
      const nodes = catmullRomToBezier(simplified, false);
      const effectiveWidth = calculateStrokeWidth(brushSize, brushType, rawPoints[0].pressure);

      const newPath: VPath = {
        id: crypto.randomUUID(),
        nodes,
        closed: false,
        strokeColor,
        strokeWidth: effectiveWidth,
        fillColor: fillColor && fillColor !== 'transparent' ? fillColor : 'none',
        opacity: BRUSH_PRESETS[brushType].opacity,
        brushType,
        pressures: simplified.map(() => 1.0),
        createdAt: Date.now(),
      };

      const pathsToAdd = [newPath];

      if (doc.symmetry !== 'none') {
        const symPointsList: Point[][] = [];
        const numS = getSymmetricPoints(simplified[0], doc.symmetry, doc.symmetryCenter).length;
        for (let s = 1; s < numS; s++) symPointsList.push([]);

        for (const pt of simplified) {
          const syms = getSymmetricPoints(pt, doc.symmetry, doc.symmetryCenter);
          for (let s = 1; s < syms.length; s++) {
            symPointsList[s - 1].push(syms[s]);
          }
        }

        for (const symPts of symPointsList) {
          if (symPts.length > 1) {
            pathsToAdd.push({
              ...newPath,
              id: crypto.randomUUID(),
              nodes: catmullRomToBezier(symPts, false),
            });
          }
        }
      }

      onUpdateDoc({
        ...doc,
        layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: [...l.paths, ...pathsToAdd] } : l),
      });
      return;
    }

    // Finish Mesh Pin Drag / Click
    if (draggedMeshPin && activeLayer) {
      if (!draggedMeshPin.hasDragged) {
        const path = activeLayer.paths.find(p => p.id === draggedMeshPin.pathId);
        if (path && path.mesh) {
          const newColors = [...path.mesh.colors];
          newColors[draggedMeshPin.pinIndex] = strokeColor !== 'none' ? strokeColor : '#ec4899';
          onUpdateDoc({
            ...doc,
            layers: doc.layers.map(l => l.id === activeLayer.id ? {
              ...l,
              paths: l.paths.map(p => p.id === path.id ? { ...p, mesh: { ...p.mesh!, colors: newColors } } : p)
            } : l),
          });
          onStatusChange('ピンの色を更新しました');
        }
      }
      setDraggedMeshPin(null);
      return;
    }

    // Finish Reshape Node Dragging (check endpoint snapping to close loop)
    if (draggedNode && tool === 'reshape' && activeLayer) {
      const path = activeLayer.paths.find(p => p.id === draggedNode.pathId);
      if (path && !path.closed && path.nodes.length >= 3) {
        if (draggedNode.nodeIndex === 0 || draggedNode.nodeIndex === path.nodes.length - 1) {
          const otherIdx = draggedNode.nodeIndex === 0 ? path.nodes.length - 1 : 0;
          if (dist(path.nodes[draggedNode.nodeIndex].pos, path.nodes[otherIdx].pos) < 25) {
            const closedPath = closePathIfEndpointsMeet(path, 30);
            const newPaths = activeLayer.paths.map(p => p.id === path.id ? closedPath : p);
            onUpdateDoc({
              ...doc,
              layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: newPaths } : l),
            });
            onStatusChange('端点を結合してパスを閉じました！');
            setDraggedNode(null);
            return;
          }
        }
      }
    }

    setDraggedNode(null);
  };

  // Double click on balloon or node
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const screenPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const docPt = toDoc(screenPt.x, screenPt.y);

    const activeLayer = doc.layers.find(l => l.id === doc.activeLayerId);
    if (!activeLayer) return;

    // 1. Double click on speech balloon to edit text!
    for (const p of activeLayer.paths) {
      if (p.balloon) {
        if (isPointInVPath(docPt, p) || dist(p.nodes[0].pos, docPt) < 60) {
          const bbox = getPathBoundingBox(p);
          const scr = toScreen(bbox.centerX, bbox.centerY);
          setEditingBalloon({
            pathId: p.id,
            text: p.balloon.text || '',
            fontSize: p.balloon.fontSize || 20,
            verticalText: p.balloon.verticalText ?? true,
            textColor: p.balloon.textColor || '#000000',
            screenPos: scr,
          });
          onStatusChange('フキダシのテキストを直接編集中…');
          return;
        }
      }
    }

    // 2. Double click on reshape node to toggle corner vs smooth
    if (tool === 'reshape') {
      for (const p of activeLayer.paths) {
        for (let idx = 0; idx < p.nodes.length; idx++) {
          const n = p.nodes[idx];
          if (dist(toScreen(n.pos.x, n.pos.y), screenPt) < 12) {
            const updated = toggleNodeSmoothness(p, idx);
            const newPaths = activeLayer.paths.map(x => x.id === p.id ? updated : x);
            onUpdateDoc({
              ...doc,
              layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: newPaths } : l),
            });
            setSelectedNode({ pathId: p.id, nodeIndex: idx });
            onStatusChange(`ノードの属性を切り替えました: ${!n.smooth ? '角丸 (曲線)' : '尖り (直線)'}`);
            return;
          }
        }
      }
    }
  };

  const createFocusLines = (centerPt: Point) => {
    const activeLayer = doc.layers.find(l => l.id === doc.activeLayerId);
    if (!activeLayer) return;

    const innerRadius = Math.min(doc.width, doc.height) * 0.22;
    const outerRadius = Math.max(doc.width, doc.height) * 0.9;
    const focusPaths: VPath[] = [];
    const count = 48;

    for (let k = 0; k < count; k++) {
      const angle = (k / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.05;
      const innerR = innerRadius * (0.85 + Math.random() * 0.3);
      const pStart = {
        x: centerPt.x + Math.cos(angle) * innerR,
        y: centerPt.y + Math.sin(angle) * innerR,
      };
      const pEnd = {
        x: centerPt.x + Math.cos(angle) * outerRadius,
        y: centerPt.y + Math.sin(angle) * outerRadius,
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
    onStatusChange('クリック位置を中心に集中線を生成しました');
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const newZoom = Math.max(0.08, Math.min(12.0, zoom * zoomFactor));

    const newPan = {
      x: mouseX - (mouseX - pan.x) * (newZoom / zoom),
      y: mouseY - (mouseY - pan.y) * (newZoom / zoom),
    };

    setPan(newPan);
    onZoomChange(newZoom);
  };

  const getCursor = () => {
    if (isPanning || tool === 'hand') return 'grab';
    if (tool === 'eyedropper') return 'crosshair';
    if (tool === 'eraser') return 'none'; // Custom circle overlay is rendered
    if (tool === 'pen') return 'crosshair';
    if (tool === 'select') {
      if (activeHandle === 'rotate') return 'grab';
      if (activeHandle === 'nw' || activeHandle === 'se') return 'nwse-resize';
      if (activeHandle === 'ne' || activeHandle === 'sw') return 'nesw-resize';
      if (activeHandle === 'n' || activeHandle === 's') return 'ns-resize';
      if (activeHandle === 'e' || activeHandle === 'w') return 'ew-resize';
      if (activeHandle === 'body') return 'move';
      return 'default';
    }
    if (tool === 'reshape') return 'pointer';
    if (tool === 'trim') return 'crosshair';
    if (tool === 'scissors') return 'crosshair';
    if (tool === 'width') return 'ew-resize';
    if (tool === 'bucket') return 'cell';
    return 'crosshair';
  };

  // Commit speech balloon inline text
  const handleCommitBalloonText = () => {
    if (!editingBalloon) return;
    const activeLayer = doc.layers.find(l => l.id === doc.activeLayerId);
    if (!activeLayer) return;

    const newPaths = activeLayer.paths.map(p => {
      if (p.id === editingBalloon.pathId && p.balloon) {
        return {
          ...p,
          balloon: {
            ...p.balloon,
            text: editingBalloon.text,
            fontSize: editingBalloon.fontSize,
            verticalText: editingBalloon.verticalText,
            textColor: editingBalloon.textColor,
          }
        };
      }
      return p;
    });

    onUpdateDoc({
      ...doc,
      layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: newPaths } : l),
    });
    setEditingBalloon(null);
    onStatusChange('セリフを確定しました');
  };

  // Scratch-style Reshape node actions
  const handleToggleNodeMode = useCallback((mode: 'smooth' | 'sharp') => {
    if (!selectedNode) return;
    const activeLayer = doc.layers.find(l => l.id === doc.activeLayerId);
    if (!activeLayer) return;
    const path = activeLayer.paths.find(p => p.id === selectedNode.pathId);
    if (!path) return;

    const updated = toggleNodeSmoothness(path, selectedNode.nodeIndex, mode);
    const newPaths = activeLayer.paths.map(p => p.id === path.id ? updated : p);
    onUpdateDoc({
      ...doc,
      layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: newPaths } : l),
    });
    onStatusChange(`ノードを「${mode === 'smooth' ? '角丸 (曲線)' : '尖り (直線)'}」に変更しました`);
  }, [selectedNode, doc, onUpdateDoc, onStatusChange]);

  const handleDeleteSelectedNode = useCallback(() => {
    if (!selectedNode) return;
    const activeLayer = doc.layers.find(l => l.id === doc.activeLayerId);
    if (!activeLayer) return;
    const path = activeLayer.paths.find(p => p.id === selectedNode.pathId);
    if (!path) return;

    const updated = deleteNodeFromPath(path, selectedNode.nodeIndex);
    let newPaths: VPath[];
    if (!updated) {
      newPaths = activeLayer.paths.filter(p => p.id !== path.id);
      onSelectPaths([]);
      onStatusChange('ノード数が不足したためパスを削除しました');
    } else {
      newPaths = activeLayer.paths.map(p => p.id === path.id ? updated : p);
      onStatusChange('アンカーポイントを削除しました');
    }

    onUpdateDoc({
      ...doc,
      layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: newPaths } : l),
    });
    setSelectedNode(null);
  }, [selectedNode, doc, onUpdateDoc, onSelectPaths, onStatusChange]);

  // Simplify curve nodes on active path
  const handleSimplifySelectedPath = useCallback(() => {
    const activeLayer = doc.layers.find(l => l.id === doc.activeLayerId);
    if (!activeLayer) return;

    let targetPathId = selectedNode?.pathId;
    if (!targetPathId && selectedPathIds.length > 0) {
      targetPathId = selectedPathIds[0];
    }
    if (!targetPathId) return;

    const path = activeLayer.paths.find(p => p.id === targetPathId);
    if (!path || path.nodes.length < 3) {
      onStatusChange('単純化するには3点以上のアンカーポイントが必要です');
      return;
    }

    const beforeCount = path.nodes.length;
    const simplified = simplifyVPath(path, 2.2);
    const afterCount = simplified.nodes.length;

    const newPaths = activeLayer.paths.map(p => p.id === targetPathId ? simplified : p);
    onUpdateDoc({
      ...doc,
      layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: newPaths } : l),
    });
    setSelectedNode(null);
    onStatusChange(`曲線単純化: アンカーポイントを ${beforeCount}個 から ${afterCount}個 に整理しました`);
  }, [doc, selectedNode, selectedPathIds, onUpdateDoc, onStatusChange]);

  // Intercept Delete / Backspace key when node is selected in Reshape mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && tool === 'reshape' && selectedNode) {
        e.preventDefault();
        e.stopPropagation();
        handleDeleteSelectedNode();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [tool, selectedNode, handleDeleteSelectedNode]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full overflow-hidden canvas-checkerboard select-none"
      style={{ cursor: getCursor() }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        onPointerDown={(e) => {
          if (radialMenuPos) setRadialMenuPos(null);
          handlePointerDown(e);
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        onContextMenu={(e) => {
          e.preventDefault();
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            setRadialMenuPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }
        }}
      />

      {/* Speech Balloon Inline Text Editor Overlay */}
      {editingBalloon && (
        <div
          className="absolute z-50 flex flex-col gap-1.5 p-2 bg-zinc-900/95 border border-indigo-500 rounded-lg shadow-2xl backdrop-blur-xs min-w-56"
          style={{
            left: `${editingBalloon.screenPos.x}px`,
            top: `${editingBalloon.screenPos.y}px`,
            transform: 'translate(-50%, -50%)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Controls pill */}
          <div className="flex items-center justify-between gap-1 text-[11px] pb-1 border-b border-zinc-800">
            <button
              onClick={() => setEditingBalloon({ ...editingBalloon, verticalText: !editingBalloon.verticalText })}
              className={`px-2 py-0.5 rounded border text-[10px] font-medium ${
                editingBalloon.verticalText
                  ? 'bg-indigo-600 border-indigo-400 text-white'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-300'
              }`}
            >
              {editingBalloon.verticalText ? '縦書き' : '横書き'}
            </button>

            <div className="flex items-center gap-1">
              <span className="text-zinc-400">サイズ:</span>
              <input
                type="number"
                min="12"
                max="64"
                value={editingBalloon.fontSize}
                onChange={e => setEditingBalloon({ ...editingBalloon, fontSize: parseInt(e.target.value) || 18 })}
                className="w-12 bg-zinc-800 text-center rounded border border-zinc-700 text-zinc-100 text-xs py-0.5"
              />
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleCommitBalloonText}
                title="確定 (Ctrl+Enter)"
                className="p-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setEditingBalloon(null)}
                title="キャンセル (Esc)"
                className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Text Area */}
          <textarea
            autoFocus
            rows={3}
            value={editingBalloon.text}
            onChange={e => {
              const val = e.target.value;
              setEditingBalloon({ ...editingBalloon, text: val });
              // Live update path text
              const activeLayer = doc.layers.find(l => l.id === doc.activeLayerId);
              if (activeLayer) {
                const newPaths = activeLayer.paths.map(p => 
                  p.id === editingBalloon.pathId && p.balloon ? {
                    ...p,
                    balloon: { ...p.balloon, text: val }
                  } : p
                );
                onUpdateDoc({
                  ...doc,
                  layers: doc.layers.map(l => l.id === activeLayer.id ? { ...l, paths: newPaths } : l),
                });
              }
            }}
            onKeyDown={e => {
              if (e.key === 'Escape') setEditingBalloon(null);
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleCommitBalloonText();
            }}
            placeholder="セリフを入力…"
            className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-100 text-sm focus:outline-none focus:border-indigo-500 resize-y"
          />
        </div>
      )}

      {/* Scratch-style Reshape Sub-Toolbar (Curved, Pointed, Delete Node) */}
      {tool === 'reshape' && (
        <div 
          className="absolute top-4 left-1/2 -translate-x-1/2 bg-zinc-900/95 border border-zinc-700/80 backdrop-blur-md rounded-xl shadow-2xl px-3 py-1.5 flex items-center gap-2 z-30 animate-in fade-in slide-in-from-top-2 duration-150 text-xs select-none"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center gap-1.5 border-r border-zinc-700/60 pr-2.5 font-medium text-zinc-300">
            <Spline className="w-4 h-4 text-sky-400" />
            <span className="hidden sm:inline">変形ツール</span>
          </div>

          {/* Smooth / Curved button */}
          <button
            onClick={() => handleToggleNodeMode('smooth')}
            disabled={!selectedNode}
            title="選択した点を角丸 (曲線) に変更"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-all ${
              selectedNode
                ? 'bg-zinc-800 hover:bg-sky-600/30 text-sky-300 border border-sky-500/40 hover:border-sky-400 shadow-xs'
                : 'opacity-40 cursor-not-allowed bg-zinc-800/40 text-zinc-500 border border-transparent'
            }`}
          >
            <CircleDot className="w-3.5 h-3.5" />
            <span>角丸 (曲線)</span>
          </button>

          {/* Sharp / Pointed button */}
          <button
            onClick={() => handleToggleNodeMode('sharp')}
            disabled={!selectedNode}
            title="選択した点を尖った角 (直線・鋭角) に変更"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-all ${
              selectedNode
                ? 'bg-zinc-800 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 hover:border-amber-400 shadow-xs'
                : 'opacity-40 cursor-not-allowed bg-zinc-800/40 text-zinc-500 border border-transparent'
            }`}
          >
            <Square className="w-3.5 h-3.5" />
            <span>尖り (直線)</span>
          </button>

          {/* Delete Node button */}
          <button
            onClick={handleDeleteSelectedNode}
            disabled={!selectedNode}
            title="選択した点を削除 (Delete / Backspace)"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-all ${
              selectedNode
                ? 'bg-zinc-800 hover:bg-red-600/30 text-red-300 border border-red-500/40 hover:border-red-400 shadow-xs cursor-pointer'
                : 'opacity-40 cursor-not-allowed bg-zinc-800/40 text-zinc-500 border border-transparent'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>点を削除</span>
          </button>

          {/* Simplify Curve button (曲線単純化) */}
          <button
            onClick={handleSimplifySelectedPath}
            disabled={!selectedNode && selectedPathIds.length === 0}
            title="曲線の不要なアンカーポイントを整理して滑らかにする"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-all ${
              selectedNode || selectedPathIds.length > 0
                ? 'bg-zinc-800 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:border-emerald-400 shadow-xs cursor-pointer'
                : 'opacity-40 cursor-not-allowed bg-zinc-800/40 text-zinc-500 border border-transparent'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>曲線単純化</span>
          </button>

          <div className="pl-1 text-[11px] text-zinc-400 hidden md:block border-l border-zinc-700/60 pl-2.5">
            {selectedNode ? (
              <span className="text-sky-300 font-mono">点 #{selectedNode.nodeIndex + 1} 選択中</span>
            ) : (
              <span className="text-zinc-500">輪郭をクリックして点を追加 / 点をドラッグ</span>
            )}
          </div>
        </div>
      )}

      {/* Canvas Top Quick Bar: Width Brush Active HUD (線幅修正クイック切替バー) */}
      {tool === 'width' && (
        <div 
          className="absolute top-4 left-1/2 -translate-x-1/2 bg-zinc-900/95 border border-violet-500/50 backdrop-blur-md rounded-xl shadow-2xl px-3 py-1.5 flex items-center gap-2 z-30 animate-in fade-in slide-in-from-top-2 duration-150 text-xs select-none"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center gap-1.5 border-r border-zinc-700/60 pr-2.5 font-medium text-zinc-300">
            <SlidersHorizontal className="w-4 h-4 text-violet-400" />
            <span className="font-bold text-violet-300">線幅修正</span>
          </div>

          {/* 4 One-tap Modes */}
          <div className="flex items-center gap-1 bg-zinc-950/70 p-0.5 rounded-lg border border-zinc-800">
            {[
              { id: 'thicken', label: '太くする', symbol: '＋', desc: '線をなぞって太く' },
              { id: 'thin', label: '細くする', symbol: '−', desc: '線をなぞって細く' },
              { id: 'taper', label: '抜き・入り', symbol: '▲', desc: '端を尖らせる' },
              { id: 'normalize', label: '均一化', symbol: '＝', desc: '太さを揃える' },
            ].map(m => {
              const isSelected = (widthBrushMode || 'thicken') === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    onWidthBrushModeChange?.(m.id as WidthBrushMode);
                    onStatusChange(`線幅修正モード: ${m.label} (${m.desc})`);
                  }}
                  title={`${m.label}: ${m.desc}`}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-violet-600 text-white shadow-xs font-bold'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                  }`}
                >
                  <span className="text-xs font-mono">{m.symbol}</span>
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* Return to Pen Button */}
          <button
            onClick={() => {
              onSelectTool?.('pen');
              onStatusChange('ペンツールに戻りました');
            }}
            title="作画に戻る (P)"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-medium transition-all cursor-pointer ml-1"
          >
            <PenTool className="w-3.5 h-3.5 text-indigo-400" />
            <span>ペンに戻る</span>
          </button>
        </div>
      )}

      {/* Canvas Top Quick Pill when using Pen: Instant One-tap Switch to Width Brush */}
      {tool === 'pen' && (
        <div 
          className="absolute top-4 left-1/2 -translate-x-1/2 bg-zinc-900/85 hover:bg-zinc-900 border border-zinc-700/60 hover:border-violet-500/50 backdrop-blur-md rounded-xl shadow-xl px-2.5 py-1 flex items-center gap-2 z-20 text-xs select-none transition-all group"
          onClick={e => e.stopPropagation()}
        >
          <span className="text-[11px] text-zinc-400 flex items-center gap-1 font-medium">
            <PenTool className="w-3 h-3 text-indigo-400" />
            作画中
          </span>
          <div className="w-px h-3.5 bg-zinc-700/70" />
          <button
            onClick={() => {
              onSelectTool?.('width');
              onStatusChange('線幅修正ブラシに切り替えました (線をなぞって太さ調整)');
            }}
            title="描いた線の太さをその場で直す・入り抜き付与 (W)"
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-violet-600/25 hover:bg-violet-600 text-violet-200 hover:text-white border border-violet-500/40 hover:border-violet-500 transition-all font-medium cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-violet-400 group-hover:text-white" />
            <span>線幅を直す (W)</span>
          </button>
        </div>
      )}

      {/* Canvas Stylus / Right-click Radial Quick Menu (8-way Circular Wheel) */}
      {radialMenuPos && (
        <div 
          className="absolute inset-0 z-50 select-none cursor-default"
          onClick={() => setRadialMenuPos(null)}
          onContextMenu={e => { e.preventDefault(); setRadialMenuPos(null); }}
        >
          <div 
            className="absolute -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full pointer-events-auto"
            style={{ left: radialMenuPos.x, top: radialMenuPos.y }}
            onClick={e => e.stopPropagation()}
          >
            {/* Circular Backdrop & Ring */}
            <div className="absolute inset-0 rounded-full bg-zinc-950/85 backdrop-blur-xl border border-zinc-700/80 shadow-[0_0_35px_rgba(0,0,0,0.85)] animate-in zoom-in-95 duration-100" />
            <div className="absolute inset-2 rounded-full border border-zinc-800/60 pointer-events-none" />

            {/* 8 Radial Buttons around circle at radius = 68px */}
            {[
              { angle: -90, id: 'pen', label: 'ペン (P)', icon: PenTool, action: () => onSelectTool?.('pen'), color: 'text-indigo-400 hover:bg-indigo-600/30 hover:border-indigo-500' },
              { angle: -45, id: 'bucket', label: '隙間閉じバケツ (G)', icon: PaintBucket, action: () => onSelectTool?.('bucket'), color: 'text-sky-400 hover:bg-sky-600/30 hover:border-sky-500' },
              { angle: 0, id: 'eraser', label: 'ベクター消しゴム (E)', icon: Eraser, action: () => onSelectTool?.('eraser'), color: 'text-rose-400 hover:bg-rose-600/30 hover:border-rose-500' },
              { angle: 45, id: 'eyedropper', label: 'スポイト (I)', icon: Pipette, action: () => onSelectTool?.('eyedropper'), color: 'text-amber-400 hover:bg-amber-600/30 hover:border-amber-500' },
              { angle: 90, id: 'reshape', label: 'パス変形 (A)', icon: Spline, action: () => onSelectTool?.('reshape'), color: 'text-cyan-400 hover:bg-cyan-600/30 hover:border-cyan-500' },
              { angle: 135, id: 'width', label: '線幅修正 (W)', icon: SlidersHorizontal, action: () => onSelectTool?.('width'), color: 'text-violet-400 hover:bg-violet-600/30 hover:border-violet-500' },
              { angle: 180, id: 'undo', label: '元に戻す (Ctrl+Z)', icon: Undo2, action: () => onUndo(), disabled: !canUndo, color: 'text-emerald-400 hover:bg-emerald-600/30 hover:border-emerald-500' },
              { angle: 225, id: 'redo', label: 'やり直す (Ctrl+Y)', icon: Redo2, action: () => onRedo(), disabled: !canRedo, color: 'text-emerald-400 hover:bg-emerald-600/30 hover:border-emerald-500' },
            ].map(item => {
              const rad = (item.angle * Math.PI) / 180;
              const r = 68;
              const x = 96 + r * Math.cos(rad);
              const y = 96 + r * Math.sin(rad);
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.disabled) return;
                    item.action();
                    setRadialMenuPos(null);
                  }}
                  disabled={item.disabled}
                  title={item.label}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center border transition-transform hover:scale-115 active:scale-95 shadow-md ${
                    item.disabled
                      ? 'opacity-30 cursor-not-allowed bg-zinc-900 border-zinc-800 text-zinc-600'
                      : `bg-zinc-900/95 border-zinc-700/80 cursor-pointer ${item.color}`
                  }`}
                  style={{ left: `${x}px`, top: `${y}px` }}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}

            {/* Center Close Pill */}
            <button
              onClick={() => setRadialMenuPos(null)}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-600/60 flex items-center justify-center text-zinc-400 hover:text-white transition-all shadow-sm cursor-pointer"
              title="閉じる (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Beginner Action Hint Banner (常時表示される直感的な操作ヒントバナー) */}
      <div 
        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 select-none max-w-[94vw] sm:max-w-2xl transition-all duration-200 pointer-events-auto"
        onClick={e => e.stopPropagation()}
      >
        {isHintCollapsed ? (
          <button
            onClick={() => setIsHintCollapsed(false)}
            title="初心者向け操作ヒントを展開"
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/70 shadow-lg backdrop-blur-md text-xs cursor-pointer transition-all hover:scale-105"
          >
            <Lightbulb className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span className="font-medium text-amber-300/90">💡 操作ヒント</span>
            <ChevronUp className="w-3 h-3 text-zinc-400" />
          </button>
        ) : (
          <div className="bg-zinc-950/90 border border-zinc-700/80 rounded-xl shadow-2xl backdrop-blur-md px-3.5 py-2 text-xs flex flex-col gap-1 text-zinc-200 animate-in fade-in slide-in-from-bottom-2 duration-150">
            {/* Header row */}
            <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-1">
              <div className="flex items-center gap-1.5 font-medium text-zinc-200">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="font-bold text-amber-300/90">{TOOL_HINTS[tool]?.title || 'ツール'}</span>
                {TOOL_HINTS[tool]?.shortcut && (
                  <span className="bg-zinc-800 px-1.5 py-0.2 rounded text-[10px] font-mono text-zinc-400 border border-zinc-700">
                    {TOOL_HINTS[tool].shortcut}
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsHintCollapsed(true)}
                title="ヒントを折りたたむ"
                className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
              >
                <span>折りたたむ</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            {/* Instruction row */}
            <div className="text-[11px] leading-relaxed text-zinc-100 font-medium">
              {TOOL_HINTS[tool]?.main || 'キャンバス上をクリックまたはドラッグして操作します。'}
            </div>

            {/* Pro Tip row */}
            {TOOL_HINTS[tool]?.tip && (
              <div className="text-[10px] text-zinc-400 flex items-start gap-1 pt-0.5">
                <span className="text-indigo-400 font-semibold shrink-0">ヒント:</span>
                <span className="leading-tight">{TOOL_HINTS[tool].tip}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
