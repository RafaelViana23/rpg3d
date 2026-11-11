import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {AnimationState} from './animation/AnimationController';
import {DEFAULT_CONFIG,ProceduralCharacter} from './character';
import {ProceduralCharacter as LegacyCharacter} from './character.pre-remodel';
import './body-lab.css';

const host=document.querySelector<HTMLDivElement>('#body-lab')!;
host.innerHTML=`<header><div><strong>BODY TOPOLOGY LAB</strong><small>comparação da mesma configuração e animação</small></div><a href="/">Voltar ao lobby</a></header><main><section><div class="labels"><span>ANTES · malha preservada</span><span>DEPOIS · topologia anatômica</span></div><div id="viewport"></div></section><aside><h1>Comparação visual</h1><p>Arraste para orbitar. Os dois modelos compartilham configuração, câmera e estado.</p><label>Animação</label><div id="states"></div><label>Vista</label><div id="views"><button data-view="front">Frente</button><button data-view="side">Lado</button><button data-view="back">Costas</button></div><label>Diagnóstico</label><button id="wire">Alternar wireframe</button></aside></main>`;
const states:AnimationState[]=['idle','walk','run','jump','fall','attack','dodge','death'];
document.querySelector('#states')!.innerHTML=states.map((state,index)=>`<button data-state="${state}" class="${index===0?'active':''}">${state}</button>`).join('');
const viewport=document.querySelector<HTMLDivElement>('#viewport')!;viewport.innerHTML='<div></div><div></div>';
const legacy=new LegacyCharacter(DEFAULT_CONFIG),current=new ProceduralCharacter(DEFAULT_CONFIG);
const makeView=(container:HTMLDivElement,character:LegacyCharacter|ProceduralCharacter)=>{
  const scene=new THREE.Scene();scene.background=new THREE.Color('#14232c');scene.add(character.group);
  const camera=new THREE.PerspectiveCamera(34,1,.01,30);camera.position.set(0,1.42,5.25);
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;container.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight('#e5efff','#392c25',2.1));const key=new THREE.DirectionalLight('#ffd4ad',4);key.position.set(3,5,4);scene.add(key);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(1.7,40),new THREE.MeshStandardMaterial({color:'#57717c',roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.y=.005;scene.add(floor);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1.35,0);controls.enableDamping=true;
  new ResizeObserver(()=>{const w=container.clientWidth,h=container.clientHeight;if(w&&h){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}}).observe(container);
  return{scene,camera,renderer,controls};
};
const containers=[...viewport.children] as HTMLDivElement[],views=[makeView(containers[0],legacy),makeView(containers[1],current)];
let last=performance.now();const render=(now:number)=>{const dt=Math.min((now-last)/1000,.05);last=now;legacy.update(dt);current.update(dt);views.forEach(view=>{view.controls.update();view.renderer.render(view.scene,view.camera);});requestAnimationFrame(render);};requestAnimationFrame(render);
document.querySelectorAll<HTMLButtonElement>('[data-state]').forEach(button=>button.addEventListener('click',()=>{const state=button.dataset.state as AnimationState;legacy.setAnimation(state);current.setAnimation(state);document.querySelectorAll('[data-state]').forEach(item=>item.classList.toggle('active',item===button));}));
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button=>button.addEventListener('click',()=>{const direction=button.dataset.view;views.forEach(view=>{view.camera.position.set(direction==='side'?5.25:0,1.42,direction==='back'?-5.25:direction==='side'?0:5.25);view.controls.target.set(0,1.35,0);view.controls.update();});}));
document.querySelector<HTMLButtonElement>('#wire')!.addEventListener('click',event=>{let enabled=false;views.forEach(view=>view.scene.traverse(object=>{if(object instanceof THREE.Mesh){const materials=Array.isArray(object.material)?object.material:[object.material];for(const material of materials)if(material instanceof THREE.MeshStandardMaterial){material.wireframe=!material.wireframe;enabled=material.wireframe;}}}));(event.currentTarget as HTMLButtonElement).classList.toggle('active',enabled);});
