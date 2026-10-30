import { BrushType } from '../types';

export interface BrushPreset {
  id: BrushType;
  name: string;
  nameJa: string;
  description: string;
  defaultSize: number;
  minSizeMultiplier: number;
  maxSizeMultiplier: number;
  opacity: number;
  pressureResponse: 'linear' | 'ease-in-out' | 'sharp';
  stabilization: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
}

export const BRUSH_PRESETS: Record<BrushType, BrushPreset> = {
  gpen: {
    id: 'gpen',
    name: 'G-Pen',
    nameJa: 'Gペン',
    description: '強弱がはっきりつく、漫画のペン入れに最適な高感度インクペン',
    defaultSize: 3.5,
    minSizeMultiplier: 0.15,
    maxSizeMultiplier: 1.8,
    opacity: 1.0,
    pressureResponse: 'sharp',
    stabilization: 4,
    lineCap: 'round',
    lineJoin: 'round',
  },
  pen: {
    id: 'pen',
    name: 'Studio Pen',
    nameJa: 'スタジオペン',
    description: '滑らかで安定した均一感のあるベクター描画ペン',
    defaultSize: 4.0,
    minSizeMultiplier: 0.4,
    maxSizeMultiplier: 1.4,
    opacity: 1.0,
    pressureResponse: 'linear',
    stabilization: 3,
    lineCap: 'round',
    lineJoin: 'round',
  },
  pencil: {
    id: 'pencil',
    name: 'Pencil',
    nameJa: 'リアル鉛筆',
    description: '紙のテクスチャ感と繊細な筆圧タッチの下描き鉛筆',
    defaultSize: 2.5,
    minSizeMultiplier: 0.3,
    maxSizeMultiplier: 1.3,
    opacity: 0.75,
    pressureResponse: 'ease-in-out',
    stabilization: 1,
    lineCap: 'round',
    lineJoin: 'round',
  },
  marker: {
    id: 'marker',
    name: 'Marker',
    nameJa: 'コピック風マーカー',
    description: '透け感と重ね塗りが美しく決まる平筆マーカー',
    defaultSize: 12.0,
    minSizeMultiplier: 0.6,
    maxSizeMultiplier: 1.2,
    opacity: 0.65,
    pressureResponse: 'linear',
    stabilization: 2,
    lineCap: 'square',
    lineJoin: 'miter',
  },
  watercolor: {
    id: 'watercolor',
    name: 'Watercolor',
    nameJa: '透明水彩',
    description: '水分を含んだような柔らかいエッジのグラデーション表現',
    defaultSize: 18.0,
    minSizeMultiplier: 0.4,
    maxSizeMultiplier: 1.5,
    opacity: 0.45,
    pressureResponse: 'ease-in-out',
    stabilization: 3,
    lineCap: 'round',
    lineJoin: 'round',
  },
  airbrush: {
    id: 'airbrush',
    name: 'Airbrush',
    nameJa: 'エアブラシ',
    description: 'ふんわりとボケ足の長い陰影付けスプレー',
    defaultSize: 32.0,
    minSizeMultiplier: 0.5,
    maxSizeMultiplier: 1.6,
    opacity: 0.35,
    pressureResponse: 'ease-in-out',
    stabilization: 2,
    lineCap: 'round',
    lineJoin: 'round',
  },
};

// Calculate effective stroke width based on brush type and input pressure/velocity
export function calculateStrokeWidth(
  baseWidth: number,
  brush: BrushType,
  pressure = 0.5,
  velocity = 0
): number {
  const preset = BRUSH_PRESETS[brush] || BRUSH_PRESETS.pen;
  let p = pressure;

  if (preset.pressureResponse === 'sharp') {
    // Sharp S-curve for G-pen inking
    p = p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p);
  } else if (preset.pressureResponse === 'ease-in-out') {
    p = 0.5 - Math.cos(p * Math.PI) / 2;
  }

  // Velocity taper (faster strokes get slightly thinner like a real stylus ink flick)
  const velFactor = Math.max(0.7, 1.0 - Math.min(velocity, 50) * 0.006);

  const multiplier = preset.minSizeMultiplier + (preset.maxSizeMultiplier - preset.minSizeMultiplier) * p;
  return Math.max(0.5, baseWidth * multiplier * velFactor);
}
