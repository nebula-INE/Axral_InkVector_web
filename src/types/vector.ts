export interface Point {
  x: number;
  y: number;
}

export interface VNode {
  id: string;
  pos: Point;
  cpIn: Point;
  cpOut: Point;
  smooth: boolean;
}

export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light';
export type SymmetryType = 'none' | 'h' | 'v' | 'cross';
export type PerspectiveType = 'none' | '1pt' | '2pt';
export type ToneType = 'none' | 'dot' | 'line' | 'cross';
export type BalloonType = 'ellipse' | 'rect' | 'cloud' | 'spiky';

export type ToolType =
  | 'pen'
  | 'reshape'
  | 'select'
  | 'hand'
  | 'eraser'
  | 'add_node'
  | 'del_node'
  | 'width'
  | 'bucket'
  | 'scissors'
  | 'trim'       // 交差点消しゴム
  | 'mesh'       // カラーメッシュ編集
  | 'balloon'    // フキダシ
  | 'panel'      // コマ割り
  | 'focus'      // 集中線
  | 'speed';     // 効果線

export interface BrushPreset {
  name: string;
  pressureWidth: boolean;
  opacityVar: number;
  scatter: number;
  tip: 'round' | 'flat' | 'soft' | 'angle';
  smoothing: number;
  taper: number;
}

export interface VPath {
  id: string;
  nodes: VNode[];
  closed: boolean;
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  opacity: number;
  visible: boolean;
  brushName: string;
  pressure: number[];
  
  // Gradients
  gradientEnabled: boolean;
  gradientStart: string;
  gradientEnd: string;
  gradientAngle: number;

  // Gradient Color Mesh
  meshEnabled: boolean;
  meshCols: number;
  meshRows: number;
  meshColors: string[];
  meshPts: [number, number][]; // normalized coordinates [0..1] in bounding rect

  // Manga Tone Screen
  toneType: ToneType;
  toneFreq: number;
  toneSize: number;

  // Manga Speech Balloon Text
  text: string;
  textSize: number;
  textColor: string;
  textAlign: 'left' | 'center' | 'right';

  // Metadata (e.g. { type: 'balloon', balloonType: 'cloud', tail: Point } or { type: 'panel' })
  meta?: Record<string, any>;
}

export interface VLayer {
  id: string;
  name: string;
  paths: VPath[];
  visible: boolean;
  locked: boolean;
  opacity: number;
  blend: BlendMode;
}

export interface DocumentState {
  width: number;
  height: number;
  layers: VLayer[];
  activeLayerIdx: number;
  symmetry: SymmetryType;
  symCx: number;
  symCy: number;
  perspective: PerspectiveType;
  perspVp1: Point;
  perspVp2: Point;
  horizonY: number;
  webtoonMode: boolean;
  webtoonStripHeight: number;
  brushPresets: Record<string, BrushPreset>;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
}
