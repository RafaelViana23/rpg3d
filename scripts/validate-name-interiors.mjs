import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const T=await server.ssrLoadModule('three');
 const {cityNameVisibility}=await server.ssrLoadModule('/src/editor/CityLightInteriors.ts');
 const inn=new T.Group();inn.userData.building={enterable:true,width:44,depth:24,height:15};inn.position.set(40,8,20);inn.rotation.y=.7;inn.scale.setScalar(2);inn.updateMatrixWorld(true);
 const house=new T.Group();house.userData.building={enterable:true,width:10,depth:10,height:6};house.position.set(-100,0,0);house.updateMatrixWorld(true);
 const inside=inn.localToWorld(new T.Vector3(0,1,0)),otherFloor=inn.localToWorld(new T.Vector3(0,11,0)),outside=inn.localToWorld(new T.Vector3(0,1,15));
 assert(cityNameVisibility([inn,house],inside)(otherFloor));
 assert(!cityNameVisibility([inn,house],inside)(outside));
 assert(!cityNameVisibility([inn,house],outside)(inside));
 assert(cityNameVisibility([inn,house],outside)(new T.Vector3(100,0,100)));
 assert(!cityNameVisibility([inn,house],inside)(new T.Vector3(-100,1,0)));
 const palace=new T.Group();palace.userData.building={enterable:true,width:40,depth:40,height:20};palace.userData.palaceComplex=true;palace.userData.weatherRoofs=[[-20,0,-20,-5,15,20]];
 assert(!cityNameVisibility([palace],new T.Vector3(-10,1,0))(new T.Vector3(0,1,0)),'Open palace courtyard remains exterior');
 console.log('Names: same interior/exterior only; different buildings, saved transforms, floors and palace courtyard OK.');
}finally{await server.close();}
