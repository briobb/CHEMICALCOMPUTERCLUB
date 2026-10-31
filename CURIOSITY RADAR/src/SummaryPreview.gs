function summaryPreviewData_() {
  adminEmail_();
  var names={}, rows=rows_('ARTICLES'), counts={total:rows.length,done:0,scored:0,pending:0,failed:0};
  rows_('SOURCES').forEach(function(s) { names[s.source_id]=s.source_name; });
  rows.forEach(function(a) {
    if (a.ai_status==='SCORED') counts.scored++;
    if (['PENDING','SCORING','EVALUATING','SUMMARIZING'].indexOf(a.ai_status)>=0) counts.pending++;
    if (a.ai_status==='FAILED') counts.failed++;
  });
  var articles=rows.filter(function(a) { return a.ai_status==='DONE' && String(a.summary_ja || '').trim(); });
  counts.done=articles.length;
  articles.sort(function(a,b) { return Number(b.total_score)-Number(a.total_score) || String(b.published_at).localeCompare(String(a.published_at)); });
  return {counts:counts,articles:articles.map(function(a) {
    var url=''; try { url=safeUrl_(a.url); } catch (_) { /* Do not render unsafe links. */ }
    return {title:a.title_ja || a.title_original,summary:a.summary_ja,source:names[a.source_id] || a.source_id,
      score:Number(a.total_score),category:a.category,reliability:a.reliability,note:a.reliability_note,
      point:a.interesting_point,source_note:a.source_note,url:url,
      published:date_(a.published_at)?day_(a.published_at):'公開日不明'};
  })};
}
function renderSummaryPreview_() {
  var template=HtmlService.createTemplateFromFile('SummaryReadingTemplate');
  template.data=summaryPreviewData_();
  return template.evaluate().getContent();
}
function previewSummarizedArticles() {
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(renderSummaryPreview_()).setWidth(920).setHeight(760),
    'CCC RADAR — 要約済み記事を読む');
}
