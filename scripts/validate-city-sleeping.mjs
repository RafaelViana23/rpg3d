import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const T=await server.ssrLoadModule('three');
 const {CitySleeping,cityBedAnchor}=await server.ssrLoadModule('/src/editor/CitySleeping.ts');
 const {ProceduralCharacter,DEFAULT_CONFIG}=await server.ssrLoadModule('/src/character.ts');
 const sleeping=new CitySleeping(),scene=new T.Scene(),size=new T.Vector3(1.974,1.19,1.274);
 const actor=new ProceduralCharacter(DEFAULT_CONFIG);actor.setChibi(true);scene.add(actor.group);
 for(const item of ['shirt','pants','boots','armor','armorPants','armorBoots','armorGloves','steelHelmet'])actor.setClothing(item,true);
 actor.setAnimation('idle');actor.update(.01);
 for(const yaw of [0,.67,-1.5])for(const scale of [[1,1,1],[.82,1.8,1.14]]){
  sleeping.restore(actor.group);actor.group.position.set(20,0,-30);actor.group.rotation.set(0,.8,0);
  const originalScale=actor.group.scale.clone(),home=new T.Group();home.position.set(5,2,-9);home.rotation.y=yaw;home.scale.fromArray(scale);scene.add(home);
  const bed=new T.Group();bed.position.set(-2,6,-4);bed.rotation.y=Math.PI*1.5;bed.scale.set(3.4/size.x,1.5/size.y,3.4/size.z);
  const anchor=cityBedAnchor(bed,size);sleeping.place(actor.group,home,anchor);
  const matrix=new T.Matrix4().multiplyMatrices(home.matrixWorld,new T.Matrix4().fromArray(anchor.matrix)),inverse=matrix.clone().invert();
  const up=new T.Vector3(0,0,1).applyQuaternion(actor.group.quaternion),vertical=new T.Vector3().setFromMatrixColumn(matrix,1).normalize();assert(up.dot(vertical)>.9999,'Face must point upward');
  const head=new T.Vector3(0,1,0).applyQuaternion(actor.group.quaternion),headboard=new T.Vector3().setFromMatrixColumn(matrix,0).normalize().negate();assert(head.dot(headboard)>.9999,'Head must point toward the pillow at negative bed X');
  let count=0;const p=new T.Vector3();
  actor.group.traverseVisible(mesh=>{
   if(!(mesh instanceof T.Mesh))return;
   for(let i=0;i<mesh.geometry.attributes.position.count;i++){
    mesh.getVertexPosition(i,p);p.applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);count++;
    assert(Math.abs(p.x)<=size.x*.42+1e-5,'Body must remain between headboard and footboard');
    assert(Math.abs(p.z)<=size.z*.41+1e-5,'Body must remain inside mattress width');
    assert(p.y>=anchor.mattressY-.2,'Only shallow cloth/hair compression may enter the mattress');
   }
  });assert(count>100);
  let contact=Infinity;
  actor.group.traverseVisible(mesh=>{
   if(!(mesh instanceof T.Mesh)||!['bodySkin.torso','equipment.armor.breastplate'].includes(mesh.name))return;
   for(let i=0;i<mesh.geometry.attributes.position.count;i++){
    mesh.getVertexPosition(i,p);p.applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);contact=Math.min(contact,p.y);
   }
  });
  assert(Math.abs(contact-anchor.mattressY)<.006,'Actual back surface must touch the mattress, not float');
  const position=actor.group.position.clone();sleeping.place(actor.group,home,anchor);assert(actor.group.position.distanceTo(position)<1e-6,'Sleep placement must not drift between frames');
  sleeping.restore(actor.group);assert(actor.group.scale.equals(originalScale),'Waking must restore original character scale');home.removeFromParent();
 }
 const {CityResidents}=await server.ssrLoadModule('/src/editor/CityResidents.ts');
 const home=new T.Group();home.name='Cidade:house';home.userData.building={width:12,depth:16,doorWidth:4};scene.add(home);
 const residents=new CityResidents(scene,new Map([['home',home]]),[]);
 const camera=new T.OrthographicCamera(-60,60,60,-60,.1,200);camera.position.set(0,0,100);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
 const samples=['guarda-torre','guarda-palacio','guarda-arqueiro','guarda-patrulha','morador','padre'].map(role=>{
  const r=residents.residents.find(r=>r.citizen.role===role),group=new T.Group();scene.add(group);group.position.set(0,0,20);
  r.actor={group};r.routine='home';r.label={style:{},classList:{toggle(name,value){this[name]=value;}}};return r;
 });
 const labels=()=>residents.updateLabels(camera,new T.Vector3(),{clientWidth:800,clientHeight:600});labels();
 for(const r of samples)assert.equal(r.label.classList.visible,r.citizen.role==='padre','Guard names must use the same short radius as common NPCs');
 for(const r of samples)r.actor.group.position.z=10;labels();for(const r of samples)assert(r.label.classList.visible);
 samples[0].routine='sleep';labels();assert(!samples[0].label.classList.visible,'Sleeping residents must not show floating name labels');
 console.log('Nomes das quatro patentes limitados ao raio dos NPCs comuns; nomes ocultos ao dormir.');
 console.log('Corpo real dentro do colchão, cabeça na cabeceira, rosto para cima, casas rotacionadas/escaladas, posição estável e escala restaurada ao acordar validados.');
}finally{await server.close();}
