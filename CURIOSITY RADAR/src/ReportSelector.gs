function publisher_(a) { return a.source_id.replace(/_(HISTORY|RETRO|NEURO|RESEARCH)$/,''); }
function chooseArticles_(articles,reports,period,c) {
  var reserved = new Set();
  reports.forEach(function(r) {
    // Even FAILED/UNKNOWN frozen reports reserve their articles to prevent overlapping issues.
    JSON.parse(r.article_ids || '[]').forEach(function(id) { reserved.add(id); });
  });
  var previous = articles.filter(function(a) { return reserved.has(a.article_id) || a.delivery_status==='DELIVERED'; });
  var candidates = articles.filter(function(a) {
    var d = date_(a.category==='RETRO' ? a.fetched_at : a.published_at);
    return a.ai_status==='DONE' && a.delivery_status!=='DELIVERED' && !reserved.has(a.article_id) &&
      d && d>=period.start && d<period.end && Number(a.total_score)>=c.MIN_SCORE &&
      RADAR.reliability.indexOf(a.reliability)>=0 && a.reliability!=='UNVERIFIED' &&
      (a.reliability!=='VERIFIED' || (bool_(a.source_verified) && a.evidence_url && a.evidence_checked_at)) &&
      !previous.some(function(b) { return sameNews_(a,b); });
  });
  candidates.sort(function(a,b) { return Number(b.total_score)-Number(a.total_score) || primaryRank_(b)-primaryRank_(a) || String(a.article_id).localeCompare(String(b.article_id)); });
  // Within confidently matched stories prefer the primary publisher, even at a slightly lower score.
  candidates = candidates.filter(function(a) { return !candidates.some(function(b) { return primaryRank_(b)>primaryRank_(a) && sameNews_(a,b); }); });
  var chosen = [], sources = {}, categories = {}, uncertain = 0;
  function add(a) {
    var publisher = publisher_(a), caution = ['SPECULATIVE','DISPUTED'].indexOf(a.reliability)>=0;
    if (chosen.length>=c.REPORT_COUNT || (sources[publisher] || 0)>=c.SOURCE_MAX ||
        (categories[a.category] || 0)>=c.CATEGORY_MAX || (caution && uncertain>=2) ||
        chosen.some(function(b) { return sameNews_(a,b); })) return false;
    chosen.push(a); sources[publisher]=(sources[publisher] || 0)+1; categories[a.category]=(categories[a.category] || 0)+1;
    if (caution) uncertain++; return true;
  }
  candidates.filter(function(a) { return a.category==='RETRO'; }).some(function(a) { if ((categories.RETRO || 0)>=c.RETRO_TARGET) return true; add(a); return false; });
  candidates.filter(function(a) { return a.category!=='RETRO'; }).forEach(function(a) {
    if (chosen.filter(function(b) { return b.category!=='RETRO'; }).length<c.REPORT_COUNT-c.RETRO_TARGET) add(a);
  });
  return chosen.sort(function(a,b) { return (a.category==='RETRO')-(b.category==='RETRO') || Number(b.total_score)-Number(a.total_score); });
}
function selectWeeklyArticles() { return withLock_(function() { return finalizeReport_(new Date()); }); }
function finalizeReport_(now) {
  var c = settings_(), period = reportPeriod_(now), reports = rows_('REPORTS');
  var existing = reports.filter(function(r) { return r.report_id===period.id; })[0];
  if (existing) return existing;
  var articles = chooseArticles_(rows_('ARTICLES'),reports,period,c);
  var issue = reports.reduce(function(n,r) { return Math.max(n,Number(r.issue_number)||0); },0)+1;
  var data = reportData_(articles,period,issue,c);
  var snapshot = JSON.stringify(data);
  if (snapshot.length>45000) throw new Error('Report snapshot exceeds sheet cell limit');
  var report = append_('REPORTS',[{report_id:period.id,issue_number:issue,period_start:iso_(period.start),
    period_end:iso_(period.end),article_ids:JSON.stringify(articles.map(function(a) { return a.article_id; })),
    status:'READY',created_at:iso_(now),snapshot_json:snapshot}])[0];
  SpreadsheetApp.flush(); log_('REPORT','READY',articles.length,0,0,period.id);
  return report;
}
