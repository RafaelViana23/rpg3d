import * as T from "three";

/** Procedural recreation of the CC0 low-poly medieval dirt path tile. */
export function createCityDirtPath(width = 1, length = 2) {
  const root = new T.Group();
  root.name = "CityDirtPath";

  const positions: number[] = [], indices: number[] = [], colors: number[] = [];
  const rows = 8, cols = 4;
  const color = new T.Color();
  for (let z = 0; z <= rows; z++) for (let x = 0; x <= cols; x++) {
    const u = x / cols, v = z / rows;
    const edge = Math.min(u, 1 - u);
    const wobble = Math.sin(v * 17.0 + u * 5.0) * .018 + Math.sin(v * 31.0) * .009;
    const y = -.018 + wobble + (edge < .16 ? -.018 * (1 - edge / .16) : 0);
    positions.push((u - .5) * width, y, (v - .5) * length);
    color.setHSL(.075 + (Math.sin(x * 9 + z * 3) * .008), .34, .30 + .055 * ((x * 13 + z * 7) % 5) / 4);
    colors.push(color.r, color.g, color.b);
  }
  for (let z = 0; z < rows; z++) for (let x = 0; x < cols; x++) {
    const a = z * (cols + 1) + x, b = a + 1, c = a + cols + 1, d = c + 1;
    if ((x + z) % 2) indices.push(a, b, c, b, d, c); else indices.push(a, b, d, a, d, c);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  root.add(new T.Mesh(geometry, new T.MeshLambertMaterial({vertexColors:true, flatShading:true})).translateY(.02));
  return root;
}
