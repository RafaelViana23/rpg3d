import * as THREE from "three";

export class PerformanceMonitor {
  private readonly panel = document.createElement("div");
  attachControl(control:HTMLElement){this.panel.append(control);}
  private readonly element = document.createElement("output");
  private frames = 0;
  private elapsed = 0;
  private fps = 0;
  private hasSample = false;
  private longestFrame=0;
  private frameTimes:number[]=[];
  private frameCursor=0;
  private stages=new Map<string,number>();
  record(name:string,milliseconds:number){this.stages.set(name,Math.max(this.stages.get(name)??0,milliseconds));}
  onSample?: (fps: number) => void;
  reset(){this.frames=0;this.elapsed=0;this.longestFrame=0;this.stages.clear();this.frameTimes=[];this.frameCursor=0;}

  constructor(private readonly renderer: THREE.WebGLRenderer,private readonly scene?:THREE.Scene) {
    this.element.className = "performance-monitor";
    this.panel.className="performance-debug-panel";
    this.panel.hidden=true;
    this.panel.append(this.element);
    window.addEventListener('keydown',event=>{
      if(event.code!=='Tab'||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
      const target=event.target;
      if(target instanceof HTMLElement&&!this.panel.contains(target)&&target.closest('input,textarea,select,button,a,[contenteditable="true"],[role="dialog"]'))return;
      event.preventDefault();
      if(!event.repeat){
        this.panel.hidden=!this.panel.hidden;
        if(this.panel.hidden&&document.activeElement instanceof HTMLElement&&this.panel.contains(document.activeElement))document.activeElement.blur();
      }
    });
    this.element.setAttribute("aria-label", "Diagnóstico de desempenho");
    document.querySelector("#viewport")?.append(this.panel);
  }

  update(delta: number) {
    if(!Number.isFinite(delta)||delta<=0)return;
    const frameMs=delta*1000;
    if (!this.hasSample && this.frames === 0 && this.elapsed === 0) this.fps = Math.round(1 / delta);
    this.frameTimes[this.frameCursor]=frameMs;
    this.frameCursor=(this.frameCursor+1)%300;
    this.longestFrame=Math.max(this.longestFrame,frameMs);
    this.frames++; this.elapsed += delta;
    if (this.elapsed < .5) return;
    this.fps = Math.round(this.frames / this.elapsed);
    this.hasSample = true;
    this.onSample?.(this.fps);
    this.frames = 0; this.elapsed = 0;
    const info = this.renderer.info, memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    const heap = memory ? `${Math.round(memory.usedJSHeapSize / 1048576)} MB` : "n/d";
    let lights=0;
    if(!this.panel.hidden)this.scene?.traverseVisible(o=>{if(o instanceof THREE.PointLight)lights++;});
    this.element.classList.toggle("warning", this.fps < 45);
    if(!this.panel.hidden){
      const sorted=this.frameTimes.slice().sort((a,b)=>a-b);
      const p95=sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))];
      const slow=sorted.filter(ms=>ms>50).length;
      const lines=[
        `${this.fps} FPS`,
        `P95: ${p95.toFixed(1)} ms · >50 ms: ${slow}/${sorted.length}`,
        `Desenhos: ${info.render.calls}`,
        `Triângulos: ${info.render.triangles.toLocaleString("pt-BR")}`,
        `GPU: ${info.memory.geometries} geometrias`,
        `Texturas: ${info.memory.textures}`,
        `RAM: ${heap}`,
        `Luzes: ${lights}`,
        `Shaders: ${info.programs?.length??0}`,
        `Pico: ${this.longestFrame.toFixed(0)} ms`,
        ...[...this.stages].map(([name,ms])=>`${name} (pico): ${ms.toFixed(1)} ms`),
        'Tab · ocultar',
      ];
      this.element.textContent=lines.join('\n');
    }
    this.longestFrame=0;this.stages.clear();
  }
}
