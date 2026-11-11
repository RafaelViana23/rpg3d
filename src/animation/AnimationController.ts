import * as THREE from 'three';
import { HandAnimator, HandPoseName } from '../hand/HandAnimator';

export type AnimationState='tendHorse'|'sit'|'talk'|'drink'|'sitDrink'|'idle'|'walk'|'run'|'swim'|'swimMove'|'jump'|'fall'|'attack'|'cast'|'dodge'|'mounted'|'mountedPassenger'|'death';
export type BodySideRig={clavicle:THREE.Bone;upperArm:THREE.Bone;forearm:THREE.Bone;thigh:THREE.Bone;shin:THREE.Bone;ankle:THREE.Bone;foot:THREE.Bone;hand:THREE.Bone;handAnimator:HandAnimator};
export type BodyRig={root:THREE.Group;hips?:THREE.Bone;spine?:THREE.Bone;chest?:THREE.Bone;neck:THREE.Bone;head:THREE.Bone;left:BodySideRig;right:BodySideRig};
export type MagicArmTuning={
  shoulder:{position:[number,number,number];rotation:[number,number,number]};
  elbow:{position:[number,number,number];rotation:[number,number,number]};
  wrist:{position:[number,number,number];rotation:[number,number,number]};
};
export type BroomRideNode='center'|'chest'|'leftLeg'|'rightLeg'|'leftShoulder'|'leftElbow'|'leftWrist'|'rightShoulder'|'rightElbow'|'rightWrist';
export type BroomRideTuning=Record<BroomRideNode,{position:[number,number,number];rotation:[number,number,number]}>;
const emptyBroomRideTuning=()=>Object.fromEntries(['center','chest','leftLeg','rightLeg','leftShoulder','leftElbow','leftWrist','rightShoulder','rightElbow','rightWrist'].map(key=>[key,{position:[0,0,0],rotation:[0,0,0]}])) as BroomRideTuning;

type Side='left'|'right';
const quat=(x=0,y=0,z=0)=>new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z,'XYZ'));

export class AnimationController {
  state:AnimationState='idle';
  private elapsed=0;
  private targets=new Map<THREE.Object3D,THREE.Quaternion>();
  private restPosition=new THREE.Vector3();
  private rootPosition=new THREE.Vector3();
  private gripPose:Record<Side,HandPoseName>={left:'Relaxed',right:'SwordGrip'};
  private appliedHandPose:Partial<Record<Side,HandPoseName>>={};
  private testHandPose:HandPoseName|null=null;
  private attackArmed=true;
  private armedHands:Record<Side,boolean>={left:false,right:true};
  private magicHands:Record<Side,boolean>={left:false,right:false};
  private magicArmTuning:MagicArmTuning={
    shoulder:{position:[0,0,0],rotation:[0,0,0]},
    elbow:{position:[0,0,0],rotation:[0,0,0]},
    wrist:{position:[0,0,0],rotation:[0,0,0]},
  };
  private magicRestPositions:Record<Side,Record<'shoulder'|'elbow'|'wrist',THREE.Vector3>>;
  private mountedLegSpread=.72;
  private broomRiding=false;
  private broomAimPitch=0;
  private broomRideTuning:BroomRideTuning=emptyBroomRideTuning();
  private broomRestPositions:Partial<Record<BroomRideNode,THREE.Vector3>>={};
  private attackSide:Side='left';
  private punchSide:Side='right';

  constructor(readonly rig:BodyRig){
    this.restPosition.copy(rig.root.position);this.rootPosition.copy(rig.root.position);
    this.magicRestPositions={
      left:{shoulder:rig.left.upperArm.position.clone(),elbow:rig.left.forearm.position.clone(),wrist:rig.left.hand.position.clone()},
      right:{shoulder:rig.right.upperArm.position.clone(),elbow:rig.right.forearm.position.clone(),wrist:rig.right.hand.position.clone()},
    };
    this.broomRestPositions={center:rig.root.position.clone(),chest:rig.chest?.position.clone(),leftLeg:rig.left.thigh.position.clone(),rightLeg:rig.right.thigh.position.clone(),leftShoulder:rig.left.upperArm.position.clone(),leftElbow:rig.left.forearm.position.clone(),leftWrist:rig.left.hand.position.clone(),rightShoulder:rig.right.upperArm.position.clone(),rightElbow:rig.right.forearm.position.clone(),rightWrist:rig.right.hand.position.clone()};
  }
  setState(state:AnimationState){if(this.state===state)return;if(state==='attack'){if(this.attackArmed){if(this.armedHands.left&&this.armedHands.right)this.attackSide=this.attackSide==='right'?'left':'right';else this.attackSide=this.armedHands.left?'left':'right';}else this.punchSide=this.punchSide==='right'?'left':'right';}this.state=state;this.elapsed=0;}
  setGripPose(side:Side,pose:HandPoseName){this.gripPose[side]=pose;}
  setAttackArmed(armed:boolean){this.attackArmed=armed;this.appliedHandPose={};}
  setAttackHands(left:boolean,right:boolean){this.armedHands={left,right};this.attackArmed=left||right;if(left&&!right)this.attackSide='left';else if(right&&!left)this.attackSide='right';this.appliedHandPose={};}
  setMagicHand(side:Side,active:boolean){this.magicHands[side]=active;}
  setMagicArmTuning(tuning:MagicArmTuning){this.magicArmTuning=tuning;}
  setHandTestPose(pose:HandPoseName|null){this.testHandPose=pose;this.appliedHandPose={};}
  setMountedLegSpread(value:number){this.mountedLegSpread=THREE.MathUtils.clamp(value,.1,1.2);}
  setBroomRiding(active:boolean){
    this.broomRiding=active;
    if(!active){
      const nodes:Partial<Record<BroomRideNode,THREE.Object3D>>={center:this.rig.root,chest:this.rig.chest,leftLeg:this.rig.left.thigh,rightLeg:this.rig.right.thigh,leftShoulder:this.rig.left.upperArm,leftElbow:this.rig.left.forearm,leftWrist:this.rig.left.hand,rightShoulder:this.rig.right.upperArm,rightElbow:this.rig.right.forearm,rightWrist:this.rig.right.hand};
      for(const key of Object.keys(nodes) as BroomRideNode[]){const bone=nodes[key],rest=this.broomRestPositions[key];if(bone&&rest)bone.position.copy(rest);}
    }
  }
  setBroomAimPitch(value:number){this.broomAimPitch=THREE.MathUtils.clamp(value,-Math.PI*.47,Math.PI*.47);}
  setBroomRideTuning(tuning:BroomRideTuning){this.broomRideTuning=tuning;}

  update(dt:number){
    const safeDt=Math.min(dt,.05);this.elapsed+=safeDt;this.targets.clear();
    const t=this.elapsed,state=this.state;
    let rootY=0,rootPitch=0,rootYaw=0,rootRoll=0,transitionSpeed=state==='death'?3.2:10;
    this.fk(this.rig.left,0,0,0,0,0,0);this.fk(this.rig.right,0,0,0,0,0,0);
    // Palms rest sideways; each thumb points toward model-front (+Z).
    this.target(this.rig.left.hand,0,1.20,0);this.target(this.rig.right.hand,0,-.82,-.18);
    if(this.rig.hips)this.target(this.rig.hips,0,0,0);if(this.rig.spine)this.target(this.rig.spine,0,0,0);if(this.rig.chest)this.target(this.rig.chest,0,0,0);this.target(this.rig.neck,0,0,0);this.target(this.rig.head,0,0,0);

    if(state==='sit'||state==='talk'||state==='drink'||state==='sitDrink'){
      const seated=state==='sit'||state==='sitDrink',sip=(1-Math.cos(t*.9))*.5;
      rootY=Math.sin(t*1.6)*.006;
      if(seated){
        rootY-=.48;
        this.fk(this.rig.left,-1.48,1.5,-.02,-.07,0,0);
        this.fk(this.rig.right,-1.48,1.5,-.02,.07,0,0);
      }
      if(state==='drink'||state==='sitDrink'){
        this.target(this.rig.right.upperArm,-.35-sip*.55,0,.12);
        this.target(this.rig.right.forearm,-.65-sip*1.15);
        this.target(this.rig.right.hand,0,-.9,-sip*.22);
        this.target(this.rig.head,sip*.09,Math.sin(t*.4)*.05,0);
      }else{
        const gesture=Math.sin(t*1.8);
        this.target(this.rig.left.upperArm,-.15,0,-.12);
        this.target(this.rig.left.forearm,-.55-gesture*.22);
        this.target(this.rig.right.forearm,-.3+gesture*.12);
        this.target(this.rig.head,Math.sin(t*2)*.025,Math.sin(t*.65)*.12,0);
      }
    }
    if(state==='idle'){
      const breathe=Math.sin(t*1.65);rootY=breathe*.009;
      if(this.rig.spine)this.target(this.rig.spine,breathe*.012);if(this.rig.chest)this.target(this.rig.chest,-breathe*.018,0,breathe*.006);
      this.target(this.rig.left.clavicle,0,0,-.018+breathe*.008);this.target(this.rig.right.clavicle,0,0,.018-breathe*.008);
      this.target(this.rig.left.upperArm,.035+breathe*.018,0,-.038);
      this.target(this.rig.right.upperArm,.035-breathe*.018,0,.038);
      this.target(this.rig.left.forearm,-.17);this.target(this.rig.right.forearm,-.17);
      this.target(this.rig.head,0,Math.sin(t*.62)*.07,Math.sin(t*.45)*.012);
    }else if(state==='tendHorse'){
      const brush=Math.sin(t*2.8);rootPitch=.1;
      if(this.rig.spine)this.target(this.rig.spine,.08);
      this.target(this.rig.right.upperArm,-.75+brush*.12,0,.15);
      this.target(this.rig.right.forearm,-.65-brush*.3);
      this.target(this.rig.left.upperArm,-.3,0,-.12);
      this.target(this.rig.left.forearm,-.45);
      this.target(this.rig.head,.15,Math.sin(t*.5)*.08,0);
    }else if(state==='walk'||state==='run'){
      const run=state==='run',frequency=run?8.4:6.8,stride=run?.68:.23,lift=run?.26:.078,s=Math.sin(t*frequency),c=Math.cos(t*frequency);
      rootPitch=run?.24:0;rootY=(run?Math.max(0,Math.abs(c)-.40)*.13:Math.abs(c)*.014);rootYaw=-s*(run?.11:.04);
      if(this.rig.hips)this.target(this.rig.hips,run?.08:0,s*(run?.085:.032),-s*(run?.045:.014));if(this.rig.spine)this.target(this.rig.spine,run?.06:0,-s*(run?.11:.045),s*(run?.055:.020));if(this.rig.chest)this.target(this.rig.chest,run?-.08:0,s*(run?.14:.055),-s*(run?.075:.026));
      this.legIK(this.rig.left,-s*stride,Math.max(0,c)*lift,-1);this.legIK(this.rig.right,s*stride,Math.max(0,-c)*lift,1);
      const arm=run?1.28:.48;this.target(this.rig.left.upperArm,-s*arm,0,-.07);this.target(this.rig.right.upperArm,s*arm,0,.07);
      this.target(this.rig.left.forearm,-.28-Math.max(0,s)*(run?.92:.26));this.target(this.rig.right.forearm,-.28-Math.max(0,-s)*(run?.92:.26));
      this.target(this.rig.left.clavicle,0,-s*.035,-.025);this.target(this.rig.right.clavicle,0,s*.035,.025);
      this.target(this.rig.neck,-Math.abs(c)*.015,-rootYaw*.35,0);this.target(this.rig.head,Math.abs(c)*.01,rootYaw*.45,-rootYaw*.18);
    }else if(state==='swim'){
      const float=Math.sin(t*1.35);rootY=float*.018;transitionSpeed=6.5;
      if(this.rig.spine)this.target(this.rig.spine,.03,0,0);
      if(this.rig.chest)this.target(this.rig.chest,-.025,0,float*.012);
      this.target(this.rig.left.clavicle,0,0,-.09);
      this.target(this.rig.right.clavicle,0,0,.09);
      // Stable water pose: shoulders open laterally, elbows nearly straight
      // and palms relaxed at the surface.
      this.target(this.rig.left.upperArm,0,0,-1.48);
      this.target(this.rig.right.upperArm,0,0,1.48);
      this.target(this.rig.left.forearm,-.06,0,0);
      this.target(this.rig.right.forearm,-.06,0,0);
      this.target(this.rig.left.hand,0,.15,0);
      this.target(this.rig.right.hand,0,-.15,0);
      this.fk(this.rig.left,.08,.12,-.08,-.08,0,0);
      this.fk(this.rig.right,.08,.12,-.08,.08,0,0);
      this.target(this.rig.head,-.035,Math.sin(t*.45)*.025,0);
    }else if(state==='swimMove'){
      const kick=Math.sin(t*7.2),stroke=Math.sin(t*3.6);transitionSpeed=7;
      // Rotate the whole body around X: model-front (+Z) faces the water
      // below while the head points in the camera-directed swim direction.
      rootPitch=Math.PI*.5;rootY=.72+Math.sin(t*3.6)*.018;
      if(this.rig.spine)this.target(this.rig.spine,-.06,0,0);
      if(this.rig.chest)this.target(this.rig.chest,.08,0,stroke*.025);
      this.target(this.rig.left.clavicle,0,-.08,-.06);
      this.target(this.rig.right.clavicle,0,.08,.06);
      this.target(this.rig.left.upperArm,-.58+stroke*.16,0,-.82);
      this.target(this.rig.right.upperArm,-.58-stroke*.16,0,.82);
      this.target(this.rig.left.forearm,-.22,0,0);
      this.target(this.rig.right.forearm,-.22,0,0);
      this.fk(this.rig.left,kick*.32,Math.max(0,-kick)*.34,-kick*.14,-.05,0,0);
      this.fk(this.rig.right,-kick*.32,Math.max(0,kick)*.34,kick*.14,.05,0,0);
      this.target(this.rig.head,-.18,0,0);
    }else if(state==='jump'){
      const phase=(t%1.2)/1.2,arc=Math.sin(phase*Math.PI),launch=smoothstep(0,.18,phase),land=smoothstep(.78,1,phase),air=launch*(1-land);rootY=arc*.34;
      const crouch=(1-launch)+land,knee=.92*crouch+.58*air,hip=-.46*crouch-.30*air;
      this.fk(this.rig.left,hip,knee,-hip-knee,-.10,0,0);this.fk(this.rig.right,hip,knee,-hip-knee,.10,0,0);
      this.target(this.rig.left.upperArm,-.18-.52*air,0,-.12-.16*air);this.target(this.rig.right.upperArm,-.18-.52*air,0,.12+.16*air);this.target(this.rig.left.forearm,-.30-.18*air);this.target(this.rig.right.forearm,-.30-.18*air);
      this.target(this.rig.neck,.08);this.target(this.rig.head,-.10);
    }else if(state==='fall'){
      const loop=(t%1.2)/1.2;rootY=(1-loop)*.32;
      this.fk(this.rig.left,.22,.32,-.22,-.12,0,0);this.fk(this.rig.right,.22,.32,-.22,.12,0,0);
      this.target(this.rig.left.upperArm,-1.05,0,-.48);this.target(this.rig.right.upperArm,-1.05,0,.48);this.target(this.rig.left.forearm,-.22);this.target(this.rig.right.forearm,-.22);
      this.target(this.rig.head,.16,0,0);
    }else if(state==='mounted'||state==='mountedPassenger'){
      const breathe=Math.sin(t*1.75);rootY=breathe*.006;transitionSpeed=7;
      if(this.broomRiding)rootPitch=-this.broomAimPitch*.72;
      if(this.rig.hips)this.target(this.rig.hips,this.broomRiding?-.22:-.10,0,0);
      if(this.rig.spine)this.target(this.rig.spine,this.broomRiding?.34:.10,0,0);
      if(this.rig.chest)this.target(this.rig.chest,this.broomRiding?.22:-.04,0,0);
      // Seated riding posture: thighs open around the saddle, knees bent and
      // feet brought back below the rider instead of hanging through the horse.
      this.fk(this.rig.left,-.92,1.42,-.48,-this.mountedLegSpread,-.08,.08);
      this.fk(this.rig.right,-.92,1.42,-.48,this.mountedLegSpread,.08,.08);
      if(state==='mountedPassenger'){
        // Passenger leans into the rider and closes both arms around their waist.
        this.target(this.rig.left.clavicle,.08,-.24,-.06);this.target(this.rig.right.clavicle,.08,.24,.06);
        this.target(this.rig.left.upperArm,-.38,.18,-.22);this.target(this.rig.right.upperArm,-.38,-.18,.22);
        this.target(this.rig.left.forearm,-1.12,-.08,-.08);this.target(this.rig.right.forearm,-1.12,.08,.08);
        this.target(this.rig.left.hand,.10,1.12,.06);this.target(this.rig.right.hand,.10,-1.12,-.06);
      }else{
        // Keep the rider's arms relaxed and low. A large forearm bend here used
        // to lock both fists at chest height every frame, hiding shoulder edits.
        this.target(this.rig.left.clavicle,.02,-.04,-.02);this.target(this.rig.right.clavicle,.02,.04,.02);
        this.target(this.rig.left.upperArm,.10,.04,-.08);this.target(this.rig.right.upperArm,.10,-.04,.08);
        this.target(this.rig.left.forearm,-.42,0,-.03);this.target(this.rig.right.forearm,-.42,0,.03);
        this.target(this.rig.left.hand,0,1.08,.08);this.target(this.rig.right.hand,0,-1.08,-.08);
      }
      this.target(this.rig.neck,this.broomRiding?-.12:.04);this.target(this.rig.head,this.broomRiding?-.10:-.04,Math.sin(t*.5)*.025,0);
    }else if(state==='attack'){
      const attackDuration=this.attackArmed?.72:.52,phase=Math.min(1,t/attackDuration);transitionSpeed=22;
      if(this.attackArmed){
        // One direct horizontal slice from the current idle position into the body.
        // The first key exactly matches rest, so there is no visible wind-up.
        const keys=[
          {p:0,root:0,upper:[.035,0,.038],fore:-.17,clav:[0,0,.018],wrist:[0,-.82,-.18]},
          {p:.46,root:-.28,upper:[-.38,-.18,.46],fore:-1.08,clav:[-.04,-.13,.10],wrist:[-.04,-1.34,-.12]},
          {p:.68,root:-.24,upper:[-.34,-.12,.40],fore:-1.02,clav:[-.03,-.10,.08],wrist:[-.03,-1.22,-.14]},
          {p:1,root:0,upper:[.08,0,.08],fore:-.30,clav:[0,0,.02],wrist:[0,-.82,-.18]}
        ];
        const [a,b]=segment(keys,phase),u=smootherstep((phase-a.p)/(b.p-a.p)),attackingSides=[this.attackSide] as const,primarySign=this.attackSide==='right'?1:-1;rootYaw=lerp(a.root,b.root,u)*primarySign;const upper=mix3(a.upper,b.upper,u),clav=mix3(a.clav,b.clav,u),wrist=mix3(a.wrist,b.wrist,u);
        const cut=Math.sin(phase*Math.PI);if(this.rig.hips)this.target(this.rig.hips,0,rootYaw*.68,-cut*.055);if(this.rig.spine)this.target(this.rig.spine,.06*cut,rootYaw*.48,rootYaw*.10);if(this.rig.chest)this.target(this.rig.chest,-.04*cut,rootYaw*.82,-rootYaw*.20);
        for(const side of attackingSides){const sign=side==='right'?1:-1,mirror=(values:[number,number,number]):[number,number,number]=>[values[0],values[1]*sign,values[2]*sign],active=this.rig[side];this.target(active.upperArm,...mirror(upper));this.target(active.forearm,lerp(a.fore,b.fore,u));this.target(active.clavicle,...mirror(clav));this.target(active.hand,...mirror(wrist));}
        {const supportSide=this.attackSide==='right'?'left':'right',support=this.rig[supportSide],sign=this.attackSide==='right'?1:-1;this.target(support.upperArm,-.08,rootYaw*.14*sign,-.15*sign);this.target(support.forearm,-.28);}
        this.target(this.rig.neck,0,-rootYaw*.24,0);this.target(this.rig.head,.03*cut,rootYaw*.34,0);
      }else{
        // One punch per attack input. Each new attack alternates hands.
        const strike=Math.sin(phase*Math.PI),extension=smootherstep(Math.min(1,phase/.42))*(1-smootherstep(Math.max(0,(phase-.58)/.42))),side=this.punchSide==='left'?-1:1;rootYaw=-side*strike*.38;
        const guard:[number,number,number,number]=[-.42,side*.18,side*.28,-1.22],punch:[number,number,number,number]=[-1.28,-side*.44,-side*.08,-.04],active=mix4(guard,punch,extension),support:[number,number,number,number]=[-.52,-side*.28,-side*.38,-1.38];
        if(this.rig.hips)this.target(this.rig.hips,0,rootYaw*.82,-side*strike*.055);if(this.rig.spine)this.target(this.rig.spine,.08,rootYaw*.48,side*strike*.04);if(this.rig.chest)this.target(this.rig.chest,-.05,rootYaw*.88,-rootYaw*.14);
        this.target(this.rig.left.clavicle,0,-rootYaw*.12,-.12);this.target(this.rig.right.clavicle,0,-rootYaw*.12,.12);
        const left=this.punchSide==='left'?active:support,right=this.punchSide==='right'?active:support;this.target(this.rig.left.upperArm,left[0],left[1],left[2]);this.target(this.rig.left.forearm,left[3]);this.target(this.rig.right.upperArm,right[0],right[1],right[2]);this.target(this.rig.right.forearm,right[3]);
        this.target(this.rig.left.hand,0,1.05,.12);this.target(this.rig.right.hand,0,-1.05,-.12);this.target(this.rig.head,.04,-rootYaw*.2,0);
      }
    }else if(state==='cast'){
      // Open-palm spell cast: draw the right hand back briefly, then drive the
      // whole arm straight toward model-front (+Z) and hold through release.
      const phase=Math.min(1,t/.72),windup=1-smootherstep(Math.min(1,phase/.28)),extend=smootherstep(Math.max(0,(phase-.16)/.38));transitionSpeed=18;
      rootYaw=-.12*extend;
      if(this.rig.spine)this.target(this.rig.spine,.04,-.08*extend,0);
      if(this.rig.chest)this.target(this.rig.chest,-.05,-.16*extend,.03);
      this.target(this.rig.right.clavicle,-.03,-.15*extend,.08);
      this.target(this.rig.right.upperArm,-.36*windup-1.42*extend,-.20*extend,.30*windup+.03*extend);
      this.target(this.rig.right.forearm,-1.05*windup-.05*extend,0,.04);
      this.target(this.rig.right.hand,-.05,-1.30,-.02);
      this.target(this.rig.left.upperArm,-.20,0,-.18);
      this.target(this.rig.left.forearm,-.42);
      this.target(this.rig.head,.02,-.10*extend,0);
    }else if(state==='dodge'){
      const phase=Math.sin(((t%1.1)/1.1)*Math.PI);rootY=phase*.015;rootYaw=-phase*.48;
      this.legIK(this.rig.left,-phase*.11,0,-1);this.legIK(this.rig.right,phase*.08,0,1);
      this.target(this.rig.left.upperArm,phase*.48,0,-.07-phase*.18);this.target(this.rig.right.upperArm,-phase*.62,0,.07+phase*.29);this.target(this.rig.left.forearm,-.10-phase*.62);this.target(this.rig.right.forearm,-.10-phase*.55);
      this.target(this.rig.head,.08,phase*.22,phase*.08);
    }else if(state==='death'){
      const fall=1-Math.exp(-t*2.4);rootY=.16*fall;rootRoll=-Math.PI*.5*fall;
      this.fk(this.rig.left,.10,.18,0,-.12,0,0);this.fk(this.rig.right,-.08,.20,0,.12,0,0);
      this.target(this.rig.left.upperArm,.18,0,-.15);this.target(this.rig.right.upperArm,-.12,0,.15);this.target(this.rig.left.forearm,-.12);this.target(this.rig.right.forearm,-.12);
      this.target(this.rig.neck,.15);this.target(this.rig.head,.22,0,.12);
    }

    this.target(this.rig.root,rootPitch,rootYaw,rootRoll);
    this.rootPosition.set(this.restPosition.x,this.restPosition.y+rootY,this.restPosition.z);
    for(const side of ['left','right'] as const){
      const arm=this.rig[side],active=this.magicHands[side]&&state!=='swim'&&state!=='swimMove',bones={shoulder:arm.upperArm,elbow:arm.forearm,wrist:arm.hand};
      if(active&&(state==='walk'||state==='run')){
        const sign=side==='right'?1:-1;
        // Keep the Nimbus arm in its configured display pose while locomotion
        // continues to animate the free arm and the rest of the body.
        this.target(arm.clavicle,0,0,sign*.018);
        this.target(arm.upperArm,.035,0,sign*.038);
        this.target(arm.forearm,-.17,0,0);
        if(side==='left')this.target(arm.hand,0,1.20,0);
        else this.target(arm.hand,0,-.82,-.18);
      }
      for(const key of ['shoulder','elbow','wrist'] as const){
        const bone=bones[key],rotation=active?this.magicArmTuning[key].rotation:[0,0,0],base=this.targets.get(bone)??quat();
        this.targets.set(bone,base.clone().multiply(quat(rotation[0],rotation[1],rotation[2])));
        const offset=active?this.magicArmTuning[key].position:[0,0,0],rest=this.magicRestPositions[side][key];
        bone.position.set(rest.x+offset[0],rest.y+offset[1],rest.z+offset[2]);
      }
    }
    const broomNodes:Partial<Record<BroomRideNode,THREE.Object3D>>={center:this.rig.root,chest:this.rig.chest,leftLeg:this.rig.left.thigh,rightLeg:this.rig.right.thigh,leftShoulder:this.rig.left.upperArm,leftElbow:this.rig.left.forearm,leftWrist:this.rig.left.hand,rightShoulder:this.rig.right.upperArm,rightElbow:this.rig.right.forearm,rightWrist:this.rig.right.hand};
    for(const key of Object.keys(broomNodes) as BroomRideNode[]){
      const bone=broomNodes[key],rest=this.broomRestPositions[key];if(!bone||!rest)continue;
      const tuning=this.broomRideTuning[key],position=tuning.position;
      if(this.broomRiding&&key!=='center')bone.position.set(rest.x+position[0],rest.y+position[1],rest.z+position[2]);
      if(this.broomRiding){const base=this.targets.get(bone)??quat(),rotation=tuning.rotation;this.targets.set(bone,base.clone().multiply(quat(rotation[0],rotation[1],rotation[2])));}
    }
    if(this.broomRiding){const offset=this.broomRideTuning.center.position;this.rootPosition.add(new THREE.Vector3(offset[0],offset[1],offset[2]));}
    const alpha=1-Math.exp(-transitionSpeed*safeDt);for(const [object,target] of this.targets)object.quaternion.slerp(target,alpha);
    this.rig.root.position.lerp(this.rootPosition,alpha);
    this.updateHands(safeDt);
  }

  private updateHands(dt:number){
    for(const side of ['left','right'] as const){
      let pose=this.testHandPose??this.gripPose[side];
      if(!this.testHandPose&&(this.state==='death'||this.state==='swim'||this.state==='swimMove'))pose='Open';
      else if(!this.testHandPose&&this.state==='fall'&&pose==='Relaxed')pose='Open';
      else if(!this.testHandPose&&this.state==='dodge'&&pose==='Relaxed')pose='Fist';
      else if(!this.testHandPose&&this.state==='cast'&&side==='right')pose='Open';
      else if(!this.testHandPose&&(this.state==='mounted'||this.state==='mountedPassenger'))pose='ShieldGrip';
      else if(!this.testHandPose&&this.state==='attack')pose=this.attackArmed?(this.armedHands[side]?'SwordGrip':this.gripPose[side]):'Fist';
      if(this.appliedHandPose[side]!==pose){this.rig[side].handAnimator.setPose(pose);this.appliedHandPose[side]=pose;}
      this.rig[side].handAnimator.update(dt);
    }
  }
  private target(object:THREE.Object3D,x=0,y=0,z=0){this.targets.set(object,quat(x,y,z));}
  private fk(limb:BodySideRig,hip:number,knee:number,ankle:number,spread:number,twist:number,toe:number){
    this.target(limb.thigh,hip,twist,spread);this.target(limb.shin,knee);this.target(limb.ankle,ankle);this.target(limb.foot,toe);
  }
  private legIK(limb:BodySideRig,z:number,lift:number,bendSign:number){
    const l1=.45,l2=.47,targetY=-.90+lift,d=Math.min(l1+l2-.001,Math.hypot(targetY,z));
    const hipOffset=Math.acos(THREE.MathUtils.clamp((l1*l1+d*d-l2*l2)/(2*l1*d),-1,1));
    const direction=Math.atan2(z,-targetY),hip=direction-hipOffset,knee=Math.PI-Math.acos(THREE.MathUtils.clamp((l1*l1+l2*l2-d*d)/(2*l1*l2),-1,1));
    this.target(limb.thigh,hip,0,bendSign*.015);this.target(limb.shin,knee);this.target(limb.ankle,-hip-knee);this.target(limb.foot,0);
  }
}

const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const smootherstep=(t:number)=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};
const smoothstep=(edge0:number,edge1:number,x:number)=>{const t=THREE.MathUtils.clamp((x-edge0)/(edge1-edge0),0,1);return t*t*(3-2*t);};
const mix3=(a:number[],b:number[],t:number):[number,number,number]=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
const mix4=(a:number[],b:number[],t:number):[number,number,number,number]=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t),lerp(a[3],b[3],t)];
const segment=<T extends {p:number}>(keys:T[],phase:number):[T,T]=>{for(let i=0;i<keys.length-1;i++)if(phase<=keys[i+1].p)return[keys[i],keys[i+1]];return[keys[keys.length-2],keys[keys.length-1]];};
