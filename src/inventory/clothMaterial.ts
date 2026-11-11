import { DoubleSide, MeshStandardMaterial } from 'three';

/** Thin opaque fabric shared by dresses and the player's cape. */
export function createSmoothClothMaterial(color:string){
  return new MeshStandardMaterial({color,roughness:.78,metalness:0,side:DoubleSide,flatShading:true});
}
