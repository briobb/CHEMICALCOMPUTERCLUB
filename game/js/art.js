/* Built-in pixel drawings are placeholders, replaced through config.art.
   Sprite sheets: horizontal 24 × 32 cells; idle / walk1 / walk2 / jump / fire / hurt. */
CZ.art={
 images:{},backgrounds:[],nightBackground:null,
 init(){this.nightBackground=document.createElement('canvas');this.nightBackground.width=384;this.nightBackground.height=288;this.background(this.nightBackground.getContext('2d'),1,true);for(const [key,url] of Object.entries(CZ.config.art.sprites)){const im=new Image();im.src=url;this.images[key]=im;}for(let i=0;i<3;i++){const c=document.createElement('canvas');c.width=384;c.height=288;this.background(c.getContext('2d'),i);this.backgrounds[i]=c;if(CZ.config.art.backgrounds[i]){const im=new Image();im.onload=()=>{this.backgrounds[i]=im;};im.src=CZ.config.art.backgrounds[i];}}},
 rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);},
 text(c,str,x,y,size=10,color='#e6e6be',align='left'){c.fillStyle=color;c.font=`bold ${size}px monospace`;c.textAlign=align;c.textBaseline='top';c.fillText(str,Math.round(x),Math.round(y));},
 background(c,theme,night=false){const r=(x,y,w,h,col)=>this.rect(c,x,y,w,h,col),t=(s,x,y,z,col)=>this.text(c,s,x,y,z,col);
  r(0,0,384,288,['#18303b','#162733','#142b2f'][theme]);
  if(theme===1&&!night){
   r(0,35,384,25,'#69516d');r(0,60,384,24,'#a56779');r(0,84,384,30,'#da947c');r(0,114,384,36,'#e9b18b');
   r(159,73,26,26,'#f4d29b');r(155,80,34,12,'#f4d29b');
   r(28,65,66,3,'#c88b92');r(46,61,28,4,'#c88b92');r(263,78,91,3,'#e7b19b');
  }
  if(theme===0){r(0,54,384,4,'#52634e');r(0,188,384,60,'#42594f');r(0,191,384,4,'#91a07b');for(let x=8;x<384;x+=28){r(x,106,24,80,'#587a71');r(x+2,109,19,74,'#3b5c5a');r(x+5,115,12,2,'#819a82');r(x+5,120,12,2,'#819a82');r(x+17,144,2,8,'#d1c797');}r(91,74,100,17,'#111f2b');t('TIMBERFIELD HIGH',97,79,8,'#bac99a');r(220,67,100,51,'#9c8255');r(224,71,92,43,'#324a47');r(232,78,26,28,'#c5c694');r(265,77,20,15,'#cd855d');r(289,78,21,29,'#8caf9d');r(18,54,55,4,'#e1d9a1');r(291,54,55,4,'#e1d9a1');}
  if(theme===1){for(let x=0;x<384;x+=32){r(x,90+(x%3)*10,29,158,'#233f49');r(x+5,104+(x%3)*10,7,12,'#70846a');}r(15,125,170,123,'#62594c');r(10,120,180,8,'#baa779');r(23,145,153,23,'#203b40');t('THE COPPER MUG',30,152,12,'#e5ad73');r(23,180,60,48,'#173743');r(94,180,74,48,'#173743');for(let x=27;x<160;x+=26)r(x,185,15,32,'#b88d5e');r(212,100,161,148,'#3a5553');r(221,116,144,29,'#172f3a');t('RADIO & TV',233,125,13,'#a9c795');for(let x=224;x<366;x+=45){r(x,166,36,48,'#122b35');r(x+5,180,25,18,'#6eaa9b');r(x+8,183,19,12,'#c2cea0');}r(0,240,384,8,'#929578');}
  if(theme===2){for(let y=55;y<220;y+=32){r(0,y,384,5,'#365b5a');r(0,y+5,384,2,'#101f2b');}for(let x=10;x<384;x+=78){r(x,82,63,152,'#294447');r(x+4,86,55,144,'#172e37');r(x+10,96,42,31,'#486765');r(x+13,99,36,24,'#7f9b78');t('READY',x+16,107,8,'#203c3c');for(let y=140;y<220;y+=18){r(x+10,y,34,9,'#314f53');r(x+47,y+2,4,4,'#b59d63');}}r(0,62,384,8,'#837e59');for(let x=20;x<384;x+=60)r(x,60,6,12,'#aa9a6e');}
  if(theme===0){r(8,63,71,38,'#a59475');r(11,66,65,32,'#b57581');r(11,82,65,16,'#e6ae85');r(11,91,65,7,'#576d60');r(42,66,3,32,'#a59475');}
 },
 arcade(c,x,lit=true){
  const r=(a,y,w,h,col)=>this.rect(c,x+a,y,w,h,col);
  r(0,106,190,142,'#74534c');
  for(let y=111;y<242;y+=12)for(let a=(y%24?0:9);a<181;a+=22){r(a,y,19,1,'#996956');}
  r(-4,96,198,10,'#c3a273');r(3,106,184,4,'#342e3d');
  r(11,117,168,34,'#1b2b39');r(14,120,162,2,lit?'#d885a2':'#625363');
  this.text(c,'ARCADE',x+95,126,22,lit?'#f2c987':'#665d67','center');
  r(14,147,162,2,lit?'#d885a2':'#625363');
  r(5,155,180,9,'#92735b');
  for(let a=7;a<185;a+=18)r(a,156,9,7,'#c4a374');
  r(12,176,92,59,'#b59773');r(16,180,84,51,'#142b38');
  for(let a=22;a<94;a+=25){r(a,185,19,37,'#596275');r(a+2,188,15,14,lit?'#78b4af':'#334e58');r(a+4,191,10,2,'#c6d28f');r(a+1,205,17,5,'#c18578');r(a+4,207,3,2,'#eac69a');r(a+3,213,13,9,'#253846');}
  r(111,171,56,77,'#c4a67c');r(116,176,46,72,'#182c38');
  r(120,180,18,49,'#6c9797');r(141,180,17,49,'#4e727d');
  r(138,178,3,70,'#d4bc8f');r(133,215,3,8,'#f3d399');r(143,215,3,8,'#f3d399');
  this.text(c,'OPEN',x+139,185,8,lit?'#f1d08e':'#526974','center');
  r(107,245,64,3,'#c5b78b');
 },
 actor(c,p,time,kind='alex'){const x=Math.round(p.x),y=Math.round(p.y),dir=p.dir||1,normal=p.normal;const sheet=this.images[kind];if(sheet?.complete&&sheet.naturalWidth){let frame=kind==='alex'?(p.inv>0?5:p.fire>0?4:!p.grounded?3:Math.abs(p.vx)>0?1+Math.floor(time*9)%2:0):Math.floor(time*6)%2;frame%=Math.max(1,Math.floor(sheet.width/24));c.save();c.translate(x+7,y+(p.h||(kind==='alex'||kind==='chris'?32:26)));c.scale(dir,1);c.drawImage(sheet,frame*24,0,24,32,-12,-32,24,32);c.restore();return;}
  c.save();c.translate(x+(dir<0?14:0),y);c.scale(dir,1);const r=(a,b,w,h,col)=>this.rect(c,a,b,w,h,col),walk=Math.abs(p.vx||0)>0?Math.floor(time*9)%2:0;
  if(kind==='alex'||kind==='chris'){
   // Reference proportions: small head, plain T-shirt, long trouser legs.
   const alex=kind==='alex',skin='#e9bf8c',shirt=alex?'#d4d6d0':'#83ae92';
   r(4,0,9,3,alex?'#cc633e':'#ba9256');r(3,2,4,4,alex?'#b85437':'#9c784d');
   r(6,3,7,5,skin);r(12,4,2,2,'#263942');r(12,6,3,2,skin);r(6,7,5,3,skin);
   if(alex){
    r(2,9,11,10,shirt);r(0,10,3,5,shirt);r(12,10,3,5,shirt);
    r(0,15,2,6,skin);r(13,15,2,6,skin);
    r(3,19,9,3,'#58a6a2');
    r(3,22,3,6,'#69beb5');r(9,22,3,6,'#69beb5');
    r(3-walk*2,27,3,4,'#69beb5');r(9+walk*2,27,3,4,'#69beb5');
    r(2-walk*2,30,5,2,'#e8d8ae');r(9+walk*2,30,5,2,'#e8d8ae');
   }else{
    r(1,9,13,10,shirt);r(-2,10,4,5,shirt);r(13,10,4,5,shirt);
    r(-2,15,3,4,skin);r(14,15,3,4,skin);
    r(2,19,11,3,'#658ba0');
    r(2,22,4,6,'#769eb1');r(9,22,4,6,'#769eb1');
    r(2-walk*2,27,4,4,'#769eb1');r(9+walk*2,27,4,4,'#769eb1');
    r(1-walk*2,30,6,2,'#e8d8ae');r(9+walk*2,30,6,2,'#e8d8ae');
   }
   if(alex){
    // Keep the chest lettering readable in both facing directions.
    c.save();if(dir<0){c.translate(14,0);c.scale(-1,1);}
    for(let a=4;a<=10;a+=3){r(a,12,2,1,'#d86229');r(a,13,1,3,'#d86229');r(a,16,2,1,'#d86229');}
    c.restore();
   }
   if(p.fire>0){r(14,13,7,3,skin);r(19,12,6,6,'#86b1a5');r(23,13,3,2,'#e8e4a7');}
  }
  else if(kind==='car'){r(0,14,23,8,normal?'#4e776d':'#ca754d');r(5,9,11,6,'#d9b168');r(7,10,7,4,'#273e4a');r(2,21,5,5,'#111f2d');r(17,21,5,5,'#111f2d');r(15,3,1,7,'#b3ba89');}
  else if(kind==='dog'){r(1,12,20,8,'#b69968');r(15,5,10,10,'#cfb27d');r(15,3,4,7,'#705447');r(23,9,4,4,'#d4bb87');r(20,7,2,2,'#172c32');r(15,14,8,3,normal?'#9acda1':'#e88964');r(3,20,4,6-walk*2,'#b69968');r(17,20,4,4+walk*2,'#b69968');r(-3,normal?9+Math.floor(time*12)%2*3:9,5,4,'#b69968');}
  else{r(0,15,25,8,normal?'#54776c':'#929455');r(6,9,15,7,'#d0ba70');r(2,21,6,5,'#132632');r(18,21,6,5,'#132632');r(0,2,2,14,'#8fada0');r(-5,1,7,2,'#c5c69d');}
  c.restore();
 },
 machine(c,b,time){const r=(x,y,w,h,col)=>this.rect(c,x,y,w,h,col),t=(s,x,y,z,col)=>this.text(c,s,x,y,z,col);r(134,52,244,196,'#3c5350');r(140,58,232,184,'#172b35');for(let x=148;x<370;x+=49){for(let y=64;y<233;y+=44){r(x,y,43,38,'#5a7265');r(x+4,y+4,35,26,b.off?'#13272e':'#809d79');if(!b.off){r(x+7,y+11,24,2,'#bbcd95');r(x+7,y+17,17,2,'#405f57');}}}for(let i=0;i<3;i++){const n=b.nodes[i];r(n.x-9,n.y-9,27,27,'#132c32');r(n.x-6,n.y-6,21,21,n.hp===0?'#354d49':i===b.active?'#e2a15d':'#778b70');r(n.x-2,n.y-2,13,13,n.hp===0?'#152c30':'#263f43');t(String(i+1),n.x+1,n.y,9,'#dce0a3');}if(b.off&&b.after>1.5){r(188,115,146,32,'#82a987');t('CONNECTION LOST',196,126,12,'#1e3b3b');}}
};
