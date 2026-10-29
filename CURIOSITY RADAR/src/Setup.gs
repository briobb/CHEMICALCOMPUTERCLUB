function initialSources_() {
  // Actual HTTP/XML checks: 2026-10-29. See docs/SOURCES.md for publisher pages and limitations.
  return [
    ['MIT_HISTORY','MIT News — History','https://news.mit.edu/rss/topic/history','RETRO',true,'XML confirmed; history must be classified by AI'],
    ['MIT','MIT News','https://news.mit.edu/rss/feed','COMPUTING',true,'XML confirmed'],
    ['NASA','NASA','https://www.nasa.gov/feed/','SPACE',true,'XML confirmed'],
    ['ESA','ESA','https://www.esa.int/rssfeed/Our_Activities/Space_News','SPACE',true,'XML confirmed'],
    ['SCIENCEDAILY','ScienceDaily','https://www.sciencedaily.com/rss/all.xml','NATURE',false,'Disabled: database storage restricted by publisher'],
    ['PHYS','Phys.org','https://phys.org/rss-feed/','NATURE',false,'Official endpoint; local HTTP 400; recheck availability/terms'],
    ['NEWATLAS','New Atlas','https://newatlas.com/index.rss','INVENTION',false,'XML confirmed; review storage/AI usage terms before enabling'],
    ['QUANTA','Quanta Magazine','https://www.quantamagazine.org/feed/','MYSTERY',false,'XML confirmed; storage/derivative-use terms require review'],
    ['SMITHSONIAN','Smithsonian Magazine','','ARCHAEOLOGY',false,'RSS page confirmed; endpoint not verified; no guessed URL'],
    ['SCIENCENEWS','Science News','https://www.sciencenews.org/feed','NATURE',false,'XML confirmed; review storage/AI usage terms before enabling'],
    ['IEEE','IEEE Spectrum','https://spectrum.ieee.org/feeds/feed.rss','COMPUTING',false,'XML confirmed; review storage/AI usage terms before enabling']
  ].map(function(s) { return {source_id:s[0],source_name:s[1],feed_url:s[2],category:s[3],enabled:s[4],last_status:s[5],failure_count:0}; });
}
function setupSystem() {
  return withLock_(function() {
    var props = PropertiesService.getScriptProperties(), id = props.getProperty('SPREADSHEET_ID');
    var book = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
    if (!book) book = SpreadsheetApp.create('CCC CURIOSITY RADAR');
    props.setProperty('SPREADSHEET_ID',book.getId()); book.setSpreadsheetTimeZone(RADAR.timezone);
    Object.keys(RADAR.columns).forEach(function(name) {
      var s = book.getSheetByName(name) || book.insertSheet(name), expected = columns_(name);
      ensureGrid_(s,2,expected.length);
      if (s.getLastRow()===0) s.getRange(1,1,1,expected.length).setValues([expected]);
      else {
        var current = s.getRange(1,1,1,s.getLastColumn()).getValues()[0];
        var missing = expected.filter(function(k) { return current.indexOf(k)<0; });
        if (new Set(current).size!==current.length) throw new Error('Duplicate headers in '+name);
        if (missing.length) {
          ensureGrid_(s,2,current.length+missing.length);
          s.getRange(1,current.length+1,1,missing.length).setValues([missing]);
        }
      }
      s.setFrozenRows(1); s.getRange(1,1,1,s.getLastColumn()).setFontWeight('bold').setBackground('#f2eee3');
    });
    var keys = new Set(rows_('SETTINGS').map(function(r) { return r.key; }));
    append_('SETTINGS',Object.keys(RADAR.defaults).filter(function(k) { return !keys.has(k); }).map(function(k) { return {key:k,value:RADAR.defaults[k]}; }));
    var sources = new Set(rows_('SOURCES').map(function(r) { return r.source_id; }));
    append_('SOURCES',initialSources_().filter(function(s) { return !sources.has(s.source_id); }));
    var feedback = sheet_('FEEDBACK');
    feedback.getRange(2,2,Math.max(feedback.getMaxRows()-1,1),1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(['GOOD','NORMAL','BAD'],true).setAllowInvalid(false).build());
    var warnings = [];
    try { adminEmail_(); } catch (e) { warnings.push(sanitize_(e)); }
    if (!props.getProperty('OPENAI_API_KEY')) warnings.push('OPENAI_API_KEY missing');
    var c = settings_();
    if (c.AUTOMATION_ENABLED && !warnings.length) syncTriggers_(c);
    log_('SETUP',warnings.length?'NEEDS_CONFIG':'OK',0,0,0,warnings.join('; '));
    console.log(JSON.stringify({spreadsheet:book.getUrl(),warnings:warnings,automation:c.AUTOMATION_ENABLED}));
    return {spreadsheet:book.getUrl(),warnings:warnings,automation:c.AUTOMATION_ENABLED};
  });
}
function setSetting_(key,value) {
  var row = rows_('SETTINGS').filter(function(r) { return r.key===key; })[0];
  if (row) update_('SETTINGS',row,{value:value}); else append_('SETTINGS',[{key:key,value:value}]);
}
function syncTriggers_(c) {
  var props = PropertiesService.getScriptProperties(), owner = adminEmail_();
  var prior = props.getProperty('TRIGGER_OWNER');
  if (prior && prior!==owner) throw new Error('Triggers belong to a different administrator');
  var specs = [
    {handler:'runDailyJob',signature:'daily-6',build:function(b) { return b.everyDays(1).atHour(6); }},
    {handler:'resumePendingJob',signature:'hourly',build:function(b) { return b.everyHours(1); }},
    {handler:'runFinalizeJob',signature:'sunday-'+c.FINALIZE_HOUR,build:function(b) { return b.onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(c.FINALIZE_HOUR); }},
    {handler:'runWeeklyJob',signature:'monday-'+c.REPORT_HOUR,build:function(b) { return b.onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(c.REPORT_HOUR); }}
  ];
  var existing = ScriptApp.getProjectTriggers();
  specs.forEach(function(s) {
    var matching = existing.filter(function(t) { return t.getHandlerFunction()===s.handler; });
    var key = 'TRIGGER_'+s.handler, stored = props.getProperty(key), wanted = s.signature+'|'+RADAR.timezone;
    var keep = matching.filter(function(t) { return stored===wanted+'|'+t.getUniqueId(); })[0];
    matching.forEach(function(t) { if (!keep || t.getUniqueId()!==keep.getUniqueId()) ScriptApp.deleteTrigger(t); });
    if (!keep) {
      var t = s.build(ScriptApp.newTrigger(s.handler).timeBased().inTimezone(RADAR.timezone)).create();
      props.setProperty(key,wanted+'|'+t.getUniqueId());
    }
  });
  props.setProperty('TRIGGER_OWNER',owner);
}
function enableAutomation() {
  return withLock_(function() {
    var c = settings_(); adminEmail_();
    if (!PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY')) throw new Error('OPENAI_API_KEY missing');
    syncTriggers_(c); setSetting_('AUTOMATION_ENABLED',true);
    log_('AUTOMATION','ENABLED',0,0,0,'');
  });
}
function disableAutomation() {
  return withLock_(function() {
    setSetting_('AUTOMATION_ENABLED',false);
    ScriptApp.getProjectTriggers().filter(function(t) { return ['runDailyJob','resumePendingJob','runFinalizeJob','runWeeklyJob'].indexOf(t.getHandlerFunction())>=0; }).forEach(function(t) { ScriptApp.deleteTrigger(t); });
    log_('AUTOMATION','DISABLED',0,0,0,'');
  });
}
