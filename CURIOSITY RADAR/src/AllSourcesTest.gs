// Uses the SOURCES rows enabled by the administrator. Does not change their settings.
function startAllSourcesTest() { return startSourceTest_(true); }
function continueAllSourcesTest() { return continueSourceTest_(true); }
// Explicit recovery after the administrator has replaced the key / replenished credit.
function recoverAfterBillingFix() {
  var result=withLock_(function() {
    adminEmail_(); settings_();
    var state=fourSourceTestState_(true);
    if (!state || state.status!=='FAILED' || state.sent_at) throw new Error('Only a failed unsent test can be recovered');
    var ids=fourSourceTestSources_(true);
    if (ids.join(',')!==state.source_ids.join(',')) throw new Error('Enabled sources changed; inspect test status before recovery');
    var other=fourSourceTestState_(false);
    if (other && ['FETCH','EVALUATE','SENDING','UNKNOWN'].indexOf(other.status)>=0) throw new Error('Another test is active or delivery is unknown');
    var recovered=0;
    rows_('ARTICLES').filter(function(a) {
      return ids.indexOf(a.source_id)>=0 && a.ai_status==='FAILED' && /^OpenAI HTTP (401|429)(?:\s|$)/.test(String(a.ai_error));
    }).forEach(function(a) {
      update_('ARTICLES',a,{ai_status:'PENDING',ai_attempts:0,ai_error:''}); recovered++;
    });
    SpreadsheetApp.flush();
    PropertiesService.getScriptProperties().deleteProperty('AI_BILLING_BLOCK');
    log_('BILLING_RECOVERY','READY',recovered,0,0,'Only failed 401/429 articles reset; usage ledger retained');
    return {status:'READY',recovered:recovered};
  });
  console.log(JSON.stringify(result));
  if (result.status==='READY') {
    var resumed=resumeAllSourcesTest(); console.log(JSON.stringify(resumed)); return resumed;
  }
  return result;
}
function resumeAllSourcesTest() {
  var result = withLock_(function() {
    var c = settings_(); adminEmail_();
    var state = fourSourceTestState_(true);
    if (!state || state.status!=='FAILED' || state.sent_at) {
      throw new Error('Only a failed, unsent test can be resumed; inspect getAllSourcesTestStatus');
    }
    var other = fourSourceTestState_(false);
    if (other && ['FETCH','EVALUATE','SENDING','UNKNOWN'].indexOf(other.status)>=0) throw new Error('Another test is active or has an unknown mail result');
    var ids = fourSourceTestSources_(true);
    if (ids.join(',')!==state.source_ids.join(',')) throw new Error('Enabled sources changed; restore the original selection before resuming');
    var usage = usage_();
    if (usage.calls>=c.MAX_AI_ARTICLES_PER_DAY) return {status:'DAILY_LIMIT',message:'Run resumeAllSourcesTest after midnight JST; no work started'};
    if (usage.cost>=c.MAX_AI_COST_USD_PER_MONTH) return {status:'MONTHLY_LIMIT',message:'Monthly budget exhausted; no work started'};
    var fetched = state.fetch_results || [];
    if (fetched.length===ids.length && !fetched.some(function(r) { return !r.error; })) throw new Error('All feeds failed; resolve feed errors first');
    stopFourSourceTest_(true);
    var trigger = ScriptApp.newTrigger('continueAllSourcesTest').timeBased().everyMinutes(5).create();
    state.status=fetched.length===ids.length?'EVALUATE':'FETCH';
    state.resumed_at=iso_(); state.started_at=state.resumed_at; state.runs=0;
    state.previous_error=state.error; delete state.error; delete state.evaluation_stop;
    try { saveFourSourceTest_(state,true); }
    catch (e) { ScriptApp.deleteTrigger(trigger); throw e; }
    return state;
  });
  if (['FETCH','EVALUATE'].indexOf(result.status)>=0) return continueSourceTest_(true);
  console.log(JSON.stringify(result)); return result;
}
function getAllSourcesTestStatus() {
  var state = fourSourceTestState_(true) || {status:'NOT_STARTED'};
  try {
    var articles=rows_('ARTICLES').filter(function(a) { return !state.source_ids || state.source_ids.indexOf(a.source_id)>=0; });
    var counts={}, errors={};
    articles.forEach(function(a) {
      var status=String(a.ai_status || 'EMPTY'); counts[status]=(counts[status] || 0)+1;
      if (a.ai_error) { var error=sanitize_(a.ai_error).slice(0,240); errors[error]=(errors[error] || 0)+1; }
    });
    var recent=rows_('LOGS').filter(function(r) { return ['AI_SCORE','AI_EVALUATE','AI_REQUEST','RESUME','ALL_SOURCES_TEST'].indexOf(r.process)>=0; }).slice(-5);
    state.diagnostics={checked_at:iso_(),counts:counts,usage:usage_(),
      exhausted_scored:articles.filter(function(a) { return a.ai_status==='SCORED' && Number(a.ai_attempts)>=3; }).length,
      article_errors:Object.keys(errors).sort(function(a,b) { return errors[b]-errors[a]; }).slice(0,5).map(function(e) { return {error:e,count:errors[e]}; }),
      recent_logs:recent.map(function(r) { return {timestamp:r.timestamp,process:r.process,status:r.status,error:sanitize_(r.error).slice(0,240)}; })};
  } catch (e) { state.diagnostics_error=sanitize_(e); }
  console.log(JSON.stringify(state)); return state;
}
