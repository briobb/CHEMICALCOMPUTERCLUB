/* Pointer IDs are independent: a thumb can hold movement while another taps A/B. */
CZ.touch={
 held:new Set(),tapped:new Set(),pointers:new Map(),buttons:[],enabled:false,landscape:false,
 init(onActivity){
  this.onActivity=onActivity;
  // On phones use the actual contact list, not WebView pointer-capture delivery.
  // Do not process the same finger through both Touch Events and Pointer Events.
  this.nativeTouch='ontouchstart' in window;
  this.buttons=Array.from(document.querySelectorAll('[data-action]'));
  this.portraitQuery=window.matchMedia('(any-pointer: coarse) and (max-width: 900px) and (orientation: portrait)');
  this.landscapeQuery=window.matchMedia('(any-pointer: coarse) and (max-height: 600px) and (orientation: landscape)');
  const layout=()=>{this.enabled=this.portraitQuery.matches;this.landscape=this.landscapeQuery.matches;this.clear();};
  layout();this.portraitQuery.addEventListener('change',layout);this.landscapeQuery.addEventListener('change',layout);
  for(const button of this.buttons){
   button.addEventListener('pointerdown',event=>{
    if(this.nativeTouch&&(event.pointerType==='touch'||event.sourceCapabilities?.firesTouchEvents))return;
    if(!this.enabled||(event.pointerType==='mouse'&&event.button!==0))return;
    event.preventDefault();try{button.setPointerCapture(event.pointerId);}catch{/* Global release listeners remain available. */}
    this.setPointer(event.pointerId,button.dataset.action);this.onActivity();
   });
   button.addEventListener('pointermove',event=>{
    if(!this.pointers.has(event.pointerId))return;
    if(event.pointerType==='mouse'&&event.buttons===0){this.release(event.pointerId,true);return;}
    event.preventDefault();
    const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-action]');
    this.setPointer(event.pointerId,this.buttons.includes(target)?target.dataset.action:null);
   });
   for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,event=>{
    this.release(event.pointerId,name!=='pointerup');
   });
   button.addEventListener('contextmenu',event=>event.preventDefault());
  }
  // Capture on the window also receives releases targeted outside a button.
  window.addEventListener('pointerup',event=>this.release(event.pointerId),true);
  window.addEventListener('pointercancel',event=>this.release(event.pointerId,true),true);
  if(this.nativeTouch){
   for(const name of ['touchstart','touchmove','touchend','touchcancel']){
    window.addEventListener(name,event=>this.updateTouches(event,name),{capture:true,passive:false});
   }
  }
  window.addEventListener('blur',()=>this.clear());
  window.addEventListener('pagehide',()=>this.clear());
  window.addEventListener('pageshow',()=>this.clear());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clear();});
 },
 updateTouches(event,type){
  const active=new Set(Array.from(event.touches,touch=>`touch:${touch.identifier}`));
  const ended=new Set(Array.from(event.changedTouches,touch=>`touch:${touch.identifier}`));
  let handled=false;
  for(const id of Array.from(this.pointers.keys())){
   if(typeof id==='string'&&id.startsWith('touch:')&&!active.has(id)){
    this.release(id,type==='touchcancel'||!ended.has(id));handled=true;
   }
  }
  if(!this.enabled)return;
  for(const touch of event.changedTouches){
   const id=`touch:${touch.identifier}`;
   if(type==='touchstart'){
    const button=touch.target?.closest?.('[data-action]');
    if(this.buttons.includes(button)){
     this.setPointer(id,button.dataset.action);this.onActivity();handled=true;
    }
   }else if(type==='touchmove'&&this.pointers.has(id)){
    const button=document.elementFromPoint(touch.clientX,touch.clientY)?.closest('[data-action]');
    this.setPointer(id,this.buttons.includes(button)?button.dataset.action:null);handled=true;
   }
  }
  // Prevent native gestures only for a controller contact, not the whole page.
  if(handled&&event.cancelable)event.preventDefault();
 },
 release(id,cancelled=false){
  if(!this.pointers.has(id))return;
  const action=this.pointers.get(id);this.pointers.delete(id);this.sync();
  if(cancelled&&action&&!this.held.has(action))this.tapped.delete(action);
 },
 setPointer(id,action){
  const wasDown=action&&this.held.has(action);
  this.pointers.set(id,action);this.sync();
  if(action&&!wasDown)this.tapped.add(action);
 },
 sync(){
  this.held=new Set(Array.from(this.pointers.values()).filter(Boolean));
  for(const button of this.buttons){const down=this.held.has(button.dataset.action);button.classList.toggle('is-held',down);button.setAttribute('aria-pressed',String(down));}
 },
 clear(){this.pointers.clear();this.tapped.clear();this.sync();},
 consumeTaps(){const result=this.tapped;this.tapped=new Set();return result;}
};
