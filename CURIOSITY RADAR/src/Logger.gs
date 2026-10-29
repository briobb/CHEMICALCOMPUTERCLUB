function sanitize_(error) {
  var s = String(error && error.message ? error.message : error || '');
  var key = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (key) s = s.split(key).join('[REDACTED]');
  return s.replace(/Bearer\s+\S+/gi,'Bearer [REDACTED]').replace(/sk-[A-Za-z0-9_-]+/g,'[REDACTED]').slice(0,1800);
}
function log_(process,status,count,tokens,cost,error) {
  return append_('LOGS',[{timestamp:iso_(),process:process,status:status,processed_count:count || 0,
    token_usage:tokens || 0,estimated_cost:cost || 0,error:sanitize_(error)}])[0];
}
function notify_(code,message) {
  // Called under the script lock. Mark before sending to avoid notification storms on ambiguous failures.
  var p = PropertiesService.getScriptProperties(), key = 'NOTICE_' + code, today = day_();
  if (p.getProperty(key) === today) return;
  try {
    settings_(); var recipient = adminEmail_();
    if (MailApp.getRemainingDailyQuota()<1) return;
    p.setProperty(key,today);
    GmailApp.sendEmail(recipient,'CCC RADAR | '+code,sanitize_(message),{name:'CCC CURIOSITY RADAR'});
  } catch (e) { console.error('Notification failed: '+sanitize_(e)); }
}
function usage_() {
  var today = day_(), month = today.slice(0,7), cost = 0, calls = 0;
  rows_('LOGS').forEach(function(r) {
    if (r.process !== 'AI_REQUEST') return;
    var day = day_(r.timestamp);
    if (day.slice(0,7)===month) cost += Number(r.estimated_cost || 0);
    if (day===today) calls += Number(r.processed_count || 0);
  });
  return {cost:cost,calls:calls};
}
