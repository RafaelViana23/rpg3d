export type AnimalSpecies = "bear" | "raccoon" | "deer" | "rabbit" | "wolf" | "puma" | "cat" | "rat" | "chicken" | "shark" | "trout";
export interface HabitatWorld { getBiomeAt(x:number,z:number):string; getHeightAt(x:number,z:number):number; getWaterLevelAt(x:number,z:number):number; isWaterAt(x:number,z:number):boolean }
export const ANIMAL_TERRITORIES: Record<AnimalSpecies,{label:string;center:readonly[number,number];radius:number;patrol:number}> = {
  bear:{label:"Mundo selvagem",center:[0,0],radius:1400,patrol:180},
  raccoon:{label:"Mundo selvagem",center:[0,0],radius:1400,patrol:180},
  deer:{label:"Mundo selvagem",center:[0,0],radius:1400,patrol:180},
  rabbit:{label:"Mundo selvagem",center:[0,0],radius:1400,patrol:180},
  wolf:{label:"Montanhas",center:[0,-700],radius:1100,patrol:120},
  puma:{label:"Mundo selvagem",center:[0,0],radius:1400,patrol:180},
  cat:{label:"Cidade",center:[-7,-3],radius:35,patrol:5},
  rat:{label:"Cidade",center:[-7,-3],radius:12,patrol:4},
  chicken:{label:"Cidade",center:[0,7.5],radius:35,patrol:9},
  shark:{label:"Mar",center:[0,0],radius:980,patrol:70},
  trout:{label:"Mar",center:[0,0],radius:980,patrol:52},
};

export function isAnimalHabitat(world:HabitatWorld,species:AnimalSpecies,x:number,z:number) {
  if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>1016||Math.abs(z)>1016)return false;
  const territory=ANIMAL_TERRITORIES[species];
  if(species==="shark")return world.isWaterAt(x,z)&&world.getWaterLevelAt(x,z)<=.05;
  if(species==="trout")return world.isWaterAt(x,z)&&world.getHeightAt(x,z)<world.getWaterLevelAt(x,z)-.35;
  if(Math.hypot(x-territory.center[0],z-territory.center[1])>territory.radius)return false;
  if(world.isWaterAt(x,z))return false;
  if(species==="cat"||species==="rat"||species==="chicken")return Math.abs(x)<52&&Math.abs(z-7.5)<46;
  const biome=world.getBiomeAt(x,z);
  const snowMountain=biome==="Neve"&&world.getHeightAt(x,z)>35;
  if(species==="wolf"||species==="puma")return biome==="Montanha"||snowMountain;
  // Keep the mountain ranges exclusive to their two apex predators. Other
  // wildlife may use flat snow fields, but not high snowy mountain terrain.
  return biome!=="Deserto"&&biome!=="Montanha"&&!snowMountain;
}

export function findAnimalHabitatPoint(world:HabitatWorld,species:AnimalSpecies,index:number,origin?:readonly[number,number],radius?:number) {
  const territory=ANIMAL_TERRITORIES[species],center=origin??territory.center,r=radius??territory.radius;
  for(let attempt=0;attempt<384;attempt++){
    const speciesSeed=(["bear","raccoon","deer","rabbit","wolf","puma","cat","rat","chicken","shark","trout"] as AnimalSpecies[]).indexOf(species)*97.371;
    const sample=index+speciesSeed+attempt*41.37;
    const radial=Math.sqrt((((sample*.61803398875)%1)+1)%1)*r*.94;
    const x=origin?center[0]+Math.cos(sample*2.399963229728653)*radial:-1000+((((sample*.61803398875)%1)+1)%1)*2000;
    const z=origin?center[1]+Math.sin(sample*2.399963229728653)*radial:-1000+((((sample*.41421356237)%1)+1)%1)*2000;
    if(!isAnimalHabitat(world,species,x,z))continue;
    return [x,world.getHeightAt(x,z),z] as const;
  }
  return undefined;
}

export function animalPatrolPoints(world:HabitatWorld,species:AnimalSpecies,index:number,home:readonly[number,number]) {
  const points:(readonly[number,number,number])[]=[];
  const segmentValid=(a:readonly[number,number],b:readonly[number,number])=>{
    const steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/3));
    for(let i=0;i<=steps;i++)if(!isAnimalHabitat(world,species,a[0]+(b[0]-a[0])*i/steps,a[1]+(b[1]-a[1])*i/steps))return false;
    return true;
  };
  for(let i=0;i<6;i++)for(let attempt=0;attempt<48;attempt++){
    const point=findAnimalHabitatPoint(world,species,index*131+i*37+attempt,home,ANIMAL_TERRITORIES[species].patrol);
    if(!point)continue;
    const previous=points.at(-1),from:readonly[number,number]=previous?[previous[0],previous[2]]:home;
    if(!segmentValid(from,[point[0],point[2]]))continue;
    points.push(point);break;
  }
  return points;
}
