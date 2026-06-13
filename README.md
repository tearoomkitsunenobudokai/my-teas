# 🍵 TeaNote — セットアップガイド

Next.js + Supabase + Vercel で動く本格的な紅茶評価アプリです。

---

## ステップ1: Supabaseのセットアップ

### 1-1. プロジェクト作成
1. https://supabase.com にアクセスしてアカウント作成（無料）
2. 「New project」をクリック
3. プロジェクト名: `teanote`、データベースパスワードを設定して作成

### 1-2. データベースの初期化
1. Supabaseダッシュボード左メニューの「SQL Editor」を開く
2. `supabase/migrations/001_schema.sql` の内容を全てコピー
3. SQL Editorに貼り付けて「Run」を実行

### 1-3. APIキーの取得
1. 左メニューの「Project Settings」→「API」を開く
2. 以下をメモしておく:
   - **Project URL** (例: `https://xxxxxxxxxx.supabase.co`)
   - **anon public key** (長い文字列)

### 1-4. メール認証の設定
1. 左メニューの「Authentication」→「Settings」
2. 「Email」セクションで「Confirm email」を必要に応じてオフにできる（開発中はオフが便利）

---

## ステップ2: ローカル開発

```bash
# リポジトリをクローン or このフォルダをそのまま使う
cd teanote

# 依存関係をインストール
npm install

# 環境変数ファイルを作成
cp .env.local.example .env.local
```

`.env.local` を編集してSupabaseの値を入力:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

```bash
# 開発サーバー起動
npm run dev
```

http://localhost:3000 にアクセスして動作確認 ✅

---

## ステップ3: Vercelにデプロイ

### 3-1. GitHubにプッシュ
```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/あなたのID/teanote.git
git push -u origin main
```

### 3-2. Vercelでデプロイ
1. https://vercel.com にアクセスしてGitHubでログイン
2. 「New Project」→ GitHubのリポジトリを選択
3. 「Environment Variables」に以下を追加:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. 「Deploy」をクリック → 数分で公開完了！

### 3-3. SupabaseのURL設定
1. Supabase「Authentication」→「URL Configuration」
2. **Site URL**: `https://あなたのプロジェクト.vercel.app`
3. **Redirect URLs**: `https://あなたのプロジェクト.vercel.app/**`

---

## ステップ4: 管理者アカウントの設定

最初に登録したアカウントを管理者にするには:

1. Supabase「SQL Editor」で以下を実行:
```sql
update public.profiles
set is_admin = true
where id = (
  select id from auth.users where email = 'あなたのメールアドレス'
);
```

これで管理者メニューにアクセスできます。

---

## ファイル構成

```
src/
├── app/
│   ├── auth/          # ログイン・新規登録
│   ├── dashboard/
│   │   ├── page.tsx          # ダッシュボード
│   │   ├── teas/             # お茶一覧・詳細・評価
│   │   ├── reviews/          # 自分の評価一覧
│   │   ├── community/        # コミュニティ評価
│   │   └── admin/            # 管理者メニュー
│   └── globals.css
├── components/
│   ├── charts/RadarChart.tsx # レーダーチャート
│   └── layout/              # Header, Sidebar
├── lib/
│   ├── supabase.ts          # クライアントサイド用
│   └── supabase-server.ts   # サーバーサイド用
├── types/index.ts            # 型定義
└── middleware.ts             # 認証ガード

supabase/
└── migrations/001_schema.sql # DBスキーマ・初期データ
```

---

## 主な機能

| 機能 | 説明 |
|------|------|
| 認証 | Supabase Auth（メール+パスワード）|
| 茶葉管理 | 管理者が公式リスト管理、ユーザーも追加可能 |
| 評価 | 6軸スライダー入力 + レーダーチャート表示 |
| 共有 | 公開/非公開切り替え、コミュニティページで閲覧 |
| 管理者 | 茶葉削除、ユーザー一覧、集計確認 |
