// Set the weekly digest to approximately 07:00 JST without sending a report now.
function setMondayMorningDelivery() {
  return withLock_(function() {
    var c=settings_(), owner=adminEmail_(), props=PropertiesService.getScriptProperties();
    var prior=props.getProperty('TRIGGER_OWNER');
    if (prior && prior!==owner) throw new Error('Triggers belong to a different administrator');
    var old=ScriptApp.getProjectTriggers().filter(function(t) { return t.getHandlerFunction()==='runWeeklyJob'; });
    var trigger=ScriptApp.newTrigger('runWeeklyJob').timeBased().inTimezone('Asia/Tokyo')
      .onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).nearMinute(0).create();
    old.forEach(function(t) { ScriptApp.deleteTrigger(t); });
    setSetting_('REPORT_HOUR',7);
    props.setProperty('TRIGGER_runWeeklyJob','monday-7|Asia/Tokyo|'+trigger.getUniqueId());
    props.setProperty('TRIGGER_OWNER',owner);
    var result={day:'MONDAY',hour:7,minute:0,timezone:'Asia/Tokyo',automation_enabled:c.AUTOMATION_ENABLED,
      weekly_triggers:ScriptApp.getProjectTriggers().filter(function(t) { return t.getHandlerFunction()==='runWeeklyJob'; }).length};
    log_('DELIVERY_SCHEDULE','UPDATED',0,0,0,JSON.stringify(result));
    console.log(JSON.stringify(result));
    return result;
  });
}
