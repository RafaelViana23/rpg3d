type Point = readonly [number, number];

// World-space outlines matching the approved map reference:
// gray mountains across the north-west, white snow in the north-east,
// green grass in the center, and a beige beach along the south coast.
// The outer vertices extend beyond the playable island so the regions close
// cleanly at the map boundary.
const SNOW: Point[] = [
  // The snowy pair begins immediately after the western gray range and stays
  // in the background, matching the supplied composition reference.
  [340,-1400],[1400,-1400],[1400,-285],[1230,-305],[1060,-325],
  [890,-350],[720,-372],[570,-392],[450,-425],[370,-500],[320,-650],
];
// The range occupies the back/north edge of the existing island.  It stays
// clear of the capital, lake and southern beach, while overlapping SNOW so
// the same continuous terrain can acquire snowy summits on the cold side.
const MOUNTAIN: Point[] = [[-1400,-1400],[1400,-1400],[1400,-360],[1040,-300],[760,-390],[520,-330],[300,-430],[80,-390],[-180,-440],[-430,-350],[-720,-390],[-980,-250],[-1220,-170],[-1400,-160]];
const GRASS: Point[] = [[-1400,-180],[-1040,-260],[-790,-500],[-520,-430],[-220,-480],[210,-650],[330,-330],[520,-150],[760,-30],[1010,20],[1400,-40],[1400,560],[1040,700],[650,650],[260,590],[-120,610],[-500,560],[-850,470],[-1160,300],[-1400,220]];
// Beach is only the lower coastal band; the rest of the island stays grass.
const SAND: Point[] = [[-1400,520],[1400,520],[1400,1400],[-1400,1400]];

function polygonWeight(x: number, z: number, polygon: Point[], blendWidth = 24) {
  let inside = false, distance = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, az] = polygon[j], [bx, bz] = polygon[i];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    distance = Math.min(distance, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  const t = Math.max(0, Math.min(1, ((inside ? distance : -distance) + blendWidth) / (blendWidth * 2)));
  return t * t * (3 - 2 * t);
}

export function arenaTerrainFillAt(x: number, z: number) {
  const mountain = polygonWeight(x,z,MOUNTAIN,72);
  const snow = polygonWeight(x, z, SNOW), sand = polygonWeight(x, z, SAND), grass = polygonWeight(x, z, GRASS);
  const sum = snow + sand + grass, divisor = sum || 1;
  return {
    mountain,
    snowMountainCap: mountain * snow,
    snow: snow / divisor,
    sand: sand / divisor,
    grass: grass / divisor,
    coverage: Math.min(1, sum),
  };
}
