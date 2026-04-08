"use client";

import { useEffect, useState } from "react";

interface DevAlert {
  id: string;
  triggerReason: string;
  candidateUsername: string;
  devDescription: string;
  claudeCodePrompt: string;
  status: "pending" | "implemented" | "dismissed";
  createdAt: string;
}

interface Evolution {
  id: string;
  systemReasoning: string;
  changes: string;
  signalsUsed: string;
  predictedImprovement: number | null;
  createdAt: string;
  fromVersion: { version: string; actualScore: number | null };
  toVersion: { version: string; actualScore: number | null };
}

export default function EvolutionPage() {
  const [evolutions, setEvolutions] = useState<Evolution[]>([]);
  const [selected, setSelected] = useState<Evolution | null>(null);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState<{
    reasoning: string;
    changes: Array<{ type: string; description: string; target: string }>;
    predictedImprovement: number;
    newPersona: { version: string };
  } | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const [devAlerts, setDevAlerts] = useState<DevAlert[]>([]);
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function loadEvolutions() {
    fetch("/api/evolution")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setEvolutions(data);
          if (data.length > 0) setSelected(data[0]);
        }
      });
  }

  function loadDevAlerts() {
    fetch("/api/dev-alerts")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setDevAlerts(data); })
      .catch(() => {});
  }

  useEffect(() => {
    loadEvolutions();
    loadDevAlerts();
  }, []);

  async function handleDevAlertStatus(id: string, status: "implemented" | "dismissed") {
    await fetch("/api/dev-alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    loadDevAlerts();
  }

  async function copyToClipboard(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleFeedbackSubmit() {
    if (!feedback.trim()) return;
    setSubmitting(true);
    setFeedbackError(null);
    setFeedbackResult(null);

    const res = await fetch("/api/feedback/qualitative", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback }),
    });

    const data = await res.json();
    if (!res.ok) {
      setFeedbackError(data.error ?? "エラーが発生しました");
    } else {
      setFeedbackResult({
        reasoning: data.reasoning,
        changes: data.changes,
        predictedImprovement: data.predictedImprovement,
        newPersona: data.newPersona,
      });
      setFeedback("");
      loadEvolutions();
    }
    setSubmitting(false);
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Evolution Log</h1>
        <p className="text-gray-500 text-sm mt-1">プロンプト進化の履歴とAIの思考過程</p>
      </div>

      {/* Dev Alerts panel */}
      {devAlerts.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-gray-900">開発提案</h2>
            <span className="bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5">{devAlerts.length}</span>
            <span className="text-xs text-gray-400">— 見送り理由からプロンプト改善だけでは解決できない課題を検出しました</span>
          </div>
          <div className="space-y-3">
            {devAlerts.map((alert) => (
              <div key={alert.id} className="bg-white border border-red-200 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400">@{alert.candidateUsername} の見送り理由より</span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{new Date(alert.createdAt).toLocaleDateString("ja-JP")}</span>
                    </div>
                    <p className="text-sm text-gray-600 bg-gray-50 rounded px-2 py-1 mb-2 italic">
                      「{alert.triggerReason}」
                    </p>
                    <p className="text-sm font-medium text-red-800">{alert.devDescription}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleDevAlertStatus(alert.id, "implemented")}
                      className="text-xs px-2.5 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 font-medium"
                    >
                      実装済み
                    </button>
                    <button
                      onClick={() => handleDevAlertStatus(alert.id, "dismissed")}
                      className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"
                    >
                      却下
                    </button>
                  </div>
                </div>

                {/* Claude Code prompt */}
                <div className="border border-dashed border-red-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-red-700">Claude Code プロンプト案</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setExpandedPrompt(expandedPrompt === alert.id ? null : alert.id)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        {expandedPrompt === alert.id ? "折りたたむ" : "展開"}
                      </button>
                      <button
                        onClick={() => copyToClipboard(alert.claudeCodePrompt, alert.id)}
                        className="text-xs px-2.5 py-1 rounded bg-red-600 text-white hover:bg-red-700 font-medium"
                      >
                        {copiedId === alert.id ? "コピー済み ✓" : "コピー"}
                      </button>
                    </div>
                  </div>
                  <pre className={`text-xs text-gray-700 font-mono whitespace-pre-wrap leading-relaxed ${expandedPrompt === alert.id ? "" : "line-clamp-3"}`}>
                    {alert.claudeCodePrompt}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Qualitative feedback panel */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">アルゴリズムへの定性フィードバック</h2>
        <p className="text-xs text-gray-500 mb-4">
          探索・抽出・評価の3つのプロンプトを同時に改善します。スコアなしで直接方向性を指示できます。
        </p>

        {!feedbackResult ? (
          <>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
              placeholder={"例: 「ゲーム系は除外してほしい。B2B SaaSで月次売上に言及している人に絞りたい」\n例: 「AI系ツールが多すぎる。ものづくり・製造系の起業家をもっと拾ってほしい」"}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none mb-3"
            />
            {feedbackError && (
              <p className="text-red-500 text-sm mb-3">{feedbackError}</p>
            )}
            <div className="flex justify-end">
              <button
                onClick={handleFeedbackSubmit}
                disabled={!feedback.trim() || submitting}
                className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? "AIが思考中..." : "フィードバックを反映させる →"}
              </button>
            </div>
            {submitting && (
              <p className="text-xs text-gray-400 mt-2 text-right">Claudeが3つのプロンプトを分析・更新しています（20〜40秒）</p>
            )}
          </>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                {feedbackResult.newPersona.version} 作成完了
              </span>
              <button
                onClick={() => setFeedbackResult(null)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                もう一度送る
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {feedbackResult.changes.map((c, i) => (
                <span
                  key={i}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    c.type === "add" ? "bg-green-100 text-green-700" :
                    c.type === "remove" ? "bg-red-100 text-red-700" :
                    "bg-blue-100 text-blue-700"
                  }`}
                >
                  [{c.target}] {c.type === "add" ? "+" : c.type === "remove" ? "-" : "~"} {c.description}
                </span>
              ))}
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">AIの判断</div>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{feedbackResult.reasoning}</p>
            </div>
            <div className="mt-2 text-xs text-gray-500 text-right">
              予測改善率:{" "}
              <span className={`font-semibold ${feedbackResult.predictedImprovement > 0 ? "text-green-600" : "text-red-500"}`}>
                {feedbackResult.predictedImprovement > 0 ? "+" : ""}{feedbackResult.predictedImprovement}%
              </span>
            </div>
          </div>
        )}
      </div>

      {evolutions.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <div className="text-gray-400 text-4xl mb-4">⟳</div>
          <div className="text-gray-600 font-medium mb-2">まだ進化履歴はありません</div>
          <div className="text-gray-400 text-sm">
            Scoringページで候補を評価してフィードバックを送ると、AIが自律的にプロンプトを改善します。
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          {/* Timeline */}
          <div className="col-span-1 space-y-2">
            {evolutions.map((evo) => {
              const changes = JSON.parse(evo.changes) as Array<{ type: string; description: string }>;
              const improvement = evo.predictedImprovement;
              return (
                <button
                  key={evo.id}
                  onClick={() => setSelected(evo)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    selected?.id === evo.id
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">
                      {evo.fromVersion.version} → {evo.toVersion.version}
                    </span>
                    {improvement !== null && (
                      <span
                        className={`text-xs font-semibold ${
                          improvement > 0 ? "text-green-600" : "text-red-500"
                        }`}
                      >
                        {improvement > 0 ? "+" : ""}{improvement}%
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {changes.slice(0, 2).map((c, i) => (
                      <span
                        key={i}
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          c.type === "add" ? "bg-green-100 text-green-600" :
                          c.type === "remove" ? "bg-red-100 text-red-600" :
                          "bg-blue-100 text-blue-600"
                        }`}
                      >
                        {c.type === "add" ? "+" : c.type === "remove" ? "-" : "~"} {c.description.slice(0, 20)}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(evo.createdAt).toLocaleDateString("ja-JP")}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail */}
          <div className="col-span-2">
            {selected && (
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-semibold text-gray-900">
                    {selected.fromVersion.version} → {selected.toVersion.version}
                  </h2>
                  <span className="text-sm text-gray-400">
                    {new Date(selected.createdAt).toLocaleString("ja-JP")}
                  </span>
                </div>

                {/* Signals used */}
                {(() => {
                  const signals = JSON.parse(selected.signalsUsed) as {
                    feedbackCount: number;
                    avgScore: number;
                    hasOverallComment: boolean;
                  };
                  return (
                    <div className="flex gap-4 mb-5 p-3 bg-gray-50 rounded-lg text-sm">
                      <div>
                        <span className="text-gray-500">フィードバック数: </span>
                        <span className="font-medium">{signals.feedbackCount}件</span>
                      </div>
                      <div>
                        <span className="text-gray-500">平均スコア: </span>
                        <span className="font-medium">{signals.avgScore.toFixed(1)}/5</span>
                      </div>
                      {signals.hasOverallComment && (
                        <div className="text-gray-500">全体コメントあり</div>
                      )}
                    </div>
                  );
                })()}

                {/* Changes */}
                <h3 className="text-sm font-semibold text-gray-700 mb-2">変更内容</h3>
                <div className="space-y-2 mb-5">
                  {(JSON.parse(selected.changes) as Array<{ type: string; description: string }>).map((c, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 px-3 py-2 rounded-lg text-sm ${
                        c.type === "add" ? "bg-green-50 text-green-800" :
                        c.type === "remove" ? "bg-red-50 text-red-800" :
                        "bg-blue-50 text-blue-800"
                      }`}
                    >
                      <span className="font-bold shrink-0">
                        {c.type === "add" ? "[+]" : c.type === "remove" ? "[-]" : "[~]"}
                      </span>
                      {c.description}
                    </div>
                  ))}
                </div>

                {/* AI reasoning */}
                <h3 className="text-sm font-semibold text-gray-700 mb-2">AIの思考過程</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {selected.systemReasoning}
                  </p>
                </div>

                {selected.predictedImprovement !== null && (
                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-sm text-gray-500">AIの予測改善率:</span>
                    <span
                      className={`font-semibold ${
                        selected.predictedImprovement > 0 ? "text-green-600" : "text-red-500"
                      }`}
                    >
                      {selected.predictedImprovement > 0 ? "+" : ""}
                      {selected.predictedImprovement}%
                    </span>
                    {selected.toVersion.actualScore !== null && selected.fromVersion.actualScore !== null && (
                      <>
                        <span className="text-gray-300 mx-1">·</span>
                        <span className="text-sm text-gray-500">実績:</span>
                        <span className={`font-semibold ${
                          selected.toVersion.actualScore > selected.fromVersion.actualScore ? "text-green-600" : "text-red-500"
                        }`}>
                          {selected.fromVersion.actualScore.toFixed(1)} → {selected.toVersion.actualScore.toFixed(1)}/5
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
