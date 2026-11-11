import * as THREE from "three";

export function resolveCircleCollision(position: THREE.Vector3, radius: number, collider: THREE.Vector3, colliderRadius: number, scratch: THREE.Vector3) {
  scratch.set(position.x - collider.x, 0, position.z - collider.z);
  const minimum = radius + colliderRadius, distanceSq = scratch.lengthSq();
  if (distanceSq >= minimum * minimum) return false;
  if (distanceSq < 1e-6) scratch.set(1, 0, 0);
  else scratch.multiplyScalar(1 / Math.sqrt(distanceSq));
  position.x = collider.x + scratch.x * minimum;
  position.z = collider.z + scratch.z * minimum;
  return true;
}
