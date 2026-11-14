import {Vector2,Vector3,type Group} from 'three';
import {cityDistrictPlan,districtAt} from '../ui/CityDistricts';
export type CitizenRole='feirante'|'nobre'|'cozinheiro-real'|'empregada-real'|'empregada-pousada'|'cavalarico'|'morador'|'rei'|'rainha'|'princesa'|'padre'|'freira'|'armeiro'|'alquimista'|'taverneira'|'estalajadeira'|'atendente-pousada'|'guilda'|'guarda-torre'|'guarda-palacio'|'guarda-arqueiro'|'guarda-patrulha'|'guarda-portao'|'lojista';
export type Citizen={id:string;name:string;gender:'homem'|'mulher';role:CitizenRole;homeId:string;workId:string;post:number;parentIds?:string[];spouseId?:string;socialClass?:'nobre'|'plebeu';existingIndex?:number};
const men=["Rito","Basel","Aldren","Theron","Kael","Cedric","Alaric","Eldric","Gareth","Roland","Leoric","Osric","Hadrian","Tristan","Lucan","Dorian","Fenris","Valen","Riven","Eron","Arven","Darion","Sylas","Renald","Galen","Azren","Torin","Varyn","Aeron","Bastian","Corvin","Draven","Elric","Faelan","Galdric","Haron","Isen","Jareth","Kiran","Lorcan","Maeron","Noren","Odran","Perrin","Quirin","Rael","Soren","Taren","Ulric","Vael","Wulfric","Xaren","Yoren","Zephan","Aster","Brann","Caelan","Dain","Eirik","Faris","Gavren","Halric","Ivar","Jorin","Keldan","Lior","Morven","Nael","Orin","Rurik","Serin","Thalen","Veyron"];
const women=["Eleonor","Alice","Emma","Lifa","Lyra","Selena","Aelina","Freya","Elara","Aria","Neria","Sylvie","Yuna","Rina","Althea","Brina","Cerys","Dahlia","Eira","Faye","Gwyne","Hilda","Iris","Juna","Kyra","Liora","Mirel","Nessa","Orielle","Petra","Quilla","Rhea","Seraphina","Thalia","Undine","Vanya","Wren","Xena","Ylva","Zaira","Alys","Brynn","Celia","Delya","Elys","Fiora","Gisela","Hestia","Ilia","Jessamine","Keira","Lyria","Melia","Nyra","Ophelia","Prisca","Roswyn","Saria","Tilia","Velia","Yselle","Zelia","Amaris","Belryn","Calia","Elwyn","Isolde","Loriel","Maelis","Nerissa","Ravena","Solia","Aerin"];
/** Stable identities and ownership are independent of which character meshes are loaded. */
export function createCityPopulation(buildings:Map<string,Group>):Citizen[]{
  const entries=[...buildings.entries()].sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true}));
  const houses=entries.filter(([,b])=>b.name==='Cidade:house'&&!String(b.userData.cityLayer??'').startsWith('Vila de Valen'));
  const find=(kind:string)=>entries.find(([,b])=>b.name===`Cidade:${kind}`)?.[0]??'';
  const towers=entries.filter(([,b])=>b.name==='Cidade:tower');
  if(!houses.length)return [];
  const citizens:Citizen[]=Array.from({length:146},(_,i)=>{
    const female=i>=73,j=i%73,pool=female?women:men;
    const name=pool[j];
    return {id:`citizen-${String(i+1).padStart(3,'0')}`,name,gender:female?'mulher':'homem',role:'morador',homeId:'',workId:'',post:0,...(female&&j<3?{existingIndex:j}:{})};
  });
  const role=(index:number,value:CitizenRole,kind:string,liveAtWork=false)=>{
    const c=citizens[index];c.role=value;c.workId=find(kind);if(liveAtWork)c.homeId=c.workId;
  };
  role(0,'rei','palace',true);role(1,'padre','church');
  role(2,'armeiro','weapons',true);role(3,'alquimista','potions',true);
  role(76,'rainha','palace',true);
  role(81,'princesa','palace',true);
  [citizens[74].name,citizens[81].name]=[citizens[81].name,citizens[74].name];
  citizens[81].parentIds=[citizens[0].id,citizens[76].id];
  const palace=buildings.get(find('palace'));if(palace)palace.userData.royalFamily={kingId:citizens[0].id,queenId:citizens[76].id,daughterId:citizens[81].id};
  for(let i=0;i<4;i++){role(82+i,'freira','church');citizens[82+i].post=i;}
  role(77,'taverneira','tavern',true);
  role(78,'estalajadeira','inn',true);citizens[78].socialClass='nobre';
  if(find('inn')){role(89,'atendente-pousada','inn');citizens[89].socialClass='plebeu';}role(79,'guilda','guild');citizens[79].socialClass='nobre';citizens[79].gender='homem';citizens[79].name='Teobaldo';
  for(let i=0;i<8;i++)Object.assign(citizens[4+i],{role:'guarda-torre',workId:towers[i]?.[0]??'',post:i});
  for(let i=0;i<6;i++)Object.assign(citizens[12+i],{role:'guarda-palacio',workId:find('palace'),post:i});
  const walls=entries.filter(([,b])=>b.name==='Cidade:wall'&&b.userData.walkSurfaces?.length);
  for(let i=0;i<8;i++){
    Object.assign(citizens[18+i],{role:'guarda-arqueiro',workId:walls[Math.floor(i*walls.length/8)]?.[0]??towers[i]?.[0]??find('palace'),post:i});

  }
  for(let i=0;i<4;i++)Object.assign(citizens[26+i],{role:'guarda-patrulha',post:i});
  const gates=entries.filter(([,b])=>b.name==='Cidade:gate');
  // Reassign four patrol guards and two existing residents, preserving identities.
  [30,31,32,33,38,39].forEach((index,i)=>Object.assign(citizens[index],{role:'guarda-portao',workId:gates[Math.floor(i/2)%Math.max(1,gates.length)]?.[0]??'',post:i%2}));
  if(find('stable'))role(34,'cavalarico','stable');
  for(let i=0;i<3;i++){role(35+i,'cozinheiro-real','palace');citizens[35+i].post=i;role(86+i,'empregada-real','palace');citizens[86+i].post=i;} 
  if(find('inn'))for(let i=0;i<4;i++){role(90+i,'empregada-pousada','inn');citizens[90+i].post=i;citizens[90+i].socialClass='plebeu';}
  if(find('shop'))role(80,'lojista','shop',true);
  const available=new Map(houses);
  const avenue=entries.find(([,b])=>b.userData.royalAvenue);
  const residentialHomes=new Set<string>();
  const nobleDistrictHomes=new Set<string>();
  const commercialHomes=new Set<string>();
  if(avenue){
    const points=towers.map(([,b])=>b.getWorldPosition(new Vector3()));
    const center=points.reduce((sum,p)=>sum.add(p),new Vector3()).divideScalar(Math.max(1,points.length));
    const perimeter=points.sort((a,b)=>Math.atan2(a.z-center.z,a.x-center.x)-Math.atan2(b.z-center.z,b.x-center.x)).map(p=>new Vector2(p.x,p.z));
    const currentPlan=cityDistrictPlan(buildings.values(),perimeter);
    for(const [id,b] of houses){
      const p=b.getWorldPosition(new Vector3());
      const district=districtAt(currentPlan,p.x,p.z)?.id;
      if(district==='residential')residentialHomes.add(id);
      if(district==='commercial')commercialHomes.add(id);
      if(district==='noble')nobleDistrictHomes.add(id);
    }
    // Keep the original 32 guard homes when commercial zoning expands.
    const plan=cityDistrictPlan(buildings.values(),perimeter,40);
    const military=new Map(houses.filter(([,b])=>{const p=b.getWorldPosition(new Vector3());return districtAt(plan,p.x,p.z)?.id==='military';}));
    // Reserve a distinct military home for each guard before civilian allocation.
    for(const guard of citizens.filter(c=>c.role.startsWith('guarda-'))){
      const work=buildings.get(guard.workId);
      const nearest=[...military].sort(([,a],[,b])=>work?a.position.distanceToSquared(work.position)-b.position.distanceToSquared(work.position):0)[0];
      if(!nearest)continue;
      guard.homeId=nearest[0];military.delete(nearest[0]);available.delete(nearest[0]);
    }
  }
  // Noble homes are reserved before assigning the existing civilian population.
  for(const id of nobleDistrictHomes)available.delete(id);
  // Reserve the closest free houses for the tavern keeper, priest and guild clerk.
  for(const index of [1,79,34,82,83,84,85,35,36,37,86,87,88,90,91,92,93]){
    const c=citizens[index],work=buildings.get(c.workId);
    const residentialResident=['cozinheiro-real','empregada-real','empregada-pousada','padre','freira'].includes(c.role);
    const candidates=(c.role==='guilda'?[...houses]:[...available]).filter(([id])=>!avenue||(c.role==='guilda'?nobleDistrictHomes.has(id):!residentialResident||residentialHomes.has(id)));
    const nearest=candidates.sort(([,a],[,b])=>work?a.position.distanceToSquared(work.position)-b.position.distanceToSquared(work.position):0)[0];
    if(nearest){c.homeId=nearest[0];available.delete(nearest[0]);}
  }
  for(const c of citizens){
    if(!c.homeId){const next=(c.role==='morador'&&avenue?[...available.keys()].find(id=>residentialHomes.has(id)):available.keys().next().value) as string|undefined;c.homeId=next??houses.find(([id])=>residentialHomes.has(id))?.[0]??houses.find(([id])=>!nobleDistrictHomes.has(id))?.[0]??houses[0][0];if(next)available.delete(next);}
    if(!c.workId)c.workId=c.homeId;
  }
  if(avenue){
    const points=towers.map(([,b])=>b.getWorldPosition(new Vector3()));
    const center=points.reduce((sum,p)=>sum.add(p),new Vector3()).divideScalar(Math.max(1,points.length));
    const perimeter=points.sort((a,b)=>Math.atan2(a.z-center.z,a.x-center.x)-Math.atan2(b.z-center.z,b.x-center.x)).map(p=>new Vector2(p.x,p.z));
    const plan=cityDistrictPlan(buildings.values(),perimeter);
    const nobleHomes=houses.filter(([,b])=>{const p=b.getWorldPosition(new Vector3());return districtAt(plan,p.x,p.z)?.id==='noble';}).slice(0,25);
    const nobleMen=['Augusto','Artur','Baltasar','Clemente','Duarte','Estevao','Ferdinand','Gaspar','Henrique','Inacio','Joaquim','Lourenco','Maximilian'];
    const nobleWomen=['Adelaide','Beatriz','Carlota','Constanca','Delfina','Estela','Florentina','Gabriela','Helena','Leonor','Madalena','Valentina'];
    const husbands=['Afonso','Bernardo','Cristovao','Diogo','Eduardo','Francisco','Goncalo','Hugo','Jaime','Leonardo','Martim','Nicolau'];
    const wives=['Amelia','Benedita','Catarina','Debora','Eugenia','Filipa','Guiomar','Hortensia','Ines','Josefina','Luisa','Mariana','Natalia'];
    nobleHomes.forEach(([homeId],i)=>{
      const female=i%2===1;
      const id=`noble-${String(i+1).padStart(3,'0')}`,spouseId=`${id}-spouse`;
      citizens.push({id,name:(female?nobleWomen:nobleMen)[Math.floor(i/2)],gender:female?'mulher':'homem',role:'nobre',homeId,workId:homeId,post:i,spouseId});
      citizens.push({id:spouseId,name:(female?husbands:wives)[Math.floor(i/2)],gender:female?'homem':'mulher',role:'nobre',homeId,workId:homeId,post:i+25,spouseId:id});
      available.delete(homeId);
    });
  }
  // Remove only surplus ordinary citizens; preserve clergy, staff and existing actors.
  const housingCapacity=residentialHomes.size+commercialHomes.size;
  const reservedCount=citizens.filter(c=>['padre','freira','cozinheiro-real','empregada-real','empregada-pousada'].includes(c.role)).length;
  const surplus=Math.max(0,citizens.filter(c=>c.role==='morador').length-Math.max(0,housingCapacity-reservedCount));
  const removable=citizens.filter(c=>c.role==='morador'&&c.existingIndex===undefined);
  const removed=new Set((avenue&&surplus?removable.slice(-surplus):[]).map(c=>c.id));
  for(let i=citizens.length-1;i>=0;i--)if(removed.has(citizens[i].id))citizens.splice(i,1);
  const guildChief=citizens.find(c=>c.role==='guilda');
  if(guildChief){
    const wifeId='guild-chief-spouse';
    guildChief.spouseId=wifeId;
    citizens.push({id:wifeId,name:'Cecilia',gender:'mulher',role:'nobre',socialClass:'nobre',homeId:guildChief.homeId,workId:guildChief.homeId,post:51,spouseId:guildChief.id});
  }
  const ordinary=citizens.filter(c=>c.role==='morador');
  const targetMen=Math.floor(ordinary.length/2);
  const menCount=ordinary.filter(c=>c.gender==='homem').length;
  const newMaleNames=['Abel','Adriano','Amadeu','Anselmo','Antonio','Aureliano','Bento','Caetano'];
  if(menCount<targetMen){
    ordinary.filter(c=>c.gender==='mulher'&&c.existingIndex===undefined).slice(-(targetMen-menCount)).forEach((c,i)=>{
      c.gender='homem';c.name=newMaleNames[i]??`Abel${i+1}`;
    });
  }
  const residentialIds=houses.filter(([id])=>residentialHomes.has(id)).map(([id])=>id);
  const reserved=new Set(citizens.filter(c=>['padre','freira','cozinheiro-real','empregada-real','empregada-pousada'].includes(c.role)).map(c=>c.homeId));
  const civilianHomes=houses.filter(([id])=>(residentialHomes.has(id)||commercialHomes.has(id))&&!reserved.has(id)).map(([id])=>id);
  const plebeians=citizens.filter(c=>c.role==='morador');
  if(civilianHomes.length){
    plebeians.forEach((c,i)=>{
      c.homeId=civilianHomes[i%civilianHomes.length];
      c.workId=c.homeId;
      available.delete(c.homeId);
    });
  }
  const marketId=find('market');
  const vendorHomes=civilianHomes.length?civilianHomes:!avenue?[...new Set(plebeians.map(c=>c.homeId))]:[];
  if(marketId&&vendorHomes.length){
    const vendorNames=[['Dimas','Gregorio','Jacinto','Lazaro','Manuel','Nestor'],['Agueda','Aurora','Clarice','Dulce','Lucinda','Matilde']];
    for(let post=0;post<12;post++){
      const female=post%2===1,name=vendorNames[female?1:0][Math.floor(post/2)];
      citizens.push({id:`market-vendor-${String(post+1).padStart(2,'0')}`,name,gender:female?'mulher':'homem',role:'feirante',socialClass:'plebeu',homeId:vendorHomes[post%vendorHomes.length],workId:marketId,post});
    }
  }
  // Valen has its own compact population and is excluded from the capital
  // housing allocation above so its 18 residents remain local to the village.
  const valenEntries=entries.filter(([,b])=>String(b.userData.cityLayer??'').startsWith('Vila de Valen'));
  const valenHouses=valenEntries.filter(([,b])=>b.name==='Cidade:house').map(([id])=>id);
  const valenWork=(kind:string)=>valenEntries.find(([,b])=>b.name===`Cidade:${kind}`)?.[0]??'';
  const special:[string,string,'homem'|'mulher',CitizenRole,string][]=[
    ['valen-ferreiro','Aldren','homem','armeiro','weapons'],
    ['valen-alquimista','Mirel','mulher','alquimista','potions'],
    ['valen-taverneiro','Brann','homem','taverneira','tavern'],
    ['valen-estalajadeira','Selma','mulher','estalajadeira','inn'],
    ['valen-armazeneiro','Osric','homem','lojista','warehouse'],
    ['valen-ancião','Hilda','mulher','morador',''],
    ['valen-mensageiro','Perrin','homem','morador',''],
  ];
  special.forEach(([id,name,gender,role,kind],index)=>{
    const work=kind?valenWork(kind):''; const home=work||valenHouses[index%Math.max(1,valenHouses.length)]||'';
    citizens.push({id,name,gender,role,homeId:home,workId:work||home,post:index,socialClass:'plebeu'});
  });
  const common:[string,'homem'|'mulher'][]=[['Edna','mulher'],['Galen','homem'],['Rina','mulher'],['Tomas','homem'],['Brina','mulher'],['Cael','homem'],['Nessa','mulher'],['Oren','homem'],['Faye','mulher'],['Dain','homem'],['Liora','mulher']];
  common.forEach(([name,gender],index)=>{const home=valenHouses[index%Math.max(1,valenHouses.length)]??'';citizens.push({id:`valen-morador-${String(index+1).padStart(2,'0')}`,name,gender,role:'morador',homeId:home,workId:home,post:index,socialClass:'plebeu'});});
  for(const [,b]of entries){delete b.userData.primaryResidentId;delete b.userData.ownerName;delete b.userData.ownerNames;delete b.userData.ownerIds;delete b.userData.workerNames;}
  const own=(id:string,c:Citizen)=>{const b=buildings.get(id);if(!b)return;const owners=b.userData.ownerIds??(b.userData.ownerIds=[]);if(!owners.includes(c.id)){owners.push(c.id);(b.userData.ownerNames??(b.userData.ownerNames=[])).push(c.name);}b.userData.ownerName=b.userData.ownerNames.join(' e ');};
  for(const c of citizens){own(c.homeId,c);if(['armeiro','alquimista','taverneira','estalajadeira','lojista','rei','rainha','princesa'].includes(c.role))own(c.workId,c);const work=buildings.get(c.workId);if(work&&c.workId!==c.homeId)(work.userData.workerNames??(work.userData.workerNames=[])).push(c.name);}
  for(const id of residentialIds){
    const resident=plebeians.find(c=>c.homeId===id);
    const home=buildings.get(id);
    if(home&&resident){home.userData.ownerName=resident.name;home.userData.primaryResidentId=resident.id;}
  }
  // Extra manually built homes remain owned by the existing population.
  const civilianOwners=citizens.filter(c=>!c.role.startsWith('guarda-')&&buildings.get(c.homeId)?.name==='Cidade:house');
  let extra=0;for(const id of available.keys())own(id,civilianOwners[extra++%civilianOwners.length]??citizens[0]);
  return citizens;
}
