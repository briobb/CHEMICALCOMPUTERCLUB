function bool_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function iso_(v) { return new Date(v === undefined ? Date.now() : v).toISOString(); }
function date_(v) { var d = v ? new Date(v) : null; return d && isFinite(d.getTime()) ? d : null; }
function day_(v) { return Utilities.formatDate(new Date(v === undefined ? Date.now() : v), RADAR.timezone, 'yyyy-MM-dd'); }
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return {status: 'BUSY'};
  try { return fn(); } finally { lock.releaseLock(); }
}
function deadline_() { return Date.now() + RADAR.maxRunMs; }
function timeLeft_(deadline, margin) { return Date.now() + (margin || 30000) < deadline; }
function hash_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8)
    .map(function(b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function html_(s) { return String(s === undefined ? '' : s).replace(/[&<>"']/g, function(c) {
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
}); }
function plain_(s, limit) {
  return String(s || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, function(_, n) { var x = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1),16) : Number(n); return x > 0 && x <= 0x10ffff ? String.fromCodePoint(x) : ''; })
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, function(_, n) { return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[n]; })
    .replace(/\s+/g, ' ').trim().slice(0, limit || 2000);
}
// V8 Apps Script does not provide the browser URL API. Keep path and meaningful query bytes intact.
function urlParts_(url) {
  var m = String(url || '').trim().match(/^(https?):\/\/([^\/?#]+)([^?#]*)(\?[^#]*)?(?:#.*)?$/i);
  if (!m || /[@\s\\<>"']/.test(m[2]) || /[\r\n\\<>"']/.test(String(url))) throw new Error('Invalid HTTP URL');
  var host = m[2].toLowerCase();
  if (!/^[a-z0-9.-]+(?::\d+)?$/.test(host) || !/[a-z]/.test(host) || host.indexOf('.') < 0 ||
      /(?:^|\.)(localhost|local|internal)(?::|$)/.test(host)) throw new Error('Public HTTP hostname required');
  return {scheme:m[1].toLowerCase(), host:host, path:m[3] || '/', query:(m[4] || '').slice(1)};
}
function safeUrl_(url) { urlParts_(url); return String(url).trim(); }
function resolveUrl_(url, base) {
  if (/^https?:\/\//i.test(url)) return safeUrl_(url);
  var b = urlParts_(base), origin = b.scheme + '://' + b.host;
  if (/^\/\//.test(url)) return safeUrl_(b.scheme + ':' + url);
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) throw new Error('Unsupported link scheme');
  var path = url[0] === '/' ? url : b.path.replace(/[^/]*$/, '') + url;
  var bits = []; path.split('/').forEach(function(x) { if (x === '..') bits.pop(); else if (x !== '.') bits.push(x); });
  return safeUrl_(origin + bits.join('/'));
}
function fetchPublic_(url, options) {
  var current = safeUrl_(url), response;
  for (var i = 0; i < 4; i++) {
    response = UrlFetchApp.fetch(current, Object.assign({}, options || {}, {muteHttpExceptions:true, followRedirects:false}));
    var code = response.getResponseCode();
    if ([301,302,303,307,308].indexOf(code) < 0) return response;
    var h = response.getAllHeaders(), location = h.Location || h.location;
    if (!location) throw new Error('Redirect missing location');
    current = resolveUrl_(String(location), current);
  }
  throw new Error('Too many redirects');
}
// End is exclusive. Sunday uses the current week; Monday–Saturday use the last completed week.
function reportPeriod_(now) {
  var midnight = new Date(day_(now) + 'T00:00:00+09:00');
  var weekday = new Date(midnight.getTime() + 9 * 3600000).getUTCDay();
  var end = new Date(midnight.getTime() + (weekday === 0 ? 1 : 1 - weekday) * 86400000);
  return {start:new Date(end.getTime() - 7 * 86400000), end:end, id:'CCC-' + day_(end)};
}
