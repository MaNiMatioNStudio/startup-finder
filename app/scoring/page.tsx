"use client";

import { useEffect, useState } from "react";
import { ScoreStars } from "@/components/ScoreStars";
import { ScoreBar } from "@/components/ScoreBar";

interface Candidate {
  id: string;
  xUsername: string;
  displayName: string | null;
  bio: string | null;
  sampleTweets: string | null;
  followersCount: number | null;
  evaluation: {
    entrepreneurScore: number;
    executionScore: number;
    marketScore: number;
    overallScore: number;
    reasoning: string;
    keySignals: string;
  } | null;
}

interface ScoreEntry {
  candidateId: string;
  score: number;
  comment: string;
}

export default function ScoringPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [scores, setScores] = useState<Record<string, ScoreEntry>>({});
  const [overallComment, setOverallComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [evolving, setEvolving] = useState(false);
  const [evolutionResult, setEvolutionResult] = useState<{
    reasoning: string;
    changes: Array<{ type: string; description: string }>;
    predictedImprovement: number;
    newPersona: { version: string };
  } | null>(null);

  useEffect(() => {
    fetch("/api/scoring")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCandidates(data);
      });
  }, []);

  function setScore(candidateId: string, score: number) {
    setScores((prev) => ({
      ...prev,
      [candidateId]: { candidateId, score, comment: prev[candidateId]?.comment ?? "" },
    }));
  }

  function setComment(candidateId: string, comment: string) {
    setScores((prev) => ({
      ...prev,
      [candidateId]: { ...prev[candidateId], comment },
    }));
  }

  async function handleSubmit() {
    const entries = Object.values(scores).filter((s) => s.score > 0);
    if (entries.length === 0) return;

    setSubmitting(true);
    const res = await fetch("/api/scoring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scores: entries,
        overallComment: overallComment || undefined,
      }),
    });

    if (res.ok) {
      setSubmitted(true);
    }
    setSubmitting(false);
  }

  async function handleEvolve() {
    setEvolving(true);
    const res = await fetch("/api/evolution", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    if (res.ok) {
      const data = await res.json();
      setEvolutionResult(data);
    }
    setEvolving(false);
  }

  const scoredCount = Object.values(scores).filter((s) => s.score > 0).length;

  if (candidates.length === 0) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Scoring</h1>
        <p className="text-gray-500 text-sm mb-8">候補を評価してプロンプトを改善する</p>
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <div className="text-gray-400 text-4xl mb-4">★</div>
          <div className="text-gray-600 font-medium mb-2">評価待ちの候補はありません</div>
          <div className="text-gray-400 text-sm">
            候補ページから候補を追加し、AIスコアリングを実行してください。
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Scoring</h1>
        <p className="text-gray-500 text-sm mt-1">候補を評価してプロンプトを改善する</p>
      </div>

      {!submitted ? (
        <>
          <div className="space-y-4 mb-6">
            {candidates.map((c) => {
              const entry = scores[c.id];
              const tweets = c.sampleTweets ? (JSON.parse(c.sampleTweets) as string[]) : [];

              return (
                <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold">@{c.xUsername}</div>
                      {c.displayName && <div className="text-sm text-gray-500">{c.displayName}</div>}
                      {c.bio && <div className="text-sm text-gray-600 mt-1 line-clamp-2">{c.bio}</div>}
                    </div>
                    <a
                      href={`https://x.com/${c.xUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-500 hover:underline shrink-0 ml-4"
                    >
                      X →
                    </a>
                  </div>

                  {/* AI scores */}
                  {c.evaluation && (
                    <div className="mb-3 p-3 bg-gray-50 rounded-lg space-y-1.5">
                      <ScoreBar label="起業確度" score={c.evaluation.entrepreneurScore} color="bg-indigo-400" />
                      <ScoreBar label="実行力" score={c.evaluation.executionScore} color="bg-emerald-400" />
                      <ScoreBar label="市場性" score={c.evaluation.marketScore} color="bg-amber-400" />
                    </div>
                  )}

                  {/* Sample tweets */}
                  {tweets.length > 0 && (
                    <div className="mb-3 space-y-1">
                      {tweets.slice(0, 2).map((t, i) => (
                        <div key={i} className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1.5 line-clamp-2">
                          {t}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Human score input */}
                  <div className="border-t border-gray-100 pt-3">
                    <div className="flex items-center gap-4 mb-2">
                      <span className="text-sm font-medium text-gray-700">あなたのスコア:</span>
                      <ScoreStars
                        value={entry?.score ?? 0}
                        onChange={(v) => setScore(c.id, v)}
                      />
                    </div>
                    <input
                      type="text"
                      value={entry?.comment ?? ""}
                      onChange={(e) => setComment(c.id, e.target.value)}
                      placeholder="コメント (任意): 例「技術力は高いが市場が小さすぎる」"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Overall comment */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              全体へのコメント (任意)
            </label>
            <textarea
              value={overallComment}
              onChange={(e) => setOverallComment(e.target.value)}
              rows={3}
              placeholder="例:「AI系ツールが多すぎる。もっとBtoB SaaSに絞りたい」「MRR言及がある人は全員良かった」"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">{scoredCount}/{candidates.length}名にスコアを付けました</span>
            <button
              onClick={handleSubmit}
              disabled={scoredCount === 0 || submitting}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? "送信中..." : "スコアを送信してシステムに考えさせる →"}
            </button>
          </div>
        </>
      ) : (
        /* After submission: show evolution option */
        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-xl p-5">
            <div className="text-green-800 font-semibold mb-1">スコアを受け取りました</div>
            <div className="text-green-600 text-sm">
              {scoredCount}名分のフィードバックを記録しました。次のステップとして、AIにプロンプトの進化を実行させることができます。
            </div>
          </div>

          {!evolutionResult ? (
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
              <div className="text-3xl mb-3">⟳</div>
              <h2 className="font-semibold text-gray-900 mb-2">AIにプロンプトを進化させる</h2>
              <p className="text-gray-500 text-sm mb-5">
                受け取ったフィードバックをもとに、AIが自律的にパターンを分析し、
                Persona Promptを改善します。思考過程を確認できます。
              </p>
              <button
                onClick={handleEvolve}
                disabled={evolving}
                className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {evolving ? "AIが思考中..." : "プロンプト進化を実行する"}
              </button>
              {evolving && (
                <p className="text-xs text-gray-400 mt-2">Claudeがフィードバックを分析しています（10〜30秒）</p>
              )}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">システムの思考ログ</h2>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                  {evolutionResult.newPersona.version} 作成完了
                </span>
              </div>

              {/* Changes */}
              <div className="flex flex-wrap gap-2 mb-4">
                {evolutionResult.changes.map((c, i) => (
                  <span
                    key={i}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      c.type === "add" ? "bg-green-100 text-green-700" :
                      c.type === "remove" ? "bg-red-100 text-red-700" :
                      "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {c.type === "add" ? "+" : c.type === "remove" ? "-" : "~"} {c.description}
                  </span>
                ))}
              </div>

              {/* AI reasoning */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">AIの思考過程</div>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {evolutionResult.reasoning}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  予測改善率:{" "}
                  <span className={`font-semibold ${evolutionResult.predictedImprovement > 0 ? "text-green-600" : "text-red-500"}`}>
                    {evolutionResult.predictedImprovement > 0 ? "+" : ""}
                    {evolutionResult.predictedImprovement}%
                  </span>
                </div>
                <a href="/personas" className="text-sm text-indigo-600 hover:underline">
                  新しいプロンプトを確認 →
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
