const {test}=require('node:test');
const assert=require('node:assert/strict');
const {harness,article}=require('./harness.cjs');
function ready() {
  const h=harness();
  h.c.fetchFeeds_=()=>['ESA','MIT','MIT_HISTORY','NASA'].map(source=>({source}));
  h.c.evaluatePipeline_=()=>({evaluated:0,pending:h.c.rows_('ARTICLES').some(a=>a.ai_status==='PENDING')});
  h.c.append_('ARTICLES',[article('fresh',{source_id:'NASA',published_at:new Date(Date.now()-60000).toISOString()})]);
  return h;
}
test('four-source test sends real evaluated recent articles once and preserves production history',()=>{
  const {c,sent,triggers}=ready();
  assert.equal(c.startFourSourceTest().status,'EVALUATE');
  assert.equal(triggers.length,1);
  assert.equal(c.continueFourSourceTest().status,'SENT');
  assert.equal(sent.length,1);assert.match(sent[0][1],/TEST 4 SOURCES/);
  assert.match(sent[0][2],/宇宙の観測/);
  assert.equal(c.rows_('REPORTS').length,0);
  assert.equal(c.rows_('ARTICLES')[0].delivery_status,'NEW');
  assert.equal(triggers.length,0);
  c.startFourSourceTest();c.continueFourSourceTest();assert.equal(sent.length,1);
});
test('uncertain Gmail result never resends',()=>{
  const {c,sent,triggers}=ready();c.startFourSourceTest();
  c.GmailApp.sendEmail=(...args)=>{sent.push(args);throw new Error('connection interrupted');};
  assert.equal(c.continueFourSourceTest().status,'UNKNOWN');
  c.startFourSourceTest();c.continueFourSourceTest();assert.equal(sent.length,1);assert.equal(triggers.length,0);
});
test('pending work resumes; budget stops without sending or repeated triggers',()=>{
  const {c,sent,triggers}=ready();c.startFourSourceTest();
  c.append_('ARTICLES',[article('pending',{source_id:'MIT',ai_status:'PENDING'})]);
  assert.equal(c.continueFourSourceTest().status,'EVALUATE');assert.equal(sent.length,0);
  c.evaluatePipeline_=()=>({stopped:'Monthly budget exhausted'});
  assert.equal(c.continueFourSourceTest().status,'FAILED');assert.equal(sent.length,0);assert.equal(triggers.length,0);
});
test('feed failure, unexpected enabled source and empty selection do not send',()=>{
  let h=ready();h.c.fetchFeeds_=()=>[{source:'NASA',error:'HTTP 500'}];
  assert.equal(h.c.startFourSourceTest().status,'FAILED');assert.equal(h.sent.length,0);assert.equal(h.triggers.length,0);
  h=ready();h.c.update_('SOURCES',h.c.rows_('SOURCES').find(s=>s.source_id==='QUANTA'),{enabled:true});
  assert.throws(()=>h.c.startFourSourceTest(),/exactly/);assert.equal(h.triggers.length,0);
  h=ready();h.c.startFourSourceTest();h.c.update_('ARTICLES',h.c.rows_('ARTICLES')[0],{reliability:'UNVERIFIED'});
  assert.equal(h.c.continueFourSourceTest().status,'FAILED');assert.equal(h.sent.length,0);
});
