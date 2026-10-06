/* Pointer IDs are independent: a thumb can hold movement while another taps A/B. */
CZ.touch={
 held:new Set(),tapped:new Set(),pointers:new Map(),buttons:[],enabled:false,landscape:false,
 init(onActivity){
  this.onActivity=onActivity;
  this.buttons=Array.from(document.querySelectorAll('[data-action]'));
  this.portraitQuery=window.matchMedia('(any-pointer: coarse) and (max-width: 900px) and (orientation: portrait)');
  this.landscapeQuery=window.matchMedia('(any-pointer: coarse) and (max-height: 600px) and (orientation: landscape)');
  const layout=()=>{this.enabled=this.portraitQuery.matches;this.landscape=this.landscapeQuery.matches;this.clear();};
  layout();this.portraitQuery.addEventListener('change',layout);this.landscapeQuery.addEventListener('change',layout);
  for(const button of this.buttons){
   button.addEventListener('pointerdown',event=>{
    if(!this.enabled||(event.pointerType==='mouse'&&event.button!==0))return;
    event.preventDefault();button.setPointerCapture(event.pointerId);
    this.setPointer(event.pointerId,button.dataset.action);this.onActivity();
   });
   button.addEventListener('pointermove',event=>{
    if(!this.pointers.has(event.pointerId))return;
    event.preventDefault();
    const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-action]');
    this.setPointer(event.pointerId,this.buttons.includes(target)?target.dataset.action:null);
   });
   for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,event=>{
    const action=this.pointers.get(event.pointerId);
    this.pointers.delete(event.pointerId);this.sync();
    if(name!=='pointerup'&&action&&!this.held.has(action))this.tapped.delete(action);
   });
   button.addEventListener('contextmenu',event=>event.preventDefault());
  }
  window.addEventListener('blur',()=>this.clear());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clear();});
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
