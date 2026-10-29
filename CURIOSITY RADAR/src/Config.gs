/** CCC CURIOSITY RADAR 4.1. Secrets live only in Script Properties. */
var RADAR = {
  timezone: 'Asia/Tokyo', version: '4.1', maxRunMs: 240000,
  categories: ['SPACE','COMPUTING','NEURO','ARCHAEOLOGY','MYSTERY','RETRO','INVENTION','NATURE'],
  reliability: ['VERIFIED','PRELIMINARY','SPECULATIVE','DISPUTED','UNVERIFIED'],
  defaults: {
    TIMEZONE: 'Asia/Tokyo', REPORT_DAY: 'MONDAY', REPORT_HOUR: 8,
    REPORT_COUNT: 10, MIN_SCORE: 70, RETRO_TARGET: 2, SOURCE_MAX: 3,
    MAX_AI_ARTICLES_PER_DAY: 50, MAX_AI_COST_USD_PER_MONTH: 5,
    SHOW_ADMIN_SCORE: false, DELIVERY_MODE: 'ADMIN_ONLY', AUTOMATION_ENABLED: false,
    OPENAI_MODEL: 'gpt-5.6-luna', PRICE_MODEL: 'gpt-5.6-luna',
    INPUT_USD_PER_MILLION: 0.20, OUTPUT_USD_PER_MILLION: 1.20,
    PRICE_CHECKED_AT: '2026-10-29', REASONING_EFFORT: 'low', MAX_OUTPUT_TOKENS: 2500,
    CATEGORY_MAX: 3, FINALIZE_HOUR: 23, MAX_FEED_ITEMS: 100, PRIMARY_EXCERPTS_ENABLED: true
  },
  columns: {
    SOURCES: 'source_id source_name feed_url category enabled last_checked last_status failure_count',
    ARTICLES: 'article_id source_id title_original title_ja summary_original summary_ja url normalized_url duplicate_key published_at fetched_at category curiosity_score brand_score talkability_score story_score uniqueness_score total_score reliability reliability_note interesting_point section_title keywords source_verified source_note ai_status delivery_status delivered_at updated_at ai_attempts ai_error evidence_url evidence_excerpt evidence_checked_at',
    REPORTS: 'report_id issue_number period_start period_end article_ids status created_at sent_at recipient error snapshot_json',
    SETTINGS: 'key value', LOGS: 'timestamp process status processed_count token_usage estimated_cost error',
    FEEDBACK: 'article_id rating notes updated_at'
  }
};

function settings_() {
  var c = Object.assign({}, RADAR.defaults);
  rows_('SETTINGS').forEach(function(r) { if (r.key in c) c[r.key] = r.value; });
  ['SHOW_ADMIN_SCORE','AUTOMATION_ENABLED','PRIMARY_EXCERPTS_ENABLED'].forEach(function(k) { c[k] = bool_(c[k]); });
  ['REPORT_HOUR','REPORT_COUNT','MIN_SCORE','RETRO_TARGET','SOURCE_MAX','MAX_AI_ARTICLES_PER_DAY',
    'MAX_AI_COST_USD_PER_MONTH','INPUT_USD_PER_MILLION','OUTPUT_USD_PER_MILLION','MAX_OUTPUT_TOKENS',
    'CATEGORY_MAX','FINALIZE_HOUR','MAX_FEED_ITEMS'].forEach(function(k) {
    c[k] = Number(c[k]); if (!isFinite(c[k]) || c[k] < 0) throw new Error('Invalid setting: ' + k);
  });
  ['REPORT_HOUR','REPORT_COUNT','MIN_SCORE','RETRO_TARGET','SOURCE_MAX','MAX_AI_ARTICLES_PER_DAY',
    'MAX_OUTPUT_TOKENS','CATEGORY_MAX','FINALIZE_HOUR','MAX_FEED_ITEMS'].forEach(function(k) {
    if (!Number.isInteger(c[k])) throw new Error('Integer required: ' + k);
  });
  if (c.DELIVERY_MODE !== 'ADMIN_ONLY') throw new Error('Only ADMIN_ONLY is implemented');
  if (c.TIMEZONE !== RADAR.timezone || c.REPORT_DAY !== 'MONDAY') throw new Error('Version 4.1 requires Asia/Tokyo / MONDAY');
  if (c.REPORT_COUNT > 10 || c.REPORT_COUNT < 1 || c.REPORT_HOUR > 23 || c.FINALIZE_HOUR > 23 ||
      c.MIN_SCORE > 100 || c.RETRO_TARGET > c.REPORT_COUNT || c.SOURCE_MAX < 1 || c.CATEGORY_MAX < 1 ||
      c.MAX_AI_ARTICLES_PER_DAY > 50 || c.MAX_OUTPUT_TOKENS < 1000 || c.MAX_OUTPUT_TOKENS > 8000 ||
      c.MAX_FEED_ITEMS < 1 || c.MAX_FEED_ITEMS > 500) throw new Error('Settings out of range');
  if (!/^[a-zA-Z0-9._-]+$/.test(c.OPENAI_MODEL) || c.PRICE_MODEL !== c.OPENAI_MODEL ||
      c.INPUT_USD_PER_MILLION <= 0 || c.OUTPUT_USD_PER_MILLION <= 0) throw new Error('Set model and matching nonzero prices');
  if (['none','minimal','low','medium','high'].indexOf(c.REASONING_EFFORT) < 0) throw new Error('Invalid reasoning effort');
  return c;
}

function adminEmail_() {
  var email = String(PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL') || '').trim();
  if (!/^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(email)) {
    throw new Error('ADMIN_EMAIL must contain exactly one mailbox');
  }
  var owner = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if (!owner || owner !== email.toLowerCase()) throw new Error('ADMIN_EMAIL must match the executing Google account');
  return email;
}
