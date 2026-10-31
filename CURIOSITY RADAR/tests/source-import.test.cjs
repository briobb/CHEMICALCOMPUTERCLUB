const {test}=require('node:test');
const assert=require('node:assert/strict');
const {harness}=require('./harness.cjs');
test('source import adds 26 entries, enables 20 verified feeds and preserves existing rows',()=>{
  const {c,sent}=harness();const before=JSON.stringify(c.rows_('SOURCES'));
  const r=c.importRadioSources();assert.equal(r.added,26);assert.equal(r.enabled,20);assert.equal(r.disabled.length,6);
  assert.equal(c.rows_('SOURCES').length,37);assert.equal(JSON.stringify(c.rows_('SOURCES').slice(0,11)),before);
  assert.equal(c.rows_('SOURCES').filter(s=>s.source_id==='PHYS').length,1);assert.equal(sent.length,0);
  const source=c.rows_('SOURCES').find(s=>s.source_id==='SORAE');c.update_('SOURCES',source,{enabled:false});
  assert.equal(c.importRadioSources().added,0);assert.equal(c.rows_('SOURCES').find(s=>s.source_id==='SORAE').enabled,false);
});
test('source import detects existing feed aliases and does not invalidate a running test',()=>{
  const {c}=harness();c.append_('SOURCES',[{source_id:'CUSTOM_SORAE',feed_url:'https://sorae.info/feed',enabled:false}]);
  assert.equal(c.importRadioSources().added,25);
  const h=harness();h.c.saveFourSourceTest_({status:'EVALUATE'},true);
  assert.throws(()=>h.c.importRadioSources(),/実行中/);assert.equal(h.c.rows_('SOURCES').length,11);
});
test('all 4Gamer feeds share publisher limit; analog games do not default to RETRO',()=>{
  const {c}=harness();const sources=c.radioSourceCatalog_().filter(s=>s.source_id.startsWith('FOURGAMER_'));
  assert.equal(sources.length,3);assert.ok(sources.every(s=>c.publisher_(s)==='FOURGAMER'));assert.ok(sources.every(s=>s.category!=='RETRO'));
});
