const {test}=require('node:test');
const assert=require('node:assert/strict');
const {harness,evaluated,article}=require('./harness.cjs');

test('setup preserves values/data and automation stays off until explicitly enabled',()=>{
  const {c,triggers}=harness();c.setSetting_('MIN_SCORE',82);c.append_('ARTICLES',[article('keep')]);c.setupSystem();c.setupSystem();
  assert.equal(c.rows_('SETTINGS').filter(r=>r.key==='MIN_SCORE').length,1);assert.equal(c.settings_().MIN_SCORE,82);
  assert.equal(c.rows_('ARTICLES').length,1);assert.equal(c.rows_('SOURCES').length,11);assert.equal(triggers.length,0);
  c.enableAutomation();c.setupSystem();c.enableAutomation();assert.equal(triggers.length,4);
  c.setSetting_('REPORT_HOUR',9);c.setupSystem();assert.equal(triggers.length,4);
  c.disableAutomation();assert.equal(triggers.length,0);assert.equal(c.runDailyJob().status,'DISABLED');
});
test('URL normalization removes tracking only, preserves article-identifying differences',()=>{
  const {c}=harness();assert.equal(c.normalizeUrl_('https://EXAMPLE.com:443/a?id=2&utm_source=x&fbclid=y#fragment'),'https://example.com/a?id=2');
  assert.notEqual(c.normalizeUrl_('https://example.com/a?id=2'),c.normalizeUrl_('https://example.com/a?id=3'));
  assert.notEqual(c.normalizeUrl_('https://example.com/a'),c.normalizeUrl_('https://example.com/a/'));
  for(const u of ['javascript:alert(1)','https://user@example.com/','https://127.0.0.1/','https://localhost/'])assert.throws(()=>c.safeUrl_(u));
});
test('RSS, namespaced Atom and RDF parse; updated-only Atom never becomes freshly published',()=>{
  const {c}=harness(),s={feed_url:'https://example.com/feed',category:'NATURE'};
  const rss=c.parseFeed_('<rss><channel><item><title>A &amp; B</title><link>https://example.com/a</link><description><![CDATA[<p>Summary</p>]]></description><pubDate>Wed, 28 Oct 2026 01:00:00 GMT</pubDate></item></channel></rss>',s);
  assert.equal(rss[0].title_original,'A & B');assert.equal(rss[0].summary_original,'Summary');
  const atom=c.parseFeed_('<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atom</title><link rel="self" href="x"/><link href="/article"/><summary>Text</summary><updated>2026-10-29T01:00:00Z</updated></entry></feed>',s);
  assert.equal(atom[0].published_at,'');assert.equal(atom[0].updated_at,'2026-10-29T01:00:00.000Z');assert.equal(atom[0].url,'https://example.com/article');
  const rdf=c.parseFeed_('<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/"><item><title>Old</title><link>https://example.com/old</link><dc:date>1986-01-01T00:00:00Z</dc:date></item></rdf:RDF>',s);
  assert.match(rdf[0].published_at,/1986/);assert.throws(()=>c.parseFeed_('<html>not a feed</html>',s));
  assert.throws(()=>c.parseFeed_('<!DOCTYPE rss><rss/>',s));
});
test('one broken feed does not stop others; fetch is idempotent and test fetch is read-only',()=>{
  const h=harness(),{c}=h; c.rows_('SOURCES').forEach(s=>c.update_('SOURCES',s,{enabled:['MIT','NASA'].includes(s.source_id)}));
  const xml='<rss><channel><item><title>News</title><link>https://example.com/a?utm_source=test</link><description>Summary</description><pubDate>'+new Date().toUTCString()+'</pubDate></item></channel></rss>';
  h.setFetcher(url=>h.response(200,url.includes('mit.edu')?'<html>broken</html>':xml));
  c.testFeedFetch();assert.equal(c.rows_('ARTICLES').length,0);c.fetchAllFeeds();c.fetchAllFeeds();
  assert.equal(c.rows_('ARTICLES').length,1);assert.equal(c.rows_('SOURCES').find(s=>s.source_id==='MIT').failure_count,2);
});
test('summary length, score arithmetic, fields and primary evidence are validated',()=>{
  const {c}=harness(),a=article('a'),ev={kind:'RSS_ONLY',excerpt:''};assert.equal(c.validateEvaluation_(evaluated(),ev,a).total_score,85);
  for(const v of [evaluated({total_score:99}),evaluated({curiosity_score:36}),evaluated({source_verified:true}),evaluated({reliability:'VERIFIED'}),evaluated({summary_ja:'短すぎる'})])assert.throws(()=>c.validateEvaluation_(v,ev,a));
  assert.equal(c.validateEvaluation_(evaluated({reliability:'VERIFIED',source_verified:true}),{kind:'PRIMARY_PAGE_EXCERPT',excerpt:'x'.repeat(250)},a).source_verified,true);
});
test('weekly periods use JST midnight across year boundaries and Sunday finalization',()=>{
  const {c}=harness();for(const time of ['2026-11-01T14:30:00Z','2026-11-01T23:00:00Z']){
    const p=c.reportPeriod_(new Date(time));assert.equal(p.id,'CCC-2026-11-02');assert.equal(p.start.toISOString(),'2026-10-25T15:00:00.000Z');assert.equal(p.end.toISOString(),'2026-11-01T15:00:00.000Z');
  }
  assert.equal(c.reportPeriod_(new Date('2027-01-03T23:00:00Z')).start.toISOString(),'2026-12-27T15:00:00.000Z');
});
test('selection enforces score, prior publication, source/category caps, reliability and 8+2',()=>{
  const {c}=harness(),p=c.reportPeriod_(new Date('2026-11-02T00:00:00Z')),cfg=c.settings_();
  const all=Array.from({length:18},(_,i)=>article('n'+i,{category:['SPACE','NEURO','NATURE','INVENTION'][i%4],source_id:'SRC'+i%5}));
  all.push(article('retro',{category:'RETRO',published_at:'1986-01-01T00:00:00Z'}),article('retro2',{category:'RETRO',published_at:''}));
  all.push(article('low',{total_score:69}),article('unknown',{reliability:'UNVERIFIED',total_score:100}),article('delivered',{delivery_status:'DELIVERED',total_score:100}));
  const result=c.chooseArticles_(all,[],p,cfg);assert.equal(result.length,10);assert.equal(result.filter(a=>a.category==='RETRO').length,2);
  assert.ok(result.every(a=>!['low','unknown','delivered'].includes(a.article_id)));
  for(const key of new Set(result.map(a=>a.source_id)))assert.ok(result.filter(a=>a.source_id===key).length<=3);
  for(const cat of new Set(result.map(a=>a.category)))assert.ok(result.filter(a=>a.category===cat).length<=3);
  const uncertain=all.map(a=>({...a,reliability:'SPECULATIVE'}));assert.equal(c.chooseArticles_(uncertain,[],p,cfg).length,2);
  const previous=[{article_ids:JSON.stringify(result.map(a=>a.article_id))}];assert.ok(c.chooseArticles_(all,previous,p,cfg).every(a=>!result.some(b=>a.article_id===b.article_id)));
});
test('same-story detection is conservative and prefers primary sources',()=>{
  const {c}=harness(),title='Astronomers detect unusual radio signals beneath icy moon surface',summary='Astronomers discovered unusual radio signals beneath the icy moon surface using a new instrument during a long observation campaign last summer';
  const a=article('primary',{source_id:'NASA',title_original:title,summary_original:summary,total_score:80});
  const b=article('secondary',{title_original:title,summary_original:summary,total_score:99});assert.equal(c.sameNews_(a,b),true);
  assert.equal(c.sameNews_(a,article('different')),false);
  const result=c.chooseArticles_([a,b],[],c.reportPeriod_(new Date('2026-11-02T00:00:00Z')),c.settings_());assert.equal(result.length,1);assert.equal(result[0].article_id,'primary');
});
test('freeze is idempotent, stores immutable body and handles empty reports',()=>{
  const {c}=harness();c.append_('ARTICLES',[article('a')]);const now=new Date('2026-11-01T14:30:00Z');
  const first=c.finalizeReport_(now);c.update_('ARTICLES',c.rows_('ARTICLES')[0],{title_ja:'Changed after freeze'});
  const second=c.finalizeReport_(now);assert.equal(second.report_id,first.report_id);assert.equal(c.rows_('REPORTS').length,1);
  assert.ok(!JSON.parse(second.snapshot_json).articles[0].title.includes('Changed'));
  assert.equal(JSON.parse(c.finalizeReport_(new Date('2026-11-08T14:00:00Z')).snapshot_json).articles.length,0);
});
test('mail sends once; SENT recovery repairs article flags without another email',()=>{
  const {c,sent}=harness();c.append_('ARTICLES',[article('a')]);c.finalizeReport_(new Date('2026-11-01T14:00:00Z'));
  const monday=new Date('2026-11-01T23:30:00Z');c.sendReport_(monday);c.sendReport_(monday);assert.equal(sent.length,1);
  assert.equal(sent[0][0],'owner@example.com');assert.equal(c.rows_('ARTICLES')[0].delivery_status,'DELIVERED');
  c.update_('ARTICLES',c.rows_('ARTICLES')[0],{delivery_status:'NEW'});c.sendReport_(monday);assert.equal(sent.length,1);assert.equal(c.rows_('ARTICLES')[0].delivery_status,'DELIVERED');
});
test('ambiguous Gmail exception or durable SENDING never causes automatic redelivery',()=>{
  const h=harness(),{c}=h;c.finalizeReport_(new Date('2026-11-01T14:00:00Z'));let reportCalls=0;
  c.GmailApp.sendEmail=(to,subject)=>{if(subject.startsWith('CCC CURIOSITY REPORT')){reportCalls++;throw new Error('Transport outcome unknown');}};
  const monday=new Date('2026-11-01T23:30:00Z');assert.equal(c.sendReport_(monday).status,'UNKNOWN');c.sendReport_(monday);assert.equal(reportCalls,1);
  c.update_('REPORTS',c.rows_('REPORTS')[0],{status:'SENDING'});assert.equal(c.sendReport_(monday).status,'UNKNOWN');assert.equal(reportCalls,1);
});
test('preflight quota failure is FAILED and can be retried without duplicating mail',()=>{
  const {c,sent}=harness();c.finalizeReport_(new Date('2026-11-01T14:00:00Z'));const monday=new Date('2026-11-01T23:30:00Z');
  c.MailApp.getRemainingDailyQuota=()=>0;assert.throws(()=>c.sendReport_(monday));assert.equal(c.rows_('REPORTS')[0].status,'FAILED');
  c.MailApp.getRemainingDailyQuota=()=>100;c.sendReport_(monday);assert.equal(sent.length,1);
});
test('administrator only, unsupported modes fail closed, lock prevents concurrent writes',()=>{
  const h=harness(),{c}=h;for(const mail of ['other@example.com','owner@example.com,other@example.com','owner@example.com\nBcc:x@example.com']){h.properties.set('ADMIN_EMAIL',mail);assert.throws(()=>c.adminEmail_());}
  h.properties.set('ADMIN_EMAIL','owner@example.com');c.setSetting_('DELIVERY_MODE','PUBLIC');assert.throws(()=>c.settings_());
  h.lock();assert.equal(c.sendWeeklyReport().status,'BUSY');assert.equal(h.sent.length,0);h.unlock();
});
test('real template escapes content, has no images and hides scores by default',()=>{
  const {c}=harness();const p=c.reportPeriod_(new Date('2026-11-02T00:00:00Z'));
  const data=c.reportData_([article('a',{title_ja:'<script>alert(1)</script>'})],p,1,c.settings_());const r=c.renderReport_(data);
  assert.ok(r.html.includes('&lt;script&gt;'));assert.ok(!r.html.includes('<script>'));assert.ok(!/<img\b/.test(r.html));assert.ok(!r.html.includes('管理者スコア：'));
  assert.ok(r.text.includes('元')===false);assert.ok(r.text.includes('https://example.com/a'));assert.match(r.subject,/NO.001$/);
});
test('cost reservation prevents overspending and survives unknown network outcomes',()=>{
  const h=harness(),{c}=h,a=article('a'),ev={kind:'RSS_ONLY',excerpt:''};let calls=0;h.setFetcher(()=>{calls++;throw new Error('timeout');});
  assert.throws(()=>c.requestEvaluation_(a,null,ev,c.settings_(),c.deadline_()));assert.equal(c.usage_().calls,1);assert.ok(c.usage_().cost>0);
  c.setSetting_('MAX_AI_COST_USD_PER_MONTH',c.usage_().cost);assert.throws(()=>c.requestEvaluation_(a,null,ev,c.settings_(),c.deadline_()),/budget/);assert.equal(calls,1);
  c.setSetting_('MAX_AI_COST_USD_PER_MONTH',5);c.setSetting_('MAX_AI_ARTICLES_PER_DAY',1);assert.throws(()=>c.requestEvaluation_(a,null,ev,c.settings_(),c.deadline_()),/Daily/);
});
test('Responses payload and token accounting; incomplete/refusal/malformed output rejected',()=>{
  const h=harness(),{c}=h;let payload;h.setFetcher((url,opt)=>{assert.equal(url,'https://api.openai.com/v1/responses');payload=JSON.parse(opt.payload);
    return h.response(200,{status:'completed',usage:{input_tokens:100,output_tokens:200},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(evaluated())}]}]});});
  const r=c.requestEvaluation_(article('a'),null,{kind:'RSS_ONLY',excerpt:''},c.settings_(),c.deadline_());assert.equal(r.total_score,85);
  assert.equal(payload.store,false);assert.equal(payload.text.format.strict,true);assert.equal(payload.text.format.type,'json_schema');assert.equal(c.rows_('LOGS').filter(r=>r.process==='AI_REQUEST')[0].status,'RECEIVED');
  for(const response of [{status:'incomplete'},{status:'completed',output:[{content:[{type:'refusal'}]}]},{status:'completed',output:[{content:[{type:'output_text',text:'not JSON'}]}]}]){
    h.setFetcher(()=>h.response(200,response));assert.throws(()=>c.requestEvaluation_(article('b'),null,{kind:'RSS_ONLY',excerpt:''},c.settings_(),c.deadline_()));
  }
});
test('429 retry recovers, auth stops, evaluation test leaves production rows unchanged',()=>{
  const h=harness(),{c}=h;const now=new Date().toISOString();c.append_('ARTICLES',[article('pending',{ai_status:'PENDING',ai_attempts:0,published_at:now,fetched_at:now})]);
  let count=0;h.setFetcher(()=>{count++;return count===1?h.response(429,{}, {'Retry-After':'1'}):h.response(200,{status:'completed',usage:{input_tokens:100,output_tokens:200},output:[{content:[{type:'output_text',text:JSON.stringify(evaluated())}]}]});});
  const before=JSON.stringify(c.rows_('ARTICLES'));c.testArticleEvaluation();assert.equal(JSON.stringify(c.rows_('ARTICLES')),before);assert.equal(count,2);
  c.evaluatePendingArticles();assert.equal(c.rows_('ARTICLES')[0].ai_status,'DONE');
  c.append_('ARTICLES',[article('auth',{ai_status:'PENDING',ai_attempts:0,published_at:now,fetched_at:now})]);h.setFetcher(()=>h.response(401,{}));
  assert.match(c.evaluatePendingArticles().stopped,/401/);assert.equal(c.rows_('ARTICLES')[1].ai_status,'PENDING');
});
test('test email does not freeze, consume issue numbers or update delivery flags',()=>{
  const {c,sent}=harness();c.append_('ARTICLES',[article('a')]);const before=JSON.stringify(c.rows_('ARTICLES'));c.sendTestReport();
  assert.equal(sent.length,1);assert.match(sent[0][1],/^\[TEST\]/);assert.equal(c.rows_('REPORTS').length,0);assert.equal(JSON.stringify(c.rows_('ARTICLES')),before);
});
test('secrets are redacted and untrusted spreadsheet text cannot become a formula',()=>{
  const {c}=harness();assert.equal(c.sanitize_('error sk-test-not-real'),'error [REDACTED]');assert.equal(c.cell_('=IMPORTXML("bad")'),"'=IMPORTXML(\"bad\")");
  c.log_('TEST','FAILED',0,0,0,'Bearer sk-test-not-real');assert.ok(!JSON.stringify(c.rows_('LOGS')).includes('sk-test-not-real'));
});
