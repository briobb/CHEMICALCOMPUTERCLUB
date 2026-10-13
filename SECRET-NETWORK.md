# CCC SECRET NETWORK — 実装・検証記録

## 追加ファイル

- `rabbithole/index.html` — RABBITHOLE。指定メッセージと暗号照合完了表示。
- `orbital/index.html` — ORBITAL。座標・探索番号・コピー操作。
- `innercircle.html` — 最終認証ログ、祝福メッセージ、会員証の表示。
- `css/secret-network.css` — 専用の共通CRTスタイル、レスポンシブ表示、セーフエリア、モーション軽減。
- `js/secret-network.js` — 1.6秒の起動演出、タップ／ボタンによるスキップ、座標コピーとエラー表示。
- `images/secret-network/inner-circle-membership.svg` — 正式な既存CCCロゴを埋め込んだ会員証の編集用原稿。
- `images/secret-network/inner-circle-membership.png` — 表示用PNG（1800×1120、約105KB）。
- `SECRET-NETWORK.md` — この記録。

## 統合と表示

既存のHTML/CSS/Vanilla JavaScript構成に合わせた静的ファイルの追加。追加ライブラリ、ビルド工程、バックエンドは不要。既存のページ・ナビゲーション・サイトマップは変更していない。作業前から存在したCSS・JS・画像の変更もそのまま維持。

`/rabbithole` と `/orbital` はディレクトリの `index.html` で配信する。GitHub Pagesなどの静的配信では通常、それぞれ末尾スラッシュ付きURLに正規化される。`/innercircle.html` は指定どおり拡張子付き。ドメイン直下への配置が前提。

全ページに `noindex, nofollow` を設定し、ページ間リンクは設置していない。JavaScriptが無効でも本文と会員証を閲覧できる。

会員証の色は既存サイトの #F3F0E8 / #2B2B2B / #D66A2E、正式ロゴは `images/ccc_logo.png` を使用。PNGは会員証部分だけを含む。

## 会員証の表示

会員証は表示のみ。ユーザーの仕様変更により、保存ボタン、ダウンロードリンク、画像プレビュー、保存・共有処理を削除。

## 確認結果

2026-10-14、ローカルHTTPサーバーとPlaywright / Google Chromeで確認。

- 320 / 375 / 390 / 430 / 1280px の5幅 × 3ページで横スクロールなし。
- 3つのURLの直接アクセス・再読み込みが成功。
- スキップ操作と `prefers-reduced-motion: reduce` に対応。
- スキップ前後で操作位置がずれないよう制御領域の高さを維持。
- 全ページの `noindex` を確認。
- RABBITHOLEに禁止された文字列・リンク・入力欄がないことを確認。
- コピー結果は厳密に `34.4269095, 135.5117641` と一致。
- 390px幅の全ページスクリーンショットと会員証PNGを目視確認。
- JavaScript実行エラーなし。構文チェック・差分の空白チェック成功。

保存機能削除後は、関連UI・処理の除去とJavaScript構文を確認。

iPhone実機のSafari、本番配信は未確認。本番へのデプロイ・Gitコミット・pushは行っていない。

## 最新リポジトリへの統合

2026-10-14、origin/main を fetch し、最新コミット ae6be9f を基点に codex/secret-network-latest を作成。今回の8ファイルのみを追加し直した。既存の商品・ゲーム・決済ページなどは最新版を維持。旧ローカル履歴はローカル main に保管。
