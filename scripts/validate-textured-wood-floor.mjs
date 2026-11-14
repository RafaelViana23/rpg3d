import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const T=await server.ssrLoadModule('three');
 const {createCityWoodFloorGeometry}=await server.ssrLoadModule('/src/editor/CityWoodFloor.ts');
 const {createMedievalBuilding}=await server.ssrLoadModule('/src/editor/MedievalBuildings.ts');
 const geometry=createCityWoodFloorGeometry();geometry.computeBoundingBox();const size=geometry.boundingBox.getSize(new T.Vector3());assert.equal(geometry.index.count/3,12);assert(Math.abs(size.x-1)<1e-6&&Math.abs(size.y-.085)<1e-6&&Math.abs(size.z-.998)<1e-6);assert(Math.abs(geometry.boundingBox.min.y)<1e-6);
 const uv=geometry.attributes.uv;for(let face=0;face<6;face++)if(face!==2)for(let i=face*4;i<face*4+4;i++){assert(Math.abs(uv.getX(i)-.05)<1e-6);assert(Math.abs(uv.getY(i)-.95)<1e-6);}
 const pattern=JSON.parse(await readFile('artifacts/floor-comparison/plank-layout.json','utf8'));assert.equal(pattern.length,8);assert.equal(new Set(pattern.map(p=>p.min[2].toFixed(3))).size,5);
 for(const kind of ['house','shop','weapons','potions','inn','tavern']){
  const building=createMedievalBuilding(kind),before=JSON.stringify(building.userData.woodFloorSurfaces),tiles=[];
  for(const [x0,z0,x1,z1,top]of building.userData.woodFloorSurfaces){const cols=Math.ceil((x1-x0)/2),rows=Math.ceil((z1-z0)/2);for(let row=0;row<rows;row++)for(let col=0;col<cols;col++)tiles.push({x:x0+(col+.5)*(x1-x0)/cols,z:z0+(row+.5)*(z1-z0)/rows,width:(x1-x0)/cols,depth:(z1-z0)/rows,top});}
  const instances=new T.InstancedMesh(geometry,new T.MeshLambertMaterial(),tiles.length),matrix=new T.Matrix4(),rotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI/2);
  tiles.forEach((tile,i)=>{matrix.compose(new T.Vector3(tile.x,tile.top-.08,tile.z),rotation,new T.Vector3(tile.depth,.08/.085,tile.width/.998));instances.setMatrixAt(i,matrix);});instances.updateMatrixWorld(true);
  for(const tile of tiles){const ray=new T.Raycaster(new T.Vector3(tile.x,tile.top+.05,tile.z),new T.Vector3(0,-1,0),0,.1);const hits=ray.intersectObject(instances);assert(hits.some(hit=>Math.abs(hit.point.y-tile.top)<1e-5),'Every floor tile keeps its exact walking height');}
  if(kind==='inn')for(const top of [5,10]){const ray=new T.Raycaster(new T.Vector3(top===5?20.5:17.5,top+.1,0),new T.Vector3(0,-1,0),0,.2);assert.equal(ray.intersectObject(instances).length,0,'Open stairwell remains uncovered');}
  assert.equal(JSON.stringify(building.userData.woodFloorSurfaces),before);console.log(`${kind}: ${tiles.length} modules, ${tiles.length*108} → ${tiles.length*12} triangles; floor height and openings preserved.`);
 }
}finally{await server.close();}
