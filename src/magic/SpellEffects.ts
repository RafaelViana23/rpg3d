import * as THREE from "three";

type Effect = { elapsed: number; duration: number; update: (t: number, delta: number) => void; dispose: () => void };

const additive = (color: THREE.ColorRepresentation, opacity = 1) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

export class SpellEffects {
  private effects: Effect[] = [];
  private iceGroup?: THREE.Group;
  private iceBeam?: THREE.Mesh;
  private iceTip?: THREE.Mesh;
  constructor(private scene: THREE.Scene) {}

  heal(origin: THREE.Vector3) {
    const group = new THREE.Group();
    group.position.copy(origin);
    const rings = [0, 1, 2].map((index) => {
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(0.58 + index * 0.12, 0.025, 8, 48), additive("#63ff91", 0.9));
      mesh.rotation.x = Math.PI / 2;
      mesh.position.y = 0.08 + index * 0.48;
      group.add(mesh);
      return mesh;
    });
    const light = new THREE.PointLight("#65ff91", 4, 5, 2);
    light.position.y = 1.05;
    group.add(light);
    this.scene.add(group);
    this.effects.push({
      elapsed: 0, duration: 1.15,
      update: (t) => {
        rings.forEach((ring, index) => {
          const phase = Math.min(1, Math.max(0, t * 1.35 - index * 0.12));
          ring.position.y = 0.08 + phase * 1.85;
          ring.scale.setScalar(0.65 + Math.sin(phase * Math.PI) * 0.7);
          (ring.material as THREE.MeshBasicMaterial).opacity = Math.sin(phase * Math.PI) * 0.9;
        });
        light.intensity = Math.sin(Math.min(1, t) * Math.PI) * 5;
      },
      dispose: () => { this.scene.remove(group); group.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } }); },
    });
  }

  firebolt(origin: THREE.Vector3, target: THREE.Vector3, onImpact: () => void) {
    const group = new THREE.Group();
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), additive("#fff0a0"));
    const flame = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), additive("#ff4a16", 0.62));
    const light = new THREE.PointLight("#ff5522", 8, 6, 2);
    group.add(core, flame, light);
    group.position.copy(origin);
    this.scene.add(group);
    let impacted = false;
    this.effects.push({
      elapsed: 0, duration: 0.72,
      update: (t) => {
        const travel = Math.min(1, t / 0.78);
        group.position.lerpVectors(origin, target, 1 - Math.pow(1 - travel, 2));
        group.position.y += Math.sin(travel * Math.PI) * 0.35;
        flame.rotation.x += 0.2; flame.rotation.y += 0.28;
        flame.scale.setScalar(0.85 + Math.sin(t * 32) * 0.18);
        if (travel >= 1 && !impacted) { impacted = true; onImpact(); core.scale.setScalar(3.2); flame.scale.setScalar(4.5); light.intensity = 16; }
      },
      dispose: () => { this.scene.remove(group); group.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } }); },
    });
  }

  lightning(origin: THREE.Vector3, target: THREE.Vector3, onImpact: () => void) {
    const group = new THREE.Group();
    const materials: THREE.MeshBasicMaterial[] = [];
    const makeBolt = (start: THREE.Vector3, end: THREE.Vector3, radius: number, jitter: number, color: string) => {
      const points: THREE.Vector3[] = [], segments = 10;
      for (let i = 0; i <= segments; i++) {
        const p = start.clone().lerp(end, i / segments);
        if (i > 0 && i < segments) { p.x += (Math.random() - .5) * jitter; p.y += (Math.random() - .5) * jitter; p.z += (Math.random() - .5) * jitter; }
        points.push(p);
      }
      const material = additive(color, .95); materials.push(material);
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, radius, 6, false), material);
      group.add(mesh);
    };
    // Four heavy parallel arcs make the strike feel like a magical discharge,
    // with short branches breaking away around the middle.
    for (let i = 0; i < 4; i++) makeBolt(origin, target, .025 + i * .006, .25 + i * .07, i === 0 ? "#ffffff" : "#66cfff");
    const direction = target.clone().sub(origin);
    for (let i = 0; i < 7; i++) {
      const branchStart = origin.clone().addScaledVector(direction, .28 + Math.random() * .55);
      const branchEnd = branchStart.clone().add(new THREE.Vector3((Math.random()-.5)*1.25, (Math.random()-.2)*.8, (Math.random()-.5)*1.25));
      makeBolt(branchStart, branchEnd, .014 + Math.random() * .012, .18, "#86ddff");
    }
    const flash = new THREE.PointLight("#8fdcff", 18, 8, 2);
    flash.position.copy(target);
    this.scene.add(group, flash);
    onImpact();
    this.effects.push({
      elapsed: 0, duration: 0.32,
      update: (t) => { const fade = Math.max(0,1-t); materials.forEach((material,index)=>material.opacity=fade*(index%2?.72:1)); group.visible=Math.sin(t*52)>-.35; flash.intensity = fade * 24; },
      dispose: () => { this.scene.remove(group, flash); group.traverse((o)=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});materials.forEach((m)=>m.dispose()); },
    });
  }

  iceStream(origin: THREE.Vector3, target: THREE.Vector3) {
    if (!this.iceGroup) {
      this.iceGroup = new THREE.Group();
      this.iceBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(1, .55, 1, 8, 1, true),
        additive("#78ddff", .62),
      );
      this.iceTip = new THREE.Mesh(new THREE.IcosahedronGeometry(.2, 1), additive("#d8f8ff", .9));
      this.iceGroup.add(this.iceBeam, this.iceTip, new THREE.PointLight("#75dfff", 5, 5, 2));
      for (let i = 0; i < 9; i++) {
        const shard = new THREE.Mesh(new THREE.OctahedronGeometry(.045 + i % 3 * .018, 0), additive("#c9f5ff", .8));
        shard.userData.phase = i / 9;
        this.iceGroup.add(shard);
      }
      this.scene.add(this.iceGroup);
    }
    this.iceGroup.visible = true;
    const direction = target.clone().sub(origin), length = Math.max(.01, direction.length()), midpoint = origin.clone().lerp(target, .5);
    direction.normalize();
    this.iceBeam!.position.copy(midpoint);
    this.iceBeam!.scale.set(.075, length, .075);
    this.iceBeam!.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    this.iceTip!.position.copy(target);
    this.iceTip!.rotation.x += .18; this.iceTip!.rotation.y += .24;
    const time = performance.now() * .001;
    this.iceGroup.children.slice(3).forEach((object, index) => {
      const phase = (object.userData.phase + time * (.65 + index * .025)) % 1;
      object.position.copy(origin).lerp(target, phase);
      object.position.x += Math.sin(time * 7 + index) * .11;
      object.position.y += Math.cos(time * 6 + index * 2) * .08;
    });
  }

  stopIceStream() { if (this.iceGroup) this.iceGroup.visible = false; }

  update(delta: number) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.elapsed += delta;
      effect.update(effect.elapsed / effect.duration, delta);
      if (effect.elapsed >= effect.duration) { effect.dispose(); this.effects.splice(i, 1); }
    }
  }
}
