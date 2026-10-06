CZ.sound = {
 muted:false,ctx:null,track:'',beat:0,clock:0,external:null,
 unlock(){
  if(!this.ctx){const AC=window.AudioContext||window.webkitAudioContext;if(AC){this.ctx=new AC();this.ctx.onstatechange=()=>this.status?.();}}
  if(this.ctx?.state==='suspended')this.ctx.resume().catch(()=>{});
  if(this.external?.paused&&!this.muted)this.external.play().catch(()=>{});
  this.status?.();
 },
 tone(freq,duration=.1,type='square',gain=1,delay=0){if(this.muted||!this.ctx||this.ctx.state!=='running')return;const o=this.ctx.createOscillator(),v=this.ctx.createGain(),t=this.ctx.currentTime+delay;o.type=type;o.frequency.value=freq;v.gain.setValueAtTime(CZ.config.audio.volume*gain,t);v.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(v);v.connect(this.ctx.destination);o.start(t);o.stop(t+duration);},
 play(name){if(this.muted)return;const file=CZ.config.audio.files[name];if(file){const a=new Audio(file);a.volume=CZ.config.audio.volume;a.play().catch(()=>{});return;}const seq={jump:[330,660],tuner:[880,440],hit:[170,260],normal:[523,659,784],damage:[160,80],fall:[200,90,45],clear:[523,659,784,1047],over:[220,196,147,110],menu:[440,660],machine:[65,70],ending:[392,523,659,784]}[name]||[220];seq.forEach((f,i)=>this.tone(f,.09+i*.045,'square',.7,i*.075));},
 music(name){if(this.track===name)return;this.external?.pause();this.external=null;this.track=name;this.beat=0;this.clock=0;const file=CZ.config.audio.files[name];if(file){this.external=new Audio(file);this.external.loop=true;this.external.playbackRate=CZ.config.audio.stepSeconds/(CZ.config.audio.trackStepSeconds[name]||CZ.config.audio.stepSeconds);this.external.volume=CZ.config.audio.volume;if(!this.muted)this.external.play().catch(()=>{});}},
 tick(dt){if(!this.track||this.muted||this.external||this.ctx?.state!=='running')return;this.clock-=dt;if(this.clock>0)return;this.clock=CZ.config.audio.trackStepSeconds[this.track]||CZ.config.audio.stepSeconds;const tunes={title:[262,0,392,330,294,0,330,392],stage1:[330,392,440,392,330,262,294,392],stage2:[294,349,440,523,440,349,330,262],stage3:[165,0,196,220,165,147,196,0],boss:[110,110,131,0,147,131,110,98],ending:[262,330,392,523,392,330,294,392]};const notes=tunes[this.track]||tunes.title,f=notes[this.beat++%notes.length];if(f)this.tone(f,.17,'triangle',.45);if(this.beat%2===0)this.tone((notes[0]||220)/2,.2,'square',.2);},
 toggle(){this.muted=!this.muted;if(this.external){if(this.muted)this.external.pause();else this.external.play().catch(()=>{});}return this.muted;}
};
