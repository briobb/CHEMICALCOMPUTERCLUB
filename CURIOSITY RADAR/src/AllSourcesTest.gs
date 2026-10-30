// Uses the SOURCES rows enabled by the administrator. Does not change their settings.
function startAllSourcesTest() { return startSourceTest_(true); }
function continueAllSourcesTest() { return continueSourceTest_(true); }
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
  console.log(JSON.stringify(state)); return state;
}
