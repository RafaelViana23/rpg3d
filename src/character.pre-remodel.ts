import * as THREE from 'three';
import { AnimationController, AnimationState } from './animation/AnimationController';
import { GripSolver } from './hand/GripSolver';
import { HandAnimator } from './hand/HandAnimator';
import { HandMesh } from './hand/HandMesh';
import { HandRig } from './hand/HandRig';

export type CharacterConfig = {
  name: string;
  body: 'masculino' | 'feminino';
  className: 'Espadachim' | 'Guardião' | 'Explorador';
  hairStyle: 'curto' | 'longo' | 'espetado';
  skin: string; hair: string; outfit: string; eyes: string;
  height: number;
};

export type HeldItem = 'espada' | 'escudo' | 'pocao' | 'nenhum';

export const DEFAULT_CONFIG: CharacterConfig = {
  name: '', body: 'masculino', className: 'Espadachim', hairStyle: 'curto',
  skin: '#d8a17b', hair: '#3d2921', outfit: '#456b57', eyes: '#467c9d', height: 1
};

const mat = (hex: string, metalness = 0, roughness = metalness ? .34 : .78) =>
  new THREE.MeshStandardMaterial({ color: hex, roughness, metalness, flatShading: true, side: THREE.DoubleSide });
const shadow = (mesh: THREE.Mesh) => { mesh.castShadow = true; mesh.receiveShadow = true; return mesh; };

function loft(parent: THREE.Object3D, rings: number[][], material: THREE.Material, segments = 14): THREE.Mesh {
  const vertices: number[] = [], indices: number[] = [];
  rings.forEach(([x, y, z, rx, rz], j) => {
    for (let i = 0; i < segments; i++) {
      const a = i / segments * Math.PI * 2;
      vertices.push(x + Math.cos(a) * rx, y, z + Math.sin(a) * rz);
      if (j < rings.length - 1) {
        const n = j * segments + i, next = j * segments + (i + 1) % segments;
        indices.push(n, n + segments, next, next, n + segments, next + segments);
      }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const mesh = shadow(new THREE.Mesh(geometry, material)); parent.add(mesh); return mesh;
}

function ell(parent: THREE.Object3D, x: number, y: number, z: number, rx: number, ry: number, rz: number, material: THREE.Material) {
  const rings: number[][] = [];
  for (let j = 0; j <= 10; j++) {
    const a = -Math.PI / 2 + j / 10 * Math.PI;
    rings.push([x, y + Math.sin(a) * ry, z, Math.max(.002, Math.cos(a) * rx), Math.max(.002, Math.cos(a) * rz)]);
  }
  return loft(parent, rings, material);
}

function box(parent: THREE.Object3D, width: number, height: number, depth: number, x: number, y: number, z: number, material: THREE.Material) {
  const mesh = shadow(new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material));
  mesh.position.set(x, y, z); parent.add(mesh); return mesh;
}

function cylinder(parent: THREE.Object3D, rt: number, rb: number, height: number, material: THREE.Material, segments = 10) {
  const mesh = shadow(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, height, segments), material)); parent.add(mesh); return mesh;
}

export class ProceduralCharacter {
  readonly group = new THREE.Group();
  private parts = new THREE.Group();
  private neck = new THREE.Bone(); private head = new THREE.Bone(); private headVisual = new THREE.Group();
  private leftClavicle = new THREE.Bone(); private rightClavicle = new THREE.Bone();
  private leftUpperArm = new THREE.Bone(); private rightUpperArm = new THREE.Bone();
  private leftForearm = new THREE.Bone(); private rightForearm = new THREE.Bone();
  private leftHand = new THREE.Bone(); private rightHand = new THREE.Bone();
  private leftThigh = new THREE.Bone(); private rightThigh = new THREE.Bone();
  private leftShin = new THREE.Bone(); private rightShin = new THREE.Bone();
  private leftAnkle = new THREE.Bone(); private rightAnkle = new THREE.Bone();
  private leftFoot = new THREE.Bone(); private rightFoot = new THREE.Bone();
  private leftGrip = new THREE.Group(); private rightGrip = new THREE.Group();
  private skinColor = DEFAULT_CONFIG.skin;
  private leftItem: HeldItem = 'nenhum'; private rightItem: HeldItem = 'espada';
  private leftHandRig?:HandRig;private rightHandRig?:HandRig;
  private leftHandAnimator?:HandAnimator;private rightHandAnimator?:HandAnimator;
  private leftGripSolver?:GripSolver;private rightGripSolver?:GripSolver;
  private animation:AnimationState='idle';
  private animationController?:AnimationController;
  private debugEnabled=false;
  private debugHelper?:THREE.SkeletonHelper;
  private debugAxes:THREE.AxesHelper[]=[];

  constructor(config: CharacterConfig) { this.parts.name='parts';this.group.add(this.parts); this.rebuild(config); }
  setAnimation(value:AnimationState){this.animation=value;this.animationController?.setState(value);}
  setHandTestPose(pose:'Open'|'Relaxed'|'Fist'|'SwordGrip'|'ShieldGrip'|'Point'|null){this.animationController?.setHandTestPose(pose);}
  setDebug(enabled:boolean){this.debugEnabled=enabled;if(this.debugHelper)this.debugHelper.visible=enabled;for(const axes of this.debugAxes)axes.visible=enabled;}
  equipRightHand(item: HeldItem) { this.rightItem=item;this.rightGripSolver?.setGrip(item);this.animationController?.setGripPose('right',this.poseForItem(item));this.buildHeldItem(this.rightGrip,item,true); }
  equipLeftHand(item: HeldItem) { this.leftItem=item;this.leftGripSolver?.setGrip(item);this.animationController?.setGripPose('left',this.poseForItem(item));this.buildHeldItem(this.leftGrip,item,false); }
  private poseForItem(item:HeldItem){return item==='espada'?'SwordGrip':item==='escudo'||item==='pocao'?'ShieldGrip':'Relaxed' as const;}

  private clearObject(root: THREE.Object3D) {
    root.traverse(obj => { if (obj instanceof THREE.Mesh) { obj.geometry.dispose(); const ms = Array.isArray(obj.material) ? obj.material : [obj.material]; ms.forEach(m => m.dispose()); } });
    root.clear();
  }

  private buildHeldItem(grip: THREE.Group, item: HeldItem, right: boolean) {
    this.clearObject(grip);
    const steel = mat('#d9e6ed', .82, .2), gold = mat('#d7aa61', .58, .28), leather = mat('#5d3d29', 0, .7);
    if (item === 'espada') {
      // Anatomical grip: handle crosses the palm on X; the blade exits on the thumb side.
      const thumb = right ? 1 : -1, weapon = new THREE.Group();weapon.name='equipment.sword';weapon.userData.bladeDirection=thumb;grip.add(weapon);
      box(weapon, .25, .055, .055, 0, 0, 0, leather);
      box(weapon, .055, .28, .10, thumb*.155, 0, 0, gold);
      box(weapon, .72, .068, .038, thumb*.54, 0, 0, steel);
      const bx=thumb*.90, ax=thumb*1.04, w=.034, d=.019;
      const points=[bx,-w,-d,bx,w,-d,bx,w,d,bx,-w,d,ax,0,0];
      const tipGeometry=new THREE.BufferGeometry();tipGeometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
      tipGeometry.setIndex([0,2,1,0,3,2,0,1,4,1,2,4,2,3,4,3,0,4]);tipGeometry.computeVertexNormals();
      weapon.add(shadow(new THREE.Mesh(tipGeometry,steel)));
    } else if (item === 'escudo') {
      const shield = new THREE.Group(); shield.rotation.x = Math.PI / 2; shield.position.set(0, 0, .16); grip.add(shield);
      shield.add(shadow(new THREE.Mesh(new THREE.CylinderGeometry(.31, .36, .07, 8), mat('#425b6d', .25, .45))));
      const handle=cylinder(grip,.026,.026,.23,leather,8);handle.rotation.z=Math.PI/2;handle.position.z=.055;
      const boss = shadow(new THREE.Mesh(new THREE.SphereGeometry(.10, 10, 6), gold)); boss.position.y = -.055; shield.add(boss);
      for (let i = 0; i < 8; i++) { const stud = shadow(new THREE.Mesh(new THREE.SphereGeometry(.022, 6, 4), gold)); const a=i/8*Math.PI*2; stud.position.set(Math.cos(a)*.265,-.058,Math.sin(a)*.265); shield.add(stud); }
    } else if (item === 'pocao') {
      const bottle = new THREE.Group(); bottle.position.y = -.42; grip.add(bottle);
      const glass = new THREE.MeshPhysicalMaterial({color:'#7ad8ee',transparent:true,opacity:.62,roughness:.12,transmission:.25});
      cylinder(bottle,.105,.14,.30,glass,12).position.y=.18; cylinder(bottle,.055,.07,.13,glass,10).position.y=.39; cylinder(bottle,.065,.065,.055,leather,8).position.y=.48;
      cylinder(bottle,.095,.125,.17,mat('#e83e76',.05,.2),12).position.y=.105;
    }
  }

  private buildArm(side: -1 | 1, shoulder: number, coat: THREE.Material, skin: THREE.Material) {
    const clavicle = side === -1 ? this.leftClavicle : this.rightClavicle;
    const upper = side === -1 ? this.leftUpperArm : this.rightUpperArm;
    const fore = side === -1 ? this.leftForearm : this.rightForearm;
    const suffix=side===-1?'L':'R';clavicle.name=`Clavicle_${suffix}`;upper.name=`UpperArm_${suffix}`;fore.name=`Forearm_${suffix}`;
    clavicle.position.set(0,1.82,0);this.parts.add(clavicle);
    upper.position.set(side * shoulder, .09, 0); clavicle.add(upper);
    loft(upper, [[0,0,0,.155,.15],[side*.045,-.17,0,.145,.135],[side*.075,-.36,.01,.115,.11]], coat);
    ell(upper,side*.075,-.38,.01,.125,.105,.115,coat);
    fore.position.set(side*.075,-.38,.01); upper.add(fore);
    loft(fore, [[0,0,0,.105,.105],[side*.035,-.18,.012,.09,.085],[side*.055,-.35,.025,.07,.065]], skin);
    const rig=new HandRig(side===1?'right':'left');rig.root.position.set(side*.055,-.35,.025);fore.add(rig.root);HandMesh.create(rig,this.skinColor);
    const animator=new HandAnimator(rig),solver=new GripSolver(rig,animator);
    if(side===-1){this.leftHandRig=rig;this.leftHand=rig.wrist;this.leftGrip=rig.socket;this.leftHandAnimator=animator;this.leftGripSolver=solver;}
    else{this.rightHandRig=rig;this.rightHand=rig.wrist;this.rightGrip=rig.socket;this.rightHandAnimator=animator;this.rightGripSolver=solver;}
  }

  private buildLeg(side: -1 | 1, trousers: THREE.Material, boots: THREE.Material) {
    const thigh = side === -1 ? this.leftThigh : this.rightThigh;
    const shin = side === -1 ? this.leftShin : this.rightShin;
    const ankle = side === -1 ? this.leftAnkle : this.rightAnkle;
    const foot = side === -1 ? this.leftFoot : this.rightFoot;
    const suffix=side===-1?'L':'R';thigh.name=`Thigh_${suffix}`;shin.name=`Shin_${suffix}`;ankle.name=`Ankle_${suffix}`;foot.name=`Foot_${suffix}`;
    thigh.position.set(side*.18,1.08,0); this.parts.add(thigh);
    loft(thigh,[[0,0,0,.18,.16],[side*.01,-.22,0,.17,.155],[side*.015,-.43,.015,.13,.13]],trousers); ell(thigh,side*.015,-.45,.015,.135,.11,.13,trousers);
    shin.position.set(side*.015,-.45,.015); thigh.add(shin);
    loft(shin,[[0,0,0,.13,.12],[0,-.25,.01,.145,.14],[0,-.47,.02,.12,.12]],boots);
    ankle.position.set(0,-.47,.02);shin.add(ankle);foot.position.set(0,-.03,.12);ankle.add(foot);ell(foot,0,0,.02,.155,.105,.25,boots);
  }

  rebuild(config: CharacterConfig) {
    if(this.debugHelper){this.group.remove(this.debugHelper);this.debugHelper.geometry.dispose();(this.debugHelper.material as THREE.Material).dispose();this.debugHelper=undefined;}
    for(const axes of this.debugAxes){axes.removeFromParent();axes.geometry.dispose();(axes.material as THREE.Material).dispose();}this.debugAxes=[];
    this.leftHandRig?.dispose();this.rightHandRig?.dispose();
    this.clearObject(this.parts);
    this.leftClavicle = new THREE.Bone(); this.rightClavicle = new THREE.Bone(); this.leftUpperArm = new THREE.Bone(); this.rightUpperArm = new THREE.Bone(); this.leftForearm = new THREE.Bone(); this.rightForearm = new THREE.Bone();
    this.leftHand = new THREE.Bone(); this.rightHand = new THREE.Bone();this.leftHandRig=undefined;this.rightHandRig=undefined;this.leftHandAnimator=undefined;this.rightHandAnimator=undefined;this.leftGripSolver=undefined;this.rightGripSolver=undefined;
    this.leftThigh = new THREE.Bone(); this.rightThigh = new THREE.Bone(); this.leftShin = new THREE.Bone(); this.rightShin = new THREE.Bone();
    this.leftAnkle = new THREE.Bone(); this.rightAnkle = new THREE.Bone(); this.leftFoot = new THREE.Bone(); this.rightFoot = new THREE.Bone();
    this.leftGrip = new THREE.Group(); this.rightGrip = new THREE.Group();
    this.neck=new THREE.Bone();this.neck.name='Neck';this.head=new THREE.Bone();this.head.name='Head';this.headVisual=new THREE.Group();
    this.skinColor=config.skin;
    const skin = mat(config.skin, 0, .62), hair = mat(config.hair, 0, .72), coat = mat(config.outfit, 0, .78);
    const shade = mat(new THREE.Color(config.outfit).multiplyScalar(.62).getStyle(), 0, .86);
    const trousers = mat('#293344',0,.8), boots = mat('#49382d',0,.72), belt = mat('#60452e',0,.68), gold = mat('#d7aa61', .45, .3), white = mat('#f1eee5',0,.38), iris = mat(config.eyes,0,.3), black = mat('#161d22',0,.5);
    const feminine = config.body === 'feminino', shoulder = feminine ? .34 : .43, waist = feminine ? .255 : .305, hip = feminine ? .35 : .30;
    loft(this.parts, [[0,1.06,0,hip,.20],[0,1.27,0,waist,.19],[0,1.51,0,waist*.94,.19],[0,1.76,0,shoulder,.235],[0,1.91,0,shoulder*.91,.23],[0,2.02,0,.15,.13]],coat);
    loft(this.parts, [[0,1.11,0,hip+.02,.22],[0,1.17,0,hip+.025,.22],[0,1.24,0,hip,.21]],belt); box(this.parts,.14,.12,.07,0,1.17,.23,gold);
    loft(this.parts,[[0,2.01,0,.115,.115],[0,2.17,0,.12,.12]],skin);
    this.neck.position.set(0,2.02,0);this.parts.add(this.neck);this.head.position.set(0,.15,0);this.neck.add(this.head);this.headVisual.position.y=-2.17;this.head.add(this.headVisual);
    loft(this.headVisual,[[0,2.15,.01,.10,.11],[0,2.21,.02,.17,.17],[0,2.29,.018,.215,.20],[0,2.40,.025,.247,.226],[0,2.55,-.01,.253,.23],[0,2.66,-.02,.20,.18],[0,2.71,-.02,.055,.06]],skin);
    loft(this.headVisual,[[0,2.56,-.045,.253,.23],[0,2.67,-.045,.267,.24],[0,2.76,-.055,.20,.18],[0,2.79,-.055,.025,.025]],hair);
    for (const side of [-1,1] as const) {
      ell(this.headVisual,side*.255,2.40,-.005,.052,.084,.054,skin);
      ell(this.headVisual,side*.102,2.43,.210,.066,.059,.025,white); ell(this.headVisual,side*.102,2.43,.233,.034,.042,.015,iris); ell(this.headVisual,side*.102,2.43,.246,.014,.027,.008,black);
      const brow=box(this.headVisual,.11,.018,.018,side*.102,2.515,.244,hair); brow.rotation.z=side*.08;
      this.buildArm(side, shoulder, coat, skin); this.buildLeg(side, trousers, boots);
      if (config.hairStyle === 'longo') ell(this.headVisual,side*.22,2.30,-.105,.095,.33,.125,hair);
      else if (config.hairStyle === 'espetado') for(let i=0;i<4;i++) { const spike=shadow(new THREE.Mesh(new THREE.ConeGeometry(.095,.25,5),hair)); spike.position.set(side*(.04+i*.053),2.77+(i%2)*.035,-.04); spike.rotation.z=side*.32; this.headVisual.add(spike); }
    }
    ell(this.headVisual,0,2.35,.232,.047,.065,.06,skin); box(this.headVisual,.10,.018,.012,0,2.285,.245,mat('#8d514b',0,.55));
    if(config.hairStyle !== 'espetado') for(let i=-2;i<=2;i++) ell(this.headVisual,i*.085,2.62,.165,.07,.13,.085,hair);
    const strap=box(this.parts,.075,.86,.03,.12,1.58,.239,belt); strap.rotation.z=.34;
    if(config.className==='Explorador') loft(this.parts,[[0,1.93,-.22,.34,.04],[0,1.49,-.26,.42,.045],[0,.94,-.28,.51,.055]],shade);
    this.parts.scale.setScalar(config.height);
    this.equipRightHand('espada'); this.equipLeftHand(config.className === 'Guardião' ? 'escudo' : 'nenhum');
    if(this.leftHandAnimator&&this.rightHandAnimator){
      this.animationController=new AnimationController({root:this.parts,neck:this.neck,head:this.head,left:{clavicle:this.leftClavicle,upperArm:this.leftUpperArm,forearm:this.leftForearm,thigh:this.leftThigh,shin:this.leftShin,ankle:this.leftAnkle,foot:this.leftFoot,hand:this.leftHand,handAnimator:this.leftHandAnimator},right:{clavicle:this.rightClavicle,upperArm:this.rightUpperArm,forearm:this.rightForearm,thigh:this.rightThigh,shin:this.rightShin,ankle:this.rightAnkle,foot:this.rightFoot,hand:this.rightHand,handAnimator:this.rightHandAnimator}});
      this.animationController.setGripPose('right',this.poseForItem(this.rightItem));this.animationController.setGripPose('left',this.poseForItem(this.leftItem));this.animationController.setState(this.animation);
    }
    this.debugHelper=new THREE.SkeletonHelper(this.parts);this.debugHelper.name='debug.skeleton';this.debugHelper.visible=this.debugEnabled;this.group.add(this.debugHelper);
    for(const anchor of [this.leftGrip,this.rightGrip,this.leftFoot,this.rightFoot]){const axes=new THREE.AxesHelper(.16);axes.name=`debug.axes.${anchor.name||anchor.type}`;axes.visible=this.debugEnabled;anchor.add(axes);this.debugAxes.push(axes);}
  }

  update(dt: number) {
    this.animationController?.update(dt);
  }
}
