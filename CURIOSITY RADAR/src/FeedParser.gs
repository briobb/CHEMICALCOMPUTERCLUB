function children_(el, name) { return el.getChildren().filter(function(c) { return c.getName() === name; }); }
function childText_(el, name) { var c = children_(el,name)[0]; return c ? c.getValue().trim() : ''; }
function parseFeed_(xml, source) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('DTD/entities are not supported');
  var root = XmlService.parse(xml).getRootElement(), type = root.getName(), items;
  if (type === 'rss') {
    var channel = children_(root,'channel')[0]; if (!channel) throw new Error('RSS channel missing');
    items = children_(channel,'item');
  } else if (type === 'feed') items = children_(root,'entry');
  else if (type === 'RDF') items = children_(root,'item');
  else throw new Error('Unsupported feed root');
  return items.map(function(item) {
    try {
      var link;
      if (type === 'feed') {
        var l = children_(item,'link').filter(function(x) { var r = x.getAttribute('rel'); return !r || r.getValue()==='alternate'; })[0];
        link = l && l.getAttribute('href') ? l.getAttribute('href').getValue() : '';
      } else link = childText_(item,'link');
      if (!link) return null;
      // Atom updated is deliberately never used as the publication date.
      var published = type === 'feed' ? childText_(item,'published') : childText_(item,'pubDate') || childText_(item,'date');
      var title = plain_(childText_(item,'title'),500);
      if (!title) return null;
      return {title_original:title, summary_original:plain_(childText_(item,'description') || childText_(item,'summary') || childText_(item,'content') || childText_(item,'encoded'),2000),
        url:resolveUrl_(link,source.feed_url), published_at:date_(published) ? iso_(published) : '',
        updated_at:date_(childText_(item,'updated')) ? iso_(childText_(item,'updated')) : '', category:source.category};
    } catch (_) { return null; }
  }).filter(Boolean);
}
