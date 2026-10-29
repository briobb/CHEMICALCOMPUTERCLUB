function sendWeeklyReport() { return withLock_(function() { return sendReport_(new Date()); }); }
function sendReport_(now) {
  settings_(); var recipient = adminEmail_(), p = reportPeriod_(now);
  var reports = rows_('REPORTS'), report = reports.filter(function(r) { return r.report_id===p.id; })[0];
  if (!report) { notify_('REPORT_MISSING','確定済み週間レポートがありません。プレビュー後にselectWeeklyArticlesを実行してください。'); throw new Error('No frozen report; Monday never regenerates automatically'); }
  if (now < new Date(report.period_end)) throw new Error('Report cannot be sent before its Monday');
  if (report.status==='SENDING') {
    update_('REPORTS',report,{status:'UNKNOWN',error:'Previous send interrupted; inspect Gmail Sent manually'});
    notify_('MAIL_UNKNOWN','送信結果が不明です。Gmail送信済みを確認してください。自動再送しません。');
  }
  if (report.status==='SENT') { markDelivered_(report); return {status:'SENT',alreadySent:true}; }
  if (['READY','FAILED'].indexOf(report.status)<0) return {status:report.status};
  var rendered;
  try {
    if (report.recipient && report.recipient!==recipient) throw new Error('Recipient changed after an earlier attempt');
    if (MailApp.getRemainingDailyQuota()<1) throw new Error('Gmail daily recipient quota exhausted');
    rendered = renderReport_(JSON.parse(report.snapshot_json));
    if (rendered.data.report_id!==report.report_id) throw new Error('Snapshot ID mismatch');
  } catch (e) {
    update_('REPORTS',report,{status:'FAILED',error:sanitize_(e)}); notify_('MAIL_PRECHECK',sanitize_(e)); throw e;
  }
  update_('REPORTS',report,{status:'SENDING',recipient:recipient,error:''});
  SpreadsheetApp.flush();
  try {
    GmailApp.sendEmail(recipient,rendered.subject,rendered.text,{htmlBody:rendered.html,name:'CCC CURIOSITY RADAR'});
  } catch (e) {
    update_('REPORTS',report,{status:'UNKNOWN',error:'Gmail call failed; delivery may have occurred. '+sanitize_(e)});
    notify_('MAIL_UNKNOWN','Gmail送信結果が不明です。REPORTSと送信済みメールを確認してください。自動再送しません。');
    return {status:'UNKNOWN'};
  }
  // If this write fails, durable SENDING prevents another Gmail call next time.
  update_('REPORTS',report,{status:'SENT',sent_at:iso_(now),error:''}); SpreadsheetApp.flush();
  markDelivered_(report);
  log_('MAIL','SENT',rendered.data.articles.length,0,0,report.report_id);
  return {status:'SENT',report_id:report.report_id};
}
function markDelivered_(report) {
  var ids = new Set(JSON.parse(report.article_ids));
  rows_('ARTICLES').filter(function(a) { return ids.has(a.article_id) && a.delivery_status!=='DELIVERED'; }).forEach(function(a) {
    update_('ARTICLES',a,{delivery_status:'DELIVERED',delivered_at:report.sent_at});
  });
}
function sendTestReport() {
  return withLock_(function() {
    settings_(); var recipient = adminEmail_();
    if (MailApp.getRemainingDailyQuota()<1) throw new Error('Gmail daily quota exhausted');
    var r = renderReport_(previewData_());
    GmailApp.sendEmail(recipient,'[TEST] '+r.subject,r.text,{htmlBody:r.html,name:'CCC CURIOSITY RADAR'});
    log_('TEST_MAIL','SENT',r.data.articles.length,0,0,'Production history unchanged');
    return {status:'TEST_SENT'};
  });
}
function resolveUnknownReport() {
  var ui = SpreadsheetApp.getUi();
  var id = ui.prompt('送信結果の照合','Gmail送信済みで確認したレポートID（CCC-YYYY-MM-DD）',ui.ButtonSet.OK_CANCEL);
  if (id.getSelectedButton()!==ui.Button.OK) return;
  var answer = ui.alert('Gmail送信済みで確認','このレポートが管理者に送信済みであることを確認しましたか？「いいえ」は何も変更しません。',ui.ButtonSet.YES_NO);
  if (answer!==ui.Button.YES) return;
  return withLock_(function() {
    adminEmail_(); var r = rows_('REPORTS').filter(function(x) { return x.report_id===id.getResponseText().trim(); })[0];
    if (!r || ['UNKNOWN','SENDING'].indexOf(r.status)<0) throw new Error('No ambiguous report with this ID');
    update_('REPORTS',r,{status:'SENT',sent_at:iso_(),error:'Manually reconciled with Gmail Sent'}); markDelivered_(r);
    log_('MAIL_RECONCILE','SENT',0,0,0,r.report_id);
  });
}
