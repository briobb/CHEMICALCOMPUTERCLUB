const fs=require('node:fs'),path=require('node:path');
const {harness,article,root}=require('../tests/harness.cjs');
const {c}=harness();const p=c.reportPeriod_(new Date('2026-11-02T00:00:00Z'));
const data=c.reportData_([article('layout-example',{title_ja:'レポートの表示サンプル（実際のニュースではありません）',
  summary_ja:'これはメールの見た目を確認するための表示サンプルです。実際の研究や発見を紹介するものではありません。週刊レポートでは、収集した記事の内容と確認できた根拠をもとに、日本語で発見の概要を紹介します。研究が進行中の場合や、まだ確かめられていない仮説を扱う場合は、その限界も明記します。興味を引く話題でも、科学的な裏付けが不足していれば自動掲載の対象から外します。各記事の下にあるリンクから元の情報にたどれる構成です。',
  interesting_point:'発見の内容と、その根拠を分けて読めるレイアウトです。',reliability_note:'レイアウト確認用の架空データです。',source_note:'実際のニュースは使用していません。'})],p,1,c.settings_());
const r=c.renderReport_(data);fs.mkdirSync(path.join(root,'preview'),{recursive:true});
fs.writeFileSync(path.join(root,'preview/report.html'),r.html);fs.writeFileSync(path.join(root,'preview/report.txt'),r.text);
console.log('Wrote preview/report.html and preview/report.txt (synthetic layout fixture, no mail sent)');
