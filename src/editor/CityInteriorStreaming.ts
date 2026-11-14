import * as T from 'three';
import {cityLightContext,cityPointIsIndoors} from './CityLightInteriors';
import {buildingDoorIsNear,buildingDoorIsOpenNear} from './ChurchDoors';

type State={prepare:boolean;active:boolean;props:Set<T.Object3D>};
const states=new Map<T.Group,State>();
function stateFor(building:T.Group){
  let state=states.get(building);
  if(!state){state={prepare:false,active:false,props:new Set()};states.set(building,state);}
  return state;
}
export function cityInteriorDemand(building:T.Group){return stateFor(building);}
function setActive(prop:T.Object3D,active:boolean){
  if(!active&&prop.visible){prop.visible=false;prop.userData.cityInteriorHidden=true;}
  else if(active&&prop.userData.cityInteriorHidden){prop.visible=!prop.userData.cityDistanceHidden;delete prop.userData.cityInteriorHidden;}
}
/** Tag furnishing roots only. Shells, roofs, floors and door leaves stay intact. */
export function registerCityInteriorProp(building:T.Group,prop:T.Object3D,position=prop.position){
  if(!cityPointIsIndoors(building,position))return false;
  prop.userData.cityInteriorProp=true;
  prop.userData.cityInteriorPosition=position.toArray();
  const state=stateFor(building);state.props.add(prop);setActive(prop,state.active);
  return true;
}
export function updateCityInteriorStreaming(buildings:Iterable<T.Group>,viewer:T.Vector3,buildMode=false){
  const live=new Set([...buildings].filter(b=>b.parent&&b.userData.building?.enterable));
  const context=cityLightContext(new Set(live),viewer);
  const center=new T.Vector3();
  for(const building of live){
    const state=stateFor(building),info=building.userData.building;
    center.setFromMatrixPosition(building.matrixWorld);
    const extent=Math.hypot(info.width*building.scale.x,info.depth*building.scale.z)/2;
    const regional=buildMode&&Math.hypot(center.x-viewer.x,center.z-viewer.z)<120+extent;
    state.active=regional||context.inside===building||(!context.inside&&buildingDoorIsOpenNear(building,viewer));
    state.prepare=state.active||buildingDoorIsNear(building,viewer,18);
    for(const prop of state.props){
      if(prop.parent!==building){state.props.delete(prop);continue;}
      setActive(prop,state.active);
    }
  }
  for(const building of states.keys())if(!live.has(building))states.delete(building);
}
