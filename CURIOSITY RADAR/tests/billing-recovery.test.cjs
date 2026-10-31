const {test}=require('node:test');
const assert=require('node:assert/strict');
const {harness,article}=require('./harness.cjs');
test('billing 429 is classified and blocks later API requests without exposing server messages',()=>{
  const h=harness(),{c}=h;let calls=0;
  h.setFetcher(()=>{calls++;return h.response(429,{error:{code:'insufficient_quota',message:'private server message'}});});
  const request=()=>c.requestEvaluation_(article('a'),null,{kind:'RSS_ONLY',excerpt:''},c.settings_(),c.deadline_());
  assert.throws(request,e=>e.stop===true && /insufficient_quota/.test(e.message));
  assert.throws(request,/billing paused/);assert.equal(calls,1);assert.equal(c.usage_().calls,1);
  assert.ok(!JSON.stringify(c.rows_('LOGS')).includes('private server message'));
});
test('rate limit 429 remains retryable and does not set billing block',()=>{
  const h=harness(),{c}=h;
  h.setFetcher(()=>h.response(429,{error:{code:'rate_limit_exceeded'}}));
  assert.throws(()=>c.requestEvaluation_(article('a'),null,{kind:'RSS_ONLY',excerpt:''},c.settings_(),c.deadline_()),e=>e.retryable && !e.stop);
  assert.equal(h.properties.has('AI_BILLING_BLOCK'),false);
});
test('recovery resets only scoped failed auth/quota rows and preserves successful summaries and usage',()=>{
  const {c,properties}=harness();
  const ids=c.fourSourceTestSources_(true);c.saveFourSourceTest_({status:'FAILED',source_ids:ids},true);
  c.append_('ARTICLES',[
    article('auth',{source_id:'NASA',ai_status:'FAILED',ai_attempts:3,ai_error:'OpenAI HTTP 401'}),
    article('quota',{source_id:'NASA',ai_status:'FAILED',ai_attempts:3,ai_error:'OpenAI HTTP 429 [insufficient_quota]'}),
    article('invalid',{source_id:'NASA',ai_status:'FAILED',ai_attempts:3,ai_error:'Invalid score sum'}),
    article('done',{source_id:'NASA'}),article('other',{source_id:'OTHER',ai_status:'FAILED',ai_error:'OpenAI HTTP 429'})]);
  c.log_('AI_REQUEST','HTTP_429',1,0,0.01,'reserved');const usage=JSON.stringify(c.usage_());
  properties.set('AI_BILLING_BLOCK','insufficient_quota');c.resumeAllSourcesTest=()=>({status:'EVALUATE'});
  assert.equal(c.recoverAfterBillingFix().status,'EVALUATE');const rows=c.rows_('ARTICLES');
  assert.equal(rows[0].ai_status,'PENDING');assert.equal(rows[1].ai_attempts,0);assert.equal(rows[2].ai_status,'FAILED');
  assert.equal(rows[3].ai_status,'DONE');assert.ok(rows[3].summary_ja);assert.equal(rows[4].ai_status,'FAILED');
  assert.equal(JSON.stringify(c.usage_()),usage);assert.equal(properties.has('AI_BILLING_BLOCK'),false);
  for(const status of ['SENT','SENDING','UNKNOWN']) {c.saveFourSourceTest_({status,source_ids:ids},true);assert.throws(()=>c.recoverAfterBillingFix(),/failed unsent/);}
});
