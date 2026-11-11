/** Armor has diminishing returns: 100 defense halves incoming physical damage. */
export function physicalDamage(raw:number,defense:number):number {
  if(raw<=0)return 0;
  return Math.max(1,Math.round(raw*100/(100+Math.max(0,defense))));
}
export const DODGE_DURATION=.55;
export const DODGE_DISTANCE=3.2;
export const DODGE_STAMINA=12;
export function dodgeInvulnerable(elapsed:number):boolean {
  return elapsed>=.06&&elapsed<.36;
}
/** Integrated easing keeps displacement identical at different frame rates. */
export function dodgeProgress(elapsed:number):number {
  const t=Math.max(0,Math.min(1,elapsed/DODGE_DURATION));
  return 1-(1-t)*(1-t);
}
