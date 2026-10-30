export interface Point {
  x: number;
  y: number;
}

export interface VNode {
  pos: Point;
  cpIn?: Point;  // Control point in (relative or absolute, we use absolute coordinates)
  cpOut?: Point; // Control point out (absolute)
  smooth?: boolean; // When true, cpIn, pos, and cpOut stay collinear
}

export interface ColorMesh {
  enabled: boolean;
  cols: number;
  rows: number;
  pts: [number, number][]; // normalized (0..1) relative to path bounding box
  colors: string[]; // hex/rgba color for each vertex (rows * cols)
}

export type BrushType = 'pen' | 'gpen' | 'pencil' | 'marker' | 'watercolor' | 'airbrush';

export interface ScreenTone {
  type: 'none' | 'dots' | 'lines' | 'cross' | 'noise' | 'gradient';
  freq: number; // frequency (lines/dots per inch, e.g. 30L-85L)
  size: number; // dot radius or line thickness
  angle: number; // rotation in degrees
  density?: number; // density percentage (5..80%)
}

export type EraserMode = 'intersection' | 'stroke' | 'segment';

export type WidthBrushMode = 'thicken' | 'thin' | 'normalize' | 'taper';

export interface FocusLineConfig {
  count: number;
  innerRadiusRatio: number; // relative to canvas min dimension
  outerRadiusRatio: number;
  strokeWidth: number;
  taper: boolean;
  jitter: number;
}

export interface SpeedLineConfig {
  count: number;
  angle: number; // degrees
  length: number;
  strokeWidth: number;
  jitter: number;
  taper: boolean;
}

export interface BurstLineConfig {
  count: number;
  innerRadius: number;
  outerRadius: number;
  strokeWidth: number;
  raggedness: number;
}

export interface AutoTraceConfig {
  threshold: number; // 0..255
  invert: boolean;
  denoise: number; // 0..5
  smoothing: number; // tolerance for Douglas-Peucker
  strokeWidth: number;
  strokeColor: string;
}

export interface SpeechBalloon {
  tailPos: Point;
  text: string;
  fontSize: number;
  textColor: string;
  verticalText: boolean;
  shape: 'oval' | 'roundRect' | 'shout' | 'cloud';
}

export interface MangaPanel {
  gutter: number;
  borderColor: string;
  borderWidth: number;
}

export interface VPath {
  id: string;
  nodes: VNode[];
  closed: boolean;
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  opacity: number;
  brushType: BrushType;
  pressures?: number[]; // pressure / thickness multiplier per node
  mesh?: ColorMesh;
  tone?: ScreenTone;
  balloon?: SpeechBalloon;
  panel?: MangaPanel;
  createdAt: number;
}

export type BlendMode = 'source-over' | 'multiply' | 'screen' | 'overlay' | 'lighten' | 'color-dodge';

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  clipped?: boolean; // When true, clips to the layer below
  opacity: number;
  blendMode: BlendMode;
  paths: VPath[];
}

export type SymmetryMode = 'none' | 'vertical' | 'horizontal' | 'cross';

export interface PerspectiveGuide {
  enabled: boolean;
  mode: '1-point' | '2-point' | '3-point';
  vanishingPoints: Point[];
  horizonY: number;
}

export interface Document {
  id: string;
  title: string;
  width: number;
  height: number;
  layers: Layer[];
  activeLayerId: string;
  symmetry: SymmetryMode;
  symmetryCenter: Point;
  perspective: PerspectiveGuide;
  webtoonMode: boolean;
}

export type ShapeType = 'rect' | 'ellipse' | 'line' | 'star' | 'polygon';

export type ToolType = 
  | 'select'        // V: Selection & Transform
  | 'reshape'       // A: Direct Selection / Node editing
  | 'pen'           // P: Freehand & Bezier Pen
  | 'shape'         // U: Geometric Shapes (Rect, Ellipse, Line)
  | 'eraser'        // E: Standard / Stroke Eraser
  | 'eyedropper'    // I: Color Picker / Eyedropper
  | 'width'         // W: Dynamic Stroke Width Editor
  | 'bucket'        // B: Vector Bucket Fill
  | 'trim'          // T: Intersection Eraser (はみ出し消しゴム)
  | 'scissors'      // C: Path Split / Scissors
  | 'add_anchor'    // Shift+A: Insert Anchor Point
  | 'del_anchor'    // Shift+D: Delete Anchor Point
  | 'mesh'          // M: Color Mesh Gradient Editor
  | 'balloon'       // Speech Balloon
  | 'panel'         // Manga Frame Split
  | 'focus_line'    // Action Focus Rays (集中線)
  | 'speed_line'    // Speed Lines (流線)
  | 'hand';         // H: Pan / Zoom

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}
