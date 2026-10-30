function fetchAllFeeds() { return withLock_(function() { return fetchFeeds_(deadline_(),false); }); }
function testFeedFetch() { return withLock_(function() { return fetchFeeds_(deadline_(),true); }); }
function fetchFeeds_(deadline, dryRun, sourceIds) {
  var c = settings_(), sources = rows_('SOURCES').filter(function(s) { return bool_(s.enabled) && (!sourceIds || sourceIds.indexOf(s.source_id)>=0); });
  sources.sort(function(a,b) { return String(a.last_checked).localeCompare(String(b.last_checked)); });
  var seen = new Set(rows_('ARTICLES').map(function(a) { return a.duplicate_key; })), total = 0, results = [];
  sources.forEach(function(s) {
    if (!timeLeft_(deadline)) return;
    try {
      if (RADAR.categories.indexOf(s.category)<0) throw new Error('Invalid source category');
      var response = fetchPublic_(s.feed_url);
      if (response.getResponseCode()!==200) throw new Error('Feed HTTP ' + response.getResponseCode());
      var xml = response.getContentText();
      if (xml.length > 2000000) throw new Error('Feed exceeds 2MB');
      var articles = parseFeed_(xml,s).slice(0,c.MAX_FEED_ITEMS), fresh = [];
      articles.forEach(function(a) {
        var pub = date_(a.published_at);
        if (pub && pub.getTime() > Date.now() + 300000) return;
        if (a.category !== 'RETRO' && (!pub || Date.now()-pub.getTime()>14*86400000)) return;
        a.normalized_url = normalizeUrl_(a.url); a.duplicate_key = hash_(a.normalized_url);
        if (seen.has(a.duplicate_key)) return;
        seen.add(a.duplicate_key);
        Object.assign(a,{article_id:'A-'+a.duplicate_key.slice(0,24),source_id:s.source_id,fetched_at:iso_(),ai_status:'PENDING',delivery_status:'NEW',ai_attempts:0});
        fresh.push(a);
      });
      if (!dryRun) {
        append_('ARTICLES',fresh);
        update_('SOURCES',s,{last_checked:iso_(),last_status:'OK: '+fresh.length,failure_count:0});
      }
      total += fresh.length; results.push({source:s.source_id,parsed:articles.length,newArticles:fresh.length});
    } catch (e) {
      results.push({source:s.source_id,error:sanitize_(e)});
      if (!dryRun) {
        var failures = Number(s.failure_count || 0)+1;
        update_('SOURCES',s,{last_checked:iso_(),last_status:sanitize_(e),failure_count:failures});
        log_('RSS','FAILED',0,0,0,s.source_id+': '+sanitize_(e));
        if (failures>=3) notify_('RSS_'+s.source_id,'RSS取得が継続して失敗しています。SOURCESを確認してください。');
      }
    }
  });
  log_(dryRun?'RSS_TEST':'RSS','COMPLETE',total,0,0,JSON.stringify(results));
  return results;
}
