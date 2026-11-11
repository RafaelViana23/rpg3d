type RidgePoint = readonly [x: number, z: number, height: number, width: number];

// A connected ridge skeleton gives the range a readable silhouette and valleys.
const RIDGES: RidgePoint[][] = [
  [[-1170,-850,105,250],[-960,-875,165,280],[-760,-820,252,285],[-560,-925,202,265],[-355,-790,238,260],[-140,-830,135,235]],
  [[-220,-865,120,225],[20,-745,174,255],[235,-825,250,285],[445,-735,282,295],[660,-690,192,270],[825,-510,48,210]],
  [[-960,-875,165,240],[-990,-650,112,220],[-1080,-390,55,210],[-1160,-120,10,190]],
  [[-760,-820,252,240],[-835,-655,132,210],[-710,-500,50,190],[-770,-340,0,165]],
  [[-355,-790,238,230],[-440,-655,124,210],[-350,-510,35,190],[-395,-350,0,170]],
  [[235,-825,250,230],[160,-650,135,210],[260,-485,35,190],[180,-325,0,160]],
  [[445,-735,282,240],[560,-555,112,210],[485,-380,22,180],[580,-255,0,155]],
];

function smoothstep(a: number, b: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function mountainReliefAt(x: number, z: number) {
  if (z > 80 || z < -1450 || x < -1500 || x > 1150) return 0;
  const wx = x + Math.sin(z / 165 + Math.cos(x / 260)) * 17;
  const wz = z + Math.sin(x / 185 + Math.cos(z / 210)) * 14;
  let relief = 0;
  for (const ridge of RIDGES) for (let i = 1; i < ridge.length; i++) {
    const [ax, az, ah, aw] = ridge[i - 1], [bx, bz, bh, bw] = ridge[i];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((wx - ax) * dx + (wz - az) * dz) / (dx * dx + dz * dz)));
    const distance = Math.hypot(wx - ax - dx * t, wz - az - dz * t);
    const width = aw + (bw - aw) * t, height = ah + (bh - ah) * t;
    const profile = Math.pow(Math.max(0, 1 - distance / width), 1.35);
    relief = Math.max(relief, height * profile);
  }
  // Small folds enrich the faces without turning every sample into a spike.
  const folds = Math.sin(wx * .037 + wz * .016) * Math.cos(wz * .031 - wx * .011);
  return Math.max(0, relief + folds * 9 * smoothstep(5, 100, relief));
}
