import type { Object3D } from "three";

export function removeCastleActors(root: Object3D) {
  const actors: Object3D[] = [];
  root.traverse((object) => {
    // The castle author named the two archers Fence_19 and Fence_20.
    if (/^Fence_(?:19|20)(?:_0)?$/.test(object.name) || /^(?:Horse|Horseman|Character|Soldier|Girl|Bucketgirl|Chicken)(?:_\d+)*$/i.test(object.name)) actors.push(object);
  });
  for (const actor of actors) actor.removeFromParent();
  return actors.map((actor) => actor.name);
}
