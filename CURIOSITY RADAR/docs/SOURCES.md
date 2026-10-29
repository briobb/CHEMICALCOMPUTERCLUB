# 情報源の確認記録

確認日：2026-10-29。RSSの実在確認は、公式案内・公式HTMLのリンクとHTTPレスポンスを確認し、取得できたXMLをパースして行いました。GASの送信元ネットワークでの取得可否は導入時のRSS取得テストで再確認してください。

| 情報源 | 登録URL | 確認結果 | 初期状態 |
| --- | --- | --- | --- |
| MIT News | `https://news.mit.edu/rss/feed` | HTTP 200、RSS、50記事 | 有効 |
| MIT History | `https://news.mit.edu/rss/topic/history` | HTTP 200、RSS、50記事 | 有効・RETRO候補 |
| NASA | `https://www.nasa.gov/feed/` | HTTP 200、RSS、10記事 | 有効 |
| ESA | `https://www.esa.int/rssfeed/Our_Activities/Space_News` | HTTP 200、RSS、9記事 | 有効 |
| ScienceDaily | `https://www.sciencedaily.com/rss/all.xml` | 公式RSS案内に存在 | 保存条件の制限で無効 |
| Phys.org | `https://phys.org/rss-feed/` | 公式RSSリンクを確認、今回の直接取得はHTTP 400 | 無効 |
| New Atlas | `https://newatlas.com/index.rss` | HTTP 200、RSS、60記事 | 保存・AI利用条件の追加確認まで無効 |
| Quanta Magazine | `https://www.quantamagazine.org/feed/` | HTTP 200、RSS、5記事 | 保存・派生利用条件の追加確認まで無効 |
| Smithsonian Magazine | 空欄 | 公式RSS案内あり、直接取得は403、エンドポイント未確認 | 無効・推測URLなし |
| Science News | `https://www.sciencenews.org/feed` | HTTP 200、RSS、20記事 | 保存・AI利用条件の追加確認まで無効 |
| IEEE Spectrum | `https://spectrum.ieee.org/feeds/feed.rss` | 公式トップのRSSリンクを発見、HTTP 200、RSS、30記事 | 保存・AI利用条件の追加確認まで無効 |

有効なフィードのカテゴリは初期分類です。AIが内容で8カテゴリに分類し直します。MIT Historyには歴史研究者の人事等も含まれるため、すべてを科学技術史として採用しません。RETRO件数を埋めるための創作・古い通常記事の流用は行いません。

ScienceDailyの[利用条件](https://www.sciencedaily.com/terms.htm)はRSSデータの長期保存・データベース格納を制限しています。本構成は記事をSheetsに保存するため初期無効としています。Quantaの[利用条件](https://www.quantamagazine.org/terms-conditions/)にも保存・派生利用への制限があります。RSSの存在だけを保存・AI利用の許諾と解釈していません。

初期有効ソースは個人閲覧用の短い要約・リンクのみを使用し、公開再配信はしません。MIT Newsの[利用案内](https://news.mit.edu/terms-of-use)には再掲載時の条件があります。元記事全文や画像をメールへ転載しません。

公式の確認元：

- [MIT RSS](https://news.mit.edu/rss)
- [NASA RSS](https://www.nasa.gov/rss-feeds/)
- [ESA RSS](https://www.esa.int/Services/RSS_Feeds)
- [ScienceDaily RSS](https://www.sciencedaily.com/newsfeeds.htm)
- [Phys.org RSS](https://phys.org/feeds/)
- [New Atlas RSS](https://newatlas.com/rss)
- [Quanta RSS](https://www.quantamagazine.org/feed/)
- [Smithsonian RSS案内](https://www.smithsonianmag.com/rss/)
- [Science News FAQのRSS案内](https://www.sciencenews.org/about-science-news/frequently-asked-questions)
- [IEEE Spectrum公式トップ](https://spectrum.ieee.org/)

無効ソースを使う場合、管理者が保存・AI利用を含む条件と取得可否を確認し、`SOURCES.enabled`をTRUEに変更します。変更後は取得テストを実行してください。HTTP 403等を回避するスクレイピングは実装していません。
