# startup-finder

X (Twitter) から日本人起業家候補を自動発掘し、面談アポを取るためのツール。

## 開発サーバー
```bash
npm run dev        # port 3000
npx prisma studio  # DB確認
```

## スキーマ変更時
```bash
npx prisma migrate dev --name <変更名>
npx prisma generate
```

## 重要な設計
- ステータス: pending / scheduled / contacted / passed / hold
- 見送り理由 → プロンプト自動更新 + DevAlert（開発提案）生成
- 保留候補者 → 収集ランのたびにツイート更新・条件チェック
- 検索: Brave Search API 優先、DDG フォールバック
- 全ての重い処理（Claude 呼び出し）はバックグラウンド実行

## 主要ライブラリ
- `lib/claude.ts` — Claude API 関数群（評価・抽出・メッセージ生成・プロンプト進化等）
- `lib/x-api.ts` — X API クライアント
- `lib/prtimes.ts` — PR Times 検索（Brave/DDG）
- `lib/prisma.ts` — Prisma クライアント

## 環境変数（.env）
- ANTHROPIC_API_KEY
- X_BEARER_TOKEN
- BRAVE_SEARCH_API_KEY
- DATABASE_URL=file:./dev.db
