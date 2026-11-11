type Point = readonly [number, number];

// World-space outlines traced from the annotated overview (O, X and V).
// Outer vertices extend beyond the map so the marked regions close its edges.
const MOUNTAIN: Point[] = [[-1400,-1400],[80,-1400],[-260,-850],[-300,-500],[-540,-430],[-800,-520],[-1100,25],[-1400,100]];
const SAND: Point[] = [[-1400,100],[-1100,25],[-880,-15],[-720,42],[-570,216],[-543,376],[-554,666],[-411,964],[-400,1400],[-1400,1400]];
const GRASS: Point[] = [[-800,-520],[-540,-430],[-300,-500],[-260,-850],[-136,-645],[19,-530],[264,-396],[286,-114],[390,40],[371,183],[494,317],[705,377],[903,633],[1250,950],[1250,1400],[-400,1400],[-411,964],[-554,666],[-543,376],[-570,216],[-720,42],[-880,-15],[-1100,25]];

function polygonWeight(x: number, z: number, polygon: Point[]) {
  let inside = false, distance = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, az] = polygon[j], [bx, bz] = polygon[i];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    distance = Math.min(distance, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  const t = Math.max(0, Math.min(1, ((inside ? distance : -distance) + 24) / 48));
  return t * t * (3 - 2 * t);
}

export function arenaTerrainFillAt(x: number, z: number) {
  const mountain = polygonWeight(x, z, MOUNTAIN), sand = polygonWeight(x, z, SAND), grass = polygonWeight(x, z, GRASS);
  const sum = mountain + sand + grass, divisor = sum || 1;
  return { mountain: mountain / divisor, sand: sand / divisor, grass: grass / divisor, coverage: Math.min(1, sum) };
}
