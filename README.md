# Startup Finder

プロンプト駆動型の起業家候補発掘・自律改善システム。

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

```bash
cp .env.example .env
```

`.env` に以下を設定してください:

```
ANTHROPIC_API_KEY=sk-ant-...      # Claude API キー
X_BEARER_TOKEN=...                 # X (Twitter) API Bearer Token
```

### 3. データベースの初期化

```bash
npx prisma migrate dev
```

### 4. 開発サーバー起動

```bash
npm run dev
```

### 5. 初期データの作成

ブラウザで http://localhost:3000 を開き、「初期データを作成する」ボタンを押してください。

## 使い方

### 基本フロー

1. **Candidates** ページで起業家候補を追加（手動 or X API）
2. **Candidates** の候補を「AIで評価する」
3. **Scoring** ページで候補に 1〜5 のスコアを付ける（任意でコメント）
4. 「スコアを送信してシステムに考えさせる」を押す
5. 「プロンプト進化を実行する」→ AI が自律的にパターンを分析してプロンプトを改善
6. **Evolution** で AI の思考過程を確認
7. **History** でバージョン間のパフォーマンスを比較

### X API を使った自動発掘

```
POST /api/x/fetch
{ "query": "MRR SaaS lang:ja" }
```

### ページ構成

| ページ | 機能 |
|--------|------|
| `/` | ダッシュボード |
| `/personas` | Persona Prompt のバージョン管理・編集 |
| `/candidates` | 候補一覧・詳細・手動追加 |
| `/scoring` | スコアリング → プロンプト進化トリガー |
| `/evolution` | 進化ログと AI 思考過程 |
| `/history` | バージョン比較・精度推移 |

## コスト目安（月額）

| 項目 | 金額 |
|------|------|
| Claude API（週次進化×4回、評価×50名） | ~¥500〜2,000 |
| X API Basic | $100/月 (~¥15,000) |
| 合計 | ~¥15,000以内 |

## API エンドポイント

```
POST /api/seed                      # 初期データ作成
GET  /api/personas                  # ペルソナ一覧
POST /api/personas                  # 新バージョン作成
POST /api/personas/[id]/activate    # バージョン有効化
GET  /api/candidates                # 候補一覧
POST /api/candidates/manual         # 手動追加（X API + AI評価）
POST /api/candidates/[id]/evaluate  # AI評価
GET  /api/scoring                   # 未スコア候補取得
POST /api/scoring                   # スコアバッチ送信
GET  /api/evolution                 # 進化履歴
POST /api/evolution                 # 進化実行
POST /api/x/fetch                   # X API から候補を自動発掘
```
