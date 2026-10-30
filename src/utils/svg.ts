import { Document, Layer, VPath, VNode, Point } from '../types';

export function documentToSvg(doc: Document): string {
  const parts: string[] = [];
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="0 0 ${doc.width} ${doc.height}" ` +
    `width="${doc.width}" height="${doc.height}" ` +
    `data-generator="VektorStudio-Web" ` +
    `data-webtoon="${doc.webtoonMode}">`
  );

  // SVG Definitions for screen tones and patterns
  parts.push(`  <defs>`);
  parts.push(`    <pattern id="tone-dots" width="12" height="12" patternUnits="userSpaceOnUse">`);
  parts.push(`      <circle cx="6" cy="6" r="2.5" fill="#000000" fill-opacity="0.35"/>`);
  parts.push(`    </pattern>`);
  parts.push(`    <pattern id="tone-lines" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">`);
  parts.push(`      <line x1="0" y1="0" x2="0" y2="8" stroke="#000000" stroke-width="2" stroke-opacity="0.35"/>`);
  parts.push(`    </pattern>`);
  parts.push(`  </defs>`);

  // Document metadata
  parts.push(`  <!-- VektorStudio Layers -->`);
  for (const layer of doc.layers) {
    if (!layer.visible) continue;
    parts.push(
      `  <g id="layer-${layer.id}" ` +
      `data-name="${escapeXml(layer.name)}" ` +
      `data-locked="${layer.locked}" ` +
      `data-blend="${layer.blendMode}" ` +
      `opacity="${layer.opacity}">`
    );

    for (const path of layer.paths) {
      const d = pathToSvgD(path);
      if (!d) continue;

      let fill = path.fillColor;
      if (path.tone && path.tone.type === 'dots') fill = 'url(#tone-dots)';
      else if (path.tone && path.tone.type === 'lines') fill = 'url(#tone-lines)';

      const meshAttr = path.mesh && path.mesh.enabled
        ? ` data-mesh='${JSON.stringify({
            cols: path.mesh.cols,
            rows: path.mesh.rows,
            pts: path.mesh.pts,
            colors: path.mesh.colors,
          })}'`
        : '';

      const balloonAttr = path.balloon
        ? ` data-balloon='${JSON.stringify(path.balloon)}'`
        : '';

      parts.push(
        `    <path id="${path.id}" ` +
        `d="${d}" ` +
        `stroke="${path.strokeColor}" ` +
        `stroke-width="${path.strokeWidth}" ` +
        `stroke-linecap="round" ` +
        `stroke-linejoin="round" ` +
        `fill="${fill}" ` +
        `opacity="${path.opacity}" ` +
        `data-brush="${path.brushType}"` +
        meshAttr +
        balloonAttr +
        `/>`
      );

      // If speech balloon has text, render text element
      if (path.balloon && path.balloon.text) {
        // Approximate center of path
        const firstNode = path.nodes[0];
        const tx = firstNode ? firstNode.pos.x : 0;
        const ty = firstNode ? firstNode.pos.y : 0;
        parts.push(
          `    <text x="${tx}" y="${ty}" ` +
          `fill="${path.balloon.textColor || '#000000'}" ` +
          `font-size="${path.balloon.fontSize || 18}" ` +
          `font-family="sans-serif" ` +
          `text-anchor="middle" ` +
          `dominant-baseline="central">` +
          `${escapeXml(path.balloon.text)}` +
          `</text>`
        );
      }
    }

    parts.push(`  </g>`);
  }

  parts.push(`</svg>`);
  return parts.join('\n');
}

export function pathToSvgD(path: VPath): string {
  const nodes = path.nodes;
  if (nodes.length === 0) return '';
  if (nodes.length === 1) {
    return `M ${nodes[0].pos.x.toFixed(2)} ${nodes[0].pos.y.toFixed(2)}`;
  }

  const cmds: string[] = [];
  cmds.push(`M ${nodes[0].pos.x.toFixed(2)} ${nodes[0].pos.y.toFixed(2)}`);

  const numSegs = path.closed ? nodes.length : nodes.length - 1;
  for (let i = 0; i < numSegs; i++) {
    const n1 = nodes[i];
    const n2 = nodes[(i + 1) % nodes.length];

    const cp1 = n1.cpOut ?? n1.pos;
    const cp2 = n2.cpIn ?? n2.pos;
    const end = n2.pos;

    // Check if straight line
    const isLinear = Math.abs(cp1.x - n1.pos.x) < 0.1 && Math.abs(cp1.y - n1.pos.y) < 0.1 &&
                     Math.abs(cp2.x - end.x) < 0.1 && Math.abs(cp2.y - end.y) < 0.1;

    if (isLinear) {
      cmds.push(`L ${end.x.toFixed(2)} ${end.y.toFixed(2)}`);
    } else {
      cmds.push(
        `C ${cp1.x.toFixed(2)} ${cp1.y.toFixed(2)}, ` +
        `${cp2.x.toFixed(2)} ${cp2.y.toFixed(2)}, ` +
        `${end.x.toFixed(2)} ${end.y.toFixed(2)}`
      );
    }
  }

  if (path.closed) cmds.push('Z');
  return cmds.join(' ');
}

// Parse SVG string into VektorStudio Document
export function svgToDocument(svgText: string): Document | null {
  const parser = new DOMParser();
  const xml = parser.parseFromString(svgText, 'image/svg+xml');
  const svgEl = xml.querySelector('svg');
  if (!svgEl) return null;

  const width = parseFloat(svgEl.getAttribute('width') || '1920') || 1920;
  const height = parseFloat(svgEl.getAttribute('height') || '1080') || 1080;
  const webtoon = svgEl.getAttribute('data-webtoon') === 'true';

  const layers: Layer[] = [];
  const gEls = svgEl.querySelectorAll('g');

  if (gEls.length > 0) {
    gEls.forEach((g, gIdx) => {
      // Don't import defs or non-layer groups
      if (g.closest('defs')) return;
      const layerId = g.getAttribute('id') || `layer-${gIdx + 1}`;
      const name = g.getAttribute('data-name') || `レイヤー ${gIdx + 1}`;
      const locked = g.getAttribute('data-locked') === 'true';
      const blendMode = (g.getAttribute('data-blend') as any) || 'source-over';
      const opacity = parseFloat(g.getAttribute('opacity') || '1.0');

      const paths: VPath[] = [];
      const pathEls = g.querySelectorAll('path');
      pathEls.forEach(pEl => {
        const vpath = parsePathElement(pEl);
        if (vpath) paths.push(vpath);
      });

      layers.push({
        id: layerId,
        name,
        visible: true,
        locked,
        opacity,
        blendMode,
        paths,
      });
    });
  }

  // If no <g> layers found, grab top-level <path> elements
  if (layers.length === 0) {
    const paths: VPath[] = [];
    const pathEls = svgEl.querySelectorAll('path');
    pathEls.forEach(pEl => {
      const vpath = parsePathElement(pEl);
      if (vpath) paths.push(vpath);
    });

    layers.push({
      id: crypto.randomUUID(),
      name: 'レイヤー 1',
      visible: true,
      locked: false,
      opacity: 1.0,
      blendMode: 'source-over',
      paths,
    });
  }

  return {
    id: crypto.randomUUID(),
    title: 'インポートしたSVG',
    width,
    height,
    layers,
    activeLayerId: layers[0].id,
    symmetry: 'none',
    symmetryCenter: { x: width / 2, y: height / 2 },
    perspective: {
      enabled: false,
      mode: '1-point',
      vanishingPoints: [{ x: width / 2, y: height / 2 }],
      horizonY: height / 2,
    },
    webtoonMode: webtoon,
  };
}

function parsePathElement(pEl: SVGPathElement): VPath | null {
  const d = pEl.getAttribute('d');
  if (!d) return null;

  const strokeColor = pEl.getAttribute('stroke') || '#000000';
  const strokeWidth = parseFloat(pEl.getAttribute('stroke-width') || '2') || 2;
  const fillColor = pEl.getAttribute('fill') || 'none';
  const opacity = parseFloat(pEl.getAttribute('opacity') || '1.0');
  const brushType = (pEl.getAttribute('data-brush') as any) || 'pen';

  const { nodes, closed } = parseSvgPathD(d);
  if (nodes.length === 0) return null;

  let mesh = undefined;
  const meshAttr = pEl.getAttribute('data-mesh');
  if (meshAttr) {
    try {
      const mData = JSON.parse(meshAttr);
      mesh = {
        enabled: true,
        cols: mData.cols,
        rows: mData.rows,
        pts: mData.pts,
        colors: mData.colors,
      };
    } catch {}
  }

  let balloon = undefined;
  const balloonAttr = pEl.getAttribute('data-balloon');
  if (balloonAttr) {
    try {
      balloon = JSON.parse(balloonAttr);
    } catch {}
  }

  return {
    id: pEl.getAttribute('id') || crypto.randomUUID(),
    nodes,
    closed,
    strokeColor,
    strokeWidth,
    fillColor,
    opacity,
    brushType,
    mesh,
    balloon,
    createdAt: Date.now(),
  };
}

// Simple robust SVG path `d` attribute parser (M, L, C, Z)
export function parseSvgPathD(d: string): { nodes: VNode[]; closed: boolean } {
  const nodes: VNode[] = [];
  let closed = false;

  // Normalize commands and arguments
  const tokens = d.match(/([a-zA-Z]|[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)/g) || [];
  let i = 0;
  let currentPos: Point = { x: 0, y: 0 };

  while (i < tokens.length) {
    const cmd = tokens[i];
    if (/^[a-zA-Z]$/.test(cmd)) {
      i++;
      if (cmd === 'M' || cmd === 'm') {
        const x = parseFloat(tokens[i++]);
        const y = parseFloat(tokens[i++]);
        currentPos = cmd === 'm' ? { x: currentPos.x + x, y: currentPos.y + y } : { x, y };
        nodes.push({ pos: { ...currentPos }, smooth: true });
      } else if (cmd === 'L' || cmd === 'l') {
        const x = parseFloat(tokens[i++]);
        const y = parseFloat(tokens[i++]);
        currentPos = cmd === 'l' ? { x: currentPos.x + x, y: currentPos.y + y } : { x, y };
        nodes.push({ pos: { ...currentPos }, smooth: true });
      } else if (cmd === 'C' || cmd === 'c') {
        const x1 = parseFloat(tokens[i++]);
        const y1 = parseFloat(tokens[i++]);
        const x2 = parseFloat(tokens[i++]);
        const y2 = parseFloat(tokens[i++]);
        const x = parseFloat(tokens[i++]);
        const y = parseFloat(tokens[i++]);

        const cp1: Point = cmd === 'c' ? { x: currentPos.x + x1, y: currentPos.y + y1 } : { x: x1, y: y1 };
        const cp2: Point = cmd === 'c' ? { x: currentPos.x + x2, y: currentPos.y + y2 } : { x: x2, y: y2 };
        currentPos = cmd === 'c' ? { x: currentPos.x + x, y: currentPos.y + y } : { x, y };

        if (nodes.length > 0) {
          nodes[nodes.length - 1].cpOut = cp1;
        }
        nodes.push({
          pos: { ...currentPos },
          cpIn: cp2,
          smooth: true,
        });
      } else if (cmd === 'Z' || cmd === 'z') {
        closed = true;
      }
    } else {
      // Subsequent coordinates for previous command
      i++;
    }
  }

  return { nodes, closed };
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
