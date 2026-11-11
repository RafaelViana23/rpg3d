import * as T from 'three';
import { ITEM_BY_ID } from '../inventory/catalog';
import { createProceduralItem } from '../inventory/proceduralItem';
import { merchantItems, TAVERN_ITEM_IDS } from '../inventory/commerce';
import { scheduleCityPropBatch } from './CityPropBatching';

/** The shop displays use the same item geometry and IDs as the inventory. */
export function addCityShopDisplays(building:T.Group){
  const kind=building.name.slice(7),info=building.userData.building;if(!info)return;
  if(kind!=='weapons'&&kind!=='tavern')return;
  const ids=kind==='weapons'?merchantItems('weapons').filter(i=>i.category==='weapon'&&i.visual!=='shield').map(i=>i.id):TAVERN_ITEM_IDS.filter(id=>id!=='water-flask');
  const columns=Math.max(1,Math.floor((info.width-3)/1.4));
  ids.forEach((id,index)=>{
    const item=ITEM_BY_ID.get(id);if(!item)return;
    const row=Math.floor(index/columns),x=-info.width/2+2+(index%columns)*1.4,y=1+row*1.3+.16;
    if(info.upperFloor&&y+1.1>info.upperFloor-.15)return;
    const model=createProceduralItem(item);
    if(kind==='weapons')model.rotation.z=Math.PI/2;
    model.updateMatrixWorld(true);
    const bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3());
    const scale=Math.min(1.05/Math.max(size.x,.001),(kind==='weapons'?1.05:.45)/Math.max(size.y,.001),.72/Math.max(size.z,.001));
    model.scale.setScalar(scale);model.updateMatrixWorld(true);
    const fitted=new T.Box3().setFromObject(model),center=fitted.getCenter(new T.Vector3());
    model.position.set(x-center.x,y-fitted.min.y,-info.depth/2+.6-center.z);
    model.name=`Mercadoria: ${item.name}`;model.userData.inventoryItemId=id;model.userData.cityObject=true;model.userData.batchableCityProp=true;
    building.add(model);
  });
  scheduleCityPropBatch(building);
}
