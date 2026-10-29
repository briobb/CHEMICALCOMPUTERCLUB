# CCC CURIOSITY RADAR 4.1

Google Apps Script / Google Sheets / OpenAI Responses API / Gmailで動く、管理者本人向けの科学ニュース週刊レポートです。収集・AI評価・選抜・本文生成・送信を分離しています。既存CCCサイト、GitHub Pages、Cloudflare、Stripeを変更するコードはありません。

## 実装と検証の状態

Phase 1〜3のコード、ローカル自動テスト、clasp配置用設定、メール表示サンプルを収録しています。Google上への配置、OAuth認可、実APIでの日本語品質確認、実際のGmail送信は初期導入後に行ってください。このリポジトリにAPIキー・管理者アドレス・GASプロジェクトIDは含めていません。

初期セットアップでは自動送信を開始しません。テスト完了後、`enableAutomation()`で有効化します。初期情報源はMIT、MIT History、NASA、ESA。他候補は取得可否・保存条件の調査結果に応じて無効登録します。詳細は[情報源の確認記録](docs/SOURCES.md)を参照してください。

## プロジェクト構造

```text
src/
  Main.gs                 メニュー・定期処理・復旧
  Config.gs               設定・宛先の検証
  Setup.gs                シート作成・初期情報源・トリガー
  FeedFetcher.gs          HTTP取得・新着判定
  FeedParser.gs           XmlServiceでRSS / Atom / RDF解析
  ArticleRepository.gs    Sheets入出力
  DuplicateDetector.gs    URL正規化・保守的な類似判定
  EvidenceVerifier.gs     対象の一次情報ページの短い抜粋取得
  OpenAIClient.gs         Responses API・構造化出力・費用予約
  ArticleEvaluator.gs     評価検証・分割実行
  ReportSelector.gs       選抜・週間確定
  ReportBuilder.gs        共通レポートデータ・HTML / テキスト
  ReportTemplate.html     画像なしのインラインCSSメール
  MailSender.gs           管理者送信・結果不明時の停止
  Logger.gs               ログ・通知・使用量
  Utilities.gs            日付・文字列・ロック・URL
  appsscript.json          V8・権限・Asia/Tokyo
tests/                    GASサービスの代替実装を使うローカルテスト
scripts/                  構文検査・表示サンプル生成
preview/                  レイアウト確認用HTML / テキスト（架空データ）
docs/                     情報源調査・受け入れ確認
.clasp.json.example        配置先の設定例
```

## 初期導入

1. **管理者として使うGoogleアカウント**で新しいGoogleスプレッドシートを作成します。共有は不要です。
2. スプレッドシートの「拡張機能 → Apps Script」から紐づくGASプロジェクトを作成します。「プロジェクトの設定」でスクリプトIDを確認します。
3. ローカルでこのフォルダーに移動し、次を実行します。clasp利用には[Apps Script APIの有効化](https://script.google.com/home/usersettings)が必要です。

   ```sh
   npm ci
   npm run check
   npm test
   cp .clasp.json.example .clasp.json
   # .clasp.json の scriptId を、新しく作成した専用GASのIDに置換する
   npx @google/clasp login
   npx @google/clasp status
   npx @google/clasp push
   ```

   `status`で`src/`のGAS・HTML・manifestだけが対象になっていることを確認します。専用プロジェクトに配置してください。時間トリガーにはWebアプリ公開や`clasp deploy`は不要で、`push`したコードが実行されます。

4. GASの「プロジェクトの設定 → スクリプト プロパティ」に以下を設定します。キーをシートやソース、チャットへ貼らないでください。

   | 名前 | 値 |
   | --- | --- |
   | `OPENAI_API_KEY` | 自分のOpenAI APIキー |
   | `ADMIN_EMAIL` | 実行するGoogleアカウント自身のメールアドレス1件 |
   | `SPREADSHEET_ID` | 紐づくシートでは省略可。セットアップが保存。単独GASでは指定可 |

   単独GASでシートIDもアクティブシートもない場合、セットアップが新規スプレッドシートを作成します。ただしカスタムメニューは紐づくGASで使用するため、通常は手順1〜2を推奨します。

5. GASエディターで`setupSystem()`を実行し、Googleの権限認可を行います。GmailAppを使うためGmailの権限、Sheets、外部通信、トリガー、本人メール確認の権限が必要です。実行結果とLOGSの`SETUP`に不足設定がないことを確認します。
6. シートを再読み込みすると「CCC RADAR」メニューが現れます。`SOURCES`の有効情報源と`SETTINGS`を確認します。
7. 「RSS取得テスト」→「本日のニュース取得」を実行します。取得テストはARTICLESを変更せず、LOGSに結果を残します。
8. 「AI評価テスト」を実行します。未評価の1記事を実APIで評価して実行ログに表示します。API料金・使用量は記録しますが、ARTICLES・配信履歴は変更しません。未評価記事がない場合は先に取得してください。
9. 「未評価記事処理」を実行し、ARTICLESの`DONE`記事、日本語要約、出典確認状況、採点を確認します。`UNVERIFIED`は選抜しません。
10. 「週間レポートプレビュー」→「テストメール送信」を実行し、スマートフォン・Gmailで見た目と日本語を確認します。テストメールには`[TEST]`が付き、号数・REPORTS・掲載履歴は更新しません。
11. 「自動実行を有効化」を選択します。以後、以下の4トリガーを管理者本人のアカウントで実行します。別アカウントからトリガーを作成しないでください。

セットアップの再実行は既存の設定・記事を上書きしません。必要なシート・列・設定キー・初期情報源が不足していれば追加します。有効化済みの場合だけ自分の4種類のトリガーを照合し、重複を除去します。

## 自動実行と週の境界

| 処理 | JST時刻 | 動作 |
| --- | --- | --- |
| `runDailyJob` | 毎日6時台 | RSS収集後、時間内で評価 |
| `resumePendingJob` | 1時間ごと | 残りの未評価記事を処理。日次・月次上限適用 |
| `runFinalizeJob` | 日曜23時台 | 再取得・時間内で追加評価後、記事と本文を確定 |
| `runWeeklyJob` | 月曜8時台 | 確定済みレポートだけを送信 |

時間トリガーは正時を保証しません。対象期間はJSTの月曜0:00以上、次の月曜0:00未満です。日曜のプレビュー・確定は当週、それ以外は直前の完了週を扱います。通常記事は公開日時、RETROは初回取得日時が対象期間に入るものだけを選びます。

**日曜日の確定実行後から23:59:59までに公開・取得された記事は追加されません。** 日曜確定と不変の本文を優先する仕様です。日曜夜のフィードに未反映の記事や評価待ち記事も取りこぼし得ます。月曜には収集・再選抜しません。確定に失敗した場合は通知し、手動確認後に「週間レポートを確定」で復旧できます。

通常枠は最大8件、RETROは最大2件。RETRO不足を通常記事で無理に埋めません。70点以上、同一媒体最大3件、同一カテゴリ最大3件を初期値とします。MITとMIT Historyは同一媒体として数えます。SPECULATIVEとDISPUTEDは合計2件まで。0件でも「掲載基準を満たす記事なし」のレポートを作ります。

## 設定

仕様書の設定項目に加えて運用用の項目を用意しています。

| 設定 | 初期値 / 説明 |
| --- | --- |
| `TIMEZONE` / `REPORT_DAY` | `Asia/Tokyo` / `MONDAY`。4.1では固定。他値はエラー |
| `REPORT_HOUR` / `FINALIZE_HOUR` | `8` / `23`。変更後`setupSystem()`または`enableAutomation()`でトリガー更新 |
| `REPORT_COUNT` / `RETRO_TARGET` | `10` / `2` |
| `MIN_SCORE` / `SOURCE_MAX` / `CATEGORY_MAX` | `70` / `3` / `3` |
| `MAX_AI_ARTICLES_PER_DAY` | `50`。再試行とテストも含むAPI呼び出し数を安全側の上限として使用 |
| `MAX_AI_COST_USD_PER_MONTH` | `5`米ドル |
| `OPENAI_MODEL` / `PRICE_MODEL` | `gpt-5.6-luna`。変更時は両方を同じモデル名にし料金も更新 |
| `INPUT_USD_PER_MILLION` / `OUTPUT_USD_PER_MILLION` | `0.20` / `1.20`。確認日2026-10-29 |
| `PRICE_CHECKED_AT` | `2026-10-29`。料金を確認した日に手動更新 |
| `REASONING_EFFORT` / `MAX_OUTPUT_TOKENS` | `low` / `2500`。推論トークンも出力上限・料金に含む |
| `PRIMARY_EXCERPTS_ENABLED` | `TRUE`。許可対象の一次情報ページを1記事1回確認 |
| `MAX_FEED_ITEMS` | 1情報源につき`100`件、1レスポンス最大2MBの解析上限 |
| `SHOW_ADMIN_SCORE` | `FALSE`。確定時点の値を本文に保存 |
| `DELIVERY_MODE` | `ADMIN_ONLY`以外は未実装としてエラー |
| `AUTOMATION_ENABLED` | 初期`FALSE`。メニューで有効化・停止 |

モデル・料金は[OpenAI公式モデル情報](https://developers.openai.com/api/docs/models/gpt-5.6-luna)で確認しました。Responses APIの[Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)を使用し、`store:false`を指定します。モデル利用可否は各APIアカウントで確認してください。

## 根拠の扱いと重複判定

RSS概要は最大2,000文字に制限します。通常記事は公開から14日以内。Atomの`updated`は別の列に保存し、公開日時の代用にしません。公開日時不明の通常記事は取得対象外です。

NASA（www/science）、MIT News、ESAの対象記事では、公開ページのarticle/main領域から最大4,500文字の段落抜粋を一時取得しAIに渡します。URL・確認日時と最大800文字の抜粋だけをARTICLESに保存します。任意サイトの本文巡回、モデルが提示したURLの追跡、ペイウォール回避はありません。取得失敗時はRSSだけで慎重に評価します。

`VERIFIED`は一次ページの抜粋で主要な主張を裏付けた場合だけ許容します。一次ページの取得成功そのものは事実確認の完了ではありません。`PRELIMINARY`も、初期研究・プレプリント等である根拠が必要です。根拠が足りない記事は`UNVERIFIED`として不掲載になります。AIによる照合は独立した科学査読ではなく、論文全文の自動検証は実装していません。

URLのホスト・標準ポート・追跡パラメーターを正規化します。記事識別に使うクエリ、パスの大小文字、末尾スラッシュ、HTTP/HTTPSはむやみに同一化しません。同一URLは登録前に除去し、タイトルと概要の単語の重なりが高い同一ニュースは評価・選抜前にも除去します。判定できない関連研究は別記事として残るため、完全な意味的重複排除は保証しません。

## 費用・失敗・再試行

すべての変更処理はScriptLockで排他実行します。1回のジョブは240秒の内部予算を持ち、新規API呼び出し前には45秒以上の余裕を要求します。ただしGASのHTTP呼び出しを任意の秒数で中断する機能はなく、遅い通信でハード制限に達することがあります。未処理記事は次の時間トリガーへ持ち越します。

API呼び出し前にLOGSへ最大推定費用を`RESERVED`として書き込み、flushします。結果のusageを取得できればトークン数と推定費用へ置換し、タイムアウトやusage欠落時は予約額を保持します。キャッシュ割引は差し引かず、入力価格に1.25倍の余裕を含めるため推定額は請求額より高くなる場合があります。モデル料金変更・税・他システムのAPI利用はこの上限では管理できません。OpenAIの課金画面も併用してください。

429・5xx・通信エラーは待機後に再試行します。記事ごとのAPI実行は**初回を含め最大3回**、上限を超えたらFAILEDです。不正JSON・不正スコア等はFAILEDに記録します。「失敗処理の再実行」は残り回数があるFAILEDだけをPENDINGに戻します。認証エラーはその処理を停止し通知します。キー修正後に再実行できます。3回使い切った記事の再評価は、原因を解消してから管理者が`ai_attempts=0`、`ai_status=PENDING`に変更する明示操作が必要です。使用量LOGSは削除しません。

FEEDBACKのGOOD / NORMAL / BADとnotesは記録用です。評価モデルの自動学習・自動調整には使いません。評価済み記事を自動で再評価しません。

## メール送信と障害復旧

`ADMIN_EMAIL`は単一のメールアドレスで、実行Googleアカウントのメールと一致しなければ送れません。エイリアス・別の管理者アドレスも拒否します。本文は宛先非依存で保存します。

| REPORTS.status | 意味 / 対応 |
| --- | --- |
| READY | 記事と本文が確定、未送信 |
| SENDING | Gmail呼び出し直前に永続化済み |
| SENT | Gmail呼び出し成功。掲載フラグ更新に失敗しても再実行で修復し、再送しない |
| FAILED | Gmail呼び出し前に失敗。設定・日次枠を直して再実行可能 |
| UNKNOWN | Gmail呼び出し失敗またはSENDINGで中断。**自動再送しない** |

UNKNOWNの場合はGmailの送信済みで件名の日付・号数を確認してください。

- **送信済みを確認できた場合**：「送信結果不明を照合」でレポートIDを入力し確認すると、SENTと掲載フラグを更新します。
- **送信されていないと確実に確認できた場合**：自動実行を停止し、対象REPORTS行を管理者が手動でREADYに戻して「週間レポート手動送信」を実行します。結果が不明なままREADYへ戻さないでください。
- **過去週のレポート**：通常の手動送信は対象週だけを扱い、古いレポートをまとめて自動再送しません。未送信の過去号は保存された本文を確認して個別に対応してください。

GmailとSheetsを1つのトランザクションにできないため、厳密なexactly-once配信は保証できません。結果不明なら停止することで重複送信を避けます。SENTはGmail送信APIの成功であり、受信箱への到達保証ではありません。

RSS継続失敗（3回以上）、API認証、月次予算、レポート生成、送信失敗は管理者へ通知します。同種通知はJSTで1日1回まで。Gmail枠切れやメール設定不備では通知自体が送れないため、LOGS・GAS実行履歴を確認してください。現月のAI_REQUESTログを消すと予算集計が壊れるため、削除しないでください。

Googleの制限は[公式クォータ表](https://developers.google.com/apps-script/guides/services/quotas)と[トリガー仕様](https://developers.google.com/apps-script/guides/triggers/installable)を参照してください。確認時点の通常スクリプトは1実行6分、メール宛先数は一般アカウント100/日・Workspace 1,500/日、トリガー合計実行時間は一般90分/日・Workspace 6時間/日です。クォータは他のスクリプトと共有される場合があります。

## ローカル検証

```sh
npm ci
npm run check
npm test
npm run preview
```

`preview/report.html`をブラウザーで開くとデザインを確認できます。サンプルは実際のニュース・AI評価の成果ではありません。ローカルテストは代替GASサービスを使用し、API呼び出し・メール送信は行いません。実RSSに対する確認結果と、Google側で残る確認は[受け入れ記録](docs/ACCEPTANCE.md)を参照してください。

## 将来拡張の境界

`reportData_`が共通データ、`renderReport_`が本文生成、`MailSender.gs`が配送を担当します。購読者DB、登録フォーム、配信停止、一斉送信、Cloudflare・Stripe連携、公開バックナンバーは含みません。一般公開・配信拡大には別途情報源の利用条件を再確認する必要があります。
