type RidgePoint = readonly [x: number, z: number, height: number, width: number];

// A connected ridge skeleton gives the range a readable silhouette and valleys.
const RIDGES: RidgePoint[][] = [
  [[-1170,-850,105,250],[-960,-875,165,280],[-760,-820,252,285],[-560,-925,202,265],[-355,-790,238,260],[-140,-830,135,235]],
  [[-220,-865,120,225],[20,-745,174,255],[235,-825,250,285],[445,-735,282,295],[590,-610,0,190]],
  [[-960,-875,165,240],[-990,-650,112,220],[-1080,-390,55,210],[-1160,-120,10,190]],
  [[-760,-820,252,240],[-835,-655,132,210],[-710,-500,50,190],[-770,-340,0,165]],
  [[-355,-790,238,230],[-440,-655,124,210],[-350,-510,35,190],[-395,-350,0,170]],
  [[235,-825,250,230],[160,-650,135,210],[260,-485,35,190],[180,-325,0,160]],
  [[445,-735,282,240],[560,-555,112,210],[485,-380,22,180],[580,-255,0,155]],
  // The second snow peak is close to the first, but slightly forward. Its
  // shoulders preserve a natural entrance without leaving an isolated mass.
  [[610,-540,0,155],[775,-485,178,210],[990,-520,0,175]],
];

// Broad, low corridors subtract from the ridge field.  They produce readable
// passes instead of a single solid wall, and remain wide enough for gameplay.
const PASSES: readonly (readonly [number,number,number,number,number])[] = [
  // Broad green corridor in the middle of the four-mountain composition.
  [35,-315,125,-930,105],
  [-610,-330,-520,-930,34],
  // Wide, walkable approach on the left flank of the remaining snow peak.
  [300,-285,365,-825,70],
  // Walkable entrance between the two eastern snow mountains.
  [640,-255,675,-925,72],
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
  let passWeight=0;
  for(const [ax,az,bx,bz,width] of PASSES){
    const dx=bx-ax,dz=bz-az;
    const t=Math.max(0,Math.min(1,((wx-ax)*dx+(wz-az)*dz)/(dx*dx+dz*dz)));
    const distance=Math.hypot(wx-ax-dx*t,wz-az-dz*t);
    passWeight=Math.max(passWeight,1-smoothstep(width,width*2.8,distance));
  }
  const foothill=smoothstep(0,38,relief);
  const carved=relief*(1-passWeight*.72);
  return Math.max(0,carved+folds*8*foothill*(1-passWeight*.55));
}

export function mountainSlopeAt(x:number,z:number,step=3){
  const dx=(mountainReliefAt(x+step,z)-mountainReliefAt(x-step,z))/(step*2);
  const dz=(mountainReliefAt(x,z+step)-mountainReliefAt(x,z-step))/(step*2);
  return Math.hypot(dx,dz);
}
