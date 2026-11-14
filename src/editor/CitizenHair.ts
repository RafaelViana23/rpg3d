import type {Citizen,CitizenRole} from './CityPopulation';
const civilianHair=['#765034','#0b0d10','#50382b'];
/** Nobles share a stable blond, chestnut and dark brown palette; royals keep their blond. */
export function citizenHairColor(role:CitizenRole,index:number){
 if(role==='estalajadeira')return '#765034';
 if(role==='morador')return '#0b0d10';
 if(role==='nobre'){
  const palette=['#d9b45f','#765034','#50382b'];
  const couple=index%25,spouse=index>=25;
  // Each gender receives all three tones, with matching and mixed couples.
  return palette[(couple+(spouse?couple%3:0))%palette.length];
 }
 return role==='rei'||role==='rainha'||role==='princesa'?'#d9b45f':civilianHair[index%civilianHair.length];
}

/** Keep each woman's hairstyle stable when residents are loaded or recycled. */
export function citizenHairStyle(citizen:Pick<Citizen,'id'|'gender'|'role'>):'curto'|'longo'{
 if(citizen.gender!=='mulher'||citizen.role==='freira')return 'curto';
 const seed=[...citizen.id].reduce((hash,char)=>hash*31+char.charCodeAt(0)|0,0);
 return Math.abs(seed)%3===0?'longo':'curto';
}
