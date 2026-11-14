import * as T from 'three';
const crust=new T.MeshStandardMaterial({color:'#c89a54',roughness:.85});
const cuts=new T.MeshStandardMaterial({color:'#e9dec4',roughness:.9});
/** The same loaf is used on palace tables and in the inventory. */
export function createRoyalBread(){
 const root=new T.Group();root.name='Pão';root.userData.inventoryItemId='bread';
 const shape=new T.SphereGeometry(.22,10,8);shape.scale(1.7,.6,.8);
 root.add(new T.Mesh(shape,crust));
 for(let i=0;i<3;i++){const cut=new T.Mesh(new T.BoxGeometry(.025,.015,.22),cuts);cut.position.set(-.18+i*.18,.12,0);root.add(cut);}
 root.traverse(child=>{if(child instanceof T.Mesh)child.castShadow=child.receiveShadow=true;});
 return root;
}
