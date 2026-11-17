import type {CityAssetKind,SavedCityObject} from './WorldEditorSupport';

export const REQUESTED_VILLAGES=[
  {id:'ravenbrook',name:'Ravenbrook',subtitle:'Vila madeireira',center:[-700,80] as const,houses:15},
  {id:'stonebridge',name:'Stonebridge',subtitle:'Vila pesqueira',center:[700,150] as const,houses:20},
  {id:'frostheim',name:'Frostheim',subtitle:'Vila nevada',center:[700,-650] as const,houses:10},
] as const;

const establishments:{kind:CityAssetKind;x:number;z:number;rotation?:number}[]=[
  {kind:'inn',x:-48,z:-42},{kind:'tavern',x:8,z:-42},{kind:'guild',x:48,z:-42},
  {kind:'weapons',x:-48,z:-8},{kind:'potions',x:-24,z:-8},{kind:'shop',x:4,z:-8},{kind:'warehouse',x:36,z:-8},
];

type VillageGatePositions=Record<string,{north:number[];south:number[];west:number[];east:number[]}>;
export function requestedVillageObjects(getHeight:(x:number,z:number)=>number,footprints:Record<string,{west:number;east:number;north:number;south:number}>={},gatePositions:VillageGatePositions={}){
  const result:SavedCityObject[]=[];
  for(const village of REQUESTED_VILLAGES){
    const layer=`Vila de ${village.name}`,add=(id:string,kind:CityAssetKind,x:number,z:number,rotation=0,extra:Partial<SavedCityObject>={})=>{
      const wx=village.center[0]+x,wz=village.center[1]+z;
      result.push({id:`${village.id}-${id}`,kind,layer,position:[wx,getHeight(wx,wz),wz],rotation:[0,rotation,0],scale:[1,1,1],...extra});
    };
    establishments.forEach((entry,index)=>add(`${entry.kind}-${index+1}`,entry.kind,entry.x,entry.z,entry.rotation??0,{buildingStyle:'wood'}));
    for(let index=0;index<village.houses;index++){
      const column=index%5,row=Math.floor(index/5);
      add(`house-${String(index+1).padStart(2,'0')}`,'house',-48+column*24,28+row*25,0,{buildingStyle:'wood'});
    }
    const [cx,cz]=village.center;
    result.push({id:`${village.id}-road-main`,kind:'road',layer,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],width:8,points:[[-70,getHeight(cx-70,cz+12),cz+12],[cx+70,getHeight(cx+70,cz+12),cz+12]]});
    result[result.length-1].points=[[-70+cx,getHeight(cx-70,cz+12),cz+12],[70+cx,getHeight(cx+70,cz+12),cz+12]];
    result.push({id:`${village.id}-road-entry`,kind:'road',layer,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],width:7,points:[[cx,getHeight(cx,cz-70),cz-70],[cx,getHeight(cx,cz+12),cz+12]]});

    // Compact village perimeter. Each cardinal entrance keeps a true 20 m
    // clear span; the wall sections stop at the gate edges instead of hiding
    // behind or intersecting the gate model.
    const rows=Math.ceil(village.houses/5),footprint=footprints[village.id],savedGates=gatePositions[village.id];
    const west=savedGates?.west[0]??footprint?.west??cx-70,east=savedGates?.east[0]??footprint?.east??cx+70;
    const north=savedGates?.north[2]??footprint?.north??cz-62,south=savedGates?.south[2]??footprint?.south??cz+28+(rows-1)*25+18;
    const northGateX=savedGates?.north[0]??(west+east)/2,southGateX=savedGates?.south[0]??(west+east)/2;
    const westGateZ=savedGates?.west[2]??(north+south)/2,eastGateZ=savedGates?.east[2]??(north+south)/2,halfOpening=10;
    const wall=(id:string,a:[number,number],b:[number,number])=>{
      const ay=getHeight(a[0],a[1]),by=getHeight(b[0],b[1]),mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2,baseY=Math.min(ay,by);
      result.push({
        id:`${village.id}-wall-${id}`,kind:'wall',layer,position:[mx,baseY,mz],rotation:[0,0,0],scale:[1,1,1],fortificationStyle:'village',villagePerimeterRevision:village.id==='ravenbrook'?(id.startsWith('north-')?6:5):4,
        points:[[a[0]-mx,ay-baseY,a[1]-mz],[b[0]-mx,by-baseY,b[1]-mz]],
      });
    };
    const span=(id:string,a:[number,number],b:[number,number])=>{
      if(village.id!=='ravenbrook'){wall(id,a,b);return;}
      const middle:[number,number]=[(a[0]+b[0])/2,(a[1]+b[1])/2];wall(`${id}-01`,a,middle);wall(`${id}-02`,middle,b);
    };
    span('north-west',[west,north],[northGateX-halfOpening,north]);span('north-east',[northGateX+halfOpening,north],[east,north]);
    span('south-west',[west,south],[southGateX-halfOpening,south]);span('south-east',[southGateX+halfOpening,south],[east,south]);
    span('west-north',[west,north],[west,westGateZ-halfOpening]);span('west-south',[west,westGateZ+halfOpening],[west,south]);
    span('east-north',[east,north],[east,eastGateZ-halfOpening]);span('east-south',[east,eastGateZ+halfOpening],[east,south]);
    const gate=(id:string,x:number,z:number,rotation:number)=>result.push({id:`${village.id}-gate-${id}`,kind:'gate',layer,position:[x,getHeight(x,z),z],rotation:[0,rotation,0],scale:[1,1,1],fortificationStyle:'village',villagePerimeterRevision:4});
    gate('north',northGateX,north,0);gate('south',southGateX,south,Math.PI);
    gate('west',west,westGateZ,Math.PI/2);gate('east',east,eastGateZ,-Math.PI/2);
  }
  return result;
}
