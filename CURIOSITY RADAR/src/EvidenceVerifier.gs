/** Only publisher-owned primary sources are fetched; no arbitrary model-generated URLs. */
function evidence_(article,c) {
  var empty = {url:'',excerpt:'',checked_at:'',kind:'RSS_ONLY'};
  if (!c.PRIMARY_EXCERPTS_ENABLED) return empty;
  var p = urlParts_(article.url), host = p.host;
  if (['www.nasa.gov','science.nasa.gov','news.mit.edu','www.esa.int'].indexOf(host)<0) return empty;
  try {
    // Do not follow redirects: never mistake a different destination for the trusted primary host.
    var r = UrlFetchApp.fetch(safeUrl_(article.url),{muteHttpExceptions:true,followRedirects:false});
    if (r.getResponseCode()!==200) return empty;
    var text = r.getContentText();
    if (text.length>2000000) return empty;
    var main = text.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) || text.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
    if (!main) return empty;
    var paragraphs = main[1].match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || [];
    var excerpt = paragraphs.map(function(x) { return plain_(x,1000); }).filter(function(x) { return x.length>60; }).join('\n').slice(0,4500);
    if (excerpt.length<200) return empty;
    return {url:article.url,excerpt:excerpt,checked_at:iso_(),kind:'PRIMARY_PAGE_EXCERPT'};
  } catch (_) { return empty; }
}
