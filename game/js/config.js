/* All tuning values live here. Scripts intentionally work over file://. */
window.CZ = window.CZ || {};
CZ.config = {
  width:384,height:288, step:1/60, timeLimit:180, idleTimeout:90, endTimeout:25,
  story:{epiloguePageSeconds:8},
  player:{width:14,height:32,speed:100,jump:360,gravity:760,maxFall:420,life:3,invulnerability:1},
  tuner:{range:112,speed:260,cooldown:.35,muzzleY:15},
  enemies:{car:{hp:1,speed:38,notice:0},dog:{hp:2,speed:55,patrolSpeed:26,patrolRange:96,notice:130,windup:.35,chase:.65,recovery:1.1,heightTolerance:8},mower:{hp:3,speed:23,notice:95,boost:70}},
  spawn:{triggerDistance:560,minDelay:.3,maxDelay:2.2,screenMargin:24},
  boss:{nodeHP:4,attackInterval:2.4,warning:2.5},
  // Standard mapping: physical bottom button = A, right button = B.
  // Change these indices for unlabelled / non-standard USB controllers.
  gamepad:{jump:0,tuner:1,up:12,down:13,left:14,right:15,deadzone:.45},
  audio:{volume:.11,stepSeconds:.23,trackStepSeconds:{boss:.20},files:{/* jump:'assets/jump.wav', stage1:'assets/stage1.ogg' */}},
  art:{sprites:{/* alex:'assets/alex.png', car:'assets/car.png', dog:'assets/dog.png', mower:'assets/mower.png' */},backgrounds:[]}
};
