import * as T from 'three';
type Sweep=(start:T.Vector3,end:T.Vector3,normal:T.Vector3)=>boolean;
/** Separate wall contact from steering: slide along it and rebound away immediately. */
export class FlightImpactResponse{
  readonly velocity=new T.Vector3();
  readonly normal=new T.Vector3();
  private blockedTime=0;
  reset(){this.velocity.set(0,0,0);this.normal.set(0,0,0);this.blockedTime=0;}
  move(position:T.Vector3,displacement:T.Vector3,delta:number,sweep:Sweep,boosting=false){
    const start=position.clone(),step=displacement.clone();
    if(this.blockedTime>0){
      this.blockedTime=Math.max(0,this.blockedTime-delta);
      const inward=step.dot(this.normal);
      if(inward<0)step.addScaledVector(this.normal,-inward);
    }
    step.addScaledVector(this.velocity,delta);
    this.velocity.multiplyScalar(Math.exp(-9*delta));
    position.add(step);
    const contactNormal=new T.Vector3();
    if(!sweep(start,position,contactNormal))return false;
    this.normal.copy(contactNormal);
    // Preserve the unspent sideways movement instead of cancelling the whole frame.
    const tangent=start.clone().add(step).sub(position);
    const inward=tangent.dot(this.normal);
    if(inward<0)tangent.addScaledVector(this.normal,-inward);
    if(tangent.lengthSq()>1e-10){
      const contact=position.clone(),secondNormal=new T.Vector3();position.add(tangent);
      if(sweep(contact,position,secondNormal))this.normal.add(secondNormal).normalize();
    }
    // Apply separation in this frame, rather than waiting for the next frame's input.
    const contact=position.clone(),separationNormal=new T.Vector3();
    position.addScaledVector(this.normal,.18);
    if(sweep(contact,position,separationNormal))this.normal.add(separationNormal).normalize();
    this.velocity.copy(this.normal).multiplyScalar(boosting?16:11);
    this.blockedTime=.28;
    return true;
  }
}
