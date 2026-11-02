// Reading mode spends requests on summaries, never on ranking the entire backlog.
function prepareReadingMode_() {
  var props=PropertiesService.getScriptProperties();
  if (props.getProperty('READING_MODE_MIGRATED_V1')) return;
  var s=sheet_('ARTICLES'), headers=s.getRange(1,1,1,s.getLastColumn()).getValues()[0];
  var missing=columns_('ARTICLES').filter(function(k) { return headers.indexOf(k)<0; });
  if (missing.length) {
    ensureGrid_(s,2,headers.length+missing.length);
    s.getRange(1,headers.length+1,1,missing.length).setValues([missing]);
  }
  ['READING_MODE','DAILY_SUMMARY_LIMIT','READING_REPORT_COUNT'].forEach(function(k) {
    if (!rows_('SETTINGS').some(function(r) { return r.key===k; })) setSetting_(k,RADAR.defaults[k]);
  });
  // Recover only the obsolete formatting failure, once. Do not erase API failures or usage.
  rows_('ARTICLES').filter(function(a) {
    return a.ai_status==='FAILED' && a.ai_error==='Japanese summary must be 200–300 characters';
  }).forEach(function(a) { update_('ARTICLES',a,{ai_status:'SCORED',ai_attempts:0,ai_error:''}); });
  SpreadsheetApp.flush(); props.setProperty('READING_MODE_MIGRATED_V1','true');
  log_('READING_MODE','READY',0,0,0,'No scoring; existing API budgets preserved');
}
function readingPeriod_(period) {
  return {id:period.id,start:new Date(period.end.getTime()-14*86400000),end:period.end};
}
function readingDate_(a) { return date_(a.category==='RETRO'?a.fetched_at:a.published_at); }
function inReadingPeriod_(a,period) {
  var d=readingDate_(a); return d && d>=period.start && d<period.end;
}
function readingOrder_(articles,counts) {
  counts=Object.assign({},counts || {});
  var remaining=articles.slice().sort(function(a,b) {
    return readingDate_(b)-readingDate_(a) || String(a.article_id).localeCompare(String(b.article_id));
  }), result=[];
  while (remaining.length) {
    var best=0;
    for (var i=1;i<remaining.length;i++) {
      if ((counts[publisher_(remaining[i])] || 0)<(counts[publisher_(remaining[best])] || 0)) best=i;
    }
    var a=remaining.splice(best,1)[0], p=publisher_(a);
    result.push(a); counts[p]=(counts[p] || 0)+1;
  }
  return result;
}
function summarizeReadingQueue_(deadline,sourceIds,period) {
  prepareReadingMode_();
  var c=settings_(), articles=rows_('ARTICLES'), enabled=rows_('SOURCES').filter(function(s) { return bool_(s.enabled); }).map(function(s) { return s.source_id; });
  function scope(a) { return enabled.indexOf(a.source_id)>=0 && (!sourceIds || sourceIds.indexOf(a.source_id)>=0); }
  articles.filter(function(a) { return scope(a) && ['SCORING','SUMMARIZING','EVALUATING'].indexOf(a.ai_status)>=0; }).forEach(function(a) {
    update_('ARTICLES',a,{ai_status:Number(a.ai_attempts)>=3?'FAILED':'SCORED',ai_error:'Interrupted processing recovered'});
  });
  var today=articles.filter(function(a) { return a.ai_status==='DONE' && date_(a.updated_at) && day_(a.updated_at)===day_(); });
  var slots=Math.max(0,c.DAILY_SUMMARY_LIMIT-today.length), counts={};
  today.forEach(function(a) { var p=publisher_(a); counts[p]=(counts[p] || 0)+1; });
  if (!slots) return {evaluated:0,pending:false,deferred:true,stopped:'Daily summary limit reached'};
  var window=readingPeriod_(period), accepted=articles.filter(function(a) { return a.ai_status==='DONE'; });
  var pending=articles.filter(function(a) {
    return scope(a) && ['PENDING','SCORED'].indexOf(a.ai_status)>=0 && a.delivery_status!=='DELIVERED' && inReadingPeriod_(a,window);
  });
  var candidates=[];
  readingOrder_(pending,counts).forEach(function(a) {
    if (Number(a.ai_attempts)>=3) { update_('ARTICLES',a,{ai_status:'FAILED'}); return; }
    if (accepted.concat(candidates).some(function(b) { return sameNews_(a,b); })) { update_('ARTICLES',a,{ai_status:'DUPLICATE'}); return; }
    candidates.push(a);
  });
  var chosen=candidates.slice(0,slots);
  // SCORED remains the legacy resumable queue state; no numerical score is generated.
  chosen.forEach(function(a) { if (a.ai_status==='PENDING') update_('ARTICLES',a,{ai_status:'SCORED'}); });
  var ids=chosen.map(function(a) { return a.article_id; });
  var result=evaluatePending_(deadline,false,sourceIds,ids);
  log_('AI_SUMMARY','PROGRESS',result.evaluated || 0,0,0,result.stopped || 'No scoring requests');
  var after=rows_('ARTICLES');
  var completedToday=after.filter(function(a) { return a.ai_status==='DONE' && date_(a.updated_at) && day_(a.updated_at)===day_(); }).length;
  result.pending=completedToday<c.DAILY_SUMMARY_LIMIT && after.some(function(a) {
    return scope(a) && ['PENDING','SCORED','SUMMARIZING'].indexOf(a.ai_status)>=0 && Number(a.ai_attempts)<3 && inReadingPeriod_(a,window);
  });
  result.deferred=completedToday>=c.DAILY_SUMMARY_LIMIT;
  return result;
}
function chooseReadingArticles_(articles,reports,period,c) {
  var reserved=new Set();
  reports.forEach(function(r) { JSON.parse(r.article_ids || '[]').forEach(function(id) { reserved.add(id); }); });
  var previous=articles.filter(function(a) { return reserved.has(a.article_id) || a.delivery_status==='DELIVERED'; });
  var window=readingPeriod_(period);
  var candidates=articles.filter(function(a) {
    if (a.ai_status!=='DONE' || !String(a.summary_ja || '').trim() || reserved.has(a.article_id) || a.delivery_status==='DELIVERED' || !inReadingPeriod_(a,window)) return false;
    if (RADAR.reliability.indexOf(a.reliability)<0) return false;
    if (a.reliability==='VERIFIED' && !(bool_(a.source_verified) && a.evidence_url && a.evidence_checked_at)) return false;
    try { safeUrl_(a.url); } catch (_) { return false; }
    return !previous.some(function(b) { return sameNews_(a,b); });
  });
  var chosen=[];
  readingOrder_(candidates).forEach(function(a) {
    if (chosen.length<c.READING_REPORT_COUNT && !chosen.some(function(b) { return sameNews_(a,b); })) chosen.push(a);
  });
  return chosen;
}
function readingReliability_(a) {
  return a.reliability==='UNVERIFIED'?'裏付け未確認（元媒体の報告の要約）':a.reliability;
}
function readingNote_(a) {
  return (a.reliability==='UNVERIFIED'?'原文の主張を紹介しています。独立した裏付けは確認できていません。':'')+String(a.reliability_note || '');
}
function startReadingMode() {
  return withLock_(function() {
    adminEmail_(); setSetting_('READING_MODE',true); prepareReadingMode_();
    var result=summarizeReadingQueue_(deadline_(),null,currentEvaluationPeriod_());
    console.log(JSON.stringify(result)); return result;
  });
}
