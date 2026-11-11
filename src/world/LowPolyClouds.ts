import * as THREE from "three";
import type { WeatherType } from "./WeatherSystem";

export type CloudQuality = "low" | "medium" | "high";

export interface LowPolyCloudConfig {
  enabled: boolean;
  quality: CloudQuality;
  windSpeed: number;
  windDirection: THREE.Vector2;
  shadowOpacity: number;
}

const DEFAULT_CONFIG: LowPolyCloudConfig = {
  enabled: true,
  quality: "medium",
  windSpeed: .34,
  windDirection: new THREE.Vector2(1, .22).normalize(),
  shadowOpacity: .16,
};

const CLUSTERS: Record<CloudQuality, number> = { low: 38, medium: 64, high: 84 };
const LOBES_PER_CLUSTER = 5;

function seededRandom(seed = 481516) {
  return () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
}

function createShadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d")!;
  const random = seededRandom(9127);
  for (let index = 0; index < 22; index++) {
    const x = random() * 256, y = random() * 256, radius = 10 + random() * 25;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, "rgba(20,38,48,.5)");
    gradient.addColorStop(.55, "rgba(20,38,48,.22)");
    gradient.addColorStop(1, "rgba(20,38,48,0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.ellipse(x, y, radius * (1.2 + random()), radius * (.5 + random() * .35), random() * Math.PI, 0, Math.PI * 2);
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 10);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class LowPolyClouds {
  readonly config: LowPolyCloudConfig;
  readonly group = new THREE.Group();
  private readonly clouds: THREE.InstancedMesh;
  private readonly cloudMaterial: THREE.MeshLambertMaterial;
  private readonly shadow: THREE.Mesh;
  private readonly shadowTexture: THREE.CanvasTexture;
  private readonly dayColor = new THREE.Color("#fff8ed");
  private readonly nightColor = new THREE.Color("#2b3854");
  private readonly stormColor = new THREE.Color("#687681");
  private readonly currentColor = new THREE.Color();
  private elapsed = 0;
  private storm = 0;
  private day = 1;

  constructor(scene: THREE.Scene, config: Partial<LowPolyCloudConfig> = {}) {
    this.group.name = "Sistema de nuvens low-poly";
    this.group.userData.buildEditable = false;
    this.config = { ...DEFAULT_CONFIG, ...config, windDirection: config.windDirection?.clone() ?? DEFAULT_CONFIG.windDirection.clone() };
    const clusterCount = CLUSTERS[this.config.quality];
    const geometry = new THREE.IcosahedronGeometry(1, 1);
    this.cloudMaterial = new THREE.MeshLambertMaterial({ color: this.dayColor, emissive: "#727b84", emissiveIntensity: .72, transparent: true, opacity: .9, depthWrite: false, flatShading: true, fog: false });
    this.clouds = new THREE.InstancedMesh(geometry, this.cloudMaterial, clusterCount * LOBES_PER_CLUSTER);
    this.clouds.name = "Nuvens low-poly instanciadas";
    this.clouds.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    this.clouds.frustumCulled = false;
    this.clouds.renderOrder = -80;
    this.buildClouds(clusterCount);
    this.group.add(this.clouds);

    this.shadowTexture = createShadowTexture();
    const shadowMaterial = new THREE.MeshBasicMaterial({
      map: this.shadowTexture, color: "#263640", transparent: true, opacity: 0,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    });
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1100), shadowMaterial);
    this.shadow.name = "Sombras estilizadas das nuvens";
    this.shadow.userData.buildEditable = false;
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = .035;
    this.shadow.renderOrder = 1;
    scene.add(this.group, this.shadow);
    this.group.visible = this.config.enabled;
  }

  private buildClouds(clusterCount: number) {
    const random = seededRandom();
    const transform = new THREE.Object3D();
    const color = new THREE.Color();
    let instance = 0;
    for (let cluster = 0; cluster < clusterCount; cluster++) {
      // Cloud coordinates form a broad sky tile instead of a small ring
      // around the castle. The complete tile follows the explored region in
      // update(), so every biome receives the same sky coverage.
      const centerX = (random() - .5) * 1000;
      const centerZ = (random() - .5) * 1000;
      const centerY = 90 + random() * 55;
      const size = 4 + random() * 5;
      const stretch = 1.2 + random() * .85;
      for (let lobe = 0; lobe < LOBES_PER_CLUSTER; lobe++) {
        const side = (lobe - 2) / 2;
        transform.position.set(
          centerX + side * size * .68 + (random() - .5) * size * .35,
          centerY + (lobe === 2 ? size * .22 : (random() - .55) * size * .28),
          centerZ + (random() - .5) * size * .75,
        );
        const lobeScale = .62 + random() * .48;
        transform.scale.set(size * lobeScale * stretch, size * (.3 + random() * .16), size * (.58 + random() * .28));
        transform.rotation.set(random() * .24, random() * Math.PI, random() * .14);
        transform.updateMatrix();
        this.clouds.setMatrixAt(instance, transform.matrix);
        color.setHSL(.58 + random() * .02, .12, .86 + random() * .1);
        this.clouds.setColorAt(instance, color);
        instance++;
      }
    }
    this.clouds.instanceMatrix.needsUpdate = true;
    if (this.clouds.instanceColor) this.clouds.instanceColor.needsUpdate = true;
  }

  update(delta: number, center: THREE.Vector3, daylight: number, weather: WeatherType) {
    this.elapsed += delta;
    const targetStorm = weather === "rain" ? 1 : weather === "snow" ? .58 : 0;
    const response = 1 - Math.exp(-delta * .34);
    this.storm = THREE.MathUtils.lerp(this.storm, targetStorm, response);
    this.day = THREE.MathUtils.lerp(this.day, daylight, 1 - Math.exp(-delta * .8));
    const wind = this.config.windDirection;
    const travel = this.elapsed * this.config.windSpeed;
    // Keep a kilometer-wide cloud tile over the player's current region.
    // Wind still moves it independently, while travelling to another biome
    // can no longer leave all clouds behind over the castle.
    this.group.position.set(
      center.x + Math.sin(travel * .035) * 32 * wind.x,
      0,
      center.z + Math.sin(travel * .028) * 32 * wind.y,
    );
    this.shadow.position.set(center.x, .035, center.z);
    this.shadowTexture.offset.set((travel * .008) % 1, (travel * .004) % 1);
    this.currentColor.copy(this.nightColor).lerp(this.dayColor, this.day).lerp(this.stormColor, this.storm * .78);
    this.cloudMaterial.color.copy(this.currentColor);
    this.cloudMaterial.emissive.copy(this.currentColor).multiplyScalar(.64);
    this.cloudMaterial.opacity = THREE.MathUtils.lerp(.82, .96, this.storm);
    const shadowMaterial = this.shadow.material as THREE.MeshBasicMaterial;
    shadowMaterial.opacity = this.config.shadowOpacity * this.day * THREE.MathUtils.lerp(.7, 1.25, this.storm);
    this.shadow.visible = this.config.enabled && this.day > .05;
  }

  dispose() {
    this.group.removeFromParent();
    this.shadow.removeFromParent();
    this.clouds.geometry.dispose();
    (this.clouds.material as THREE.Material).dispose();
    this.shadow.geometry.dispose();
    (this.shadow.material as THREE.Material).dispose();
    this.shadowTexture.dispose();
  }
}
