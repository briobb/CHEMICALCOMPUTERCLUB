const {test}=require('node:test');
const assert=require('node:assert/strict');
const {harness,article}=require('./harness.cjs');
function ready() {
  const h=harness(),{c}=h;
  c.rows_('SOURCES').forEach(s=>c.update_('SOURCES',s,{enabled:true}));
  c.append_('ARTICLES',[article('recent',{source_id:'NASA',published_at:new Date(Date.now()-60000).toISOString()})]);
  c.evaluatePending_=()=>({evaluated:0});
  c.fetchFeeds_=(_,__,ids)=>ids.map(source=>({source,...(source==='SMITHSONIAN'?{error:'Missing feed URL'}:{parsed:1,newArticles:0})}));
  return h;
}
test('all sources tolerate failed feeds, scope evaluation to successes, and send only once',()=>{
  const {c,sent,triggers}=ready();
  assert.equal(c.startAllSourcesTest().status,'EVALUATE');
  c.evaluatePending_=(_,__,ids)=>{assert.equal(ids.length,10);assert.ok(!ids.includes('SMITHSONIAN'));return {evaluated:0};};
  assert.equal(c.continueAllSourcesTest().status,'SENT');
  assert.match(sent[0][1],/ALL SOURCES/);assert.match(sent[0][2],/SMITHSONIAN: Missing feed URL/);
  assert.equal(triggers.length,0);assert.equal(c.rows_('REPORTS').length,0);
  c.startAllSourcesTest();c.continueAllSourcesTest();assert.equal(sent.length,1);
});
test('fetch resumes only unfinished sources before evaluation',()=>{
  const {c}=ready();let calls=0;
  c.fetchFeeds_=(_,__,ids)=>{calls++;if(calls===1)return [{source:ids[0]}];assert.equal(ids.length,10);assert.ok(!ids.includes('ESA'));return ids.map(source=>({source}));};
  assert.equal(c.startAllSourcesTest().status,'FETCH');
  assert.equal(c.continueAllSourcesTest().status,'EVALUATE');
});
test('budget stop sends eligible completed articles with explicit partial evaluation notice',()=>{
  const {c,sent}=ready();c.startAllSourcesTest();
  c.append_('ARTICLES',[article('pending',{source_id:'MIT',ai_status:'PENDING'})]);
  c.evaluatePending_=()=>({stopped:'Daily API limit'});
  assert.equal(c.continueAllSourcesTest().status,'SENT');assert.match(sent[0][2],/評価処理は途中で停止/);
});
test('all feeds failing or ambiguous Gmail results never cause repeated sending',()=>{
  let h=ready();h.c.fetchFeeds_=(_,__,ids)=>ids.map(source=>({source,error:'HTTP 403'}));
  assert.equal(h.c.startAllSourcesTest().status,'FAILED');assert.equal(h.sent.length,0);assert.equal(h.triggers.length,0);
  h=ready();h.c.startAllSourcesTest();h.c.GmailApp.sendEmail=(...args)=>{h.sent.push(args);throw new Error('Timeout');};
  assert.equal(h.c.continueAllSourcesTest().status,'UNKNOWN');h.c.startAllSourcesTest();h.c.continueAllSourcesTest();assert.equal(h.sent.length,1);
});
test('optional source filtering does not fetch or evaluate excluded sources',()=>{
  const h=harness(),{c}=h;
  h.setFetcher(()=>h.response(200,'<rss><channel></channel></rss>'));
  assert.equal(c.fetchFeeds_(c.deadline_(),true,['NASA']).length,1);
  c.append_('ARTICLES',[article('excluded',{source_id:'MIT',ai_status:'PENDING'})]);
  c.evidence_=()=>{throw new Error('Excluded article must not be evaluated');};
  assert.equal(c.evaluatePending_(c.deadline_(),false,['NASA']).evaluated,0);
  assert.equal(c.rows_('ARTICLES')[0].ai_status,'PENDING');
});
