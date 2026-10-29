function onOpen() {
  SpreadsheetApp.getUi().createMenu('CCC RADAR')
    .addItem('初期セットアップ','setupSystem')
    .addItem('RSS取得テスト（保存なし）','testFeedFetch')
    .addItem('AI評価テスト（1記事・API料金あり）','testArticleEvaluation')
    .addSeparator().addItem('本日のニュース取得','fetchAllFeeds')
    .addItem('未評価記事処理','evaluatePendingArticles')
    .addItem('週間レポートプレビュー','previewWeeklyReport')
    .addItem('週間レポートを確定','selectWeeklyArticles')
    .addItem('テストメール送信','sendTestReport')
    .addItem('週間レポート手動送信','sendWeeklyReport')
    .addItem('失敗処理の再実行','retryFailedJobs')
    .addItem('送信結果不明を照合（送信済み）','resolveUnknownReport')
    .addSeparator().addItem('自動実行を有効化','enableAutomation')
    .addItem('自動実行を停止','disableAutomation').addToUi();
}
function job_(name,fn) {
  return withLock_(function() {
    if (!settings_().AUTOMATION_ENABLED) return {status:'DISABLED'};
    try { return fn(deadline_()); }
    catch (e) { log_(name,'FAILED',0,0,0,sanitize_(e)); notify_(name,sanitize_(e)); throw e; }
  });
}
function runDailyJob() { return job_('DAILY',function(deadline) { fetchFeeds_(deadline,false); return evaluatePending_(deadline,false); }); }
function resumePendingJob() { return job_('RESUME',function(deadline) { return evaluatePending_(deadline,false); }); }
function runFinalizeJob() {
  return job_('REPORT_BUILD',function(deadline) {
    // Refresh on Sunday evening. Freeze even when a large evaluation backlog remains.
    fetchFeeds_(Math.min(deadline,Date.now()+60000),false);
    evaluatePending_(Math.min(deadline,Date.now()+120000),false);
    return finalizeReport_(new Date());
  });
}
function runWeeklyJob() { return job_('WEEKLY',function() { return sendReport_(new Date()); }); }
function retryFailedJobs() {
  return withLock_(function() {
    var deadline = deadline_(); settings_();
    rows_('ARTICLES').filter(function(a) { return a.ai_status==='FAILED' && Number(a.ai_attempts)<3; }).forEach(function(a) { update_('ARTICLES',a,{ai_status:'PENDING'}); });
    rows_('REPORTS').forEach(function(r) {
      if (r.status==='SENDING') update_('REPORTS',r,{status:'UNKNOWN',error:'Interrupted send; manual reconciliation required'});
      if (r.status==='SENT') markDelivered_(r);
    });
    fetchFeeds_(Math.min(deadline,Date.now()+60000),false);
    var result = evaluatePending_(deadline,false);
    var period = reportPeriod_(new Date()), report = rows_('REPORTS').filter(function(r) { return r.report_id===period.id; })[0];
    if (report && report.status==='FAILED' && new Date()>=date_(report.period_end)) sendReport_(new Date());
    // Do not create or send a missing/READY/UNKNOWN issue from a generic retry operation.
    return result;
  });
}
function onEdit(e) {
  if (!e || !e.range || e.range.getSheet().getName()!=='FEEDBACK' || e.range.getRow()<2) return;
  var r = e.range;
  if (r.getColumn()<=3) r.getSheet().getRange(r.getRow(),4,r.getNumRows(),1).setValues(Array.from({length:r.getNumRows()},function() { return [iso_()]; }));
}
