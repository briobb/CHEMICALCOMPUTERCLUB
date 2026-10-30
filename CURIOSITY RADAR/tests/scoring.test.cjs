const {test}=require('node:test');
const assert=require('node:assert/strict');
const {harness,article,evaluated}=require('./harness.cjs');
function seed(h,n) {
  h.c.append_('ARTICLES',Array.from({length:n},(_,i)=>article('item'+i,{source_id:'SRC'+i%4,
    title_original:'unique'+i,summary_original:'description'+i,ai_status:'PENDING',ai_attempts:0,
    summary_ja:'',title_ja:'',published_at:new Date(Date.now()-60000).toISOString(),fetched_at:new Date(Date.now()-60000).toISOString()})));
}
function score(a,high=true) {return {article_id:a.article_id,category:'NATURE',curiosity_score:high?30:1,brand_score:high?20:1,talkability_score:high?18:1,story_score:high?9:1,uniqueness_score:high?8:1,total_score:high?85:5};}
function period() {return {start:new Date(Date.now()-14*86400000),end:new Date()};}
test('204 articles use 21 scoring requests; only selected candidates receive detailed summaries',()=>{
  const h=harness(),{c}=h;seed(h,204);let scores=0,details=0;
  c.setSetting_('CATEGORY_MAX',10);c.setSetting_('SOURCE_MAX',10);
  c.evidence_=()=>({kind:'RSS_ONLY',excerpt:'',url:'',checked_at:''});
  h.setFetcher((url,options)=>{
    assert.equal(url,'https://api.openai.com/v1/responses');
    const body=JSON.parse(options.payload),input=JSON.parse(body.input[1].content);
    let result;
    if(body.text.format.name==='ccc_preliminary_scores') {
      scores++;assert.ok(input.length<=10);assert.ok(!body.input[0].content.includes('200–300'));
      result={articles:input.map(a=>score(a,Number(a.article_id.slice(4))<8))};
    } else {details++;result=evaluated({category:'NATURE'});}
    return h.response(200,{status:'completed',usage:{input_tokens:200,output_tokens:100},output:[{content:[{type:'output_text',text:JSON.stringify(result)}]}]});
  });
  const result=c.evaluatePipeline_(c.deadline_(),null,period());
  assert.equal(scores,21);assert.equal(details,8);assert.equal(result.pending,false);
  assert.equal(c.usage_().calls,29);
  const rows=c.rows_('ARTICLES');assert.equal(rows.filter(a=>a.ai_status==='DONE').length,8);
  assert.ok(rows.filter(a=>a.ai_status==='SCORED').every(a=>a.summary_ja===''));
  c.evaluatePipeline_(c.deadline_(),null,period());assert.equal(scores,21);assert.equal(details,8);
});
test('preliminary scored articles cannot enter final report selection',()=>{
  const {c}=harness();const a=article('s',{ai_status:'SCORED',published_at:new Date(Date.now()-60000).toISOString()});
  assert.equal(c.chooseArticles_([a],[],period(),c.settings_()).length,0);
  assert.equal(c.chooseArticles_([a],[],period(),c.settings_(),true).length,1);
});
test('scoring validates batch IDs and arithmetic before committing any scores',()=>{
  const h=harness(),{c}=h;seed(h,2);
  c.requestScores_=(batch,config,deadline,onStart)=>{onStart();return {articles:[score(batch[0]),score(batch[0])]};};
  c.scorePending_(c.deadline_());assert.ok(c.rows_('ARTICLES').every(a=>a.ai_status==='PENDING' && a.ai_attempts===1));
  assert.throws(()=>c.validateScores_({articles:[{...score({article_id:'a'}),total_score:99}]},[{article_id:'a'}]),/sum/);
  c.scorePending_(c.deadline_());c.scorePending_(c.deadline_());assert.ok(c.rows_('ARTICLES').every(a=>a.ai_status==='FAILED'));
});
test('scoring respects daily limit and resumes after reset without losing completed batches',()=>{
  const h=harness(),{c}=h;seed(h,12);c.setSetting_('MAX_AI_ARTICLES_PER_DAY',1);
  h.setFetcher((url,opt)=>{const input=JSON.parse(JSON.parse(opt.payload).input[1].content);return h.response(200,{status:'completed',usage:{input_tokens:1,output_tokens:1},output:[{content:[{type:'output_text',text:JSON.stringify({articles:input.map(a=>score(a))})}]}]});});
  const result=c.scorePending_(c.deadline_());assert.match(result.stopped,/Daily/);assert.equal(c.rows_('ARTICLES').filter(a=>a.ai_status==='SCORED').length,10);
  assert.equal(c.rows_('ARTICLES').filter(a=>a.ai_status==='PENDING').length,2);
  const old=c.usage_;c.usage_=()=>({calls:0,cost:0});c.scorePending_(c.deadline_());c.usage_=old;
  assert.equal(c.rows_('ARTICLES').filter(a=>a.ai_status==='SCORED').length,12);
});
test('interrupted detailed evaluation resumes from scored stage, not a second scoring batch',()=>{
  const h=harness(),{c}=h;seed(h,1);c.update_('ARTICLES',c.rows_('ARTICLES')[0],{ai_status:'SUMMARIZING',ai_attempts:1});
  c.requestScores_=()=>{throw new Error('Must not rescore');};
  c.evidence_=()=>({kind:'RSS_ONLY',excerpt:'',url:'',checked_at:''});
  c.requestEvaluation_=(a,s,e,config,d,onStart)=>{onStart();return evaluated();};
  c.evaluatePipeline_(c.deadline_(),null,period());assert.equal(c.rows_('ARTICLES')[0].ai_status,'DONE');assert.equal(c.rows_('ARTICLES')[0].ai_attempts,2);
});
