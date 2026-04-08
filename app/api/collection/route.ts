import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSearchQueries, extractCandidatesFromText, evaluateCandidate, extractCompanyAndFunding, checkHoldCondition } from "@/lib/claude";
import { searchRecentTweets, getUserByUsername, getUserTweets } from "@/lib/x-api";

// GET: コレクション実行履歴とステータスを返す
export async function GET() {
  const [recentRuns, totalCandidates, weeklyCount] = await Promise.all([
    prisma.collectionRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 5,
    }),
    prisma.candidate.count(),
    prisma.candidate.count({
      where: {
        discoveredAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  return NextResponse.json({ recentRuns, totalCandidates, weeklyCount });
}

// POST: 自動コレクションを実行
export async function POST() {
  if (!process.env.X_BEARER_TOKEN) {
    return NextResponse.json({ error: "X_BEARER_TOKEN が設定されていません" }, { status: 400 });
  }

  // 実行中のランがある場合はスキップ
  const running = await prisma.collectionRun.findFirst({
    where: { status: "running" },
    orderBy: { startedAt: "desc" },
  });
  if (running) {
    return NextResponse.json({ error: "コレクションが実行中です" }, { status: 409 });
  }

  const [activePersona, activeExtraction, activeEval] = await Promise.all([
    prisma.personaPrompt.findFirst({ where: { isActive: true } }),
    prisma.extractionPrompt.findFirst({ where: { isActive: true } }),
    prisma.evaluationPrompt.findFirst({ where: { isActive: true } }),
  ]);

  if (!activePersona || !activeExtraction) {
    return NextResponse.json({ error: "有効なプロンプトがありません" }, { status: 400 });
  }

  // CollectionRun レコードを作成（running 状態）
  const run = await prisma.collectionRun.create({
    data: { queriesUsed: "[]" },
  });

  // バックグラウンドで実行（レスポンスは即時返す）
  runCollection(run.id, activePersona.id, activePersona.content, activeExtraction.id, activeExtraction.content, activeEval?.id ?? null, activeEval?.content ?? null).catch(
    async (err) => {
      await prisma.collectionRun.update({
        where: { id: run.id },
        data: { status: "failed", errors: JSON.stringify([String(err)]), completedAt: new Date() },
      });
    }
  );

  return NextResponse.json({ runId: run.id, status: "started" });
}

async function runCollection(
  runId: string,
  personaId: string,
  personaContent: string,
  extractionId: string,
  extractionContent: string,
  evalId: string | null,
  evalContent: string | null
) {
  const errors: string[] = [];
  let tweetsFound = 0;
  let candidatesAdded = 0;
  let candidatesSkipped = 0;

  // Step 1: ペルソナからX検索クエリを生成
  let queries: string[] = [];
  try {
    queries = await generateSearchQueries(personaContent);
  } catch (err) {
    queries = [
      "プロダクト MRR 公開 lang:ja -is:retweet -is:reply",
      "SaaS 起業 エンジニア 開発中 lang:ja -is:retweet -is:reply",
      "スタートアップ 創業 自社プロダクト lang:ja -is:retweet -is:reply",
    ];
    errors.push(`クエリ生成エラー: ${err}`);
  }

  await prisma.collectionRun.update({
    where: { id: runId },
    data: { queriesUsed: JSON.stringify(queries) },
  });

  // Step 2: 各クエリで X 検索
  const allTweets: Array<{ text: string; authorUsername?: string }> = [];
  for (const query of queries) {
    try {
      // 前回の差分取得トークンを取得
      const lastFetch = await prisma.xFetchLog.findFirst({
        where: { query },
        orderBy: { fetchedAt: "desc" },
      });

      const result = await searchRecentTweets(query, lastFetch?.nextToken ?? undefined);

      const userMap = new Map<string, string>(
        (result.userObjects ?? []).map((u) => [u.id, u.username])
      );

      const tweets = result.tweets.map((t) => ({
        text: t.text,
        authorUsername: t.authorId ? userMap.get(t.authorId) : undefined,
      }));

      allTweets.push(...tweets);
      tweetsFound += tweets.length;

      await prisma.xFetchLog.create({
        data: { query, resultCount: tweets.length, nextToken: result.nextToken ?? null },
      });

      // クエリ間のウェイト（X API レート制限対策）
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      errors.push(`クエリ「${query}」エラー: ${err}`);
    }
  }

  if (allTweets.length === 0) {
    await prisma.collectionRun.update({
      where: { id: runId },
      data: {
        status: errors.length > 0 ? "failed" : "completed",
        tweetsFound: 0,
        candidatesAdded: 0,
        candidatesSkipped: 0,
        errors: errors.length > 0 ? JSON.stringify(errors) : null,
        completedAt: new Date(),
      },
    });
    return;
  }

  // Step 3: Claude で候補者ユーザー名を抽出
  let candidateUsernames: string[] = [];
  try {
    const postsText = allTweets.map((t) => `@${t.authorUsername ?? "unknown"}: ${t.text}`).join("\n\n");
    candidateUsernames = await extractCandidatesFromText(extractionContent, personaContent, postsText);
  } catch (err) {
    errors.push(`候補者抽出エラー: ${err}`);
    // ツイート著者をフォールバックとして使用
    const authorUsernames = [...new Set(allTweets.map((t) => t.authorUsername).filter((u): u is string => !!u))];
    candidateUsernames = authorUsernames.slice(0, 10);
  }

  // 著者も候補に含める（重複除去）
  const authorUsernames = [...new Set(allTweets.map((t) => t.authorUsername).filter((u): u is string => !!u))];
  const allCandidateUsernames = [...new Set([...candidateUsernames, ...authorUsernames.slice(0, 5)])];

  // Step 4: 各候補者のプロフィール取得・評価・保存（最大20人）
  for (const username of allCandidateUsernames.slice(0, 20)) {
    try {
      const existing = await prisma.candidate.findUnique({ where: { xUsername: username } });
      if (existing) {
        candidatesSkipped++;
        continue;
      }

      const user = await getUserByUsername(username);
      const rawTweets = user ? await getUserTweets(user.id, 15) : [];
      const tweets = rawTweets.map((t) => t.text);

      const candidate = await prisma.candidate.create({
        data: {
          xUsername: username,
          xId: user?.id ?? null,
          displayName: user?.name ?? null,
          bio: user?.description ?? null,
          followersCount: user?.public_metrics?.followers_count ?? null,
          sampleTweets: JSON.stringify(
            tweets.length > 0
              ? tweets
              : allTweets.filter((t) => t.authorUsername === username).map((t) => t.text)
          ),
          personaPromptId: personaId,
          extractionPromptId: extractionId,
          lastFetchedAt: new Date(),
        },
      });

      // 自動評価
      if (evalId && evalContent && (tweets.length > 0 || user?.description)) {
        try {
          const evalResult = await evaluateCandidate(evalContent, {
            username,
            bio: user?.description ?? "",
            tweets,
            followersCount: user?.public_metrics?.followers_count ?? 0,
          });

          await prisma.candidateEvaluation.create({
            data: {
              candidateId: candidate.id,
              entrepreneurScore: evalResult.entrepreneurScore,
              executionScore: evalResult.executionScore,
              marketScore: evalResult.marketScore,
              overallScore: evalResult.overallScore,
              reasoning: evalResult.reasoning,
              keySignals: JSON.stringify(evalResult.keySignals),
              evaluationPromptId: evalId,
            },
          });
        } catch {
          // 評価失敗は無視（後から手動評価可能）
        }
      }

      candidatesAdded++;

      // 調達情報を自動取得（エラーは無視して続行）
      try {
        const tweets = rawTweets.map((t) => t.text);
        const fundingResult = await extractCompanyAndFunding({
          username,
          bio: user?.description ?? null,
          tweets,
        });
        await prisma.candidate.update({
          where: { id: candidate.id },
          data: {
            companyName: fundingResult.companyName,
            fundingRound: fundingResult.fundingRound,
            fundingAmount: fundingResult.fundingAmount,
            fundingCheckedAt: new Date(),
          },
        });
      } catch { /* 調達情報取得失敗は無視 */ }

      // X API + Claude のレート制限対策
      await new Promise((r) => setTimeout(r, 3000));
    } catch (err) {
      errors.push(`@${username} の処理エラー: ${err}`);
    }
  }

  // Step 5: 保留候補者の情報更新 & 条件チェック
  if (process.env.X_BEARER_TOKEN) {
    const holdCandidates = await prisma.candidate.findMany({
      where: { status: "hold", holdReason: { not: null } },
      select: { id: true, xUsername: true, xId: true, bio: true, holdReason: true },
    });

    for (const hold of holdCandidates) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        let latestTweets: string[] = [];
        if (hold.xId) {
          const rawTweets = await getUserTweets(hold.xId, 10);
          latestTweets = rawTweets.map((t) => t.text);
          if (latestTweets.length > 0) {
            await prisma.candidate.update({
              where: { id: hold.id },
              data: { sampleTweets: JSON.stringify(latestTweets), lastFetchedAt: new Date() },
            });
          }
        }

        const result = await checkHoldCondition({
          username: hold.xUsername,
          holdReason: hold.holdReason!,
          latestTweets,
          bio: hold.bio,
        });

        await prisma.candidate.update({
          where: { id: hold.id },
          data: {
            holdCheckedAt: new Date(),
            ...(result.conditionMet && {
              holdAlertAt: new Date(),
              holdAlertText: result.alertText,
            }),
          },
        });
      } catch { /* 保留チェック失敗は無視 */ }
    }
  }

  await prisma.collectionRun.update({
    where: { id: runId },
    data: {
      status: "completed",
      tweetsFound,
      candidatesAdded,
      candidatesSkipped,
      errors: errors.length > 0 ? JSON.stringify(errors) : null,
      completedAt: new Date(),
    },
  });
}
