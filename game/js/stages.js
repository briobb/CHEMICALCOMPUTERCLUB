/* Coordinates are logical pixels. Platforms are solid from every side.
   Gaps are the spaces between ground segments; enemies never spawn at landings. */
window.CZ = window.CZ || {};
CZ.stages = [
 {name:'TIMBERFIELD HIGH',length:3067,theme:0,goal:'EXIT',
  grounds:[[0,950],[1014,1960],[2028,3067]],
  steps:[[510,224,72,24],[1450,224,64,24],[1514,200,64,48],[1578,224,64,24],[2500,224,90,24]],
  enemies:[['car',360],['car',770],['car',1220],['car',1800],['car',2290]]},
 {name:'DOWNTOWN TIMBERFIELD',length:3733,theme:1,goal:'ARCADE',
  grounds:[[0,740],[808,1570],[1640,2490],[2564,3460],[3530,3733]],
  steps:[[400,224,80,24],[1110,224,60,24],[1170,200,70,48],[1240,224,60,24],[2010,224,64,24],[2074,200,64,48],[2910,224,96,24]],
  enemies:[['car',270],['dog',990],['mower',1410],['car',1860],['dog',2310],['mower',2770],['car',3190]]},
 {name:'UNDER TIMBERFIELD',length:4067,theme:2,
  grounds:[[0,690],[766,1420],[1500,2280],[2360,3060],[3140,4067]],
  steps:[[390,224,60,24],[450,200,60,48],[1000,224,60,24],[1060,200,60,48],[1120,176,60,72],[1800,224,64,24],[1864,200,64,48],[2650,224,64,24],[2714,200,64,48],[3440,224,60,24],[3500,200,60,48],[3560,176,60,72]],
  enemies:[['car',260],['dog',920],['mower',1250],['dog',1670],['mower',2100],['car',2530],['dog',2900],['mower',3300]]}
];
