import * as THREE from "three";

export class PerformanceMonitor {
  private readonly element = document.createElement("output");
  private frames = 0;
  private elapsed = 0;
  private fps = 0;
  private longestFrame=0;
  private stages=new Map<string,number>();
  record(name:string,milliseconds:number){this.stages.set(name,Math.max(this.stages.get(name)??0,milliseconds));}
  onSample?: (fps: number) => void;

  constructor(private readonly renderer: THREE.WebGLRenderer) {
    this.element.className = "performance-monitor";
    this.element.setAttribute("aria-label", "Diagnóstico de desempenho");
    document.querySelector("#viewport")?.append(this.element);
  }

  update(delta: number) {
    this.longestFrame=Math.max(this.longestFrame,delta*1000);
    this.frames++; this.elapsed += delta;
    if (this.elapsed < .5) return;
    this.fps = Math.round(this.frames / this.elapsed);
    this.onSample?.(this.fps);
    this.frames = 0; this.elapsed = 0;
    const info = this.renderer.info, memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    const heap = memory ? `${Math.round(memory.usedJSHeapSize / 1048576)} MB` : "n/d";
    this.element.textContent = `${this.fps} FPS · ${info.render.calls} draws · ${info.render.triangles.toLocaleString("pt-BR")} tris · GPU ${info.memory.geometries} geo/${info.memory.textures} tex · RAM ${heap}`;
    this.element.classList.toggle("warning", this.fps < 45);
    const stages=[...this.stages].map(([name,ms])=>`${name} ${ms.toFixed(1)}ms`).join(" · ");
    this.element.textContent+=` · pico ${this.longestFrame.toFixed(0)}ms · ${stages}`;
    this.longestFrame=0;this.stages.clear();
  }
}
