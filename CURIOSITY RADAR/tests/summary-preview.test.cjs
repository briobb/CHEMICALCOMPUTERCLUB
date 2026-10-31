const {test}=require('node:test');
const assert=require('node:assert/strict');
const {harness,article}=require('./harness.cjs');
test('reading view includes low-score and delivered summaries, excludes scoring-only rows, and is read-only',()=>{
  const {c,sent}=harness();
  c.append_('ARTICLES',[article('low',{total_score:15,reliability:'UNVERIFIED'}),article('sent',{delivery_status:'DELIVERED'}),
    article('scored',{ai_status:'SCORED',summary_ja:''}),article('pending',{ai_status:'PENDING',summary_ja:''})]);
  const before=JSON.stringify(c.rows_('ARTICLES')),logs=JSON.stringify(c.rows_('LOGS'));
  c.requestEvaluation_=()=>{throw new Error('Must not evaluate');};
  const data=c.summaryPreviewData_();assert.equal(data.counts.done,2);assert.equal(data.counts.scored,1);assert.equal(data.counts.pending,1);
  assert.equal(data.articles[0].score,85);assert.equal(data.articles[1].score,15);
  const html=c.renderSummaryPreview_();assert.match(html,/UNVERIFIED/);assert.match(html,/宇宙の観測/);
  assert.equal(JSON.stringify(c.rows_('ARTICLES')),before);assert.equal(JSON.stringify(c.rows_('LOGS')),logs);assert.equal(sent.length,0);
});
test('reading view escapes external content, rejects unsafe links, and handles empty data',()=>{
  const {c}=harness();assert.match(c.renderSummaryPreview_(),/まだ要約が完了した記事はありません/);
  c.append_('ARTICLES',[article('unsafe',{title_ja:'<img src=x onerror=alert(1)>',url:'javascript:alert(1)',summary_ja:'<script>alert(1)</script>'})]);
  const html=c.renderSummaryPreview_();assert.ok(!html.includes('<img src=x'));assert.ok(!html.includes('href="javascript:'));
  assert.match(html,/&lt;script&gt;/);
});
