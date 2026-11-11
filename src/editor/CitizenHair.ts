import type {CitizenRole} from './CityPopulation';
const civilianHair=['#765034','#0b0d10','#50382b'];
/** Blond hair is reserved for the three members of the royal family. */
export function citizenHairColor(role:CitizenRole,index:number){
 return role==='rei'||role==='rainha'||role==='princesa'?'#d9b45f':civilianHair[index%civilianHair.length];
}
