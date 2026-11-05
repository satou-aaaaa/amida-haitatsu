# AGENTS.md

あみだ配達：あみだくじに横線を足して、上の手紙をそれぞれ同じ字の家へ届ける1日3問のパズル（いちばん少ない本数を目指す）。`index.html` と `gen.js`（問題の作り方と、いちばん少ない本数の数え方）を GitHub Pages で公開する。

## 準備（最初に一度）

```bash
bash scripts/setup.sh   # Node.js（版は .nvmrc）を確かめ、検査の依存とブラウザを入れる。何度実行してもよい
```

## push する前の確認

```bash
node qa/run.mjs   # 問題の作り方（4つの大きさ×何百問、いちばん少ない本数を別の数え方で数え直す）・3問の組み方（1年分）・引く/消す/戻す・ヒント・続きから・上級・配達帳・実績・スマホ幅・PWA（CI の QA と同じ）
```

## このリポジトリの決まり

- あみだのきまり：手紙は縦の道を上から下へ進み、横線があれば必ず渡る。同じ段で横線はとなり合わせにしない（はじめからの横線とも）。はじめからある横線は消せず、工事中の所には引けない。遊び方と README に同じことを書く。
- 問題は `gen.js` の `make` が種から作る：はじめからの横線と工事中を置き、上の段から順に「どの並びに何本で着けるか」を全部数え（`solve`）、いちばん少ない本数が `SIZES`・`HARD` の `min` の幅に入る並びを家の並びにする。いちばん少ない本数 `d` は画面に出す。`gen.js` を変えると過去の日の問題も変わるので、変えた PR に一言書く。
- 今日の3問（小道4本・町5本・大通り6本）・上級（7本を2つ）は日本時間の日付から作る種（`seedOf`）で決まり、だれでも同じ。`Math.random()` は練習の問題の種だけ（QA が数を見る）。
- ★は足した本数で決める（いちばん少ない本数で★3・2本多いまで★2・それ以上★1）。ヒント（いちばん少ない引き方の横線を1本引く。足りていれば余分な横線を1本消す）1回ごとに★を1つ減らす（最低★1、2回まで）。上級はヒントなし。時間制限は付けない。
- 今日の3問・上級は1日1回で、途中で閉じても引いた横線とヒントのまま続きから。保存してあった引き方は、空いた所だけ・となり合わない・ヒントの線が中にあるかを確かめてから使う（`valid`）。途中経過はモードごとに分けて保存し（`runs.d`・`runs.h`・`runs.p`）、練習で今日・上級の途中を消さない。答えを入れる前に、保存した進み具合が画面と同じ問題か確かめる。記録は保存の前に読み直す。保存に失敗したあとは、途中経過を時刻でなく進み具合で選び、配達帳の数は多いほうを残す（shared-workflows `incidents/2026-11-04-daily-game-save-gaps.md`）。
- 共有は遊ぶ人が押したときに開くリンク（X・LINE・Web Share・コピー）だけ。シェアの文に道（答え）を出さない（🟩いちばん少ない本数・🟨2本多いまで・🟧もっと・💡ヒント）。
- 文字は少なめ・一画面一問。お笑いの言葉は入れない（QA が見る）。ほかの作品の名前・キャラ・見た目は使わない。
- 実績（`achList`）は腕前と集めることに報い、まだのものは進み具合を出す。ぴったり・ヒントなし・上級は今日の3問と上級の記録だけで数え、練習は配達帳の数にだけ入る。新しく取った実績は次の結果の画面で知らせる（`s.ach`）。
- 感想は「感想を送る」から GitHub の Issue フォーム（`.github/ISSUE_TEMPLATE/feedback.yml`、ラベル「感想」）を開くだけ。項目は shared-workflows の `template/.github/ISSUE_TEMPLATE/feedback.yml` と同じにし、名前・メールは聞かない。週1で shared-workflows `routines/game-feedback.md` が読んで直す。
- 応援は Ko-fi（https://ko-fi.com/satouaaaaa）へのただのリンクだけ。今日の3問・上級を初めて終えて全部いちばん少ない本数（ヒントなし）のときだけ、結果の画面の下に1行（共有フォルダ kofi/app-guide.md）。遊ぶのは無料のまま、有料版は置かない。
- 外へ通信しない。外から読むのは Google Fonts の文字だけ（CSP の `connect-src 'self'` を広げない）。記録は遊ぶ人のブラウザ（localStorage）だけ。
- 同じ日はどの端末でも同じ問題にする：乱数は `sort` の比較の中で引かない（QA が見る）。少し遅れて動く処理（setTimeout）は、画面が替わっていたら何もしない。
- 押せる所は高さ44px以上、盤の押す所（縦の道のあいだ×段）は幅320pxの7本でも40px×44px以上（QA が見る）。機能を足す・直すたびに `qa/run.mjs` に検査を足す。乱数で組む部分は何百回も作って確かめる（shared-workflows `incidents/2026-10-31-roppo-empty-village.md`）。
- PWA（`manifest.webmanifest`・`sw.js`・`icon-*.png`）：画面のファイルを足したら `sw.js` の `SHELL` にも足し、中身を大きく変えたら `CACHE` の版を上げる。アイコンは `node tools/make-icons.cjs`、SNS 用の絵 `og.png` は `node tools/make-og.cjs`（今日の問題を入れない）。
- 引き継ぎコード（別の端末へ記録を移す）：`transfer.js`・`qa/transfer-check.mjs` は shared-workflows の `template/` の写し（ここで直さない。直すときはひな形を直して配り、`引き継ぎの版` を上げる）。`index.html` の script の `data-keys` は記録のキーだけを書く。記録の形を変えたら `qa/run.mjs` の `checkTransfer` の `sample` も合わせる。sw.js の `SHELL` から `./transfer.js` を外さない（shared-workflows `routines/game-dev.md`「引き継ぎコード」）。
- 見やすさ：`</head>` の前の見やすさの設定（`<!-- a11y:begin -->`〜`end`）は shared-workflows `template/a11y/a11y.html` の写しで、ここでは直さない。`qa/a11y.mjs` も `template/qa/a11y.mjs` の写し（画面の足し方・許しは `qa/a11y.json` に理由つき）。色だけで分けない・コントラスト 4.5:1・知らせは aria-live（`#live`）・決めつけの言葉を使わない（shared-workflows `routines/game-dev.md`「だれでも遊べるように」）。はじめからの横線は両はしに●、ヒントの横線は中に○、家の下に着いた手紙の字（「✓着」「着○」）、取れなかった星は ☆、進み具合の点は形（いまの問題が高い・まだは中が空）。押す所と手紙は role=button で Enter/Space でも押せ、名前に状態を持つ。「色の見分けを助ける」（`html.a11y-cvd`）では手紙の道をカラーユニバーサルデザインの組と線の模様（`.rt.c0`〜`c6`）に替える。
- 公開リポジトリなので、個人情報・鍵を入れない。

## 公開

- GitHub Pages は `main` のルート（`/`）を公開する。PR の QA と Secret scan が ✅ になると `automerge.yml` が自動でマージする。止めたいときは下書きにするか、ラベル「自動マージしない」を付ける。
- `sw.js`・`manifest.webmanifest` を変える PR は自動ではマージされない（`hold_paths`）。CodeRabbit のレビューを待ち、手でマージする直前に今の head へのレビューを読み直す（shared-workflows `incidents/2026-11-01-roppo-merged-before-review.md`）。CodeRabbit は PR に `@coderabbitai review` とコメントして頼む。

## 共通のきまり

- PR の作り方・マージの仕方は satou-aaaaa/shared-workflows の `routines/pr.md`、全体のきまりは `routines/common.md` に従う。
- CI の部品は shared-workflows の共通部品を呼ぶ。リポジトリ側の .github/workflows には呼び出しと設定値だけを書く。
- Claude 以外の AI・人が作業するときは、shared-workflows の `routines/tool-map.md` と `routines/without-claude.md` を読む。
