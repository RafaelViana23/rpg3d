import * as T from 'three';

/** One constant room light reaches walls and windows even in scaled buildings. */
export function configureCityChandelierLight(light:T.PointLight,building:T.Group,roomHeight:number){
  const info=building.userData.building;
  building.updateWorldMatrix(true,false);
  const scale=building.getWorldScale(new T.Vector3());
  const reach=Math.hypot(info.width*Math.abs(scale.x)/2,info.depth*Math.abs(scale.z)/2,roomHeight*Math.abs(scale.y));
  light.decay=1;
  light.distance=Math.max(24,reach*4);
  light.intensity=Math.max(30,reach*2.5);
  light.castShadow=false;
}
