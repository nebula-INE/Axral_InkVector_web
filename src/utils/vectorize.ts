import { Point, VNode, VPath, AutoTraceConfig } from '../types';
import { simplifyPolyline, catmullRomToBezier } from './geometry';

export interface TraceProgress {
  status: string;
  percent: number;
}

/**
 * Traces a raster image into clean vector Bézier paths (VPath[])
 */
export async function vectorizeImage(
  imageSource: HTMLImageElement | ImageBitmap | ImageData,
  config: AutoTraceConfig,
  targetWidth: number,
  targetHeight: number,
  onProgress?: (p: TraceProgress) => void
): Promise<VPath[]> {
  onProgress?.({ status: '画像を前処理中…', percent: 15 });

  // 1. Prepare offscreen canvas
  let srcWidth = 0;
  let srcHeight = 0;
  let imgData: ImageData;

  if (imageSource instanceof ImageData) {
    imgData = imageSource;
    srcWidth = imageSource.width;
    srcHeight = imageSource.height;
  } else {
    srcWidth = imageSource.width;
    srcHeight = imageSource.height;

    // Constrain max resolution for tracing performance & stability
    const maxDim = 1200;
    const scale = Math.min(1, maxDim / Math.max(srcWidth, srcHeight));
    const workW = Math.max(10, Math.round(srcWidth * scale));
    const workH = Math.max(10, Math.round(srcHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = workW;
    canvas.height = workH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];

    ctx.drawImage(imageSource, 0, 0, workW, workH);
    imgData = ctx.getImageData(0, 0, workW, workH);
    srcWidth = workW;
    srcHeight = workH;
  }

  const { width, height, data } = imgData;
  const numPixels = width * height;

  onProgress?.({ status: '二値化とノイズ除去中…', percent: 35 });

  // 2. Grayscale & Thresholding
  const binary = new Uint8Array(numPixels);
  const threshold = config.threshold ?? 140;
  const invert = config.invert ?? false;

  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    const alpha = data[idx + 3];
    if (alpha < 30) {
      binary[i] = 0; // transparent is background
      continue;
    }
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;

    let isForeground = gray < threshold;
    if (invert) isForeground = !isForeground;

    binary[i] = isForeground ? 1 : 0;
  }

  // 3. Simple Median Denoise if requested
  if (config.denoise > 0) {
    const clean = new Uint8Array(binary);
    const passes = Math.min(3, config.denoise);
    for (let p = 0; p < passes; p++) {
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          let sum = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              sum += binary[(y + dy) * width + (x + dx)];
            }
          }
          clean[y * width + x] = sum >= 5 ? 1 : 0;
        }
      }
      binary.set(clean);
    }
  }

  onProgress?.({ status: '輪郭ストロークを検出中…', percent: 60 });

  // 4. Contour Boundary Tracing (Moore Neighbor Tracing)
  const visited = new Uint8Array(numPixels);
  const rawContours: Point[][] = [];

  // Direction offsets (dx, dy) for 8 neighbors, clockwise starting from top
  const dxs = [0, 1, 1, 1, 0, -1, -1, -1];
  const dys = [-1, -1, 0, 1, 1, 1, 0, -1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      // Start contour if foreground and left pixel is background
      if (binary[idx] === 1 && binary[idx - 1] === 0 && !visited[idx]) {
        const contour: Point[] = [];
        let cx = x;
        let cy = y;
        let dir = 0;
        let startX = cx;
        let startY = cy;

        contour.push({ x: cx, y: cy });
        visited[cy * width + cx] = 1;

        let steps = 0;
        const maxSteps = 4000;

        while (steps < maxSteps) {
          steps++;
          // Find next pixel in 8-neighborhood
          let found = false;
          const searchStart = (dir + 5) % 8; // backtrack direction

          for (let k = 0; k < 8; k++) {
            const checkDir = (searchStart + k) % 8;
            const nx = cx + dxs[checkDir];
            const ny = cy + dys[checkDir];

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              if (binary[ny * width + nx] === 1) {
                cx = nx;
                cy = ny;
                dir = checkDir;
                found = true;
                break;
              }
            }
          }

          if (!found) break;

          if (cx === startX && cy === startY) {
            break; // Loop completed
          }

          contour.push({ x: cx, y: cy });
          visited[cy * width + cx] = 1;
        }

        // Only keep contours with reasonable perimeter (ignore single-pixel noise)
        if (contour.length >= 8) {
          rawContours.push(contour);
        }
      }
    }
  }

  onProgress?.({ status: 'ベクター曲線を最適化中…', percent: 85 });

  // 5. Convert contours to target canvas scale and smooth Bézier VPaths
  const scaleX = targetWidth / width;
  const scaleY = targetHeight / height;
  // Maintain aspect ratio centered on target canvas
  const fitScale = Math.min(scaleX, scaleY);
  const offsetX = (targetWidth - width * fitScale) / 2;
  const offsetY = (targetHeight - height * fitScale) / 2;

  const paths: VPath[] = [];
  const tolerance = Math.max(0.8, config.smoothing ?? 2.0);

  for (const contour of rawContours) {
    // Map to target canvas points
    const mappedPts: Point[] = contour.map(p => ({
      x: offsetX + p.x * fitScale,
      y: offsetY + p.y * fitScale,
    }));

    // Simplify points
    const simplified = simplifyPolyline(mappedPts, tolerance);
    if (simplified.length < 3) continue;

    // Convert to smooth Bézier nodes
    const nodes = catmullRomToBezier(simplified, true);
    if (nodes.length < 3) continue;

    paths.push({
      id: crypto.randomUUID(),
      nodes,
      closed: true,
      strokeColor: config.strokeColor || '#18181b',
      strokeWidth: config.strokeWidth || 2,
      fillColor: 'none',
      opacity: 1.0,
      brushType: 'pen',
      createdAt: Date.now(),
    });
  }

  onProgress?.({ status: 'ベクター化完了！', percent: 100 });
  return paths;
}
