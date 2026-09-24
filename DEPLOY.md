# Railway へのデプロイ手順

社員がいつでもブラウザからアクセスできる状態にするための手順。
所要時間はおおよそ 40〜60 分（R2 の設定を含む）。

---

## 全体像

```
GitHub リポジトリ  ──push──▶  Railway（Next.js アプリ）
                                  │
                                  ├─ MySQL（Railway が同一プロジェクト内に用意）
                                  └─ Cloudflare R2（領収書画像）
```

---

## ⚠️ 公開前に理解しておくこと

このシステムは**パスワードを使わず、お名前の入力だけでログイン**する。
そのため、**公開 URL とオーナーのログイン名を知っている人は誰でも
オーナーとして全社員の経費データを閲覧・操作できる**。

URL の管理がそのままアクセス管理になるため、次の点に注意すること。

- URL とログイン名を社外に共有しない（メール転送・チャットの外部共有に注意）
- **リポジトリを Public にする場合、ログイン名をソースに書かない**（環境変数で渡す）
- 検索エンジンに拾われないよう、公開リンクをどこにも貼らない
- より強い保護が必要になったら、サイト共通の合言葉や IP 制限の追加を検討する

---

## 事前に用意するもの

- GitHub アカウント
- Railway アカウント（GitHub でサインインできる）
- Cloudflare アカウント（R2 用・無料枠で足りる）

データベースは **Railway MySQL** を使う。同じプロジェクト内に置くので、
接続情報は Railway が自動で受け渡してくれる（手入力は不要）。

### Cloudflare R2 は本番では必須

Railway のコンテナは**再デプロイのたびにファイルが消える**。
R2 を設定しないと領収書画像が失われるため、未設定時はアップロードを
エラーで止めるようにしてある（`src/lib/storage.ts`）。

R2 は無料枠（10GB / 月）があり、領収書用途なら十分。

---

## 手順

### STEP 1. GitHub にリポジトリを作る

GitHub で空のプライベートリポジトリを作成する（README なしで作る）。
その後、ローカルで以下を実行する。

```bash
cd ~/keihi-system && git add -A && git commit -m "経費管理システム: 経費申請・日報・PDF出力"
```

```bash
cd ~/keihi-system && git branch -M main && git remote add origin https://github.com/<ユーザー名>/<リポジトリ名>.git && git push -u origin main
```

> `.env` は `.gitignore` 済みなので push されない。秘密情報は STEP 4 で Railway に直接登録する。

---

### STEP 2. Cloudflare R2 を用意する

1. Cloudflare ダッシュボード → **R2** → 「バケットを作成」
   - バケット名の例: `keihi-receipts`
   - ロケーション: `APAC`
2. R2 の「**API トークンを管理**」→「API トークンを作成」
   - 権限: **オブジェクトの読み取りと書き込み**
   - 対象バケット: 上で作ったバケットのみ
3. 表示される次の 3 つを控える（**アクセスキーは一度しか表示されない**）
   - アクセスキー ID
   - シークレットアクセスキー
   - アカウント ID（R2 のトップ画面に表示される）

---

### STEP 3. Railway でプロジェクトを作る

1. https://railway.app にサインイン（GitHub アカウントでログインするのが楽）
2. **New Project** → **Deploy from GitHub repo** → STEP 1 のリポジトリを選択
3. 初回のビルドは環境変数が無いため失敗する。STEP 4 を先に済ませる。

続けて、同じプロジェクト内に MySQL を追加する。

**New** → **Database** → **Add MySQL**

サービス名が `MySQL` になっていることを確認する（STEP 4 でこの名前を使う）。

---

### STEP 4. 環境変数を登録する

Railway のアプリサービス → **Variables** タブで以下を設定する。

| 変数名 | 値 |
| --- | --- |
| `DATABASE_URL` | `${{MySQL.MYSQL_URL}}` と**そのまま入力**する（波括弧込み。Railway が MySQL サービスの接続情報に置き換える） |
| `AUTH_SECRET` | 下のコマンドで生成した値 |
| `R2_ACCOUNT_ID` | STEP 2 のアカウント ID |
| `R2_ACCESS_KEY_ID` | STEP 2 のアクセスキー ID |
| `R2_SECRET_ACCESS_KEY` | STEP 2 のシークレット |
| `R2_BUCKET` | `keihi-receipts` |

`AUTH_SECRET` の生成:

```bash
openssl rand -base64 32
```

> この値を変更すると全員のログインセッションが切れる（再ログインが必要になるだけで、データは消えない）。

---

### STEP 5. デプロイと公開 URL の発行

1. **Deployments** タブで再デプロイする（Variables を保存すると自動で走ることが多い）
2. マイグレーションは起動時に自動実行される（`railway.json` の `startCommand`）
3. **Settings** → **Networking** → **Generate Domain** で
   `https://xxxx.up.railway.app` の URL が発行される

独自ドメイン（Xserver で取得したものなど）を使う場合は、
同じ画面の **Custom Domain** にドメインを入力し、表示される CNAME を
Xserver の DNS 設定に追加する。SSL は Railway が自動で発行する。

---

### STEP 6. 初期アカウントを投入する

デプロイ後の DB は空なので、最初のユーザーを作る。

```bash
npm i -g @railway/cli && railway login
```

初期アカウントの名前は環境変数で渡す（ソースには残さない）。

```bash
cd ~/keihi-system && railway link && SEED_OWNER_NAME="オーナーの名前" SEED_USER_NAME="社員の名前" railway run npm run db:seed
```

これでオーナーと社員のアカウントが作成される。

---

### STEP 7. 本番用の社員アカウントを追加する

オーナーのログイン名でログインし、サイドバーの **社員管理** から追加する。
氏名を入力するとログイン名に姓が自動で入るので、
重複する姓の社員がいる場合はログイン名を手で調整する（例: `山田健`／`山田M`）。

社員には「ログイン画面で入力する名前」を伝えるだけでよい。

---

## デプロイ後の確認

- [ ] `https://<発行されたURL>/login` が表示される
- [ ] オーナーの名前を入力してログインでき、管理者メニューが出る
- [ ] 社員の名前を入力してログインでき、管理者メニューが**出ない**
- [ ] 経費申請で通勤経路を登録し、出勤日を選択して提出できる
- [ ] 領収書画像をアップロードし、一覧の「画像を表示」で開ける
- [ ] 申請履歴から PDF をダウンロードでき、日本語が文字化けしていない
- [ ] 日報を提出できる
- [ ] **再デプロイ後も領収書画像が表示される**（R2 が効いている証拠）

---

## 運用メモ

### 費用の目安

| 項目 | 目安 |
| --- | --- |
| Railway | $5/月 のクレジット枠あり。小規模な社内利用ならこの範囲に収まることが多い |
| Railway MySQL | 上記の使用量に含まれる |
| Cloudflare R2 | 10GB まで無料。領収書画像なら当面無料枠内 |

### バックアップ

Railway MySQL は管理画面からバックアップを設定できる。
給与・経費に関わるデータなので、**月次でのバックアップ設定を推奨**する。

### デプロイの更新

`main` ブランチに push すると Railway が自動で再ビルド・再デプロイする。
DB マイグレーションも起動時に自動適用される。

```bash
cd ~/keihi-system && git add -A && git commit -m "変更内容" && git push
```

### スキーマを変更したとき

ローカルでマイグレーションファイルを作ってから push する。

```bash
cd ~/keihi-system && npx prisma migrate dev --name 変更内容
```

---

## つまずきやすい点

| 症状 | 原因と対処 |
| --- | --- |
| ビルドは通るが起動しない | `DATABASE_URL` が未設定。STEP 4 を確認する |
| ログイン後すぐログイン画面に戻る | `AUTH_SECRET` が未設定、または 16 文字未満 |
| 「お名前が見つかりません」と出る | シード未実行（STEP 6）。または社員管理でログイン名を確認する |
| 領収書アップロードでエラー | R2 の 4 変数が揃っていない。エラーメッセージにその旨が出る |
| PDF の日本語が四角になる | フォント `src/assets/fonts/NotoSansJP.ttf` が push されているか確認（9.5MB） |
| DB に繋がらない | `DATABASE_URL` に `${{MySQL.MYSQL_URL}}` が波括弧ごと入っているか確認する。MySQL サービス名が `MySQL` 以外なら、その名前に合わせる |
| マイグレーションが走らない | Deploy ログに `prisma migrate deploy` の出力が出ているか確認する（`railway.json` の startCommand） |
| 画面が開かない・ログインが終わらない | まず `https://<公開URL>/api/health` を開く。`503` なら MySQL 側の問題。Railway で MySQL が Online か、直近で再デプロイされていないかを確認する |
