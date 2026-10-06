(() => {
'use strict';
const C=CZ.config,A=CZ.art,S=CZ.sound,canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
ctx.imageSmoothingEnabled=false;A.init();
CZ.touch?.init(()=>{S.unlock();lastActivity=performance.now();});
const keys=new Set(),taps=new Set(),previous={},input={},pressed={};let lastActivity=performance.now(),padSignature='',suspended=false;
const G={state:'title',selection:0,stage:0,time:180,age:0,clock:0,camera:0,player:null,enemies:[],pulses:[],hazards:[],effects:[],boss:null,dialog:[],line:0};
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const rect=(x,y,w,h,col)=>A.rect(ctx,x,y,w,h,col),text=(s,x,y,size=10,col='#e5e3b6',align='left')=>A.text(ctx,s,x,y,size,col,align);
function state(name){G.state=name;G.age=0;G.selection=0;}
function title(){state('title');G.boss=null;G.hazards=[];G.pulses=[];S.music('title');}
function dialog(lines,next,theme='radio'){state('dialog');G.dialog=lines;G.line=0;G.next=next;G.dialogTheme=theme;}
function begin(){
 G.stage=0;
 dialog(CZ.story.intro,()=>dialog(CZ.story.radio,()=>loadStage(0)),'intro');
}
function epilogue(){dialog(CZ.story.epilogue,()=>state('end'),'epilogue');}
function loadStage(index){G.stage=index;G.data=CZ.stages[index];G.platforms=[...G.data.grounds.map(([x,end])=>({x,y:248,w:end-x,h:64})),...G.data.steps.map(([x,y,w,h])=>({x,y,w,h}))];G.player={x:40,y:248-C.player.height,w:C.player.width,h:C.player.height,vx:0,vy:0,dir:1,life:C.player.life,inv:0,grounded:true,fire:0,cooldown:0};G.enemies=G.data.enemies.map(([kind,x])=>({kind,x,y:222,w:kind==='car'?23:25,h:26,vx:0,dir:-1,hp:C.enemies[kind].hp,normal:false,flash:0,origin:x,boost:0,rest:0,pending:x>=C.width+C.spawn.screenMargin,spawnDelay:C.spawn.minDelay+Math.random()*(C.spawn.maxDelay-C.spawn.minDelay)}));G.pulses=[];G.hazards=[];G.effects=[];G.boss=null;G.machine=index===2?createMachine():null;G.camera=0;G.time=C.timeLimit;state('stageIntro');S.music('stage'+(index+1));}
function readInput(){const m=C.gamepad;let pad=null;try{pad=Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected);}catch{}const b=n=>!!pad?.buttons[n]?.pressed,axis=pad?.axes[0]||0,ay=pad?.axes[1]||0;Object.assign(input,{left:keys.has('ArrowLeft')||b(m.left)||axis < -m.deadzone,right:keys.has('ArrowRight')||b(m.right)||axis>m.deadzone,up:keys.has('ArrowUp')||b(m.up)||ay < -m.deadzone,down:keys.has('ArrowDown')||b(m.down)||ay>m.deadzone,jump:keys.has('KeyZ')||keys.has('Enter')||b(m.jump),tuner:keys.has('KeyX')||b(m.tuner),back:keys.has('Escape')});for(const k in input)input[k]=input[k]||!!CZ.touch?.held.has(k);const touchTaps=CZ.touch?.consumeTaps();for(const k in input){pressed[k]=!!touchTaps?.has(k)||input[k]&&!previous[k];previous[k]=input[k];}const codes={left:'ArrowLeft',right:'ArrowRight',up:'ArrowUp',down:'ArrowDown',jump:'KeyZ',tuner:'KeyX',back:'Escape'};for(const k in codes)pressed[k]=pressed[k]||taps.has(codes[k]);pressed.jump=pressed.jump||taps.has('Enter');taps.clear();if(Object.values(input).some(Boolean))lastActivity=performance.now();const sig=pad?pad.id:'none';if(sig!==padSignature){padSignature=sig;document.getElementById('pad-status').textContent=pad?'GAMEPAD CONNECTED · A: ジャンプ / B: TUNER':'KEYBOARD READY · USB GAMEPAD SUPPORTED';}if(Object.values(pressed).some(Boolean))S.unlock();}
function move(p,dt){p.x+=p.vx*dt;for(const q of G.platforms)if(overlap(p,q)){if(p.vx>0)p.x=q.x-p.w;if(p.vx<0)p.x=q.x+q.w;}p.x=Math.max(G.boss?G.data.length-384:0,Math.min(p.x,G.data.length-p.w));p.vy=Math.min(C.player.maxFall,p.vy+C.player.gravity*dt);p.y+=p.vy*dt;p.grounded=false;for(const q of G.platforms)if(overlap(p,q)){if(p.vy>0){p.y=q.y-p.h;p.grounded=true;}else if(p.vy<0)p.y=q.y+q.h;p.vy=0;}}
function damage(){const p=G.player;if(p.inv>0||G.state!=='play')return;p.life--;p.inv=C.player.invulnerability;S.play('damage');if(p.life<=0)gameover('シグナルに つつまれた。');}
function gameover(reason){G.reason=reason;state('over');S.music('');S.play('over');}
function fire(){const p=G.player;if(p.cooldown>0)return;p.cooldown=C.tuner.cooldown;p.fire=.17;G.pulses.push({x:p.x+(p.dir>0?p.w:-8),y:p.y+C.tuner.muzzleY,w:8,h:8,dir:p.dir,travel:0});S.play('tuner');}
function createMachine(){return {active:-1,nodes:[{x:268,y:226,hp:C.boss.nodeHP},{x:304,y:177,hp:C.boss.nodeHP},{x:338,y:219,hp:C.boss.nodeHP}],timer:1.8,pattern:0,off:false,after:0};}
function beginBoss(){
 // Enter only after the scrolling camera naturally reaches the arena origin.
 G.camera=G.data.length-C.width;G.enemies=[];G.pulses=[];
 G.boss=G.machine||createMachine();G.boss.active=0;
 state('warning');S.music('');S.play('machine');
}
function updateBoss(dt){const b=G.boss;if(b.off){b.after+=dt;if(b.after>4)startEnding();return;}b.timer-=dt;if(b.timer<0){b.timer=C.boss.attackInterval;b.pattern++;S.play('machine');if(b.pattern%2){G.hazards.push({x:G.camera+368,y:233,w:20,h:10,vx:-92,vy:0,kind:'floor'});}else{G.hazards.push({x:G.camera+366,y:204,w:13,h:10,vx:-115,vy:0,kind:'wave'});}}
}
// Activate each encounter once, after a random delay, beyond the right edge.
// Missed encounters are discarded rather than appearing on top of the player.
function updateSpawns(dt){
 for(const e of G.enemies){
  if(!e.pending||e.x-G.player.x>C.spawn.triggerDistance)continue;
  e.spawnDelay-=dt;
  if(e.x<G.camera+C.width+C.spawn.screenMargin){e.skipped=true;continue;}
  if(e.spawnDelay<=0)e.pending=false;
 }
 G.enemies=G.enemies.filter(e=>!e.skipped);
}
// Dogs only react to a grounded player on the same level and in clear view.
// Jumping or climbing breaks pursuit, including a grace period after landing.
function updateDog(e,p,dt){
 const cfg=C.enemies.dog;
 e.dogState=e.dogState||'patrol';
 e.dogTimer=Math.max(0,(e.dogTimer||0)-dt);
 const sameLevel=p.grounded&&Math.abs(p.y+p.h-(e.y+e.h))<=cfg.heightTolerance;
 const left=Math.min(e.x+e.w/2,p.x+p.w/2),right=Math.max(e.x+e.w/2,p.x+p.w/2);
 const blocked=G.platforms.some(q=>q.y<e.y+e.h&&q.x<right&&q.x+q.w>left&&q.y+q.h>e.y);
 if(!sameLevel||blocked){
  if(e.dogState==='patrol')return cfg.patrolSpeed;
  e.dogState='rest';e.dogTimer=cfg.recovery;return 0;
 }
 if(e.dogState==='rest'){
  if(e.dogTimer>0)return 0;
  e.dogState='patrol';
 }
 if(e.dogState==='patrol'){
  if(Math.abs(p.x-e.x)>=cfg.notice)return cfg.patrolSpeed;
  e.dir=Math.sign(p.x-e.x)||e.dir;
  e.dogState='ready';e.dogTimer=cfg.windup;return 0;
 }
 if(e.dogState==='ready'){
  if(e.dogTimer>0)return 0;
  e.dogState='chase';e.dogTimer=cfg.chase;
 }
 if(e.dogState==='chase'&&e.dogTimer>0)return cfg.speed;
 e.dogState='rest';e.dogTimer=cfg.recovery;return 0;
}
function updatePlay(dt){const p=G.player;p.inv=Math.max(0,p.inv-dt);p.fire=Math.max(0,p.fire-dt);p.cooldown=Math.max(0,p.cooldown-dt);p.vx=(Number(input.right)-Number(input.left))*C.player.speed;if(p.vx)p.dir=Math.sign(p.vx);if(pressed.jump&&p.grounded){p.vy=-C.player.jump;p.grounded=false;S.play('jump');}if(pressed.tuner)fire();move(p,dt);if(p.y>310){S.play('fall');gameover('あしもとに きをつけて！');return;}
 if(!G.boss){G.time=Math.max(0,G.time-dt);if(G.time===0){gameover('じかんが なくなった。');return;}G.camera=Math.max(0,Math.min(p.x-125,G.data.length-C.width));if(G.stage===2&&G.camera>=G.data.length-C.width){beginBoss();return;}}
 if(!G.boss)updateSpawns(dt);
 for(const e of G.enemies){if(e.pending)continue;e.flash=Math.max(0,e.flash-dt);if(e.normal){if(e.kind==='dog'){e.x+=22*dt;e.vx=22;e.dir=1;}continue;}if(Math.abs(e.x-p.x)>480)continue;const cfg=C.enemies[e.kind],distance=p.x-e.x;let speed=cfg.speed;if(e.kind==='dog')speed=updateDog(e,p,dt);if(e.kind==='mower'){e.rest=Math.max(0,e.rest-dt);e.boost=Math.max(0,e.boost-dt);if(Math.abs(distance)<cfg.notice&&e.rest===0){e.dir=Math.sign(distance)||1;e.boost=.65;e.rest=2.1;}if(e.boost>0)speed=cfg.boost;}e.vx=speed*e.dir;const next=e.x+e.vx*dt,foot={x:next+(e.dir>0?e.w:0),y:249,w:2,h:2},wall={x:next,y:e.y,w:e.w,h:e.h};if(!G.platforms.some(q=>overlap(foot,q))||G.platforms.some(q=>q.y<248&&overlap(wall,q))||Math.abs(next-e.origin)>(e.kind==='dog'?cfg.patrolRange:190)){if(e.kind==='dog'&&e.dogState!=='patrol'){e.dogState='rest';e.dogTimer=C.enemies.dog.recovery;e.vx=0;}else e.dir*=-1;}else e.x=next;if(overlap(p,e))damage();}
 for(const q of G.pulses){const d=C.tuner.speed*dt;q.x+=q.dir*d;q.travel+=d;for(const e of G.enemies)if(!e.pending&&!e.normal&&overlap(q,e)){q.travel=C.tuner.range+1;e.hp--;e.flash=.12;S.play('hit');if(e.hp<=0){e.normal=true;e.vx=0;S.play('normal');G.effects.push({x:e.x,y:e.y-10,time:1,text:'OK!'});}break;}if(G.boss&&!G.boss.off){const b=G.boss,n=b.nodes[b.active];if(overlap(q,{x:G.camera+n.x-6,y:n.y-6,w:21,h:21})){q.travel=C.tuner.range+1;n.hp--;S.play('hit');if(n.hp<=0){S.play('normal');b.active++;if(b.active===3){b.off=true;G.hazards=[];G.pulses=[];S.music('');S.play('clear');}}}}}
 G.pulses=G.pulses.filter(q=>q.travel<=C.tuner.range);G.effects.forEach(e=>e.time-=dt);G.effects=G.effects.filter(e=>e.time>0);
 for(const h of G.hazards){h.x+=h.vx*dt;h.y+=h.vy*dt;if(overlap(p,h))damage();}G.hazards=G.hazards.filter(h=>h.x>G.camera-30&&h.y<300);
 if(G.state!=='play')return;if(G.boss)updateBoss(dt);else if(G.stage<2&&p.x>G.data.length-75){state('clear');S.music('');S.play('clear');}
}
function startEnding(){state('ending');S.music('ending');S.play('ending');}
function tick(dt){readInput();G.clock+=dt;G.age+=dt;if(performance.now()-lastActivity>C.idleTimeout*1000&&G.state!=='title')title();S.tick(dt);
 if(G.state==='title'||G.state==='over'){if(pressed.up||pressed.down){G.selection=1-G.selection;S.play('menu');}if(pressed.jump){S.play('menu');if(G.state==='title'){if(G.selection===0)begin();else state('about');}else if(G.selection===0)loadStage(G.stage);else title();}}
 else if(G.state==='about'){if(pressed.jump||pressed.tuner||pressed.back)title();}
 else if(G.state==='dialog'){if((pressed.jump&&G.age>.2)||(G.dialogTheme==='epilogue'&&G.age>=C.story.epiloguePageSeconds)){G.line++;G.age=0;S.play('menu');if(G.line>=G.dialog.length)G.next();}}
 else if(G.state==='stageIntro'){if(G.age>2||(pressed.jump&&G.age>.3))state('play');}
 else if(G.state==='play')updatePlay(dt);
 else if(G.state==='warning'){if(G.age>C.boss.warning){state('play');S.music('boss');}}
 else if(G.state==='clear'&&G.age>1.7){if(G.stage===0)loadStage(1);else dialog(['クリスの カバンだ！\nこのなかに いるのか？','ゲームセンターの おくに\nちかへ つづく いりぐちが あった。'],()=>loadStage(2));}
 else if(G.state==='ending'&&G.age>23)epilogue();
 else if(G.state==='end'&&(G.age>C.endTimeout||pressed.jump))title();
}
function box(x,y,w,h){rect(x,y,w,h,'#10242d');rect(x,y,w,2,'#9aaa83');rect(x,y+h-2,w,2,'#9aaa83');rect(x,y,2,h,'#9aaa83');rect(x+w-2,y,2,h,'#9aaa83');}
function lines(str,x,y,size=11,col){str.split('\n').forEach((s,i)=>text(s,x,y+i*(size+8),size,col));}
function titleDraw(){rect(0,0,384,288,'#122a35');for(let i=0;i<48;i++){const x=(i*79)%384,y=(i*37)%146;rect(x,y,1,1,i%3?'#456368':'#93a789');}for(let i=0;i<15;i++){const x=i*29,h=18+(i*23)%45;rect(x,222-h,25,h,'#274347');rect(x+5,226-h,3,4,'#8e9b70');}rect(0,223,384,65,'#0d222b');rect(24,229,336,1,'#6e856f');text('CHEMICAL COMPUTER CLUB',192,39,12,'#afc39c','center');text('CHANNEL',192,66,43,'#e3dcaa','center');text('ZERO',192,105,54,'#dc8958','center');text('A TIMBERFIELD TRANSMISSION',192,163,8,'#8ca899','center');text((G.selection===0?'> ':'  ')+'START',144,189,13,G.selection===0?'#e7e1b2':'#6d8c83');text((G.selection===1?'> ':'  ')+'ABOUT CCC',144,209,13,G.selection===1?'#e7e1b2':'#6d8c83');text('Z / A  ケッテイ',192,244,10,'#b3bf9a','center');text('© 1986 CCC SOFTWARE DIVISION',192,265,8,'#66847c','center');}
function world(){const theme=G.data.theme,bg=A.backgrounds[theme],offset=Math.floor(G.camera*.25)%384;ctx.drawImage(bg,-offset,0,384,288);ctx.drawImage(bg,384-offset,0,384,288);if(theme===2){for(let i=0;i<Math.floor(G.camera/800);i++){rect((i*57-Math.floor(G.camera*.4)%57),45+i*5,384,2,'#60766a');}}ctx.save();ctx.translate(-Math.floor(G.camera),0);for(const q of G.platforms){if(q.x+q.w<G.camera||q.x>G.camera+384)continue;rect(q.x,q.y,q.w,q.h,'#354c47');rect(q.x,q.y,q.w,5,'#a6ab7a');rect(q.x,q.y+5,q.w,3,'#647659');for(let x=q.x;x<q.x+q.w;x+=24){rect(x,q.y+10,1,q.h-10,'#203b3b');rect(x+3,q.y+18,16,2,'#486057');}}
 if(G.stage===0){const x=G.data.length-80;rect(x-7,166,55,82,'#132932');rect(x-3,170,47,78,'#b8a66d');rect(x+2,177,37,71,'#284a4b');rect(x+7,183,27,35,'#718d79');rect(x+29,224,4,3,'#e9dba3');rect(x-13,146,67,18,'#c5b778');text(G.data.goal,x+20,150,12,'#213d3c','center');}
 if(G.stage===1)A.arcade(ctx,G.data.length-200);
 if(G.stage===2&&G.machine){
  ctx.save();ctx.translate(G.data.length-C.width,0);
  A.machine(ctx,G.machine,G.clock);
  if(G.machine.off&&G.machine.after>2.4){rect(345,205,27,43,'#101e29');A.actor(ctx,{x:349,y:248-C.player.height,dir:-1,vx:0},G.clock,'chris');}
  ctx.restore();
 }
 for(const e of G.enemies)if(!e.pending&&e.x>G.camera-40&&e.x<G.camera+400){if(e.flash<=0||Math.floor(G.clock*40)%2)A.actor(ctx,e,G.clock,e.kind);if(e.kind==='dog'&&e.dogState==='ready')text('!',e.x+8,e.y-19,12,'#efcb86');if(!e.normal&&e.kind!=='car')for(let i=0;i<e.hp;i++)rect(e.x+i*5,e.y-6,3,2,'#df9866');}
 if(!G.player.inv||Math.floor(G.clock*18)%2)A.actor(ctx,G.player,G.clock);
 for(const q of G.pulses){ctx.save();ctx.translate(q.x+4,q.y);ctx.scale(q.dir,1);text(')))',-6,-4,15,'#e6d991');ctx.restore();}
 for(const h of G.hazards){rect(h.x,h.y,h.w,h.h,'#de8955');rect(h.x+3,h.y+2,h.w-6,3,'#f1d494');}
 for(const e of G.effects)text(e.text,e.x,e.y-(1-e.time)*10,9,'#bfdba3');
 if(G.stage===0&&G.camera<160){text('← →  イドウ',48,102,11);text('Z / A  ジャンプ',48,122,11);text('X / B  SIGNAL TUNER',48,142,10);text('みぎへ すすもう →',48,170,10,'#a7c898');}
 ctx.restore();if(G.boss?.off&&G.boss.after<.15)rect(0,38,384,250,'#e8e9c1');
 rect(0,0,384,35,'#10242d');text('ALEX',12,10,11);text('♥'.repeat(G.player.life)+'·'.repeat(3-G.player.life),48,8,14,'#df9666');text('0'+(G.stage+1),187,10,11,'#b7c797');text(G.boss?'SIGNAL '+[100,67,33,0][G.boss.active]+'%':'TIME '+Math.ceil(G.time).toString().padStart(3,'0'),371,10,11,'#dce0af','right');rect(0,34,384,1,'#587666');
}
function endingDraw(){ctx.drawImage(A.nightBackground,0,0);rect(0,0,384,92,'#112430');text('TIMBERFIELD / 1986',192,20,10,'#8fae98','center');const lit=G.age<17||(G.age>20.8&&G.age<21.1);A.arcade(ctx,110,lit);rect(0,248,384,40,'#1d3538');if(G.age<19){const x=G.age>13?170-(G.age-13)*40:170;A.actor(ctx,{x,y:248-C.player.height,dir:-1,vx:G.age>13?1:0},G.clock);A.actor(ctx,{x:x+33,y:248-C.player.height,dir:-1,vx:G.age>13?1:0},G.clock,'chris');}const sayings=['クリス：これ なんだったんだ？','アレックス：わからない。','クリス：しらべてみる？','アレックス：……あしたな。'];if(G.age<13){box(12,48,360,43);text(sayings[Math.min(3,Math.floor(G.age/3.25))],25,64,11);}if(G.age>21.5){ctx.fillStyle=`rgba(10,24,30,${Math.min(1,(G.age-21.5)/1.5)})`;ctx.fillRect(0,0,384,288);}}
function dialogDraw(){
 const theme=G.dialogTheme||'radio';
 rect(0,0,384,288,theme==='epilogue'?'#102630':'#152e37');
 if(theme==='radio'){
  text('CCC / RADIO LINK',24,26,11,'#d69c68');
  text('TIMBERFIELD · 16:42',24,55,9,'#779b8b');
  for(let i=0;i<40;i++)rect(28+i*8,110-Math.sin(i*2+G.clock*7)*10,2,20,'#72937f');
 }else{
  text(theme==='intro'?'TIMBERFIELD, OREGON / 1986':'CCC / THE STORY CONTINUES',24,26,11,'#d69c68');
  // Quiet forest and river: a shared establishing view, darkened for the epilogue.
  rect(22,130,340,22,'#254d50');
  for(let i=0;i<17;i++){
   const x=24+i*20,h=22+(i*13)%34;
   rect(x+7,128-h,4,h,'#607960');
   rect(x+2,123-h,14,15,'#3f695c');
   rect(x+5,115-h,8,10,'#3f695c');
  }
  rect(137,94,111,38,'#516859');rect(131,88,123,6,'#ac9971');
  text('TIMBERFIELD HIGH',143,101,9,'#d7d3a0');
  for(let x=145;x<239;x+=18)rect(x,117,10,10,'#a6b792');
  if(theme==='intro'&&G.line>=1){
   A.actor(ctx,{x:166,y:127,dir:1,vx:0},G.clock);
   A.actor(ctx,{x:205,y:127,dir:-1,vx:0},G.clock,'chris');
  }
 }
 box(14,164,356,107);lines(G.dialog[G.line]||'',27,180,11);
 text(`${G.line+1} / ${G.dialog.length}`,27,252,9,'#91ac94');
 text('Z / A ▶',346,252,9,'#d8b680','right');
}
function render(){ctx.clearRect(0,0,384,288);if(G.state==='title')titleDraw();else if(G.state==='about'){rect(0,0,384,288,'#142e37');text('ABOUT CCC',192,26,21,'#e2d9a8','center');text('CHEMICAL COMPUTER CLUB',192,66,12,'#dba16d','center');text('1986 / TIMBERFIELD, OREGON',192,85,9,'#91ae96','center');lines('CCCは 1986ねん\nオレゴンしゅうの ちいさなまち\nティンバーフィールドで うまれました。\n\nカガクと コンピューター、\nそして コウキシンの ちからで\nまいにちを すこし おもしろく。',36,113,10);text('WELCOME TO CCC.',192,246,11,'#dba16d','center');text('Z / A  もどる',192,270,9,'#9caf94','center');}
 else if(G.state==='dialog')dialogDraw();
 else if(G.state==='ending')endingDraw();else if(G.state==='end'){rect(0,0,384,288,'#102630');text('CHEMICAL COMPUTER CLUB',192,82,15,'#dfd8a5','center');text('TIMBERFIELD, OREGON',192,116,11,'#91ac94','center');text('1986',192,138,12,'#d5976b','center');text('END',192,186,24,'#ded9ac','center');text('Z / A  タイトルへ',192,251,10,'#8ea58e','center');}
 else {world();if(G.state==='stageIntro'){box(23,98,338,90);text('STAGE 0'+(G.stage+1),192,113,11,'#d99a65','center');text(G.data.name,192,139,18,'#e1ddb0','center');text('クリスを さがそう！',192,167,10,'#a8bd96','center');}if(G.state==='clear'){box(51,104,282,74);text('STAGE CLEAR!',192,123,24,'#e1dda9','center');text('シグナルを とりもどした。',192,155,10,'#a9c298','center');}if(G.state==='warning'){ctx.save();ctx.translate(Math.sin(G.age*80)*2,0);box(42,100,300,82);text('WARNING',192,113,29,'#e3975e','center');text('THE MACHINE',192,153,15,'#e0dba7','center');ctx.restore();}if(G.state==='over'){rect(0,35,384,253,'#10252deb');box(57,79,270,149);text('GAME OVER',192,97,25,'#dfa173','center');text(G.reason,192,135,10,'#a8bb98','center');text((G.selection===0?'> ':'  ')+'CONTINUE',129,163,13,G.selection===0?'#e1dba7':'#678b7b');text((G.selection===1?'> ':'  ')+'TITLE',129,189,13,G.selection===1?'#e1dba7':'#678b7b');}}
 if(suspended){box(90,119,204,52);text('PAUSED',192,135,20,'#e6dfb0','center');}
}
window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyZ','KeyX','Enter','Space'].includes(e.code))e.preventDefault();if(!e.repeat)taps.add(e.code);keys.add(e.code);lastActivity=performance.now();S.unlock();});window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();taps.clear();suspended=true;S.ctx?.suspend();S.external?.pause();});window.addEventListener('focus',()=>{suspended=false;last=performance.now();acc=0;S.unlock();if(S.external&&!S.muted)S.external.play().catch(()=>{});lastActivity=performance.now();});document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();taps.clear();suspended=true;S.ctx?.suspend();S.external?.pause();}else{suspended=false;last=performance.now();acc=0;lastActivity=performance.now();S.unlock();if(S.external&&!S.muted)S.external.play().catch(()=>{});}});
S.status=()=>{document.getElementById('sound').textContent=S.muted?'SOUND OFF':S.ctx?.state==='suspended'?'SOUND START ▶':'SOUND ON';};
 document.getElementById('sound').onclick=()=>{const blocked=!S.muted&&S.ctx?.state==='suspended';if(!blocked)S.toggle();S.unlock();S.status();canvas.focus();};document.getElementById('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.cabinet').requestFullscreen();}catch{}canvas.focus();};canvas.addEventListener('pointerdown',()=>{S.unlock();canvas.focus();});
let last=performance.now(),acc=0;function frame(now){const delta=Math.min(.1,(now-last)/1000);last=now;if(!suspended&&!CZ.touch?.landscape){acc+=delta;while(acc>=C.step){tick(C.step);acc-=C.step;}}render();requestAnimationFrame(frame);}S.unlock();title();requestAnimationFrame(frame);
// Read-only snapshot for smoke tests and diagnostics; no gameplay cheats exposed.
CZ.snapshot=()=>({state:G.state,stage:G.stage,time:G.time,life:G.player?.life,x:G.player?.x,y:G.player?.y,enemyCount:G.enemies.filter(e=>!e.pending&&!e.normal).length});
})();
