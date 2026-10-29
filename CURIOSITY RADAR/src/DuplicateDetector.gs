function normalizeUrl_(url) {
  var p = urlParts_(url), host = p.host.replace(p.scheme === 'https' ? /:443$/ : /:80$/, '');
  var query = p.query.split('&').filter(function(part) {
    if (!part) return false;
    var k; try { k = decodeURIComponent(part.split('=')[0]).toLowerCase(); } catch (_) { return true; }
    return !/^utm_/.test(k) && ['fbclid','gclid','dclid','msclkid','mc_cid','mc_eid'].indexOf(k) < 0;
  }).join('&');
  return p.scheme + '://' + host + p.path + (query ? '?' + query : '');
}
function words_(s) {
  return Array.from(new Set(String(s || '').toLowerCase().replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9fff]+/g,' ').split(/\s+/)
    .filter(function(w) { return w.length > 2 && ['the','and','for','with','from','that','this','new','study','research','scientists'].indexOf(w)<0; })));
}
function similarity_(a,b) {
  if (!a.length || !b.length) return 0;
  var common = a.filter(function(w) { return b.indexOf(w)>=0; }).length;
  return common / (a.length + b.length - common);
}
function sameNews_(a,b) {
  if (a.duplicate_key && a.duplicate_key === b.duplicate_key) return true;
  var titleA = words_(a.title_original), titleB = words_(b.title_original);
  var sumA = words_(a.summary_original), sumB = words_(b.summary_original);
  if (titleA.length < 5 || titleB.length < 5) return false;
  return similarity_(titleA,titleB) >= 0.85 && sumA.length >= 12 && sumB.length >= 12 && similarity_(sumA,sumB) >= 0.65;
}
function primaryRank_(a) { return /^(NASA|MIT|ESA)(_|$)/.test(a.source_id) ? 1 : 0; }
