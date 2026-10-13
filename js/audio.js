/** Three original generative radio pieces, plus a separate engine and environment mixer.
 * No samples, streaming services, telemetry or external songs. Audio begins after a gesture.
 */
export const STATIONS=Object.freeze([
 {name:'01 · ONDA SALMAR',title:'Cartas de verano',bpm:88,root:57,type:'triangle',chords:[[0,4,7,11],[5,9,12,16],[2,5,9,12],[7,11,14,17]],melody:[7,11,12,7,4,-1,2,4,9,12,14,9,7,-1,4,2]},
 {name:'02 · FRECUENCIA 404',title:'Luces de Miralba',bpm:108,root:54,type:'sine',chords:[[0,3,7,10],[5,8,12,15],[8,12,15,19],[3,7,10,14]],melody:[0,7,10,12,10,7,3,-1,5,12,15,17,15,12,8,-1]},
 {name:'03 · RADIO SIERRA',title:'Antes del regreso',bpm:72,root:60,type:'triangle',chords:[[0,4,7,9],[7,11,14,16],[9,12,16,19],[5,9,12,14]],melody:[12,-1,7,-1,4,7,9,-1,16,-1,14,12,9,-1,7,-1]}
]);
const finite=(x,defaultValue)=>Number.isFinite(x)?Math.max(0,Math.min(1,x)):defaultValue;
const hz=midi=>440*2**((midi-69)/12);
export function createAudio(){
 let context=null,enabled=false,paused=true,station=0,beat=0,nextBeat=0,disposed=false;
 let mix={musicVolume:.38,engineVolume:.5,ambientVolume:.45},music=null,engine=null,ambient=null,engineOsc=null,engineTone=null,engineFilter=null,wind=null,windFilter=null,skid=null,skidFilter=null;
 const voices=new Set();
 function init(){
  if(context)return;const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)throw new Error('Web Audio unavailable');
  context=new Audio();music=context.createGain();engine=context.createGain();ambient=context.createGain();music.gain.value=engine.gain.value=ambient.gain.value=0;
  // A soft compressor catches stacked chord transients without changing the volume controls.
  const compressor=context.createDynamicsCompressor();compressor.threshold.value=-14;compressor.knee.value=16;compressor.ratio.value=3;compressor.attack.value=.02;compressor.release.value=.3;
  music.connect(compressor);engine.connect(compressor);ambient.connect(compressor);compressor.connect(context.destination);
  engineFilter=context.createBiquadFilter();engineFilter.type='lowpass';engineFilter.frequency.value=500;
  engineOsc=context.createOscillator();engineOsc.type='sawtooth';engineTone=context.createOscillator();engineTone.type='sine';const harmonicGain=context.createGain();harmonicGain.gain.value=.22;
  engineOsc.connect(engineFilter);engineTone.connect(harmonicGain).connect(engineFilter);engineFilter.connect(engine);engineOsc.start();engineTone.start();
  const buffer=context.createBuffer(1,context.sampleRate*3,context.sampleRate),channel=buffer.getChannelData(0);let brown=0,seed=73481;
  for(let i=0;i<channel.length;i++){seed=(seed*16807)%2147483647;brown=(brown+((seed/2147483647)*2-1)*.04)/1.022;channel[i]=brown*2;}
  wind=context.createBufferSource();wind.buffer=buffer;wind.loop=true;windFilter=context.createBiquadFilter();windFilter.type='lowpass';windFilter.frequency.value=700;wind.connect(windFilter).connect(ambient);skid=context.createGain();skid.gain.value=0;skidFilter=context.createBiquadFilter();skidFilter.type='bandpass';skidFilter.frequency.value=1900;skidFilter.Q.value=.8;wind.connect(skidFilter).connect(skid).connect(compressor);wind.start();
  nextBeat=context.currentTime+.05;
 }
 function tone(note,start,duration,volume,type='triangle',destination=music){
  if(disposed||!context)return;const oscillator=context.createOscillator(),gain=context.createGain();oscillator.type=type;oscillator.frequency.value=hz(note);
  gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume,start+.018);gain.gain.exponentialRampToValueAtTime(Math.max(.00001,volume*.56),start+duration*.55);gain.gain.exponentialRampToValueAtTime(.00001,start+duration);
  oscillator.connect(gain).connect(destination);voices.add(oscillator);oscillator.onended=()=>{voices.delete(oscillator);oscillator.disconnect();gain.disconnect();};oscillator.start(start);oscillator.stop(start+duration+.01);
 }
 function kick(start){
  const oscillator=context.createOscillator(),gain=context.createGain();oscillator.type='sine';oscillator.frequency.setValueAtTime(130,start);oscillator.frequency.exponentialRampToValueAtTime(42,start+.18);gain.gain.setValueAtTime(.12,start);gain.gain.exponentialRampToValueAtTime(.0001,start+.24);oscillator.connect(gain).connect(music);voices.add(oscillator);oscillator.onended=()=>{voices.delete(oscillator);oscillator.disconnect();gain.disconnect();};oscillator.start(start);oscillator.stop(start+.25);
 }
 function schedule(){
  const radio=STATIONS[station],step=60/radio.bpm/2;if(nextBeat<context.currentTime-.3){nextBeat=context.currentTime+.02;}
  let iterations=0;while(nextBeat<context.currentTime+.16&&iterations++<8){
   const chord=radio.chords[Math.floor(beat/16)%radio.chords.length],bar=beat%16,note=radio.melody[beat%radio.melody.length];
   if(bar===0)for(const pitch of chord)tone(radio.root+pitch,nextBeat,step*14,.045,'sine');
   if(beat%2===0)tone(radio.root-12+chord[(beat/2)%2===0?0:2],nextBeat,step*1.5,.11,'triangle');
   if(note>=0)tone(radio.root+12+note,nextBeat,step*1.45,.07,radio.type);
   if(station===1){if(beat%4===0)kick(nextBeat);if(beat%4===2)tone(90,nextBeat,.035,.03,'square');}
   else if(station===0&&beat%8===0)tone(radio.root+24,nextBeat,step*3,.032,'sine');
   beat++;nextBeat+=step;
  }
 }
 function cue(kind='encounter'){
  if(!enabled||!context||context.state!=='running'||disposed)return false;
  const notes=kind==='choice'?[76,83]:kind==='route'?[67,74]:[72,79],start=context.currentTime+.015;
  notes.forEach((note,index)=>tone(note,start+index*.085,.20,.055,'sine',context.destination));return true;
 }
 function levels(state={speed:0,vehicle:'vesper'},settings=mix,isPaused=paused){
  if(!context)return;const time=context.currentTime,active=enabled&&!isPaused&&context.state==='running';
  music.gain.setTargetAtTime(active?mix.musicVolume*(Math.abs(state.slide||0)>.2?.62:.82):0,time,.18);
  skid.gain.setTargetAtTime(active?mix.engineVolume*Math.min(.22,Math.abs(state.slide||0)*.19):0,time,.08);
  const speed=Math.abs(state.speed||0),factor={vesper:.82,solstice:1.05,phantom:1.18,meridian:.91}[state.vehicle]||1;
  engine.gain.setTargetAtTime(active?mix.engineVolume*(.045+Math.min(speed,180)*.00022):0,time,.09);
  const gear=Math.min(4,Math.floor(speed/37)),rpm=31+(speed-gear*22)*.75+(state.throttle||0)*9;
  engineOsc.frequency.setTargetAtTime(rpm*factor,time,.10);engineTone.frequency.setTargetAtTime(rpm*2*factor,time,.12);engineFilter.frequency.setTargetAtTime(280+speed*6.5,time,.14);
  ambient.gain.setTargetAtTime(active?mix.ambientVolume*(settings.mood==='rain'?.12:.025+speed*.00055):0,time,.2);windFilter.frequency.setTargetAtTime(settings.mood==='rain'?3500:500+speed*7,time,.3);
 }
 const api={
  async enable(value){
   if(disposed)return false;if(!value){enabled=false;levels({},mix,true);return true;}
   try{init();await context.resume();if(context.state!=='running')return false;enabled=true;nextBeat=Math.max(nextBeat,context.currentTime+.02);return true;}catch{return false;}
  },
  setMix(settings){mix={musicVolume:finite(settings.musicVolume,.38),engineVolume:finite(settings.engineVolume,.5),ambientVolume:finite(settings.ambientVolume,.45)};},
  update(state,settings,isPaused){if(!context||disposed)return;paused=!!isPaused;levels(state,settings,paused);if(enabled&&!paused&&context.state==='running')schedule();else nextBeat=context.currentTime+.05;},
  nextStation(){station=(station+1)%STATIONS.length;beat=0;if(context){nextBeat=context.currentTime+.04;for(const voice of voices){try{voice.stop(context.currentTime+.02);}catch{}}}return STATIONS[station].name;},
  cue,
  stationName(){return STATIONS[station].name+' · '+STATIONS[station].title;},
  dispose(){disposed=true;enabled=false;if(context){for(const voice of voices){try{voice.stop();}catch{}}context.close().catch(()=>{});}voices.clear();},
  get enabled(){return enabled;}
 };
 return api;
}
