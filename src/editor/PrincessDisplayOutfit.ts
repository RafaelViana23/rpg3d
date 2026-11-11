import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DEFAULT_CONFIG, ProceduralCharacter } from '../character';
import { dressCitizen } from './CitizenOutfits';
let template:T.BufferGeometry|undefined;
/** Freeze the actual princess dress, including fitted shirt, straight skirt and puff sleeves. */
export function princessDisplayOutfit(){
 if(!template){
  const actor=new ProceduralCharacter({...DEFAULT_CONFIG,body:'feminino'});
  actor.setChibi(true);actor.setClothing('shirt',true);actor.equipRightHand('nenhum');actor.equipLeftHand('nenhum');
  dressCitizen(actor,{id:'display-princess',name:'Alice',gender:'mulher',role:'princesa',homeId:'',workId:'',post:0});
  actor.group.updateMatrixWorld(true);
  const torso=actor.group.getObjectByName('bodySkin.torso') as T.Mesh;
  const shirt=Array.isArray(torso.material)?torso.material[0]:torso.material;
  const parts:T.BufferGeometry[]=[];
  actor.group.traverseVisible(object=>{
   if(!(object instanceof T.Mesh))return;
   let costume=false,parent:T.Object3D|null=object;
   while(parent){if(parent.name==='CitizenOutfit'){costume=true;break;}parent=parent.parent;}
   if(!costume&&object!==torso&&object.material!==shirt)return;
   const source=object.geometry.clone();
   if(object instanceof T.SkinnedMesh){
    object.skeleton.update();
    const positions=source.getAttribute('position'),point=new T.Vector3();
    for(let i=0;i<positions.count;i++){object.getVertexPosition(i,point);positions.setXYZ(i,point.x,point.y,point.z);}
   }
   source.applyMatrix4(object.matrixWorld);source.deleteAttribute('skinIndex');source.deleteAttribute('skinWeight');
   // Normalize attributes so cloth lofts and the body mesh merge into one static draw.
   for(const name of Object.keys(source.attributes))if(!['position','normal'].includes(name))source.deleteAttribute(name);
   source.clearGroups();const geometry=source.index?source.toNonIndexed():source;if(geometry!==source)source.dispose();parts.push(geometry);
  });
  template=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());
  template.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(template.getAttribute('position').count*2),2));
  template.computeVertexNormals();template.scale(1.2,1.2,1.2);template.translate(0,.12,0);
 }
 return template.clone();
}
