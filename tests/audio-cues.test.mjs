import assert from 'node:assert/strict';
import {createAudio} from '../js/audio.js';

const param=()=>({value:0,setTargetAtTime(v){this.value=v;},setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.value=v;}});
class FakeAudioContext{
 constructor(){this.currentTime=1;this.sampleRate=8000;this.state='suspended';this.destination={};this.oscillators=[];FakeAudioContext.last=this;}
 createGain(){return {gain:param(),connect(){return this;},disconnect(){}};}
 createDynamicsCompressor(){return Object.fromEntries(['threshold','knee','ratio','attack','release'].map(key=>[key,param()]).concat([['connect',function(){return this;}]]));}
 createBiquadFilter(){return {frequency:param(),Q:param(),connect(){return this;}};}
 createOscillator(){const node={frequency:param(),connect(){return this;},start(time){this.started=time;},stop(time){this.stopped=time;}};this.oscillators.push(node);return node;}
 createBuffer(_channels,length){return {getChannelData(){return new Float32Array(length);}};}
 createBufferSource(){return {connect(){return this;},start(){},};}
 async resume(){this.state='running';}
 async close(){this.state='closed';}
}
globalThis.AudioContext=FakeAudioContext;
const audio=createAudio();assert.equal(audio.cue('encounter'),false,'cues stay silent before audio is enabled');
assert(await audio.enable(true));assert.equal(audio.cue('encounter'),true);assert.equal(FakeAudioContext.last.oscillators.length,4,'cue adds two notes over the engine oscillators');
assert(Math.abs(FakeAudioContext.last.oscillators[2].frequency.value-523.25)<.2,'encounter cue begins on its intended pitch');
assert.equal(audio.stationName(),'01 · ONDA SALMAR · Cartas de verano');
audio.nextStation();assert.equal(audio.stationName(),'02 · FRECUENCIA 404 · Luces de Miralba');
audio.dispose();assert.equal(audio.cue('choice'),false,'disposed audio cannot emit cues');
console.log('PASS: interaction cues respect audio activation and disposal');
