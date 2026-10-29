// One explicitly requested test run. Production scheduling and delivery history stay unchanged.
var FOUR_SOURCE_TEST_KEY = 'CCC_FOUR_SOURCE_TEST_20261030';
function fourSourceTestState_() {
  return JSON.parse(PropertiesService.getScriptProperties().getProperty(FOUR_SOURCE_TEST_KEY) || 'null');
}
function saveFourSourceTest_(state) {
  PropertiesService.getScriptProperties().setProperty(FOUR_SOURCE_TEST_KEY,JSON.stringify(state));
}
function stopFourSourceTest_() {
  ScriptApp.getProjectTriggers().filter(function(t) { return t.getHandlerFunction()==='continueFourSourceTest'; })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); });
}
function fourSourceTestSources_() {
  var expected = ['ESA','MIT','MIT_HISTORY','NASA'];
  var enabled = rows_('SOURCES').filter(function(s) { return bool_(s.enabled); });
  if (enabled.map(function(s) { return s.source_id; }).sort().join(',')!==expected.join(',')) {
    throw new Error('This test requires exactly ESA, MIT, MIT_HISTORY and NASA enabled');
  }
  return expected;
}
function startFourSourceTest() {
  var result = withLock_(function() {
    settings_(); adminEmail_(); fourSourceTestSources_();
    var state = fourSourceTestState_();
    if (state) return state; // Repeated clicks never launch another mail.
    state = {status:'FETCH',started_at:iso_(),runs:0};
    saveFourSourceTest_(state);
    try { ScriptApp.newTrigger('continueFourSourceTest').timeBased().everyMinutes(5).create(); }
    catch (e) { PropertiesService.getScriptProperties().deleteProperty(FOUR_SOURCE_TEST_KEY); throw e; }
    return state;
  });
  if (result.status==='FETCH') return continueFourSourceTest();
  console.log(JSON.stringify(result)); return result;
}
function continueFourSourceTest() {
  return withLock_(function() {
    var state = fourSourceTestState_();
    if (!state) { stopFourSourceTest_(); return {status:'NOT_STARTED'}; }
    if (state.status==='SENDING') {
      state.status='UNKNOWN'; state.error='Interrupted send. Check Gmail Sent; do not automatically retry.';
      saveFourSourceTest_(state);
    }
    if (['FETCH','EVALUATE'].indexOf(state.status)<0) {
      stopFourSourceTest_(); console.log(JSON.stringify(state)); return state;
    }
    try {
      var c = settings_(), recipient = adminEmail_(), ids = fourSourceTestSources_();
      if (++state.runs>12 || Date.now()-new Date(state.started_at).getTime()>86400000) throw new Error('Test run time limit reached');
      saveFourSourceTest_(state);
      if (state.status==='FETCH') {
        var fetched = fetchFeeds_(deadline_(),false);
        if (fetched.length!==4 || fetched.some(function(r) { return r.error; })) throw new Error('Not all four feeds succeeded: '+JSON.stringify(fetched));
        state.status='EVALUATE'; saveFourSourceTest_(state);
        console.log(JSON.stringify(state)); return state;
      }
      var foreignPending = rows_('ARTICLES').some(function(a) {
        return ids.indexOf(a.source_id)<0 && ['PENDING','EVALUATING'].indexOf(a.ai_status)>=0;
      });
      if (foreignPending) throw new Error('Pending articles from other sources exist; test stopped before evaluation');
      var result = evaluatePending_(deadline_(),false);
      if (result.stopped) throw new Error(result.stopped);
      var articles = rows_('ARTICLES').filter(function(a) { return ids.indexOf(a.source_id)>=0; });
      if (articles.some(function(a) { return ['PENDING','EVALUATING'].indexOf(a.ai_status)>=0; })) return state;
      // Use recent news through now, rather than the last completed production week.
      var now = new Date(), period = {start:new Date(now.getTime()-14*86400000),end:now,id:'TEST-FOUR-'+day_(now)};
      var chosen = chooseArticles_(articles,rows_('REPORTS'),period,c);
      if (!chosen.length) throw new Error('No articles met the production selection criteria; no empty email sent');
      var rendered = renderReport_(reportData_(chosen,period,0,c));
      var note = '4情報源の実データによるテストです。直近14日間を対象に、本番と同じ採点・要約・掲載基準を使用しています。';
      var failed = articles.filter(function(a) { return a.ai_status==='FAILED'; }).length;
      if (failed) note += ' 評価に失敗した記事 '+failed+'件は掲載していません。';
      if (MailApp.getRemainingDailyQuota()<1) throw new Error('Gmail daily quota exhausted');
      state.status='SENDING'; state.recipient=recipient; state.article_count=chosen.length;
      state.subject='[TEST 4 SOURCES] CCC CURIOSITY REPORT | '+day_(now);
      saveFourSourceTest_(state);
      GmailApp.sendEmail(recipient,state.subject,note+'\n\n'+rendered.text,
        {htmlBody:'<p>'+html_(note)+'</p>'+rendered.html,name:'CCC CURIOSITY RADAR'});
      state.status='SENT'; state.sent_at=iso_(); saveFourSourceTest_(state);
      stopFourSourceTest_();
      log_('FOUR_SOURCE_TEST','SENT',chosen.length,0,0,'Production history unchanged');
    } catch (e) {
      state.status=state.status==='SENDING'?'UNKNOWN':'FAILED'; state.error=sanitize_(e);
      saveFourSourceTest_(state); stopFourSourceTest_();
      log_('FOUR_SOURCE_TEST',state.status,0,0,0,state.error);
    }
    console.log(JSON.stringify(state)); return state;
  });
}
function getFourSourceTestStatus() {
  var state = fourSourceTestState_() || {status:'NOT_STARTED'};
  console.log(JSON.stringify(state)); return state;
}
