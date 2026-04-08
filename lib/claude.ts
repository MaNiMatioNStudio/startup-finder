import Anthropic from "@anthropic-ai/sdk";
import { searchFundingOnPRTimes } from "./prtimes";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function callClaude(prompt: string, systemPrompt?: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");
  return content.text;
}

export async function evaluateCandidate(
  evaluationPrompt: string,
  candidateData: {
    username: string;
    bio: string;
    tweets: string[];
    followersCount: number;
  }
): Promise<{
  entrepreneurScore: number;
  executionScore: number;
  marketScore: number;
  overallScore: number;
  reasoning: string;
  keySignals: string[];
}> {
  const prompt = `${evaluationPrompt}

---
評価対象:
ユーザー名: @${candidateData.username}
フォロワー数: ${candidateData.followersCount}
プロフィール: ${candidateData.bio}

最近の投稿:
${candidateData.tweets.map((t, i) => `${i + 1}. "${t}"`).join("\n")}
---

以下のJSON形式で評価結果を返してください（コードブロックなし）:
{
  "entrepreneurScore": <0-100の整数>,
  "executionScore": <0-100の整数>,
  "marketScore": <0-100の整数>,
  "overallScore": <0-100の整数>,
  "reasoning": "<200字以内の評価理由>",
  "keySignals": ["<シグナル1>", "<シグナル2>", ...]
}`;

  const result = await callClaude(prompt);
  return JSON.parse(result);
}

export async function evolvePersonaPrompt(params: {
  currentPrompt: string;
  feedbacks: Array<{
    username: string;
    score: number;
    comment?: string;
    evaluation?: { entrepreneurScore: number; executionScore: number; marketScore: number };
  }>;
  overallComment?: string;
  previousEvolutions: Array<{ changes: string; predictedImprovement: number | null; actualImprovement: number | null }>;
}): Promise<{
  reasoning: string;
  changes: Array<{ type: "add" | "remove" | "modify"; description: string }>;
  newPromptContent: string;
  predictedImprovement: number;
}> {
  const feedbackSummary = params.feedbacks
    .map(
      (f) =>
        `@${f.username}: スコア${f.score}/5${f.comment ? ` — "${f.comment}"` : ""}` +
        (f.evaluation
          ? ` (起業確度:${f.evaluation.entrepreneurScore} 実行力:${f.evaluation.executionScore} 市場性:${f.evaluation.marketScore})`
          : "")
    )
    .join("\n");

  const avgScore =
    params.feedbacks.reduce((sum, f) => sum + f.score, 0) / params.feedbacks.length;

  const evolutionHistory =
    params.previousEvolutions.length > 0
      ? params.previousEvolutions
          .map(
            (e) =>
              `- ${e.changes} → 実際の改善: ${e.actualImprovement !== null ? `${e.actualImprovement > 0 ? "+" : ""}${e.actualImprovement.toFixed(1)}%` : "未計測"}`
          )
          .join("\n")
      : "なし";

  const systemPrompt = `あなたは起業家発掘AIシステムの「自律改善エンジン」です。
人間のスコアリングフィードバックを分析し、探索プロンプトを改善します。
重要: あなたは提案するだけでなく、自律的に判断して実際に新しいプロンプトを生成します。`;

  const prompt = `現在の探索プロンプト:
---
${params.currentPrompt}
---

今週のフィードバック (平均スコア: ${avgScore.toFixed(1)}/5):
${feedbackSummary}

全体コメント: ${params.overallComment || "なし"}

過去の進化履歴:
${evolutionHistory}

---
上記のシグナルを分析し、以下を実行してください:

1. スコアの高い候補と低い候補のパターンを分析
2. 何が機能していて何が機能していないかを推論
3. プロンプトの具体的な改善案を決定
4. 改善後の新しい完全なプロンプトを生成

以下のJSON形式で返してください（コードブロックなし）:
{
  "reasoning": "<AIの詳細な思考過程。パターン分析、仮説、なぜこの変更をするかの説明。300字以上>",
  "changes": [
    {"type": "add", "description": "<追加した内容>"},
    {"type": "remove", "description": "<削除した内容>"},
    {"type": "modify", "description": "<変更した内容>"}
  ],
  "newPromptContent": "<改善後の完全なプロンプトテキスト>",
  "predictedImprovement": <予測改善率。-10〜+30の数値>
}`;

  const result = await callClaude(prompt, systemPrompt);
  return JSON.parse(result);
}

export async function extractCandidatesFromText(
  extractionPrompt: string,
  personaPrompt: string,
  postsText: string
): Promise<string[]> {
  const prompt = `${extractionPrompt}

探索しているペルソナ:
${personaPrompt}

---
分析対象の投稿・プロフィール情報:
${postsText}
---

起業家候補として抽出すべきユーザーのXユーザー名リストをJSON配列で返してください（コードブロックなし）。
例: ["username1", "username2"]
候補がいない場合は空配列: []`;

  const result = await callClaude(prompt);
  return JSON.parse(result);
}

export interface OutreachSource {
  type: "bio" | "tweet";
  content: string;
  reason: string;
}

export async function generateOutreachMessage(params: {
  templateContent: string;
  candidate: {
    username: string;
    displayName: string | null;
    bio: string | null;
    tweets: string[];
  };
  pastEditedMessages: Array<{ generated: string; edited: string }>;
}): Promise<{ message: string; sources: OutreachSource[] }> {
  const tweetsText = params.candidate.tweets.map((t, i) => `[投稿${i + 1}] ${t}`).join("\n");
  const learningContext =
    params.pastEditedMessages.length > 0
      ? "\n\n## 過去の修正事例（参考にしてください）\n" +
        params.pastEditedMessages
          .map((m, i) => `### 事例${i + 1}\n生成: ${m.generated}\n修正後: ${m.edited}`)
          .join("\n\n")
      : "";

  const systemPrompt = params.templateContent + learningContext;
  const prompt = `以下の起業家に面談申込DMを作成してください。

## 対象者
ユーザー名: @${params.candidate.username}
名前: ${params.candidate.displayName ?? "不明"}
プロフィール: ${params.candidate.bio ?? "なし"}

## 投稿サンプル
${tweetsText || "なし"}

---
以下のJSON形式で返してください（コードブロックなし）:
{
  "message": "<200〜300字のDM本文>",
  "sources": [
    {"type": "bio" or "tweet", "content": "<参照した具体的なテキスト>", "reason": "<なぜこの情報に言及したか>"}
  ]
}`;

  const result = await callClaude(prompt, systemPrompt);
  return JSON.parse(result);
}

export type FundingRound = "未調達" | "シード" | "プレシリーズA" | "シリーズA" | "シリーズB以降" | "不明";

export async function extractCompanyAndFunding(params: {
  username: string;
  bio: string | null;
  tweets: string[];
}): Promise<{
  companyName: string | null;
  fundingRound: FundingRound | null;
  fundingAmount: string | null;
  reasoning: string;
}> {
  const tweetsText = params.tweets.slice(0, 10).map((t, i) => `[${i + 1}] ${t}`).join("\n");

  // Step 1: Extract company name with Claude
  const companyNameResult = JSON.parse(
    await callClaude(`以下のXユーザーのプロフィールと投稿から、このユーザーが創業・運営している会社名を抽出してください。

ユーザー名: @${params.username}
プロフィール: ${params.bio ?? "なし"}
投稿サンプル:
${tweetsText || "なし"}

ルール:
- プロフィールに明記されている場合のみ抽出（推測不可）
- 「株式会社〇〇」などの正式社名を優先。通称・サービス名でも可
- 複数ある場合は最も重要そうなもの1つ
- なければ null

JSON形式で返してください（コードブロックなし）:
{"companyName": "<会社名またはnull>"}`)
  ) as { companyName: string | null };

  const companyName = companyNameResult.companyName;

  if (!companyName) {
    return {
      companyName: null,
      fundingRound: null,
      fundingAmount: null,
      reasoning: "プロフィールから会社名を特定できませんでした",
    };
  }

  // Step 2: Search PR TIMES via DuckDuckGo
  const prTimesText = await searchFundingOnPRTimes(companyName);

  // Step 3: Classify funding round from search results
  const classifyResult = JSON.parse(
    await callClaude(`以下はDuckDuckGoで「site:prtimes.jp "${companyName}" 資金調達」を検索した結果です。
この結果をもとに「${companyName}」の資金調達状況を判定してください。

## 検索結果
${prTimesText || "該当なし（PR TIMESに資金調達記事が見つからなかった）"}

## 判定ルール
- シード/プレシリーズA/シリーズA/B以降の記載がある → 該当ラウンドを返す
- 調達した旨はあるがラウンドが不明 → "不明"
- PR TIMESに記事がない → "不明"（調達していない可能性もある）
- 起業しているが外部調達していないと明確に読める → "未調達"

ラウンドの選択肢: "未調達" | "シード" | "プレシリーズA" | "シリーズA" | "シリーズB以降" | "不明"
調達額: 検索結果に金額の記載がある場合のみ（「X億円」「X万円」形式）

JSON形式で返してください（コードブロックなし）:
{
  "fundingRound": "<ラウンド>",
  "fundingAmount": "<調達額またはnull>",
  "reasoning": "<判断根拠（80字以内）>"
}`)
  ) as { fundingRound: FundingRound; fundingAmount: string | null; reasoning: string };

  return {
    companyName,
    fundingRound: classifyResult.fundingRound,
    fundingAmount: classifyResult.fundingAmount,
    reasoning: classifyResult.reasoning,
  };
}

export async function analyzeDevNeed(params: {
  reason: string;
  username: string;
}): Promise<{
  needsDev: boolean;
  devDescription: string | null;
  claudeCodePrompt: string | null;
}> {
  const systemCapabilities = `
## 現在のシステムの機能
- X (Twitter) API でツイート検索 → Claude が起業家候補を抽出
- Claude がペルソナ・抽出・評価の3つのプロンプトで候補者をスコアリング
- PR Times + Brave Search で資金調達情報を自動検索・タグ付け
- ステータス管理: コンタクト予定 / コンタクト済 / 見送り / 保留（条件付きアラート）
- 見送り・コンタクト予定の理由 → 自動でプロンプトを更新（定性フィードバック）
- アウトリーチメッセージの自動生成・学習
- フォロワー数・AIスコア・調達ラウンドでのフィルタリング
- プロンプトの進化履歴の管理
- ペルソナからX検索クエリを自動生成して候補者を自動収集`;

  const result = await callClaude(`起業家発掘システムで、ある候補者を「見送り」にした理由を分析してください。

## 見送りにした候補者
@${params.username}

## 見送り理由
"${params.reason}"

${systemCapabilities}

---
この見送り理由を分析し、以下を判断してください:

**プロンプト改善だけで解決できる問題** (needsDev: false):
- 抽出基準・評価軸の調整
- 検索クエリの改善
- ペルソナ定義の修正
→ これらは既に自動でプロンプト更新済みのため、追加開発不要

**開発が必要な問題** (needsDev: true):
- 現在存在しない新しいデータソースの取得（例: LinkedIn、GitHub活動）
- 現在UIにない新しいフィルタ・ソート条件
- 外部サービス連携（例: Crunchbase、資本政策ツール）
- 自動化・スケジューリングの仕組み
- その他、コードを書かないと解決できない課題

JSON形式で返してください（コードブロックなし）:
{
  "needsDev": true または false,
  "devDescription": "<開発が必要な場合のみ: 何を作るべきかの説明（100字以内）。不要な場合はnull>",
  "claudeCodePrompt": "<開発が必要な場合のみ: Claude Codeに貼り付けて実装を依頼するためのプロンプト文章（日本語、具体的な実装指示）。不要な場合はnull>"
}`);

  return JSON.parse(result) as { needsDev: boolean; devDescription: string | null; claudeCodePrompt: string | null };
}

export async function checkHoldCondition(params: {
  username: string;
  holdReason: string;
  latestTweets: string[];
  bio: string | null;
}): Promise<{ conditionMet: boolean; alertText: string | null }> {
  const tweetsText = params.latestTweets.slice(0, 10).map((t, i) => `[${i + 1}] ${t}`).join("\n");

  const result = await callClaude(`以下の起業家候補を「保留」にした理由と、その後の最新投稿・プロフィールを確認してください。

## 保留にした理由（解除条件）
${params.holdReason}

## 対象者
@${params.username}
プロフィール: ${params.bio ?? "なし"}

## 最新投稿（直近）
${tweetsText || "なし"}

---
「保留の解除条件」が満たされつつある予兆・変化が最新情報に見られますか？

判断基準:
- 条件が明確に満たされた → conditionMet: true
- 予兆・変化の兆しがある → conditionMet: true（アラートを出す価値あり）
- 特に変化なし → conditionMet: false

JSON形式で返してください（コードブロックなし）:
{
  "conditionMet": true または false,
  "alertText": "<条件が満たされた/予兆がある場合のみ: 何が変化したかの簡潔な説明（60字以内）。なければnull>"
}`);

  const parsed = JSON.parse(result) as { conditionMet: boolean; alertText: string | null };
  return parsed;
}

export async function generateSearchQueries(personaPrompt: string): Promise<string[]> {
  const result = await callClaude(`あなたはTwitter/X APIの検索クエリを生成する専門家です。
以下の「探索対象ペルソナ」に合致する起業家・スタートアップ創業者を見つけるための、X API検索クエリを生成してください。

## 探索対象ペルソナ
${personaPrompt}

## X API検索クエリのルール
- 日本語ユーザーを対象にするため "lang:ja" を必ず含める
- リツイートを除外するため "-is:retweet" を必ず含める
- 返信を除外するため "-is:reply" を含める
- ペルソナに合致するキーワードをOR演算子で組み合わせる
- クエリは具体的すぎず、抽象的すぎず（10〜50件/日程度のツイートがヒットする粒度）
- 3〜5個のクエリを生成する（互いに異なる切り口で）

## 例
- "プロダクト MRR 公開 lang:ja -is:retweet -is:reply"
- "SaaS 起業 エンジニア 開発中 lang:ja -is:retweet -is:reply"
- "スタートアップ 創業 資金調達 lang:ja -is:retweet -is:reply"

JSON配列で返してください（コードブロックなし）:
["<クエリ1>", "<クエリ2>", "<クエリ3>"]`);

  return JSON.parse(result) as string[];
}

export async function applyQualitativeFeedback(params: {
  feedback: string;
  personaPrompt: string;
  extractionPrompt: string;
  evaluationPrompt: string;
}): Promise<{
  reasoning: string;
  changes: Array<{ type: "add" | "remove" | "modify"; description: string; target: "persona" | "extraction" | "evaluation" }>;
  newPersonaContent: string;
  newExtractionContent: string;
  newEvaluationContent: string;
  predictedImprovement: number;
}> {
  const systemPrompt = `あなたは起業家発掘AIシステムの「自律改善エンジン」です。
ユーザーからの定性的なフィードバックをもとに、探索・抽出・評価の3つのプロンプトを同時に改善します。
重要: あなたは提案するだけでなく、自律的に判断して実際に新しいプロンプトを生成します。`;

  const prompt = `## 現在のプロンプト

### 探索プロンプト (persona)
---
${params.personaPrompt}
---

### 抽出プロンプト (extraction)
---
${params.extractionPrompt}
---

### 評価プロンプト (evaluation)
---
${params.evaluationPrompt}
---

## ユーザーからの定性的フィードバック
"${params.feedback}"

---
上記のフィードバックを分析し、3つのプロンプトのうち影響を受けるものを改善してください。
変更不要なプロンプトは現状のまま返してください。

以下のJSON形式で返してください（コードブロックなし）:
{
  "reasoning": "<フィードバックの解釈と、各プロンプトへの影響分析。なぜその変更をするかの説明（300字以上）>",
  "changes": [
    {"type": "add"|"remove"|"modify", "description": "<変更内容>", "target": "persona"|"extraction"|"evaluation"}
  ],
  "newPersonaContent": "<改善後の完全なpersonaプロンプト>",
  "newExtractionContent": "<改善後の完全なextractionプロンプト>",
  "newEvaluationContent": "<改善後の完全なevaluationプロンプト>",
  "predictedImprovement": <予測改善率。-10〜+30の数値>
}`;

  const result = await callClaude(prompt, systemPrompt);
  return JSON.parse(result);
}

export async function evolveMessageTemplate(params: {
  currentTemplate: string;
  editedMessages: Array<{ generated: string; edited: string; candidateName: string }>;
}): Promise<{
  reasoning: string;
  newTemplateContent: string;
  changes: Array<{ type: "add" | "remove" | "modify"; description: string }>;
}> {
  const examples = params.editedMessages
    .map((m, i) => `### 修正例${i + 1}（@${m.candidateName}）\n生成: ${m.generated}\n修正後: ${m.edited}`)
    .join("\n\n");

  const prompt = `現在のメッセージ生成テンプレート:
---
${params.currentTemplate}
---

ユーザーが修正したDMの事例:
${examples}

修正パターンを分析しテンプレートを改善してください（コードブロックなし）:
{
  "reasoning": "<修正パターンから読み取れた傾向と改善根拠（200字以上）>",
  "newTemplateContent": "<改善後の完全なテンプレート>",
  "changes": [{"type": "add"|"remove"|"modify", "description": "<変更内容>"}]
}`;

  const result = await callClaude(prompt);
  return JSON.parse(result);
}

export async function applyMessageTemplateFeedback(params: {
  feedback: string;
  currentTemplate: string;
}): Promise<{
  reasoning: string;
  newTemplateContent: string;
  changes: Array<{ type: "add" | "remove" | "modify"; description: string }>;
}> {
  const prompt = `現在のメッセージ生成テンプレート:
---
${params.currentTemplate}
---

ユーザーからの定性的フィードバック:
"${params.feedback}"

このフィードバックをテンプレートの共通ルールとして組み込み、改善してください（コードブロックなし）:
{
  "reasoning": "<フィードバックの解釈と、テンプレートへの反映方針（200字以上）>",
  "newTemplateContent": "<改善後の完全なテンプレート>",
  "changes": [{"type": "add"|"remove"|"modify", "description": "<変更内容>"}]
}`;

  const result = await callClaude(prompt);
  return JSON.parse(result);
}
