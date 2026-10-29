function reportData_(articles,period,issue,c) {
  var names = {}; rows_('SOURCES').forEach(function(s) { names[s.source_id]=s.source_name; });
  return {report_id:period.id,issue_number:issue,date:day_(period.end).replace(/-/g,'.'),
    period_start:day_(period.start),period_end:day_(period.end.getTime()-1),show_score:c.SHOW_ADMIN_SCORE,
    articles:articles.map(function(a) { return {article_id:a.article_id,source:names[a.source_id] || a.source_id,
      title:a.title_ja,summary:a.summary_ja,point:a.interesting_point,section:a.section_title,
      reliability:a.reliability,note:a.reliability_note,source_note:a.source_note,
      url:safeUrl_(a.url),score:Number(a.total_score)}; })};
}
function previewData_() {
  var c = settings_(), p = reportPeriod_(new Date()), reports = rows_('REPORTS');
  var existing = reports.filter(function(r) { return r.report_id===p.id; })[0];
  if (existing) return JSON.parse(existing.snapshot_json);
  var issue = reports.reduce(function(n,r) { return Math.max(n,Number(r.issue_number)||0); },0)+1;
  return reportData_(chooseArticles_(rows_('ARTICLES'),reports,p,c),p,issue,c);
}
function renderReport_(data) {
  var issue = String(data.issue_number).padStart(3,'0');
  var lines = ['CHEMICAL COMPUTER CLUB','CURIOSITY REPORT','WEEKLY INTELLIGENCE DIGEST','ISSUE NO.'+issue,
    data.date, data.period_start+' – '+data.period_end,'',
    '今週も世界中の研究所、大学、科学者たちから興味深い報告が届いています。',
    'その中から、CCCのクラブ員がきっと気に入る話題を選びました。',''];
  if (!data.articles.length) lines.push('今週は掲載基準を満たす記事がありませんでした。次の発見をお待ちください。','');
  data.articles.forEach(function(a,i) {
    lines.push((i+1)+'. '+a.section,a.title,a.summary,'面白いポイント：'+a.point,
      '科学的信頼性：'+a.reliability,'注記：'+a.note,'出典確認：'+a.source_note,
      '出典：'+a.source,safeUrl_(a.url));
    if (data.show_score) lines.push('管理者スコア：'+a.score+'/100');
    lines.push('');
  });
  lines.push('CHEMICAL COMPUTER CLUB','TIMBERFIELD, OREGON','EST. 1986','END OF TRANSMISSION',
    'CCCの所在地・沿革は架空の設定です。記事の科学的事実とは関係ありません。');
  var template = HtmlService.createTemplateFromFile('ReportTemplate'); template.data = data;
  return {data:data,subject:'CCC CURIOSITY REPORT | '+data.date+' | NO.'+issue,
    text:lines.join('\n'),html:template.evaluate().getContent()};
}
function buildWeeklyReport() { return withLock_(function() { return renderReport_(previewData_()); }); }
function previewWeeklyReport() {
  var report = buildWeeklyReport(); if (!report.html) return report;
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(report.html).setWidth(720).setHeight(750),'CCC RADAR — プレビュー（未送信）');
}
