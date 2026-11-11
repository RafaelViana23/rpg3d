import type { Group } from 'three';
export type CitizenRole='cozinheiro-real'|'empregada-real'|'cavalarico'|'morador'|'rei'|'rainha'|'princesa'|'padre'|'freira'|'armeiro'|'alquimista'|'taverneira'|'estalajadeira'|'guilda'|'guarda-torre'|'guarda-palacio'|'guarda-arqueiro'|'guarda-patrulha'|'lojista';
export type Citizen={id:string;name:string;gender:'homem'|'mulher';role:CitizenRole;homeId:string;workId:string;post:number;parentIds?:string[];existingIndex?:number};
const men=["Rito","Basel","Aldren","Theron","Kael","Cedric","Alaric","Eldric","Gareth","Roland","Leoric","Osric","Hadrian","Tristan","Lucan","Dorian","Fenris","Valen","Riven","Eron","Arven","Darion","Sylas","Renald","Galen","Azren","Torin","Varyn","Aeron","Bastian","Corvin","Draven","Elric","Faelan","Galdric","Haron","Isen","Jareth","Kiran","Lorcan","Maeron","Noren","Odran","Perrin","Quirin","Rael","Soren","Taren","Ulric","Vael","Wulfric","Xaren","Yoren","Zephan","Aster","Brann","Caelan","Dain","Eirik","Faris","Gavren","Halric","Ivar","Jorin","Keldan","Lior","Morven","Nael","Orin","Rurik","Serin","Thalen","Veyron"];
const women=["Eleonor","Alice","Emma","Lifa","Lyra","Selene","Aelina","Freya","Elara","Aria","Neria","Sylvie","Yuna","Rina","Althea","Brina","Cerys","Dahlia","Eira","Faye","Gwyne","Hilda","Iris","Juna","Kyra","Liora","Mirel","Nessa","Orielle","Petra","Quilla","Rhea","Seraphina","Thalia","Undine","Vanya","Wren","Xena","Ylva","Zaira","Alys","Brynn","Celia","Delya","Elys","Fiora","Gisela","Hestia","Ilia","Jessamine","Keira","Lyria","Melia","Nyra","Ophelia","Prisca","Roswyn","Saria","Tilia","Velia","Yselle","Zelia","Amaris","Belryn","Calia","Elwyn","Isolde","Loriel","Maelis","Nerissa","Ravena","Solia","Aerin"];
/** Stable identities and ownership are independent of which character meshes are loaded. */
export function createCityPopulation(buildings:Map<string,Group>):Citizen[]{
  const entries=[...buildings.entries()].sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true}));
  const houses=entries.filter(([,b])=>b.name==='Cidade:house');
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
  role(78,'estalajadeira','inn',true);role(79,'guilda','guild');
  for(let i=0;i<8;i++)Object.assign(citizens[4+i],{role:'guarda-torre',workId:towers[i]?.[0]??'',post:i});
  for(let i=0;i<6;i++)Object.assign(citizens[12+i],{role:'guarda-palacio',workId:find('palace'),post:i});
  const walls=entries.filter(([,b])=>b.name==='Cidade:wall'&&b.userData.walkSurfaces?.length);
  for(let i=0;i<8;i++){
    Object.assign(citizens[18+i],{role:'guarda-arqueiro',workId:walls[Math.floor(i*walls.length/8)]?.[0]??towers[i]?.[0]??find('palace'),post:i});
    Object.assign(citizens[26+i],{role:'guarda-patrulha',post:i});
  }
  if(find('stable'))role(34,'cavalarico','stable');
  for(let i=0;i<3;i++){role(35+i,'cozinheiro-real','palace');citizens[35+i].post=i;role(86+i,'empregada-real','palace');citizens[86+i].post=i;} 
  if(find('shop'))role(80,'lojista','shop',true);
  const available=new Map(houses);
  // Reserve the closest free houses for the tavern keeper, priest and guild clerk.
  for(const index of [1,79,34,82,83,84,85,35,36,37,86,87,88]){
    const c=citizens[index],work=buildings.get(c.workId);
    const nearest=[...available].sort(([,a],[,b])=>work?a.position.distanceToSquared(work.position)-b.position.distanceToSquared(work.position):0)[0];
    if(nearest){c.homeId=nearest[0];available.delete(nearest[0]);}
  }
  for(const c of citizens){
    if(!c.homeId){const next=available.keys().next().value as string|undefined;c.homeId=next??houses[0][0];if(next)available.delete(next);}
    if(!c.workId)c.workId=c.homeId;
  }
  for(const [,b]of entries){delete b.userData.ownerName;delete b.userData.ownerNames;delete b.userData.ownerIds;delete b.userData.workerNames;}
  const own=(id:string,c:Citizen)=>{const b=buildings.get(id);if(!b)return;const owners=b.userData.ownerIds??(b.userData.ownerIds=[]);if(!owners.includes(c.id)){owners.push(c.id);(b.userData.ownerNames??(b.userData.ownerNames=[])).push(c.name);}b.userData.ownerName=b.userData.ownerNames.join(' e ');};
  for(const c of citizens){own(c.homeId,c);if(['armeiro','alquimista','taverneira','estalajadeira','lojista','rei','rainha','princesa'].includes(c.role))own(c.workId,c);const work=buildings.get(c.workId);if(work&&c.workId!==c.homeId)(work.userData.workerNames??(work.userData.workerNames=[])).push(c.name);}
  // Extra manually built homes remain owned, without adding citizens beyond 146.
  let extra=0;for(const id of available.keys())own(id,citizens[18+extra++%55]);
  return citizens;
}
