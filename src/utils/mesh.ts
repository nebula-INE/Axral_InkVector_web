import { ColorMesh, BoundingBox } from '../types';

export function createDefaultMesh(cols = 3, rows = 3, baseColor = '#5b8cff'): ColorMesh {
  const pts: [number, number][] = [];
  const colors: string[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const u = cols > 1 ? c / (cols - 1) : 0.5;
      const v = rows > 1 ? r / (rows - 1) : 0.5;
      pts.push([u, v]);
      // Vary color slightly across the grid for immediate visual feedback
      colors.push(varyColor(baseColor, u, v));
    }
  }

  return {
    enabled: true,
    cols,
    rows,
    pts,
    colors,
  };
}

function hexToRgb(hex: string): [number, number, number] {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function varyColor(hex: string, u: number, v: number): string {
  const [r, g, b] = hexToRgb(hex);
  // Shift hue / brightness based on u and v
  const r2 = Math.min(255, r * (0.8 + 0.4 * u));
  const g2 = Math.min(255, g * (0.7 + 0.5 * (1 - v)));
  const b2 = Math.min(255, b * (0.9 + 0.3 * (u + v) * 0.5));
  return rgbToHex(r2, g2, b2);
}

// Render mesh into a 2D canvas context with bilinear interpolation
export function renderMesh(
  ctx: CanvasRenderingContext2D,
  mesh: ColorMesh,
  bbox: BoundingBox
) {
  const { cols, rows, pts, colors } = mesh;
  if (!cols || !rows || pts.length < cols * rows) return;

  // We divide each grid quad into two triangles and interpolate colors
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const iTL = r * cols + c;
      const iTR = r * cols + (c + 1);
      const iBL = (r + 1) * cols + c;
      const iBR = (r + 1) * cols + (c + 1);

      const pTL = { x: bbox.minX + pts[iTL][0] * bbox.width, y: bbox.minY + pts[iTL][1] * bbox.height };
      const pTR = { x: bbox.minX + pts[iTR][0] * bbox.width, y: bbox.minY + pts[iTR][1] * bbox.height };
      const pBL = { x: bbox.minX + pts[iBL][0] * bbox.width, y: bbox.minY + pts[iBL][1] * bbox.height };
      const pBR = { x: bbox.minX + pts[iBR][0] * bbox.width, y: bbox.minY + pts[iBR][1] * bbox.height };

      const cTL = hexToRgb(colors[iTL]);
      const cTR = hexToRgb(colors[iTR]);
      const cBL = hexToRgb(colors[iBL]);
      const cBR = hexToRgb(colors[iBR]);

      // Subdivide quad into fine cells for smooth gradients
      const SUB = 6;
      for (let sy = 0; sy < SUB; sy++) {
        for (let sx = 0; sx < SUB; sx++) {
          const u0 = sx / SUB;
          const u1 = (sx + 1) / SUB;
          const v0 = sy / SUB;
          const v1 = (sy + 1) / SUB;

          // Bilinear interpolate positions
          const q00 = bilinearPt(pTL, pTR, pBL, pBR, u0, v0);
          const q10 = bilinearPt(pTL, pTR, pBL, pBR, u1, v0);
          const q11 = bilinearPt(pTL, pTR, pBL, pBR, u1, v1);
          const q01 = bilinearPt(pTL, pTR, pBL, pBR, u0, v1);

          // Bilinear interpolate colors at cell center
          const uc = (u0 + u1) * 0.5;
          const vc = (v0 + v1) * 0.5;
          const [cr, cg, cb] = bilinearColor(cTL, cTR, cBL, cBR, uc, vc);

          ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
          ctx.beginPath();
          ctx.moveTo(q00.x, q00.y);
          ctx.lineTo(q10.x, q10.y);
          ctx.lineTo(q11.x, q11.y);
          ctx.lineTo(q01.x, q01.y);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }
}

function bilinearPt(
  tl: { x: number; y: number },
  tr: { x: number; y: number },
  bl: { x: number; y: number },
  br: { x: number; y: number },
  u: number,
  v: number
) {
  const x = (1 - u) * (1 - v) * tl.x + u * (1 - v) * tr.x + (1 - u) * v * bl.x + u * v * br.x;
  const y = (1 - u) * (1 - v) * tl.y + u * (1 - v) * tr.y + (1 - u) * v * bl.y + u * v * br.y;
  return { x, y };
}

function bilinearColor(
  cTL: [number, number, number],
  cTR: [number, number, number],
  cBL: [number, number, number],
  cBR: [number, number, number],
  u: number,
  v: number
): [number, number, number] {
  const r = (1 - u) * (1 - v) * cTL[0] + u * (1 - v) * cTR[0] + (1 - u) * v * cBL[0] + u * v * cBR[0];
  const g = (1 - u) * (1 - v) * cTL[1] + u * (1 - v) * cTR[1] + (1 - u) * v * cBL[1] + u * v * cBR[1];
  const b = (1 - u) * (1 - v) * cTL[2] + u * (1 - v) * cTR[2] + (1 - u) * v * cBL[2] + u * v * cBR[2];
  return [Math.round(r), Math.round(g), Math.round(b)];
}
