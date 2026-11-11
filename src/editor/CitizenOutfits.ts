import { createSmoothClothMaterial } from '../inventory/clothMaterial';
import * as THREE from 'three';
import type { ProceduralCharacter } from '../character';
import type { Citizen } from './CityPopulation';

/** Costume pieces live on the rig so they follow walking, sitting and head turns. */
export function dressCitizen(actor:ProceduralCharacter,citizen:Citizen){
  actor.setClothing('belt',false);
  if(citizen.role.startsWith('guarda-'))return;
  const role=citizen.role,female=citizen.gender==='mulher';
  const royal=['rei','rainha','princesa'].includes(role),clergy=role==='padre'||role==='freira';
  const color=role==='empregada-real'?'#17171b':role==='cozinheiro-real'?'#e9e3d4':role==='rei'?'#8d2433':role==='rainha'||role==='guilda'?'#254b86':role==='princesa'?'#c66698':clergy?'#242329':role==='armeiro'?'#67452f':role==='cavalarico'?'#746044':role==='lojista'?'#3e5137':female?'#586443':'#687052';
  if(female){actor.setClothing('pants',false);actor.setClothing('boots',false);actor.setClothing('gloves',false);actor.setClothing('armorGloves',false);}
  actor.setCivilianClothingColor(female||clergy||royal?color:'#e4d5b8',female);
  const roots:THREE.Object3D[]=[];
  const root=(bone:string)=>{const g=new THREE.Group();g.name='CitizenOutfit';actor.group.getObjectByName(bone)!.add(g);roots.push(g);return g;};
  if(female){
    const shoeColor = role==='rainha'||role==='princesa' ? '#f4f1e8' : '#4a2818';
    // Reuse only the rigged foot surface. The calf retains its skin material,
    // so these shoes stop at the heel/ankle instead of forming a boot shaft.
    for(const side of ['L','R']){
      const foot=actor.group.getObjectByName(`bodySkin.foot.${side}`);
      if(!(foot instanceof THREE.SkinnedMesh))continue;
      const shoe=foot.clone();shoe.name='CitizenOutfit';
      shoe.geometry=foot.geometry.clone();
      const positions=shoe.geometry.getAttribute('position');
      const bounds=new THREE.Box3().setFromBufferAttribute(positions as THREE.BufferAttribute);
      const center=bounds.getCenter(new THREE.Vector3());
      for(let i=0;i<positions.count;i++)positions.setXYZ(i,
        center.x+(positions.getX(i)-center.x)*1.045,
        center.y+(positions.getY(i)-center.y)*1.035,
        center.z+(positions.getZ(i)-center.z)*1.045);
      shoe.geometry.computeVertexNormals();
      shoe.material=new THREE.MeshStandardMaterial({color:shoeColor,roughness:.72,metalness:0,flatShading:true,side:THREE.DoubleSide});
      // Own the skeleton wrapper for cleanup while keeping the original leg bones.
      shoe.skeleton=foot.skeleton.clone();
      shoe.userData={citizenShoe:true,color:shoeColor,style:'low'};
      shoe.castShadow=shoe.receiveShadow=true;
      foot.parent!.add(shoe);roots.push(shoe);
    }
  }
  const hips=root('Hips'),chest=root('Chest');
  const fabric=(c:string)=>new THREE.MeshStandardMaterial({color:c,roughness:.88});
  const cloth=female||clergy||role==='guilda'?createSmoothClothMaterial(color):fabric(color),cream=fabric('#eee4d0'),gold=new THREE.MeshStandardMaterial({color:'#d8b04e',metalness:.65,roughness:.35});
  const add=(g:THREE.Group,geo:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;g.add(m);return m;};
  const box=(g:THREE.Group,w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material)=>add(g,new THREE.BoxGeometry(w,h,d),m,x,y,z);
  if(role==='princesa'||role==='rainha'||role==='empregada-real'){
    actor.setCivilianSleevesVisible(false);
    for(const side of ['L','R']){
      const puff=add(root(`UpperArm_${side}`),new THREE.IcosahedronGeometry(.21,1),role==='empregada-real'?fabric('#f2eee4'):cloth,0,-.08,0);
      puff.name=`Manga bufante ${side}`;puff.scale.set(1.05,1,.95);
    }
  }
  // Open neckline; the shirt underneath supplies the sleeves and collar.
  if(!female){
  const vest=add(chest,new THREE.CylinderGeometry(.34,royal?.36:.30,royal?.68:.47,12,1,true),cloth,0,royal?-.245:-.14,0);vest.scale.z=.77;
  }
  if(royal&&!female){
    // Overlap the shirt at the hips to keep the waist covered when seated.
    const waist=add(hips,new THREE.CylinderGeometry(.35,.39,.30,12,1,true),cloth,0,.22,0);
    waist.scale.z=.77;
  }
  const long=female||clergy||role==='guilda';
  if(long){
    actor.setClothing('skirt',false);
    if(female){
      // Underwear is covered by the dress; omit the hidden mesh to avoid clipping.
      const underwear=actor.group.getObjectByName('equipment.underwear');
      if(underwear)underwear.visible=false;
      cloth.side=THREE.DoubleSide;
      cloth.roughness=.78;cloth.flatShading=true;
      // One thin surface: its upper rings meet the fitted shirt at the waist.
      const lining=new THREE.LatheGeometry([
        new THREE.Vector2(.46,-.94),new THREE.Vector2(.455,-.80),
        new THREE.Vector2(.45,-.64),new THREE.Vector2(.445,-.48),
        new THREE.Vector2(.44,-.32),new THREE.Vector2(.425,-.12),
        new THREE.Vector2(.39,.04),new THREE.Vector2(.285,.14),
        new THREE.Vector2(.26,.24),
      ],18).scale(1,1,.68);
      if(role==='empregada-real'||role==='princesa'){
        const positions=lining.getAttribute('position');
        // Keep the waist fixed and bring the hem up to the knee.
        const waist=.24,hem=-.94,knee=-.50;
        for(let i=0;i<positions.count;i++)positions.setY(i,waist+(positions.getY(i)-waist)*(waist-knee)/(waist-hem));
        lining.computeVertexNormals();
      }
      if(role==='rainha')addFoldingDress(actor,hips,lining,cloth);
      else{
        const skirt=addFoldingDress(actor,hips,lining,cloth);skirt.name='Saia fina do vestido';
      }
    }else{
      const skirtGeometry=new THREE.CylinderGeometry(.38,.53,1.08,16,10,true);skirtGeometry.scale(1,1,.72);skirtGeometry.translate(0,-.40,0);
      addFoldingDress(actor,hips,skirtGeometry,cloth).name='Saia articulada da túnica';
      const hemGeometry=new THREE.CylinderGeometry(.526,.535,.055,16,1,true);hemGeometry.scale(1,1,.72);hemGeometry.translate(0,-.91,0);
      addFoldingDress(actor,hips,hemGeometry,role==='guilda'?gold:cream).name='Barra articulada da túnica';
    }
  }
  if(role==='cozinheiro-real'){
    if(!female)addSmoothApron(actor,hips,false,false);
    const hat=new THREE.Group();hat.name='CitizenOutfit';actor.attachHeadAccessory(hat);roots.push(hat);add(hat,new THREE.CylinderGeometry(.25,.28,.25,10),cream,0,2.86,0);
  }
  if(royal||role==='guilda'){
    // The guild keeps its mantle; royal shirts have no cape.
    if(!royal)box(chest,.81,1.35,.08,0,-.48,-.25,cloth);
    if(!royal)for(const side of [-1,1])box(chest,.055,.56,.045,side*.28,-.12,.26,gold);
    if(!royal)box(chest,.77,.10,.38,0,.12,0,gold);
    if(female&&!royal){
      const panel=add(hips,new THREE.CylinderGeometry(.16,.29,1.0,4,1,true,Math.PI*.25,Math.PI*.5),cream,0,-.4,.13);panel.scale.z=.8;
    }
  }else if(clergy){
    box(chest,.28,.09,.34,0,.15,0,cream);
    if(role==='padre')for(const side of [-1,1]){
      box(chest,.13,.64,.045,side*.20,-.17,.275,fabric('#77449b'));
      box(hips,.13,.52,.045,side*.20,-.20,.32,fabric('#77449b'));
    }
    box(chest,.018,.30,.025,0,-.04,.30,gold);
    box(chest,.045,.20,.04,0,-.26,.32,gold);box(chest,.14,.04,.04,0,-.23,.32,gold);
  }else{
    if(role==='armeiro'&&!female)addSmoothApron(actor,hips,false,false);

  }
  const hat=role==='freira'||role==='cavalarico'||role==='lojista';
  if(hat){
    const head=new THREE.Group();head.name='CitizenOutfit';actor.attachHeadAccessory(head);roots.push(head);
    if(role==='freira'){
      actor.setHoodHairHidden(true);
      box(head,.63,.10,.54,0,2.73,0,cream);
      for(const side of [-1,1])box(head,.10,.64,.46,side*.29,2.43,-.04,cream);
      box(head,.59,.70,.10,0,2.39,-.25,cloth);
      box(head,.40,.14,.10,0,2.15,.21,cream);
    }else if(!royal){
      const brim=add(head,new THREE.CylinderGeometry(.52,.52,.06,12),cloth,0,2.73,0);brim.scale.z=.85;
      add(head,new THREE.CylinderGeometry(.29,.36,.20,10),cloth,0,2.84,0);

    }
  }
  actor.group.userData.citizenOutfit={role,palette:color};
}

export function clearCitizenOutfit(actor:ProceduralCharacter){
  const roots:THREE.Object3D[]=[];
  actor.group.traverse(o=>{if(o.name==='CitizenOutfit')roots.push(o);});
  const materials=new Set<THREE.Material>();
  for(const root of roots){root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();if(o instanceof THREE.SkinnedMesh)o.skeleton.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});root.removeFromParent();}
  materials.forEach(m=>m.dispose());
}

/** Continuous cloth surface weighted across the hips, thighs and knees. */
function addFoldingDress(actor:ProceduralCharacter,parent:THREE.Group,geometry:THREE.BufferGeometry,material:THREE.Material){
  const bones=['Hips','Thigh_L','Thigh_R','Shin_L','Shin_R'].map(name=>actor.group.getObjectByName(name) as THREE.Bone);
  const indices:number[]=[],weights:number[]=[],positions=geometry.getAttribute('position');
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i);
    const left=THREE.MathUtils.clamp(.5-x/.42,0,1);
    const hip=THREE.MathUtils.smoothstep(y,-.20,.12);
    const knee=1-THREE.MathUtils.smoothstep(y,-.64,-.36);
    // Four influences per vertex; upper rings join the waist, lower rings bend at the knees.
    if(hip>0){indices.push(0,1,2,0);weights.push(hip,(1-hip)*left,(1-hip)*(1-left),0);}
    else{indices.push(1,2,3,4);weights.push((1-knee)*left,(1-knee)*(1-left),knee*left,knee*(1-left));}
  }
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const mesh=new THREE.SkinnedMesh(geometry,material);mesh.name='Vestido articulado da rainha';
  mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);
  actor.group.updateMatrixWorld(true);mesh.bind(new THREE.Skeleton(bones));
  mesh.frustumCulled=false;
  return mesh;
}

/** A single thin sheet on the front of the rig, using the cape's cloth material. */
function addSmoothApron(actor:ProceduralCharacter,parent:THREE.Group,female:boolean,skirtOnly:boolean){
 const geometry=new THREE.PlaneGeometry(1,1,16,24),positions=geometry.getAttribute('position');
 const indices:number[]=[],weights:number[]=[];
 for(let i=0;i<positions.count;i++){
  const u=positions.getX(i),drop=.5-positions.getY(i),y=skirtOnly?.14-drop*.32:.84-drop*1.6;
  const width=skirtOnly?.32+drop*.10:.48+drop*.28,x=u*width;
  // Follow the shirt's rounded chest rather than hanging a flat sheet ahead of it.
  const rings=[[-.76,female?.33:.235,.46],[-.1,female?.30:.235,.39],[.14,.24,.34],[.28,female?.20:.265,.34],[.6,female?.20:.27,.34],[.75,female?.20:.27,.32],[.84,female?.19:.23,.28]];
  const index=Math.max(0,Math.min(rings.length-2,rings.findIndex((_r,j)=>j<rings.length-1&&y<=rings[j+1][0])));
  const a=rings[index],b=rings[index+1],t=THREE.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1);
  const depth=THREE.MathUtils.lerp(a[1],b[1],t),radius=THREE.MathUtils.lerp(a[2],b[2],t);
  positions.setXYZ(i,x,y,depth*Math.sqrt(Math.max(.08,1-(x/radius)**2))+.008);
  const torso=THREE.MathUtils.smoothstep(y,.1,.55);
  const legs=1-THREE.MathUtils.smoothstep(y,-.65,-.1),left=THREE.MathUtils.clamp(.5-u,0,1);
  indices.push(0,1,2,3);weights.push((1-torso)*(1-legs),torso,(1-torso)*legs*left,(1-torso)*legs*(1-left));
 }
 geometry.computeVertexNormals();
 geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
 geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
 const apron=new THREE.SkinnedMesh(geometry,createSmoothClothMaterial('#f2eee4'));apron.name='Avental branco de tecido liso';
 apron.castShadow=apron.receiveShadow=true;apron.frustumCulled=false;parent.add(apron);
 const bones=['Hips','Chest','Thigh_L','Thigh_R'].map(name=>actor.group.getObjectByName(name) as THREE.Bone);
 actor.group.updateMatrixWorld(true);apron.bind(new THREE.Skeleton(bones));
 return apron;
}
