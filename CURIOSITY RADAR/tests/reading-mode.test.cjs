const {test}=require('node:test');
const assert=require('node:assert/strict');
const {harness,article,evaluated}=require('./harness.cjs');
const period=()=>({id:'TEST',start:new Date(Date.now()-7*86400000),end:new Date()});
function summary() {
  const v=evaluated({reliability:'UNVERIFIED',summary_ja:'この媒体は、新しい観測結果について報告しています。提供された情報だけでは詳細を確認できず、独立した裏付けはまだ確認できていません。'});
  for(const k of Object.keys(v)) if(k.endsWith('_score')) delete v[k];
  return v;
}
function seed(h,n) {
  h.c.setSetting_('READING_MODE',true);
  h.c.append_('ARTICLES',Array.from({length:n},(_,i)=>article('r'+i,{source_id:i%2?'MIT':'NASA',
    ai_status:i%2?'SCORED':'PENDING',ai_attempts:0,summary_ja:'',total_score:1,
    published_at:new Date(Date.now()-60000-i*1000).toISOString(),updated_at:''})));
  h.c.evidence_=()=>({kind:'RSS_ONLY',excerpt:'',url:'',checked_at:''});
}
test('reading mode skips all scoring and stops at 20 summaries across repeated runs',()=>{
  const h=harness(),{c}=h;seed(h,60);
  h.setFetcher((url,opt)=>{
    const body=JSON.parse(opt.payload);
    assert.equal(body.text.format.schema.properties.total_score,undefined);
    assert.match(body.input[0].content,/Do not score/);
    return h.response(200,{status:'completed',usage:{input_tokens:300,output_tokens:200},output:[{content:[{type:'output_text',text:JSON.stringify(summary())}]}]});
  });
  const result=c.evaluatePipeline_(c.deadline_(),null,period());
  assert.equal(result.evaluated,20);assert.equal(result.pending,false);
  assert.equal(c.usage_().calls,20);
  c.evaluatePipeline_(c.deadline_(),null,period());assert.equal(c.usage_().calls,20);
  const done=c.rows_('ARTICLES').filter(a=>a.ai_status==='DONE');
  assert.equal(done.filter(a=>a.source_id==='NASA').length,10);
  assert.equal(c.chooseArticles_(c.rows_('ARTICLES'),[],period(),c.settings_()).length,20);
});
test('daily API and monthly cost budgets are preserved and respected',()=>{
  const h=harness(),{c}=h;seed(h,5);c.setSetting_('MAX_AI_ARTICLES_PER_DAY',1);c.setSetting_('MAX_AI_COST_USD_PER_MONTH',3);
  h.setFetcher(()=>h.response(200,{status:'completed',usage:{input_tokens:300,output_tokens:200},output:[{content:[{type:'output_text',text:JSON.stringify(summary())}]}]}));
  const r=c.evaluatePipeline_(c.deadline_(),null,period());
  assert.match(r.stopped,/Daily AI/);assert.equal(c.usage_().calls,1);
  assert.equal(c.settings_().MAX_AI_COST_USD_PER_MONTH,3);
  const h2=harness();seed(h2,2);h2.c.setSetting_('MAX_AI_COST_USD_PER_MONTH',0.000001);
  assert.match(h2.c.evaluatePipeline_(h2.c.deadline_(),null,period()).stopped,/Monthly/);
  assert.equal(h2.c.usage_().calls,0);
});
test('reading selection admits low scores and unverified reports with explicit labels, retains history protection',()=>{
  const {c}=harness();c.setSetting_('READING_MODE',true);
  const rows=Array.from({length:40},(_,i)=>article('r'+i,{reliability:'UNVERIFIED',total_score:0,published_at:new Date(Date.now()-86400000).toISOString()}));
  const selected=c.chooseArticles_(rows,[{article_ids:'["r0"]'}],period(),c.settings_());
  assert.equal(selected.length,30);assert.ok(selected.every(a=>a.article_id!=='r0'));
  const data=c.reportData_(selected,period(),1,c.settings_());
  assert.match(data.articles[0].reliability,/裏付け未確認/);assert.match(data.articles[0].note,/独立した裏付け/);
  assert.equal(data.show_score,false);
  assert.ok(JSON.stringify(data).length<45000);
});
test('relaxed summaries still reject fabrication of verified status and malformed output',()=>{
  const {c}=harness(),v=summary(),a=article('a');
  assert.doesNotThrow(()=>c.validateEvaluation_(v,{},a,true));
  assert.throws(()=>c.validateEvaluation_({...v,reliability:'VERIFIED',source_verified:true},{},a,true),/verification/);
  assert.throws(()=>c.validateEvaluation_({...v,summary_ja:'短い'},{},a,true),/50–600/);
});
test('migration retries only obsolete length errors once, preserves completed summaries and budgets',()=>{
  const h=harness(),{c}=h;seed(h,1);
  c.append_('ARTICLES',[article('old',{ai_status:'FAILED',ai_attempts:1,ai_error:'Japanese summary must be 200–300 characters'}),article('auth',{ai_status:'FAILED',ai_error:'OpenAI HTTP 401'})]);
  c.prepareReadingMode_();assert.equal(c.rows_('ARTICLES').find(a=>a.article_id==='old').ai_status,'SCORED');
  assert.equal(c.rows_('ARTICLES').find(a=>a.article_id==='auth').ai_status,'FAILED');
  const a=c.rows_('ARTICLES').find(a=>a.article_id==='old');c.update_('ARTICLES',a,{ai_status:'FAILED'});c.prepareReadingMode_();
  assert.equal(c.rows_('ARTICLES').find(a=>a.article_id==='old').ai_status,'FAILED');
});
test('empty frozen report never sends a digest',()=>{
  const h=harness(),{c}=h,p=c.reportPeriod_(new Date());
  c.append_('REPORTS',[{report_id:p.id,period_end:p.end.toISOString(),status:'READY',article_ids:'[]',snapshot_json:JSON.stringify(c.reportData_([],p,1,c.settings_()))}]);
  c.sendReport_(new Date(p.end.getTime()+3600000));
  assert.equal(h.sent.length,0);assert.equal(c.rows_('REPORTS')[0].status,'EMPTY');
});
