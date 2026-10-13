/* DOM/event harness using the real packaged ESM graph and an actual Canvas2D
 * implementation when available. This is not a browser or a layout engine.
 * No calls to unimplemented drawing methods are silently fabricated.
 */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
let createCanvas;
for(const base of [process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,root]){
 if(!base)continue;
 try{({createCanvas}=require(require.resolve('@napi-rs/canvas',{paths:[base]})));break;}catch{}
}

async function createGame(initial={},options={}){
 if(!vm.SourceTextModule)throw Error('Run with node --experimental-vm-modules.');
 if(!createCanvas)throw Error('Canvas2D runtime unavailable. Install @napi-rs/canvas only as a development dependency, or set CODEX_PRIMARY_RUNTIME_NODE_MODULES.');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const ids=new Map(),all=[],frames=new Map(),timers=new Map(),events={},docEvents={},store=new Map(Object.entries(initial)),downloads=[],blobs=new Map();
 let doc,idCounter=0,objectId=0;
 class Element{
  constructor(tag='div',id=''){
   this.id=id;this.tagName=tag.toUpperCase();this.type='';this.value='';this.checked=false;this.hidden=false;this.disabled=false;this.children=[];this.parentElement=null;this.listeners={};this.dataset={};this.attributes={};this.style={setProperty(key,value){this[key]=value}};this.textContent='';this._width=1280;this._height=720;
   this.clientWidth=id==='mini'?140:(options.width||1280);this.clientHeight=id==='mini'?92:(options.height||720);
   this.classes=new Set();
   this.classList={add:(...names)=>names.forEach(name=>this.classes.add(name)),remove:(...names)=>names.forEach(name=>this.classes.delete(name)),contains:name=>this.classes.has(name),toggle:(name,flag)=>{const add=flag===undefined?!this.classes.has(name):flag;add?this.classes.add(name):this.classes.delete(name);return add;}};
   all.push(this);
  }
  set className(value){this.classes=new Set(value.split(/\s+/).filter(Boolean));}get className(){return [...this.classes].join(' ')}
  set width(value){this._width=value;if(this.bitmap)this.bitmap.width=value;}get width(){return this._width;}
  set height(value){this._height=value;if(this.bitmap)this.bitmap.height=value;}get height(){return this._height;}
  setAttribute(key,value){this.attributes[key]=String(value);if(key==='id'){this.id=value;ids.set(value,this)}if(key==='class')this.className=value;}
  getAttribute(key){return this.attributes[key]??null;}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn)}
  dispatch(type,extra={}){const event={target:this,currentTarget:this,preventDefault(){this.defaultPrevented=true},defaultPrevented:false,...extra};event.completion=Promise.all((this.listeners[type]||[]).map(fn=>fn(event)));return event;}
  focus(){doc.activeElement=this;}
  click(){if(this.disabled)return;this.focus();this.dispatch('click');this.onclick?.();if(this.tagName==='A'&&this.download)downloads.push({filename:this.download,blob:blobs.get(this.href)});}
  append(...children){for(const child of children){child.parentElement=this;this.children.push(child)}}
  replaceChildren(...children){this.children=[];this.append(...children)}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);}
  contains(el){return this===el||this.children.some(child=>child.contains(el));}
  closest(selector){let element=this;while(element){if(selector.split(',').some(s=>matches(element,s)))return element;element=element.parentElement;}return null;}
  querySelectorAll(selector){return all.filter(el=>el!==this&&this.contains(el)&&selector.split(',').some(s=>matches(el,s)));}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  getClientRects(){if(this.hidden||this.classList.contains('hidden'))return [];return [{width:this.clientWidth,height:this.clientHeight}];}
  setPointerCapture(){}
  getContext(type){
   if(type!=='2d')return null; // Explicit unavailable WebGL -> game's real Canvas fallback.
   this.bitmap??=createCanvas(this.width,this.height);
   if(this.context)return this.context;
   const native=this.bitmap.getContext('2d');
   this.context=new Proxy(native,{get(target,key){
    if(key==='drawImage')return (source,...args)=>target.drawImage(source.bitmap||source,...args);
    const value=target[key];return typeof value==='function'?value.bind(target):value;
   },set(target,key,value){target[key]=value;return true}});
   return this.context;
  }
  toBlob(fn,mime='image/png'){fn(new Blob([this.bitmap.toBuffer(mime)],{type:mime}));}
 }
 function matches(el,selector){
  selector=selector.trim();
  if(selector==='[data-control]')return !!el.dataset.control;
  if(selector.includes('[contenteditable="true"]'))return el.attributes.contenteditable==='true';
  const tag=selector.match(/^[a-z]+/i)?.[0];if(tag&&el.tagName!==tag.toUpperCase())return false;
  const id=selector.match(/^#([\w-]+)/)?.[1];if(id&&el.id!==id)return false;
  const cls=selector.match(/^\.([\w-]+)/)?.[1];if(cls&&!el.classes.has(cls))return false;
  if(selector.includes(':not(:disabled)')&&el.disabled)return false;
  if(selector.includes(':not([hidden])')&&el.hidden)return false;
  if(selector.includes(':not(.hidden)')&&el.classes.has('hidden'))return false;
  if(selector.includes('[role=dialog]')&&el.attributes.role!=='dialog')return false;
  if(selector.startsWith('[tabindex]')&&!('tabindex' in el.attributes))return false;
  return !!(tag||id||cls||selector.startsWith('['));
 }
 const documentElement=new Element('html'),body=new Element('body');documentElement.append(body);
 const stack=[body];
 for(const match of html.matchAll(/<\/?([a-z][a-z0-9]*)\b([^>]*?)>/gi)){
  const tag=match[1].toLowerCase();
  if(['html','head','body','meta','link','title','script'].includes(tag))continue;
  if(match[0].startsWith('</')){if(stack.at(-1).tagName===tag.toUpperCase())stack.pop();continue;}
  const attrs={};for(const a of match[2].matchAll(/([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))attrs[a[1]]=a[2]??a[3]??a[4]??'';
  const el=new Element(tag,attrs.id||'');for(const [name,value] of Object.entries(attrs)){el.setAttribute(name,value);if(name.startsWith('data-'))el.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;}
  if(el.id)ids.set(el.id,el);if(attrs.class)el.className=attrs.class;
  el.hidden='hidden' in attrs;el.disabled='disabled' in attrs;el.type=attrs.type||'';el.value=attrs.value||'';el.checked='checked' in attrs;
  if(attrs.width)el.width=Number(attrs.width);if(attrs.height)el.height=Number(attrs.height);
  stack.at(-1).append(el);
  if(!['input','img','br','hr','source','progress'].includes(tag)&&!match[0].endsWith('/>'))stack.push(el);
 }
 doc={body,documentElement,hidden:false,activeElement:ids.get('start'),getElementById:id=>ids.get(id)||null,createElement:tag=>new Element(tag),querySelectorAll:selector=>all.filter(el=>selector.split(',').some(s=>matches(el,s))),addEventListener:(type,fn)=>(docEvents[type]??=[]).push(fn)};
 const localStorage={getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)};
 const window={document:doc,localStorage,location:{search:options.qa===false?'':'?qa=1',href:'http://localhost/CHASE-404/index.html'},innerWidth:options.width||1280,devicePixelRatio:1,addEventListener:(type,fn)=>(events[type]??=[]).push(fn),setTimeout:fn=>{timers.set(++idCounter,fn);return idCounter},clearTimeout:id=>timers.delete(id)};
 if(options.pointerEvents)window.PointerEvent=class PointerEvent{};
 class HarnessURL extends URL{}
 HarnessURL.createObjectURL=blob=>{const url='blob:qa-'+ ++objectId;blobs.set(url,blob);return url};HarnessURL.revokeObjectURL=url=>blobs.delete(url);
 const navigator={getGamepads:()=>[]};
 const sandbox={window,document:doc,localStorage,navigator,devicePixelRatio:1,Math,JSON,Date,Array,Object,String,Number,console,Blob,URL:HarnessURL,URLSearchParams,performance,TextEncoder,TextDecoder,requestAnimationFrame:fn=>{frames.set(++idCounter,fn);return idCounter},cancelAnimationFrame:id=>frames.delete(id),setTimeout:window.setTimeout,clearTimeout:window.clearTimeout};
 sandbox.globalThis=sandbox;window.requestAnimationFrame=sandbox.requestAnimationFrame;window.cancelAnimationFrame=sandbox.cancelAnimationFrame;
 const context=vm.createContext(sandbox),modules=new Map();
 function load(filename){
  filename=path.resolve(filename);if(modules.has(filename))return modules.get(filename);
  const source=fs.readFileSync(filename,'utf8');
  const mod=new vm.SourceTextModule(source,{identifier:filename,context});modules.set(filename,mod);return mod;
 }
 const entryRef=html.match(/<script[^>]*type="module"[^>]*src="([^"?]+)[^"]*"/i)?.[1];
 if(!entryRef)throw Error('index.html must use a native module entry');
 if(options.classic){vm.runInContext(fs.readFileSync(path.resolve(root,'js/game.bundle.js'),'utf8'),context,{filename:'game.bundle.js',timeout:5000});}
 else{const entry=load(path.resolve(root,entryRef));await entry.link((ref,parent)=>load(path.resolve(path.dirname(parent.identifier),ref)));await entry.evaluate();}
 function dispatch(type,extra={}){const event={target:doc.activeElement,currentTarget:window,code:'',key:'',repeat:false,preventDefault(){this.defaultPrevented=true},...extra};for(const fn of events[type]||[])fn(event);return event;}
 return {elements:ids,all,document:doc,window,store,storage:localStorage,downloads,frames,navigator,
  get qa(){return window.__CHASE_QA__},get nativeCanvas(){return ids.get('game').bitmap;},
  click:id=>{const el=ids.get(id);if(!el)throw Error('Missing control: '+id);el.click()},
  change:(id,value,type='change')=>{const el=ids.get(id);if(!el)throw Error('Missing control: '+id);el.value=value;return el.dispatch(type)},
  key:(code,type='keydown',extra={})=>dispatch(type,{code,key:code,...extra}),dispatch,
  frame:time=>{const first=frames.entries().next().value;if(first){frames.delete(first[0]);first[1](time)}},
  visible:hidden=>{doc.hidden=hidden;for(const fn of docEvents.visibilitychange||[])fn();},
  savePng:filename=>fs.writeFileSync(filename,ids.get('game').bitmap.toBuffer('image/png'))
 };
}
module.exports={createGame,hasCanvas:!!createCanvas};
