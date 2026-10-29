function book_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Run setupSystem first: SPREADSHEET_ID missing');
  return SpreadsheetApp.openById(id);
}
function sheet_(name) {
  var s = book_().getSheetByName(name);
  if (!s) throw new Error('Missing sheet: ' + name);
  return s;
}
function columns_(name) { return RADAR.columns[name].split(' '); }
function rows_(name) {
  var s = sheet_(name), n = s.getLastRow();
  if (n < 2) return [];
  var headers = s.getRange(1,1,1,s.getLastColumn()).getValues()[0];
  return s.getRange(2,1,n-1,headers.length).getValues().map(function(values, i) {
    var r = {_row:i+2}; headers.forEach(function(k,j) { r[k] = values[j]; }); return r;
  }).filter(function(r) { return r[headers[0]] !== ''; });
}
function cell_(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'object' && !(v instanceof Date)) v = JSON.stringify(v);
  // External text must never become a Sheets formula.
  return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v;
}
function append_(name, objects) {
  if (!objects.length) return [];
  var s = sheet_(name), headers = s.getRange(1,1,1,s.getLastColumn()).getValues()[0], first = s.getLastRow()+1;
  s.getRange(first,1,objects.length,headers.length).setValues(objects.map(function(o) { return headers.map(function(k) { return cell_(o[k]); }); }));
  return objects.map(function(o,i) { o._row = first+i; return o; });
}
function update_(name, record, changes) {
  if (!record._row) throw new Error('Record row required');
  var s = sheet_(name), headers = s.getRange(1,1,1,s.getLastColumn()).getValues()[0];
  // Read the row again so a partial patch cannot erase unrelated data.
  var values = s.getRange(record._row,1,1,headers.length).getValues()[0];
  headers.forEach(function(k,i) { if (Object.prototype.hasOwnProperty.call(changes,k)) values[i] = cell_(changes[k]); });
  s.getRange(record._row,1,1,headers.length).setValues([values]);
  Object.assign(record,changes); return record;
}
