export type AudioSettings={master:number;music:number;voice:number;effects:number};
const AUDIO_SETTINGS_KEY='rpg3d.audio-settings.v1';
const DEFAULT_AUDIO_SETTINGS:AudioSettings={master:.8,music:.3,voice:.8,effects:.8};
const clampVolume=(value:number)=>Math.min(1,Math.max(0,value));
const loadAudioSettings=():AudioSettings=>{try{return {...DEFAULT_AUDIO_SETTINGS,...JSON.parse(localStorage.getItem(AUDIO_SETTINGS_KEY)??'{}')}}catch{return {...DEFAULT_AUDIO_SETTINGS}}};

export class GameAudio{
  private context?:AudioContext;
  private music?:HTMLAudioElement;
  private flightLoop?:HTMLAudioElement;
  private fastFlightLoop?:HTMLAudioElement;
  private effectsBus?:GainNode;
  private settings=loadAudioSettings();
  private breathTimer=0;
  private flightActive=false;
  private flightBoosting=false;
  private readonly animalFiles={bear:'/audio/animals/bear-attack.mp3',puma:'/audio/animals/puma-attack.mp3',wolf:'/audio/animals/wolf-attack.mp3',howl:'/audio/animals/wolf-howl.mp3'} as const;
  getSettings(){return {...this.settings};}
  setSettings(next:Partial<AudioSettings>){
    this.settings={...this.settings,...next};
    (Object.keys(this.settings) as Array<keyof AudioSettings>).forEach((key)=>this.settings[key]=clampVolume(Number(this.settings[key])));
    localStorage.setItem(AUDIO_SETTINGS_KEY,JSON.stringify(this.settings));this.applySettings();
  }
  private applySettings(){
    if(this.music)this.music.volume=this.settings.master*this.settings.music;
    if(this.effectsBus)this.effectsBus.gain.value=this.settings.master*this.settings.effects;
    const flightVolume=this.settings.master*this.settings.effects;
    if(this.flightLoop)this.flightLoop.volume=Math.min(1,flightVolume*1.15);
    if(this.fastFlightLoop)this.fastFlightLoop.volume=flightVolume*.25;
  }
  private effectDestination(){return this.effectsBus??this.context?.destination;}
  ensureStarted(){
    if(!this.context)this.context=new AudioContext();if(!this.effectsBus){this.effectsBus=this.context.createGain();this.effectsBus.connect(this.context.destination);}if(this.context.state==='suspended')void this.context.resume();
    if(!this.music){
      this.music=new Audio('/audio/large-city-theme.mp3');this.music.loop=true;this.music.preload='metadata';
    }
    if(!this.flightLoop){this.flightLoop=new Audio('/audio/fly-loop.mp3');this.flightLoop.loop=true;this.flightLoop.preload='auto';}
    if(!this.fastFlightLoop){this.fastFlightLoop=new Audio('/audio/fly-fast-loop.mp3');this.fastFlightLoop.loop=true;this.fastFlightLoop.preload='auto';}
    this.applySettings();
    if(this.music.paused)void this.music.play().catch(()=>{/* A próxima interação tenta novamente. */});
  }
  private noise(duration:number,volume:number,frequency:number){const context=this.context,destination=this.effectDestination();if(!context||!destination)return;const length=Math.ceil(context.sampleRate*duration),buffer=context.createBuffer(1,length,context.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(1-i/length);const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=frequency;gain.gain.setValueAtTime(volume,context.currentTime);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+duration);source.connect(filter).connect(gain).connect(destination);source.start();}
  private tone(frequency:number,duration:number,volume:number,type:OscillatorType='sine'){const context=this.context,destination=this.effectDestination();if(!context||!destination)return;const oscillator=context.createOscillator(),gain=context.createGain();oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,context.currentTime);oscillator.frequency.exponentialRampToValueAtTime(Math.max(30,frequency*.45),context.currentTime+duration);gain.gain.setValueAtTime(volume,context.currentTime);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+duration);oscillator.connect(gain).connect(destination);oscillator.start();oscillator.stop(context.currentTime+duration);}
  attack(armed:boolean){this.ensureStarted();if(armed){this.noise(.24,.07,2800);this.tone(620,.18,.035,'triangle');}else{this.noise(.11,.045,850);this.tone(105,.09,.025,'sine');}}
  hit(){this.ensureStarted();this.noise(.16,.13,620);this.tone(72,.14,.08,'sine');}
  private playAnimalFile(kind:keyof GameAudio['animalFiles'],volume=1){this.ensureStarted();const audio=new Audio(this.animalFiles[kind]);audio.volume=Math.min(1,this.settings.master*this.settings.effects*volume);void audio.play().catch(()=>{/* A próxima interação libera o áudio. */});}
  animalAttack(kind:'bear'|'puma'|'wolf'){this.playAnimalFile(kind,kind==='wolf'?.16:.2);}
  // The mountain howl is a global ambience cue: no positional attenuation,
  // so it remains audible from the city, coast and opposite side of the map.
  wolfHowl(){this.playAnimalFile('howl',.22);}
  spell(kind:'heal'|'firebolt'|'lightning'|'ice'){this.ensureStarted();if(kind==='heal'){this.tone(520,.45,.035,'sine');this.tone(780,.6,.02,'triangle');}else if(kind==='firebolt'){this.noise(.38,.065,1800);this.tone(210,.38,.045,'sawtooth');}else if(kind==='ice'){this.noise(.3,.035,3200);this.tone(740,.28,.025,'triangle');}else{this.noise(.24,.11,4200);this.tone(980,.2,.04,'square');}}
  private sonicBoom(){this.noise(.72,.3,520);this.tone(68,.55,.18,'sine');this.tone(38,.9,.12,'sine');}
  setFlight(active:boolean,boosting:boolean){
    boosting=active&&boosting;
    if(active===this.flightActive&&boosting===this.flightBoosting)return;
    this.ensureStarted();
    if(active&&boosting&&!this.flightBoosting)this.sonicBoom();
    this.flightActive=active;this.flightBoosting=active&&boosting;
    const play=(audio?:HTMLAudioElement)=>{if(audio?.paused)void audio.play().catch(()=>{/* A próxima interação tenta novamente. */});};
    const stop=(audio?:HTMLAudioElement)=>{if(!audio)return;audio.pause();audio.currentTime=0;};
    if(!active){stop(this.flightLoop);stop(this.fastFlightLoop);return;}
    if(boosting){stop(this.flightLoop);play(this.fastFlightLoop);}else{stop(this.fastFlightLoop);play(this.flightLoop);}
  }
  update(delta:number,state:string){if(!this.context)return;this.breathTimer-=delta;const interval=state==='run'?1.15:state==='walk'?2.1:3.8;if(this.breathTimer>0)return;this.breathTimer=interval;const effort=state==='run' ? 1 : state==='walk' ? .65 : .38;this.noise(.42,.018*effort,520+effort*260);this.tone(150-effort*35,.35,.008*effort,'sine');}
}
