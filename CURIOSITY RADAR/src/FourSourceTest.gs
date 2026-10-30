// One explicitly requested test run. Production scheduling and delivery history stay unchanged.
var FOUR_SOURCE_TEST_KEY = 'CCC_FOUR_SOURCE_TEST_20261030';
function fourSourceTestState_(all) {
  return JSON.parse(PropertiesService.getScriptProperties().getProperty(sourceTestKey_(all)) || 'null');
}
function saveFourSourceTest_(state,all) {
  PropertiesService.getScriptProperties().setProperty(sourceTestKey_(all),JSON.stringify(state));
}
function stopFourSourceTest_(all) {
  ScriptApp.getProjectTriggers().filter(function(t) { return t.getHandlerFunction()===sourceTestHandler_(all); })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); });
}
function fourSourceTestSources_(all) {
  var expected = ['ESA','MIT','MIT_HISTORY','NASA'];
  var enabled = rows_('SOURCES').filter(function(s) { return bool_(s.enabled); });
  if (all) {
    if (!enabled.length) throw new Error('No sources enabled');
    return enabled.map(function(s) { return s.source_id; }).sort();
  }
  if (enabled.map(function(s) { return s.source_id; }).sort().join(',')!==expected.join(',')) {
    throw new Error('This test requires exactly ESA, MIT, MIT_HISTORY and NASA enabled');
  }
  return expected;
}
function sourceTestKey_(all) { return all ? 'CCC_ALL_SOURCES_TEST_20261030' : FOUR_SOURCE_TEST_KEY; }
function sourceTestHandler_(all) { return all ? 'continueAllSourcesTest' : 'continueFourSourceTest'; }
function startFourSourceTest() { return startSourceTest_(false); }
function startSourceTest_(all) {
  var result = withLock_(function() {
    settings_(); adminEmail_(); var ids = fourSourceTestSources_(all);
    var other = fourSourceTestState_(!all);
    if (other && ['FETCH','EVALUATE','SENDING','UNKNOWN'].indexOf(other.status)>=0) throw new Error('Another test is active or has an unknown mail result');
    var state = fourSourceTestState_(all);
    if (state) return state; // Repeated clicks never launch another mail.
    state = {status:'FETCH',started_at:iso_(),runs:0,source_ids:ids,fetch_results:[]};
    saveFourSourceTest_(state,all);
    try { ScriptApp.newTrigger(sourceTestHandler_(all)).timeBased().everyMinutes(5).create(); }
    catch (e) { PropertiesService.getScriptProperties().deleteProperty(sourceTestKey_(all)); throw e; }
    return state;
  });
  if (result.status==='FETCH') return continueSourceTest_(all);
  console.log(JSON.stringify(result)); return result;
}
function continueFourSourceTest() { return continueSourceTest_(false); }
function continueSourceTest_(all) {
  return withLock_(function() {
    var state = fourSourceTestState_(all);
    if (!state) { stopFourSourceTest_(all); return {status:'NOT_STARTED'}; }
    if (state.status==='SENDING') {
      state.status='UNKNOWN'; state.error='Interrupted send. Check Gmail Sent; do not automatically retry.';
      saveFourSourceTest_(state,all);
    }
    if (['FETCH','EVALUATE'].indexOf(state.status)<0) {
      stopFourSourceTest_(all); console.log(JSON.stringify(state)); return state;
    }
    try {
      var c = settings_(), recipient = adminEmail_(), ids = fourSourceTestSources_(all);
      if (all && ids.join(',')!==state.source_ids.join(',')) throw new Error('Enabled sources changed during test');
      if (++state.runs>12 || Date.now()-new Date(state.started_at).getTime()>86400000) throw new Error('Test run time limit reached');
      saveFourSourceTest_(state,all);
      if (state.status==='FETCH') {
        var remaining = all ? ids.filter(function(id) { return !state.fetch_results.some(function(r) { return r.source===id; }); }) : undefined;
        var fetched = fetchFeeds_(deadline_(),false,remaining);
        if (all) {
          state.fetch_results=state.fetch_results.concat(fetched);
          saveFourSourceTest_(state,all);
          if (state.fetch_results.length<ids.length) return state;
          if (!state.fetch_results.some(function(r) { return !r.error; })) throw new Error('All feeds failed; see LOGS');
        }
        if (!all && (fetched.length!==4 || fetched.some(function(r) { return r.error; }))) throw new Error('Not all four feeds succeeded: '+JSON.stringify(fetched));
        state.status='EVALUATE'; saveFourSourceTest_(state,all);
        console.log(JSON.stringify(state)); return state;
      }
      if (all) ids=state.fetch_results.filter(function(r) { return !r.error; }).map(function(r) { return r.source; });
      var foreignPending = rows_('ARTICLES').some(function(a) {
        return ids.indexOf(a.source_id)<0 && ['PENDING','EVALUATING'].indexOf(a.ai_status)>=0;
      });
      if (!all && foreignPending) throw new Error('Pending articles from other sources exist; test stopped before evaluation');
      var result = evaluatePending_(deadline_(),false,all ? ids : undefined);
      if (result.stopped && !all) throw new Error(result.stopped);
      var articles = rows_('ARTICLES').filter(function(a) { return ids.indexOf(a.source_id)>=0; });
      if (!result.stopped && articles.some(function(a) { return ['PENDING','EVALUATING'].indexOf(a.ai_status)>=0; })) return state;
      // Use recent news through now, rather than the last completed production week.
      var now = new Date(), period = {start:new Date(now.getTime()-14*86400000),end:now,id:(all?'TEST-ALL-':'TEST-FOUR-')+day_(now)};
      var chosen = chooseArticles_(articles,rows_('REPORTS'),period,c);
      if (!chosen.length) throw new Error('No articles met the production selection criteria; no empty email sent');
      var rendered = renderReport_(reportData_(chosen,period,0,c));
      var note = (all ? state.source_ids.length+'情報源' : '4情報源')+'の実データによるテストです。直近14日間を対象に、本番と同じ採点・要約・掲載基準を使用しています。';
      if (all) {
        var errors=state.fetch_results.filter(function(r) { return r.error; });
        note += ' RSS取得成功 '+ids.length+'媒体、失敗 '+errors.length+'媒体。';
        errors.forEach(function(r) { note += ' '+r.source+': '+r.error; });
        if (result.stopped) note += ' 評価処理は途中で停止しました（'+result.stopped+'）。評価済み記事のみ掲載しています。';
      }
      var failed = articles.filter(function(a) { return a.ai_status==='FAILED'; }).length;
      if (failed) note += ' 評価に失敗した記事 '+failed+'件は掲載していません。';
      if (MailApp.getRemainingDailyQuota()<1) throw new Error('Gmail daily quota exhausted');
      state.status='SENDING'; state.recipient=recipient; state.article_count=chosen.length;
      state.subject=(all?'[TEST ALL SOURCES]':'[TEST 4 SOURCES]')+' CCC CURIOSITY REPORT | '+day_(now);
      saveFourSourceTest_(state,all);
      GmailApp.sendEmail(recipient,state.subject,note+'\n\n'+rendered.text,
        {htmlBody:'<p>'+html_(note)+'</p>'+rendered.html,name:'CCC CURIOSITY RADAR'});
      state.status='SENT'; state.sent_at=iso_(); saveFourSourceTest_(state,all);
      stopFourSourceTest_(all);
      log_(all?'ALL_SOURCES_TEST':'FOUR_SOURCE_TEST','SENT',chosen.length,0,0,'Production history unchanged');
    } catch (e) {
      state.status=state.status==='SENDING'?'UNKNOWN':state.status==='SENT'?'SENT':'FAILED'; state.error=sanitize_(e);
      saveFourSourceTest_(state,all); stopFourSourceTest_(all);
      log_(all?'ALL_SOURCES_TEST':'FOUR_SOURCE_TEST',state.status,0,0,0,state.error);
    }
    console.log(JSON.stringify(state)); return state;
  });
}
function getFourSourceTestStatus() {
  var state = fourSourceTestState_(false) || {status:'NOT_STARTED'};
  console.log(JSON.stringify(state)); return state;
}
