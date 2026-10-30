export interface ColorHarmonyGroup {
  name: string;
  colors: string[];
}

export function hexToHsl(hex: string): [number, number, number] {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

export function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else if (300 <= h && h < 360) { r = c; g = 0; b = x; }

  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function generatePalettes(baseHex: string): ColorHarmonyGroup[] {
  const [h, s, l] = hexToHsl(baseHex);

  return [
    {
      name: '補色 (Complementary)',
      colors: [baseHex, hslToHex(h + 180, s, l)],
    },
    {
      name: '類似色 (Analogous)',
      colors: [
        hslToHex(h - 30, s, l),
        baseHex,
        hslToHex(h + 30, s, l),
      ],
    },
    {
      name: 'トライアド (Triadic)',
      colors: [
        baseHex,
        hslToHex(h + 120, s, l),
        hslToHex(h + 240, s, l),
      ],
    },
    {
      name: 'アニメ塗り・影色 (Anime Cel Shading)',
      colors: [
        hslToHex(h, Math.max(10, s - 15), Math.min(95, l + 20)), // ハイライト
        baseHex,                                                   // ベース
        hslToHex(h + 15, Math.min(100, s + 10), Math.max(15, l - 22)), // 1影 (色相を少し青/紫に寄せるプロ技法)
        hslToHex(h + 25, Math.min(100, s + 20), Math.max(10, l - 40)), // 2影
      ],
    },
    {
      name: '明暗階調 (Shades & Tints)',
      colors: [
        hslToHex(h, s, Math.min(95, l + 30)),
        hslToHex(h, s, Math.min(90, l + 15)),
        baseHex,
        hslToHex(h, s, Math.max(15, l - 15)),
        hslToHex(h, s, Math.max(10, l - 30)),
      ],
    },
  ];
}
