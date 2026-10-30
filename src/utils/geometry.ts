import { Point, VNode, VPath, BoundingBox, SymmetryMode, ShapeType, EraserMode, WidthBrushMode, FocusLineConfig, SpeedLineConfig, BurstLineConfig, Document } from '../types';

export function dist(p1: Point, p2: Point): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distSq(p1: Point, p2: Point): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return dx * dx + dy * dy;
}

export function lerpPoint(p1: Point, p2: Point, t: number): Point {
  return {
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t,
  };
}

// Evaluate cubic Bézier at parameter t (0..1)
export function evalCubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const it = 1 - t;
  const it2 = it * it;
  const it3 = it2 * it;
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x: it3 * p0.x + 3 * it2 * t * p1.x + 3 * it * t2 * p2.x + t3 * p3.x,
    y: it3 * p0.y + 3 * it2 * t * p1.y + 3 * it * t2 * p2.y + t3 * p3.y,
  };
}

// Split cubic Bézier at parameter t using De Casteljau algorithm
export function splitCubicBezier(
  p0: Point, p1: Point, p2: Point, p3: Point, t: number
): [[Point, Point, Point, Point], [Point, Point, Point, Point]] {
  const q0 = lerpPoint(p0, p1, t);
  const q1 = lerpPoint(p1, p2, t);
  const q2 = lerpPoint(p2, p3, t);

  const r0 = lerpPoint(q0, q1, t);
  const r1 = lerpPoint(q1, q2, t);

  const s = lerpPoint(r0, r1, t);

  return [
    [p0, q0, r0, s],
    [s, r1, q2, p3]
  ];
}

// Line segment intersection (p1-p2 with p3-p4)
export function lineIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
  if (Math.abs(denom) < 1e-6) return null;

  const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
  const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;

  if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
    return {
      x: p1.x + ua * (p2.x - p1.x),
      y: p1.y + ua * (p2.y - p1.y)
    };
  }
  return null;
}

// Flatten a VPath into densely sampled points with segment mapping
export interface SampledPathPoint {
  pt: Point;
  segIdx: number;
  t: number;
  pressure?: number;
}

export function flattenVPath(path: VPath, stepsPerSeg = 24): SampledPathPoint[] {
  const result: SampledPathPoint[] = [];
  const nodes = path.nodes;
  if (nodes.length < 2) {
    if (nodes.length === 1) {
      result.push({ pt: { ...nodes[0].pos }, segIdx: 0, t: 0, pressure: path.pressures?.[0] ?? 1 });
    }
    return result;
  }

  const numSegs = path.closed ? nodes.length : nodes.length - 1;
  for (let i = 0; i < numSegs; i++) {
    const n1 = nodes[i];
    const n2 = nodes[(i + 1) % nodes.length];
    const p0 = n1.pos;
    const p1 = n1.cpOut ?? n1.pos;
    const p2 = n2.cpIn ?? n2.pos;
    const p3 = n2.pos;

    const press0 = path.pressures?.[i] ?? 1.0;
    const press1 = path.pressures?.[(i + 1) % nodes.length] ?? 1.0;

    for (let s = 0; s < stepsPerSeg; s++) {
      const t = s / stepsPerSeg;
      const pt = evalCubicBezier(p0, p1, p2, p3, t);
      const pressure = press0 + (press1 - press0) * t;
      result.push({ pt, segIdx: i, t, pressure });
    }
  }

  const lastNode = path.closed ? nodes[0] : nodes[nodes.length - 1];
  const lastPress = path.pressures ? (path.closed ? path.pressures[0] : path.pressures[nodes.length - 1]) : 1.0;
  result.push({ pt: { ...lastNode.pos }, segIdx: numSegs - 1, t: 1.0, pressure: lastPress });

  return result;
}

// Calculate bounding box of a path
export function getPathBoundingBox(path: VPath): BoundingBox {
  const samples = flattenVPath(path, 16);
  if (samples.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0, centerX: 0, centerY: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const s of samples) {
    if (s.pt.x < minX) minX = s.pt.x;
    if (s.pt.y < minY) minY = s.pt.y;
    if (s.pt.x > maxX) maxX = s.pt.x;
    if (s.pt.y > maxY) maxY = s.pt.y;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

// Get combined bounding box for multiple paths
export function getCombinedBoundingBox(paths: VPath[]): BoundingBox {
  if (paths.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0, centerX: 0, centerY: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of paths) {
    const b = getPathBoundingBox(p);
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

// True point-in-polygon containment test for closed VPath
export function isPointInVPath(pt: Point, path: VPath): boolean {
  if (!path.closed) return false;
  const bbox = getPathBoundingBox(path);
  if (pt.x < bbox.minX || pt.x > bbox.maxX || pt.y < bbox.minY || pt.y > bbox.maxY) {
    return false;
  }

  const samples = flattenVPath(path, 16);
  if (samples.length < 3) return false;

  let inside = false;
  for (let i = 0, j = samples.length - 1; i < samples.length; j = i++) {
    const xi = samples[i].pt.x, yi = samples[i].pt.y;
    const xj = samples[j].pt.x, yj = samples[j].pt.y;

    const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
      (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
}

// Find intersections between pathA and pathB
export function findPathIntersections(pathA: VPath, pathB: VPath): Point[] {
  const samplesA = flattenVPath(pathA, 20);
  const samplesB = flattenVPath(pathB, 20);
  const intersections: Point[] = [];

  for (let i = 0; i < samplesA.length - 1; i++) {
    const a1 = samplesA[i].pt;
    const a2 = samplesA[i + 1].pt;
    for (let j = 0; j < samplesB.length - 1; j++) {
      const b1 = samplesB[j].pt;
      const b2 = samplesB[j + 1].pt;

      const hit = lineIntersection(a1, a2, b1, b2);
      if (hit) {
        if (!intersections.some(pt => dist(pt, hit) < 4.0)) {
          intersections.push(hit);
        }
      }
    }
  }

  return intersections;
}

// Vector Intersection Eraser (Trim between intersections)
export function trimPathAtIntersections(
  targetPath: VPath,
  otherPaths: VPath[],
  clickPoint: Point,
  maxClickDist = 30
): VPath[] | null {
  const samples = flattenVPath(targetPath, 24);
  if (samples.length < 2) return null;

  // Find all intersections on targetPath
  const allHits: { point: Point; sampleIndex: number }[] = [];
  for (const other of otherPaths) {
    if (other.id === targetPath.id) continue;
    const hits = findPathIntersections(targetPath, other);
    for (const h of hits) {
      let bestDist = Infinity;
      let bestIdx = -1;
      for (let i = 0; i < samples.length; i++) {
        const d = dist(samples[i].pt, h);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0) {
        allHits.push({ point: h, sampleIndex: bestIdx });
      }
    }
  }

  if (allHits.length === 0) return null;

  // Find sample closest to clickPoint
  let clickSampleIdx = -1;
  let clickDist = Infinity;
  for (let i = 0; i < samples.length; i++) {
    const d = dist(samples[i].pt, clickPoint);
    if (d < clickDist) {
      clickDist = d;
      clickSampleIdx = i;
    }
  }

  if (clickDist > maxClickDist || clickSampleIdx === -1) return null;

  allHits.sort((a, b) => a.sampleIndex - b.sampleIndex);

  // Find the bracket around clickSampleIdx
  let lowerBound = 0;
  let upperBound = samples.length - 1;

  for (let i = 0; i < allHits.length; i++) {
    if (allHits[i].sampleIndex <= clickSampleIdx) {
      lowerBound = allHits[i].sampleIndex;
    }
    if (allHits[i].sampleIndex >= clickSampleIdx) {
      upperBound = allHits[i].sampleIndex;
      break;
    }
  }

  const pieces: VPath[] = [];

  if (lowerBound > 2) {
    const nodesBefore = samplesToNodes(samples.slice(0, lowerBound + 1));
    if (nodesBefore.length >= 2) {
      pieces.push({
        ...targetPath,
        id: crypto.randomUUID(),
        nodes: nodesBefore,
        closed: false,
      });
    }
  }

  if (upperBound < samples.length - 3) {
    const nodesAfter = samplesToNodes(samples.slice(upperBound));
    if (nodesAfter.length >= 2) {
      pieces.push({
        ...targetPath,
        id: crypto.randomUUID(),
        nodes: nodesAfter,
        closed: false,
      });
    }
  }

  return pieces;
}

// Scissors / Path Cut: Split path at clicked point into two paths
export function splitVPathAtPoint(
  path: VPath,
  clickPt: Point,
  maxDist = 25
): [VPath, VPath] | null {
  const samples = flattenVPath(path, 32);
  if (samples.length < 3) return null;

  let bestIdx = -1;
  let bestDist = Infinity;
  for (let i = 0; i < samples.length; i++) {
    const d = dist(samples[i].pt, clickPt);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }

  if (bestDist > maxDist || bestIdx <= 1 || bestIdx >= samples.length - 2) {
    return null;
  }

  const s1 = samples.slice(0, bestIdx + 1);
  const s2 = samples.slice(bestIdx);

  const n1 = samplesToNodes(s1);
  const n2 = samplesToNodes(s2);

  if (n1.length < 2 || n2.length < 2) return null;

  const p1: VPath = {
    ...path,
    id: crypto.randomUUID(),
    nodes: n1,
    closed: false,
  };
  const p2: VPath = {
    ...path,
    id: crypto.randomUUID(),
    nodes: n2,
    closed: false,
  };

  return [p1, p2];
}

// Insert anchor node into path segment without altering curve shape
export function insertNodeInSegment(path: VPath, clickPt: Point, maxDist = 20): VPath | null {
  const samples = flattenVPath(path, 24);
  let bestIdx = -1;
  let bestDist = Infinity;

  for (let i = 0; i < samples.length; i++) {
    const d = dist(samples[i].pt, clickPt);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }

  if (bestDist > maxDist || bestIdx === -1) return null;

  const sample = samples[bestIdx];
  const segIdx = sample.segIdx;
  const t = sample.t;
  if (t < 0.05 || t > 0.95) return null; // Too close to existing node

  const nodes = [...path.nodes];
  const n1 = nodes[segIdx];
  const n2 = nodes[(segIdx + 1) % nodes.length];

  const p0 = n1.pos;
  const p1 = n1.cpOut ?? n1.pos;
  const p2 = n2.cpIn ?? n2.pos;
  const p3 = n2.pos;

  const [c1, c2] = splitCubicBezier(p0, p1, p2, p3, t);

  // Update n1
  n1.cpOut = c1[1];
  // Insert new node
  const newNode: VNode = {
    pos: c1[3],
    cpIn: c1[2],
    cpOut: c2[1],
    smooth: true,
  };
  // Update n2
  n2.cpIn = c2[2];

  nodes.splice(segIdx + 1, 0, newNode);

  return {
    ...path,
    nodes,
  };
}

// Transform path nodes by scaling, rotating, and translating around pivot
export function transformPath(
  path: VPath,
  scaleX: number,
  scaleY: number,
  rotateRad: number,
  pivot: Point,
  dx: number,
  dy: number
): VPath {
  const cos = Math.cos(rotateRad);
  const sin = Math.sin(rotateRad);

  const txPt = (pt: Point): Point => {
    // 1. Relative to pivot
    const rx = (pt.x - pivot.x) * scaleX;
    const ry = (pt.y - pivot.y) * scaleY;
    // 2. Rotate
    const rotX = rx * cos - ry * sin;
    const rotY = rx * sin + ry * cos;
    // 3. Translate
    return {
      x: pivot.x + rotX + dx,
      y: pivot.y + rotY + dy,
    };
  };

  const newNodes = path.nodes.map(n => ({
    pos: txPt(n.pos),
    cpIn: n.cpIn ? txPt(n.cpIn) : undefined,
    cpOut: n.cpOut ? txPt(n.cpOut) : undefined,
    smooth: n.smooth,
  }));

  return {
    ...path,
    nodes: newNodes,
  };
}

// Convert dense samples back to clean simplified Bézier nodes
function samplesToNodes(samples: SampledPathPoint[]): VNode[] {
  const pts = samples.map(s => s.pt);
  const simplified = simplifyPolyline(pts, 2.0);
  return catmullRomToBezier(simplified, false);
}

// Ramer-Douglas-Peucker Polyline Simplification
export function simplifyPolyline(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let index = 0;
  const p1 = points[0];
  const p2 = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDist(points[i], p1, p2);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyPolyline(points.slice(0, index + 1), tolerance);
    const right = simplifyPolyline(points.slice(index), tolerance);
    return left.slice(0, left.length - 1).concat(right);
  } else {
    return [p1, p2];
  }
}

function perpendicularDist(pt: Point, line1: Point, line2: Point): number {
  const dx = line2.x - line1.x;
  const dy = line2.y - line1.y;
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag < 1e-6) return dist(pt, line1);
  return Math.abs(dy * pt.x - dx * pt.y + line2.x * line1.y - line2.y * line1.x) / mag;
}

// Convert sampled polyline points into smooth cubic Bézier nodes via Catmull-Rom
export function catmullRomToBezier(points: Point[], closed = false): VNode[] {
  if (points.length === 0) return [];
  if (points.length === 1) {
    return [{ pos: { ...points[0] } }];
  }
  if (points.length === 2) {
    return [
      { pos: { ...points[0] } },
      { pos: { ...points[1] } }
    ];
  }

  const nodes: VNode[] = [];
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const pPrev = points[(i - 1 + n) % n];
    const pCurr = points[i];
    const pNext = points[(i + 1) % n];

    let tx: number, ty: number;
    if (!closed && i === 0) {
      tx = (pNext.x - pCurr.x) * 0.3;
      ty = (pNext.y - pCurr.y) * 0.3;
      nodes.push({
        pos: { ...pCurr },
        cpOut: { x: pCurr.x + tx, y: pCurr.y + ty },
        smooth: true,
      });
    } else if (!closed && i === n - 1) {
      tx = (pCurr.x - pPrev.x) * 0.3;
      ty = (pCurr.y - pPrev.y) * 0.3;
      nodes.push({
        pos: { ...pCurr },
        cpIn: { x: pCurr.x - tx, y: pCurr.y - ty },
        smooth: true,
      });
    } else {
      tx = (pNext.x - pPrev.x) * 0.25;
      ty = (pNext.y - pPrev.y) * 0.25;
      nodes.push({
        pos: { ...pCurr },
        cpIn: { x: pCurr.x - tx, y: pCurr.y - ty },
        cpOut: { x: pCurr.x + tx, y: pCurr.y + ty },
        smooth: true,
      });
    }
  }

  return nodes;
}

// Symmetry transformations
export function getSymmetricPoints(pt: Point, mode: SymmetryMode, center: Point): Point[] {
  if (mode === 'none') return [pt];
  const results: Point[] = [pt];

  if (mode === 'vertical' || mode === 'cross') {
    results.push({
      x: 2 * center.x - pt.x,
      y: pt.y,
    });
  }

  if (mode === 'horizontal' || mode === 'cross') {
    results.push({
      x: pt.x,
      y: 2 * center.y - pt.y,
    });
  }

  if (mode === 'cross') {
    results.push({
      x: 2 * center.x - pt.x,
      y: 2 * center.y - pt.y,
    });
  }

  return results;
}

// Generate vector nodes for geometric primitives (Rect, Ellipse, Line, Star, Polygon)
export function createShapeNodes(
  type: ShapeType,
  start: Point,
  end: Point,
  shiftKey: boolean
): { nodes: VNode[]; closed: boolean } {
  if (type === 'rect') {
    let p2 = { ...end };
    if (shiftKey) {
      const size = Math.max(Math.abs(p2.x - start.x), Math.abs(p2.y - start.y));
      const sx = Math.sign(p2.x - start.x) || 1;
      const sy = Math.sign(p2.y - start.y) || 1;
      p2 = { x: start.x + size * sx, y: start.y + size * sy };
    }
    const nodes: VNode[] = [
      { pos: { x: start.x, y: start.y }, smooth: false },
      { pos: { x: p2.x, y: start.y }, smooth: false },
      { pos: { x: p2.x, y: p2.y }, smooth: false },
      { pos: { x: start.x, y: p2.y }, smooth: false },
    ];
    return { nodes, closed: true };
  }

  if (type === 'ellipse') {
    let rx = Math.abs(end.x - start.x) / 2;
    let ry = Math.abs(end.y - start.y) / 2;
    if (shiftKey) {
      const r = Math.max(rx, ry);
      rx = r;
      ry = r;
    }
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    const k = 0.5522847498;

    const nodes: VNode[] = [
      { pos: { x: cx, y: cy - ry }, cpOut: { x: cx + rx * k, y: cy - ry }, cpIn: { x: cx - rx * k, y: cy - ry }, smooth: true },
      { pos: { x: cx + rx, y: cy }, cpIn: { x: cx + rx, y: cy - ry * k }, cpOut: { x: cx + rx, y: cy + ry * k }, smooth: true },
      { pos: { x: cx, y: cy + ry }, cpIn: { x: cx + rx * k, y: cy + ry }, cpOut: { x: cx - rx * k, y: cy + ry }, smooth: true },
      { pos: { x: cx - rx, y: cy }, cpIn: { x: cx - rx, y: cy + ry * k }, cpOut: { x: cx - rx, y: cy - ry * k }, smooth: true },
    ];
    return { nodes, closed: true };
  }

  if (type === 'star') {
    let rx = Math.abs(end.x - start.x) / 2;
    let ry = Math.abs(end.y - start.y) / 2;
    if (shiftKey) {
      const r = Math.max(rx, ry);
      rx = r;
      ry = r;
    }
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    const innerRatio = 0.42;

    const nodes: VNode[] = [];
    const totalPoints = 10; // 5 outer points, 5 inner points
    for (let i = 0; i < totalPoints; i++) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const rRatio = i % 2 === 0 ? 1.0 : innerRatio;
      nodes.push({
        pos: {
          x: cx + rx * rRatio * Math.cos(angle),
          y: cy + ry * rRatio * Math.sin(angle),
        },
        smooth: false,
      });
    }
    return { nodes, closed: true };
  }

  if (type === 'polygon') {
    // 3-point regular polygon (Triangle)
    let rx = Math.abs(end.x - start.x) / 2;
    let ry = Math.abs(end.y - start.y) / 2;
    if (shiftKey) {
      const r = Math.max(rx, ry);
      rx = r;
      ry = r;
    }
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;

    const nodes: VNode[] = [];
    const totalPoints = 3;
    for (let i = 0; i < totalPoints; i++) {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / totalPoints;
      nodes.push({
        pos: {
          x: cx + rx * Math.cos(angle),
          y: cy + ry * Math.sin(angle),
        },
        smooth: false,
      });
    }
    return { nodes, closed: true };
  }

  // Line
  let pEnd = { ...end };
  if (shiftKey) {
    // Snap to 45 degree angle increments
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    const d = dist(start, end);
    pEnd = {
      x: start.x + Math.cos(snapAngle) * d,
      y: start.y + Math.sin(snapAngle) * d,
    };
  }
  return {
    nodes: [{ pos: { ...start }, smooth: false }, { pos: pEnd, smooth: false }],
    closed: false,
  };
}

// Scratch-style Reshape node smoothness toggle: curved (smooth) vs pointed (sharp)
export function toggleNodeSmoothness(
  path: VPath,
  nodeIndex: number,
  mode?: 'smooth' | 'sharp'
): VPath {
  if (nodeIndex < 0 || nodeIndex >= path.nodes.length) return path;
  const nodes = [...path.nodes];
  const curr = { ...nodes[nodeIndex] };
  const targetSmooth = mode ? mode === 'smooth' : !curr.smooth;

  if (targetSmooth) {
    const n = nodes.length;
    const prevIdx = (nodeIndex - 1 + n) % n;
    const nextIdx = (nodeIndex + 1) % n;
    const prev = nodes[prevIdx];
    const next = nodes[nextIdx];

    const dx = (next.pos.x - prev.pos.x) * 0.25;
    const dy = (next.pos.y - prev.pos.y) * 0.25;

    curr.smooth = true;
    curr.cpIn = { x: curr.pos.x - dx, y: curr.pos.y - dy };
    curr.cpOut = { x: curr.pos.x + dx, y: curr.pos.y + dy };
  } else {
    curr.smooth = false;
    curr.cpIn = undefined;
    curr.cpOut = undefined;
  }

  nodes[nodeIndex] = curr;
  return {
    ...path,
    nodes,
  };
}

// Delete node from path
export function deleteNodeFromPath(path: VPath, nodeIndex: number): VPath | null {
  if (nodeIndex < 0 || nodeIndex >= path.nodes.length) return path;

  if (path.closed) {
    if (path.nodes.length <= 3) {
      // Deleting a node from a triangle leaves 2 nodes; converts to an open line
      const remaining = path.nodes.filter((_, idx) => idx !== nodeIndex);
      return {
        ...path,
        nodes: remaining,
        closed: false,
      };
    }
  } else {
    if (path.nodes.length <= 2) {
      return null;
    }
  }

  const nodes = path.nodes.filter((_, idx) => idx !== nodeIndex);
  return {
    ...path,
    nodes,
  };
}

/**
 * Clip Studio Paint style Vector Eraser
 * Supports:
 * - 'intersection': Trims line segment up to intersections with other lines (or deletes stroke if no intersections)
 * - 'segment': Slices out only the touched segment within radius
 * - 'stroke': Erases entire stroke
 */
export function eraseVectorPathAtPoint(
  targetPath: VPath,
  allPaths: VPath[],
  point: Point,
  mode: EraserMode,
  radius = 20
): { modifiedPaths: VPath[]; affected: boolean } {
  // Check if target path touches point
  const samples = flattenVPath(targetPath, 20);
  if (samples.length === 0) return { modifiedPaths: [], affected: false };

  let closestSampleIdx = -1;
  let minDistance = Infinity;

  for (let i = 0; i < samples.length; i++) {
    const d = dist(samples[i].pt, point);
    if (d < minDistance) {
      minDistance = d;
      closestSampleIdx = i;
    }
  }

  const effectiveRadius = Math.max(radius, (targetPath.strokeWidth || 2) * 1.2);
  if (minDistance > effectiveRadius) {
    return { modifiedPaths: [targetPath], affected: false };
  }

  // MODE 1: Whole Stroke Eraser
  if (mode === 'stroke') {
    return { modifiedPaths: [], affected: true };
  }

  // MODE 2: Intersection Eraser (交点まで消去)
  if (mode === 'intersection') {
    const trimmed = trimPathAtIntersections(targetPath, allPaths, point, effectiveRadius + 15);
    if (trimmed !== null) {
      return { modifiedPaths: trimmed, affected: true };
    }
    // If no intersection was hit, erase the standalone stroke entirely (standard Manga studio behavior)
    return { modifiedPaths: [], affected: true };
  }

  // MODE 3: Segment / Touch Eraser (触れた部分のみ消去・くり抜き)
  const remainingChunks: SampledPathPoint[][] = [];
  let currentChunk: SampledPathPoint[] = [];

  for (let i = 0; i < samples.length; i++) {
    const d = dist(samples[i].pt, point);
    if (d >= radius) {
      currentChunk.push(samples[i]);
    } else {
      if (currentChunk.length >= 2) {
        remainingChunks.push(currentChunk);
      }
      currentChunk = [];
    }
  }

  if (currentChunk.length >= 2) {
    remainingChunks.push(currentChunk);
  }

  const resultingPaths: VPath[] = [];
  for (const chunk of remainingChunks) {
    const nodes = samplesToNodes(chunk);
    if (nodes.length >= 2) {
      resultingPaths.push({
        ...targetPath,
        id: crypto.randomUUID(),
        nodes,
        closed: false,
      });
    }
  }

  return { modifiedPaths: resultingPaths, affected: true };
}

/**
 * Interactive Stroke Width Modification
 * Modulates local stroke width and pressure along Bézier path
 */
export function modifyPathStrokeWidth(
  path: VPath,
  hitPoint: Point,
  mode: WidthBrushMode,
  delta = 1.0,
  brushRadius = 40
): VPath {
  // Ensure pressures array is initialized
  const nodeCount = path.nodes.length;
  const currentPressures = path.pressures && path.pressures.length === nodeCount
    ? [...path.pressures]
    : Array(nodeCount).fill(1.0);

  let anyModified = false;

  for (let i = 0; i < nodeCount; i++) {
    const nodePt = path.nodes[i].pos;
    const d = dist(nodePt, hitPoint);
    if (d < brushRadius) {
      const weight = 1 - d / brushRadius;
      anyModified = true;

      switch (mode) {
        case 'thicken':
          currentPressures[i] = Math.min(4.0, currentPressures[i] + delta * 0.15 * weight);
          break;
        case 'thin':
          currentPressures[i] = Math.max(0.1, currentPressures[i] - delta * 0.15 * weight);
          break;
        case 'normalize':
          currentPressures[i] = currentPressures[i] + (1.0 - currentPressures[i]) * 0.25 * weight;
          break;
        case 'taper':
          // If near ends, taper down; if in middle, maintain normal
          const t = i / Math.max(1, nodeCount - 1);
          const targetPressure = Math.sin(t * Math.PI) * 1.2 + 0.1;
          currentPressures[i] = currentPressures[i] + (targetPressure - currentPressures[i]) * 0.3 * weight;
          break;
      }
    }
  }

  if (!anyModified) {
    // If not close to any specific node, apply moderate adjustment to path strokeWidth
    if (mode === 'thicken') {
      return { ...path, strokeWidth: Math.min(100, path.strokeWidth + 1) };
    } else if (mode === 'thin') {
      return { ...path, strokeWidth: Math.max(0.5, path.strokeWidth - 1) };
    }
    return path;
  }

  return {
    ...path,
    pressures: currentPressures,
  };
}

/**
 * Batch adjustments for selected paths
 */
export function batchAdjustPathsWidth(
  paths: VPath[],
  action: 'thicken' | 'thin' | 'normalize' | 'taper'
): VPath[] {
  return paths.map(p => {
    const nodeCount = p.nodes.length;
    switch (action) {
      case 'thicken':
        return {
          ...p,
          strokeWidth: Math.min(100, p.strokeWidth + 1.5),
        };
      case 'thin':
        return {
          ...p,
          strokeWidth: Math.max(0.5, p.strokeWidth - 1.5),
        };
      case 'normalize':
        return {
          ...p,
          pressures: Array(nodeCount).fill(1.0),
        };
      case 'taper': {
        const pressures = Array(nodeCount).fill(1.0).map((_, i) => {
          if (nodeCount <= 2) {
            return i === 0 ? 0.2 : 1.0;
          }
          const t = i / (nodeCount - 1);
          return Math.max(0.15, Math.sin(t * Math.PI));
        });
        return {
          ...p,
          pressures,
        };
      }
    }
  });
}

/**
 * Generate Procedural Manga Focus Lines (集中線)
 */
export function generateVectorFocusLines(
  center: Point,
  canvasW: number,
  canvasH: number,
  config: FocusLineConfig
): VPath[] {
  const { count, innerRadiusRatio, outerRadiusRatio, strokeWidth, taper, jitter } = config;
  const maxDim = Math.max(canvasW, canvasH);
  const minDim = Math.min(canvasW, canvasH);

  const baseInnerR = minDim * innerRadiusRatio;
  const baseOuterR = maxDim * outerRadiusRatio;

  const result: VPath[] = [];

  for (let i = 0; i < count; i++) {
    const baseAngle = (i / count) * Math.PI * 2;
    const angleJitter = (Math.random() - 0.5) * (jitter * 0.08);
    const angle = baseAngle + angleJitter;

    const rInner = Math.max(10, baseInnerR * (1 + (Math.random() - 0.5) * jitter * 0.5));
    const rOuter = baseOuterR * (1 + (Math.random() - 0.5) * jitter * 0.2);

    const pStart = {
      x: center.x + Math.cos(angle) * rInner,
      y: center.y + Math.sin(angle) * rInner,
    };
    const pEnd = {
      x: center.x + Math.cos(angle) * rOuter,
      y: center.y + Math.sin(angle) * rOuter,
    };

    const width = strokeWidth * (0.8 + Math.random() * 0.6);

    result.push({
      id: crypto.randomUUID(),
      nodes: [
        { pos: pStart, smooth: false },
        { pos: pEnd, smooth: false },
      ],
      closed: false,
      strokeColor: '#000000',
      strokeWidth: width,
      pressures: taper ? [0.15, 1.3] : [1.0, 1.0], // Thicker at outside, sharp point at inside
      fillColor: 'none',
      opacity: 1.0,
      brushType: 'pen',
      createdAt: Date.now(),
    });
  }

  return result;
}

/**
 * Generate Procedural Manga Speed Lines (流線)
 */
export function generateVectorSpeedLines(
  canvasW: number,
  canvasH: number,
  config: SpeedLineConfig
): VPath[] {
  const { count, angle, length, strokeWidth, jitter, taper } = config;
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const perpCos = -sin;
  const perpSin = cos;

  const diag = Math.sqrt(canvasW * canvasW + canvasH * canvasH);
  const result: VPath[] = [];

  for (let i = 0; i < count; i++) {
    // Distribute randomly or evenly across perpendicular axis
    const t = (i / Math.max(1, count - 1) - 0.5) * diag * 0.95;
    const perpOffset = t + (Math.random() - 0.5) * jitter * 40;

    // Center along parallel axis with jitter
    const paraOffset = (Math.random() - 0.5) * diag * 0.5;

    const midX = canvasW / 2 + perpCos * perpOffset + cos * paraOffset;
    const midY = canvasH / 2 + perpSin * perpOffset + sin * paraOffset;

    const actualLen = length * (0.6 + Math.random() * 0.8);
    const halfLen = actualLen / 2;

    const pStart = {
      x: midX - cos * halfLen,
      y: midY - sin * halfLen,
    };
    const pEnd = {
      x: midX + cos * halfLen,
      y: midY + sin * halfLen,
    };

    result.push({
      id: crypto.randomUUID(),
      nodes: [
        { pos: pStart, smooth: false },
        { pos: pEnd, smooth: false },
      ],
      closed: false,
      strokeColor: '#000000',
      strokeWidth: strokeWidth * (0.7 + Math.random() * 0.6),
      pressures: taper ? [0.2, 1.0] : [1.0, 1.0],
      fillColor: 'none',
      opacity: 0.95,
      brushType: 'pen',
      createdAt: Date.now(),
    });
  }

  return result;
}

/**
 * Generate Procedural Burst Flash / Impact Lines (ウニフラ / ベタフラ)
 */
export function generateVectorBurstLines(
  center: Point,
  config: BurstLineConfig
): VPath {
  const { count, innerRadius, outerRadius, strokeWidth, raggedness } = config;
  const nodes: VNode[] = [];

  const totalPoints = count * 2;
  for (let i = 0; i < totalPoints; i++) {
    const angle = (i / totalPoints) * Math.PI * 2;
    const isOuter = i % 2 === 1;

    let r = isOuter ? outerRadius : innerRadius;
    const j = (Math.random() - 0.5) * raggedness * (isOuter ? 30 : 15);
    r = Math.max(5, r + j);

    nodes.push({
      pos: {
        x: center.x + Math.cos(angle) * r,
        y: center.y + Math.sin(angle) * r,
      },
      smooth: false,
    });
  }

  return {
    id: crypto.randomUUID(),
    nodes,
    closed: true,
    strokeColor: '#000000',
    strokeWidth,
    fillColor: '#ffffff',
    opacity: 1.0,
    brushType: 'pen',
    createdAt: Date.now(),
  };
}

/**
 * Offsets all paths and guides in a document by (dx, dy).
 * Used when expanding or resizing canvas while keeping existing drawings centered.
 */
export function offsetDocumentContent(doc: Document, dx: number, dy: number): Document {
  if (dx === 0 && dy === 0) return doc;

  const txPt = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy });

  const newLayers = doc.layers.map(layer => ({
    ...layer,
    paths: layer.paths.map(path => {
      const newNodes = path.nodes.map(n => ({
        ...n,
        pos: txPt(n.pos),
        cpIn: n.cpIn ? txPt(n.cpIn) : undefined,
        cpOut: n.cpOut ? txPt(n.cpOut) : undefined,
      }));

      const newBalloon = path.balloon
        ? {
            ...path.balloon,
            tailPos: path.balloon.tailPos ? txPt(path.balloon.tailPos) : path.balloon.tailPos,
          }
        : undefined;

      return {
        ...path,
        nodes: newNodes,
        balloon: newBalloon,
      };
    }),
  }));

  const newSymmetryCenter = txPt(doc.symmetryCenter);
  const newPerspective = {
    ...doc.perspective,
    vanishingPoints: doc.perspective.vanishingPoints.map(txPt),
    horizonY: doc.perspective.horizonY + dy,
  };

  return {
    ...doc,
    layers: newLayers,
    symmetryCenter: newSymmetryCenter,
    perspective: newPerspective,
  };
}
