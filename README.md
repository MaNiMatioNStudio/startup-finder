# Startup Finder

X (Twitter) のアルゴリズムを AI で自律改善し、起業家・スタートアップ関連アカウントをタイムラインに最適化するツール。

## 概要

参照アカウント（お手本となる起業家）を起点に、フォロワーを探索して起業家候補を発掘します。
Claude AI が投稿スコアとフィードバックを分析し、フォロー・いいね戦略を自動生成。
実行 → 評価 → 戦略進化のループを繰り返すことで、X のタイムラインを継続的に改善します。

## 主な機能

| タブ | 機能 |
|------|------|
| **References** | 参照アカウントの追加・削除。AI による新規アカウント提案 |
| **Discovery** | 参照アカウントのフォロワーを探索。Claude が起業家候補を抽出し、カード UI で評価（キーボード操作対応） |
| **Session** | 戦略に基づいてフォロー・いいねを一括実行。実行ログを記録 |
| **Timeline** | 参照アカウントの投稿を取得し 0〜10 でスコアリング |
| **Strategy** | スコアとフィードバックから Claude が新戦略を生成・バージョン管理 |

## ディレクトリ構成

```
startup-finder/
├── app/
│   ├── layout.tsx                  # ルートレイアウト（サイドバー含む）
│   ├── training-account/
│   │   └── page.tsx                # メインダッシュボード（5タブ）
│   └── api/
│       ├── auth/x/                 # X OAuth2 認証（PKCE）
│       └── training-account/       # 各機能の API ルート
├── components/
│   ├── Sidebar.tsx
│   ├── ScoreBar.tsx
│   └── ScoreStars.tsx
├── lib/
│   ├── claude.ts                   # Claude API クライアント
│   ├── x-api.ts                    # X API v2 クライアント
│   ├── x-auth.ts                   # OAuth2 トークン管理・自動更新
│   └── prisma.ts                   # Prisma クライアント
├── prisma/
│   ├── schema.prisma               # DB スキーマ（SQLite）
│   └── migrations/                 # マイグレーション履歴
├── .env.example                    # 環境変数のテンプレート
└── CLAUDE.md                       # 開発ガイドライン
```

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

```bash
cp .env.example .env
```

`.env` に必要なキーを設定してください（[環境変数](#環境変数) を参照）。

### 3. データベースの初期化

```bash
npx prisma migrate dev
```

### 4. 開発サーバーの起動

```bash
npm run dev
# → http://localhost:3000
```

## 環境変数

`.env.example` をコピーして `.env` を作成し、以下の値を設定してください。

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `DATABASE_URL` | ✅ | SQLite ファイルパス（例: `file:./dev.db`） |
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API キー（[console.anthropic.com](https://console.anthropic.com)） |
| `X_BEARER_TOKEN` | ✅ | X API v2 Bearer Token（アプリ認証・フォロワー取得用） |
| `X_CLIENT_ID` | ✅ | X OAuth2 クライアント ID（ユーザー認証用） |
| `X_CLIENT_SECRET` | ✅ | X OAuth2 クライアントシークレット |
| `X_CALLBACK_URL` | ✅ | OAuth2 コールバック URL（例: `http://localhost:3000/api/auth/x/callback`） |
| `X_API_KEY` | — | X API v1 キー（使用機能に応じて設定） |
| `X_API_SECRET` | — | X API v1 シークレット |
| `X_ACCESS_TOKEN` | — | X アクセストークン |
| `X_ACCESS_TOKEN_SECRET` | — | X アクセストークンシークレット |
| `BRAVE_SEARCH_API_KEY` | — | Brave Search API キー（省略時は DuckDuckGo にフォールバック） |

## 実行方法

### 開発サーバー

```bash
npm run dev
```

### DB の確認（Prisma Studio）

```bash
npx prisma studio
# → http://localhost:5555
```

### ビルド

```bash
npm run build
npm run start
```

### スキーマ変更時

```bash
npx prisma migrate dev --name <変更名>
npx prisma generate
```

## 基本的な使い方

1. **X アカウント連携** — サイドバーの「Connect X Account」から OAuth2 認証
2. **References に追加** — お手本にしたい起業家のアカウントを登録
3. **Discovery で探索** — 参照アカウントのフォロワーから起業家候補を発掘・評価
4. **Timeline をスコアリング** — 参照アカウントの投稿に 0〜10 のスコアをつける
5. **Strategy を進化** — Claude がスコアパターンを分析して戦略を自動生成
6. **Session を実行** — 戦略に基づいてフォロー・いいねを一括実行
7. **繰り返す** — 実行結果を評価し戦略を更新してループ

## 注意事項

- X API の利用には **Basic プラン（$100/月）以上** が必要です
- Claude API の呼び出しはバッチ処理（50件ずつ）でコストを抑えています
- フォロー・いいねの実行前に、X API のレート制限（15分ごとのリセット）に注意してください
- OAuth2 のアクセストークンは自動更新されますが、再認証が必要になる場合があります
- ローカル開発で ngrok などのトンネリングを使う場合、`X_CALLBACK_URL` をトンネル URL に合わせてください
