export type HuntedAnimal='deer'|'rabbit'|'chicken'|'rat'|'raccoon'|'bear'|'wolf'|'puma';
export function animalLoot(id:HuntedAnimal){
 const meat:Partial<Record<HuntedAnimal,[string,number]>>={deer:['deer-meat',3],rabbit:['rabbit-meat',1],chicken:['chicken-meat',1],bear:['bear-meat',4],wolf:['wolf-meat',2],puma:['mountain-lion-meat',2]};
 const result:{itemId:string;quantity:number}[]=meat[id]?[{itemId:meat[id]![0],quantity:meat[id]![1]}]:[];
 if(['deer','bear','wolf','puma'].includes(id))result.push({itemId:'leather',quantity:id==='bear'?4:id==='deer'?1:2});
 return result;
}
