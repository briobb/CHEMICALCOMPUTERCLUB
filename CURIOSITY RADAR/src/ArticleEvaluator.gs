function validateEvaluation_(v,evidence,article) {
  var schema = evaluationSchema_();
  if (!v || typeof v!=='object' || Array.isArray(v) || Object.keys(v).length!==schema.required.length) throw new Error('Evaluation fields mismatch');
  schema.required.forEach(function(k) {
    if (!(k in v)) throw new Error('Missing evaluation field: '+k);
    var type = schema.properties[k].type;
    if (type==='string' && (typeof v[k]!=='string' || !v[k].trim() || v[k].length>1000)) throw new Error('Invalid text: '+k);
    if (type==='boolean' && typeof v[k]!=='boolean') throw new Error('Invalid boolean: '+k);
  });
  var limits = {curiosity_score:35,brand_score:25,talkability_score:20,story_score:10,uniqueness_score:10}, sum = 0;
  Object.keys(limits).forEach(function(k) { if (!Number.isInteger(v[k]) || v[k]<0 || v[k]>limits[k]) throw new Error('Score out of range: '+k); sum += v[k]; });
  if (!Number.isInteger(v.total_score) || v.total_score!==sum) throw new Error('Score sum mismatch');
  if (RADAR.categories.indexOf(v.category)<0 || RADAR.reliability.indexOf(v.reliability)<0) throw new Error('Unknown category/reliability');
  var length = Array.from(v.summary_ja).length;
  if (length<200 || length>300) throw new Error('Japanese summary must be 200–300 characters');
  if (!/[\u3040-\u30ff\u4e00-\u9fff]/.test(v.summary_ja)) throw new Error('Japanese summary required');
  if (!Array.isArray(v.keywords) || v.keywords.length<1 || v.keywords.length>8 || v.keywords.some(function(k) { return typeof k!=='string' || k.length>60; })) throw new Error('Invalid keywords');
  if (v.title_ja.length>120 || v.interesting_point.length>300 || !/^[A-Za-z0-9 &:'-]{3,60}$/.test(v.section_title)) throw new Error('Editorial fields too long or invalid');
  var hasPrimary = evidence && evidence.kind==='PRIMARY_PAGE_EXCERPT' && evidence.excerpt.length>=200;
  if (v.source_verified && !hasPrimary) throw new Error('Unsubstantiated source verification');
  if (v.reliability==='VERIFIED' && (!hasPrimary || !v.source_verified)) throw new Error('VERIFIED requires corroborated primary evidence');
  if (article.category==='RETRO' && v.category!=='RETRO' && (!date_(article.published_at) || Date.now()-date_(article.published_at).getTime()>14*86400000)) {
    throw new Error('Old nonhistorical article cannot use RETRO eligibility');
  }
  return v;
}
function evaluatePendingArticles() { return withLock_(function() { return evaluatePipeline_(deadline_(),null,currentEvaluationPeriod_()); }); }
function testArticleEvaluation() { return withLock_(function() { return evaluatePending_(deadline_(),true); }); }
function evaluatePending_(deadline,test,sourceIds,articleIds) {
  var c = settings_(), sources = rows_('SOURCES'), articles = rows_('ARTICLES'), done = 0;
  // Lock acquisition proves an old EVALUATING execution has ended. Preserve its spent attempt.
  if (!test) articles.filter(function(a) { return ['EVALUATING','SUMMARIZING'].indexOf(a.ai_status)>=0 && (!sourceIds || sourceIds.indexOf(a.source_id)>=0); }).forEach(function(a) {
    update_('ARTICLES',a,{ai_status:Number(a.ai_attempts)>=3?'FAILED':a.ai_status==='SUMMARIZING'?'SCORED':'PENDING',ai_error:'Previous execution interrupted'});
  });
  var candidates = articles.filter(function(a) { return (!sourceIds || sourceIds.indexOf(a.source_id)>=0) && (articleIds ? articleIds.indexOf(a.article_id)>=0 && a.ai_status==='SCORED' : a.ai_status==='PENDING') && Number(a.ai_attempts || 0)<3; });
  candidates.sort(function(a,b) { return primaryRank_(b)-primaryRank_(a) || String(b.published_at).localeCompare(String(a.published_at)); });
  var accepted = articles.filter(function(a) { return a.ai_status==='DONE'; });
  for (var i=0;i<candidates.length && timeLeft_(deadline,60000);i++) {
    var a = candidates[i];
    if (a.category!=='RETRO' && (!date_(a.published_at) || Date.now()-date_(a.published_at).getTime()>14*86400000)) {
      if (!test) update_('ARTICLES',a,{ai_status:'EXPIRED'}); continue;
    }
    if (accepted.some(function(b) { return sameNews_(a,b); })) { if (!test) update_('ARTICLES',a,{ai_status:'DUPLICATE'}); continue; }
    var evidence = evidence_(a,c), source = sources.filter(function(s) { return s.source_id===a.source_id; })[0];
    var attempts = test ? 0 : Number(a.ai_attempts || 0);
    while (attempts<3 && timeLeft_(deadline,45000)) {
      try {
        var result = requestEvaluation_(a,source,evidence,c,deadline,function() {
          attempts++;
          if (!test) { update_('ARTICLES',a,{ai_status:articleIds?'SUMMARIZING':'EVALUATING',ai_attempts:attempts}); SpreadsheetApp.flush(); }
        });
        validateEvaluation_(result,evidence,a);
        if (test) { log_('AI_TEST','OK',1,0,0,'No article/history updated'); console.log(JSON.stringify(result)); return result; }
        update_('ARTICLES',a,Object.assign({},result,{keywords:JSON.stringify(result.keywords),ai_status:'DONE',ai_error:'',
          evidence_url:evidence.url,evidence_excerpt:evidence.excerpt.slice(0,800),evidence_checked_at:evidence.checked_at}));
        accepted.push(a); done++; break;
      } catch (e) {
        if (!test) update_('ARTICLES',a,{ai_status:attempts>=3?'FAILED':articleIds?'SCORED':'PENDING',ai_error:sanitize_(e)});
        log_(test?'AI_TEST':'AI_EVALUATE','FAILED',0,0,0,a.article_id+': '+sanitize_(e));
        if (e.stop) return {evaluated:done,stopped:sanitize_(e)};
        if (!e.retryable) { if (!test) update_('ARTICLES',a,{ai_status:'FAILED'}); break; }
        var delay = Math.max(e.waitMs || 0,Math.pow(2,attempts)*1000);
        if (!timeLeft_(deadline,delay+45000)) break;
        Utilities.sleep(delay);
      }
    }
    if (test) return {status:'FAILED',message:'See LOGS; article/history unchanged'};
  }
  return {evaluated:done};
}
