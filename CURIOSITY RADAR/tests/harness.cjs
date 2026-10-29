const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { DOMParser } = require('@xmldom/xmldom');
const root = path.resolve(__dirname, '..');

function harness() {
  const properties = new Map(), sheets = new Map(), sent = [], triggers = [];
  let held = false, fetcher = () => { throw new Error('Unexpected network call'); };
  const propService = {getProperty:k=>properties.get(k)||null,setProperty(k,v){properties.set(k,String(v));return this;},deleteProperty:k=>properties.delete(k)};
  function range(sheet,row,col,height=1,width=1) {
    return {
      getValues:()=>Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>sheet.data[row+i-1]?.[col+j-1]??'')),
      setValues(values){
        if(values.length!==height || values.some(v=>v.length!==width)) throw new Error('Range dimension mismatch');
        values.forEach((line,i)=>line.forEach((value,j)=>{ sheet.data[row+i-1]??=[]; sheet.data[row+i-1][col+j-1]=value; }));return this;
      },setFontWeight(){return this;},setBackground(){return this;},setDataValidation(){return this;},
      getRow:()=>row,getColumn:()=>col,getNumRows:()=>height,getSheet:()=>sheet
    };
  }
  const book = {getId:()=> 'test-sheet',getUrl:()=> 'https://docs.google.com/spreadsheets/d/test-sheet',
    setSpreadsheetTimeZone(){},getSheetByName:n=>sheets.get(n),insertSheet(name){
      const s={data:[],maxRows:1000,maxColumns:26,getName:()=>name,getLastRow(){return this.data.length;},getLastColumn(){return Math.max(0,...this.data.map(r=>r.length));},
        getMaxRows(){return this.maxRows;},getMaxColumns(){return this.maxColumns;},insertRowsAfter(_,n){this.maxRows+=n;},insertColumnsAfter(_,n){this.maxColumns+=n;},
        setFrozenRows(){},getRange(row,col,height=1,width=1){if(row+height-1>this.maxRows||col+width-1>this.maxColumns)throw new Error('Grid out of bounds');return range(this,row,col,height,width);}};
      sheets.set(name,s); return s;
    }};
  function element(node) {
    return {getName:()=>node.localName,getValue:()=>node.textContent,getChildren:()=>Array.from(node.childNodes).filter(n=>n.nodeType===1).map(element),
      getAttribute(name){return node.hasAttribute(name)?{getValue:()=>node.getAttribute(name)}:null;}};
  }
  const sandbox={console:{log(){},error(){}},Date,Set,Map,JSON,Math,Number,String,Array,Object,RegExp,Error,Boolean,isFinite,parseInt,decodeURIComponent,
    PropertiesService:{getScriptProperties:()=>propService},
    Session:{getEffectiveUser:()=>({getEmail:()=> 'owner@example.com'})},
    SpreadsheetApp:{openById:()=>book,getActiveSpreadsheet:()=>book,create:()=>book,flush(){},
      newDataValidation(){return {requireValueInList(){return this;},setAllowInvalid(){return this;},build(){return {};}};}},
    LockService:{getScriptLock:()=>({tryLock(){if(held)return false; held=true;return true;},releaseLock(){held=false;}})},
    Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},
      computeDigest:(_,s)=>Array.from(crypto.createHash('sha256').update(s).digest()),
      newBlob:s=>({getBytes:()=>Buffer.from(s)}),sleep(){},
      formatDate:(date,tz,format)=>{if(tz!=='Asia/Tokyo'||format!=='yyyy-MM-dd')throw new Error('Unexpected date formatting');return new Date(date.getTime()+9*3600000).toISOString().slice(0,10);}},
    XmlService:{parse(xml){const doc=new DOMParser({onError(level,message){if(level!=='warning')throw new Error(message);}}).parseFromString(xml,'text/xml');return {getRootElement:()=>element(doc.documentElement)};}},
    UrlFetchApp:{fetch:(...args)=>fetcher(...args)},
    MailApp:{getRemainingDailyQuota:()=>100},GmailApp:{sendEmail:(...args)=>{sent.push(args);}},
    ScriptApp:{WeekDay:{SUNDAY:'SUNDAY',MONDAY:'MONDAY'},getProjectTriggers:()=>triggers.slice(),deleteTrigger(t){triggers.splice(triggers.indexOf(t),1);},
      newTrigger(handler){const b={timeBased(){return this;},inTimezone(){return this;},everyDays(){return this;},atHour(){return this;},onWeekDay(){return this;},everyHours(){return this;},create(){const id=crypto.randomUUID();const t={getHandlerFunction:()=>handler,getUniqueId:()=>id};triggers.push(t);return t;}};return b;}}};
  const context=vm.createContext(sandbox);
  sandbox.HtmlService={createTemplateFromFile(name){const template={data:null,evaluate(){
    const source=fs.readFileSync(path.join(root,'src',name+'.html'),'utf8');
    let code='let out="";\n',last=0;const pattern=/<\?([=!]?)([\s\S]*?)\?>/g;let m;
    while((m=pattern.exec(source))){code+='out+='+JSON.stringify(source.slice(last,m.index))+';\n';code+=m[1]==='='?'out+=html_('+m[2]+');\n':m[1]==='!'?'out+=('+m[2]+');\n':m[2]+'\n';last=pattern.lastIndex;}
    code+='out+='+JSON.stringify(source.slice(last))+';\nout;';
    context.data=this.data;const html=vm.runInContext(code,context);return {getContent:()=>html};}};return template;}};
  for(const file of fs.readdirSync(path.join(root,'src')).filter(f=>f.endsWith('.gs')))vm.runInContext(fs.readFileSync(path.join(root,'src',file),'utf8'),context,{filename:file});
  properties.set('ADMIN_EMAIL','owner@example.com'); properties.set('OPENAI_API_KEY','sk-test-not-real');
  context.setupSystem();
  return {c:context,sheets,properties,sent,triggers,setFetcher:f=>{fetcher=f;},lock:()=>{held=true;},unlock:()=>{held=false;},
    response:(code,body,headers={})=>({getResponseCode:()=>code,getContentText:()=>typeof body==='string'?body:JSON.stringify(body),getAllHeaders:()=>headers})};
}

function evaluated(overrides={}) {
  return Object.assign({title_ja:'宇宙の観測に新しい手がかり',summary_ja:'研究チームが宇宙の観測データを調べ、新しい手がかりを報告しました。'.repeat(7).slice(0,240),category:'SPACE',
    curiosity_score:30,brand_score:20,talkability_score:18,story_score:9,uniqueness_score:8,total_score:85,
    reliability:'PRELIMINARY',reliability_note:'初期段階の研究で、追加の観測が必要です。',interesting_point:'身近な疑問と宇宙の観測がつながる点です。',
    section_title:'SPACE ODDITIES',keywords:['SPACE'],source_verified:false,source_note:'RSSの研究概要のみ。一次資料の照合は未完了です。'},overrides);
}
function article(id,overrides={}) {
  return Object.assign({article_id:id,source_id:'S-'+id,title_original:'Distinct topic '+id,summary_original:'A separate research topic '+id,
    url:'https://example.com/'+id,normalized_url:'https://example.com/'+id,duplicate_key:'key-'+id,
    published_at:'2026-10-28T01:00:00Z',fetched_at:'2026-10-28T02:00:00Z',ai_status:'DONE',ai_attempts:1,delivery_status:'NEW'},evaluated(),overrides);
}
module.exports={harness,evaluated,article,root};
