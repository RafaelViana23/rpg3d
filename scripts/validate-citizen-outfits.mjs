import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {Group,Vector3}=await server.ssrLoadModule('three');
 const {createCityPopulation}=await server.ssrLoadModule('/src/editor/CityPopulation.ts');
 const {ProceduralCharacter,DEFAULT_CONFIG}=await server.ssrLoadModule('/src/character.ts');
 const {dressCitizen,clearCitizenOutfit}=await server.ssrLoadModule('/src/editor/CitizenOutfits.ts');
 const buildings=new Map();
 for(const [id,kind] of [...Array.from({length:146},(_,i)=>[`home-${i}`,'house']),['church','church']]){const g=new Group();g.name=`Cidade:${kind}`;buildings.set(id,g);}
 const population=createCityPopulation(buildings),nuns=population.filter(c=>c.role==='freira');
 assert.equal(population.length,146);assert.equal(nuns.length,4);
 for(const c of nuns){assert.equal(c.gender,'mulher');assert.equal(c.workId,'church');}
 assert.equal(new Set(nuns.map(c=>c.post)).size,4);
 for(const role of ['rei','rainha','princesa','padre','freira','armeiro','lojista','guilda','cavalarico','morador','empregada-real']){
  const actor=new ProceduralCharacter({...DEFAULT_CONFIG,body:['rainha','princesa','freira','empregada-real'].includes(role)?'feminino':'masculino'});
  actor.setChibi(true);
  dressCitizen(actor,{...population[0],role,gender:['rainha','princesa','freira','empregada-real'].includes(role)?'mulher':'homem'});
  assert(actor.group.getObjectByName('CitizenOutfit'));actor.setAnimation('walk');actor.update(.1);
  actor.group.traverse(o=>{if(o.isMesh)assert(o.position.toArray().every(Number.isFinite));});
  if(role==='rainha'||role==='princesa'){
    for(const side of ['L','R']){
      assert(actor.group.getObjectByName(`Manga bufante ${side}`));
      const arm=actor.group.getObjectByName(`bodySkin.arm.${side}`);
      assert.equal(arm.material[0].color.getHexString(),DEFAULT_CONFIG.skin.slice(1));
    }
  }
  if(['rainha','princesa','freira','empregada-real','padre','guilda'].includes(role)){
    const dress=actor.group.getObjectByName(role==='rainha'?'Vestido articulado da rainha':role==='padre'||role==='guilda'?'Saia articulada da túnica':'Saia fina do vestido');
    assert(dress?.isSkinnedMesh,'Vestido deve acompanhar o esqueleto');
    const positions=dress.geometry.getAttribute('position');
    let index=0;for(let i=1;i<positions.count;i++)if(positions.getY(i)<positions.getY(index))index=i;
    actor.group.updateMatrixWorld(true);dress.skeleton.update();
    const before=dress.getVertexPosition(index,new Vector3()).clone();
    actor.group.getObjectByName('Shin_L').rotation.x+=.7;
    actor.group.getObjectByName('Shin_R').rotation.x+=.7;
    actor.group.updateMatrixWorld(true);dress.skeleton.update();
    assert(before.distanceTo(dress.getVertexPosition(index,new Vector3()))>.05,'Barra deve dobrar com os joelhos');
  }
  clearCitizenOutfit(actor);assert.equal(actor.group.getObjectByName('CitizenOutfit'),undefined);
 }
 console.log('Quatro freiras mulheres na igreja; roupas por função, animação e limpeza do pool validadas.');
}finally{await server.close();}
