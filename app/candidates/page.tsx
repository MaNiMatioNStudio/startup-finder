"use client";

import { useEffect, useState, useMemo } from "react";
import { ScoreBar } from "@/components/ScoreBar";

interface Evaluation {
  entrepreneurScore: number;
  executionScore: number;
  marketScore: number;
  overallScore: number;
  reasoning: string;
  keySignals: string;
}

interface OutreachSource {
  type: "bio" | "tweet";
  content: string;
  reason: string;
}

interface OutreachMessage {
  id: string;
  generatedText: string;
  editedText: string | null;
  sources: string;
  createdAt: string;
}

type FundingRound = "未調達" | "シード" | "プレシリーズA" | "シリーズA" | "シリーズB以降" | "不明";

interface Candidate {
  id: string;
  xUsername: string;
  displayName: string | null;
  bio: string | null;
  followersCount: number | null;
  sampleTweets: string | null;
  status: string;
  contactedAt: string | null;
  discoveredAt: string;
  companyName: string | null;
  fundingRound: FundingRound | null;
  fundingAmount: string | null;
  fundingCheckedAt: string | null;
  holdReason: string | null;
  holdAlertAt: string | null;
  holdAlertText: string | null;
  holdCheckedAt: string | null;
  personaPrompt: { version: string } | null;
  evaluation: Evaluation | null;
  humanFeedbacks: Array<{ score: number; comment: string | null }>;
}

type StatusTab = "all" | "scheduled" | "contacted" | "passed" | "hold";
type SortKey = "score" | "discovered" | "followers";
type FundingFilter = "all" | FundingRound;

interface CollectionRun {
  id: string;
  status: "running" | "completed" | "failed";
  queriesUsed: string;
  tweetsFound: number;
  candidatesAdded: number;
  candidatesSkipped: number;
  errors: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface CollectionStatus {
  recentRuns: CollectionRun[];
  totalCandidates: number;
  weeklyCount: number;
}

const FUNDING_COLORS: Record<FundingRound, string> = {
  "未調達":      "bg-gray-100 text-gray-600",
  "シード":      "bg-blue-100 text-blue-700",
  "プレシリーズA": "bg-cyan-100 text-cyan-700",
  "シリーズA":   "bg-emerald-100 text-emerald-700",
  "シリーズB以降": "bg-amber-100 text-amber-700",
  "不明":        "bg-gray-100 text-gray-400",
};

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [adding, setAdding] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [addingLoading, setAddingLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState<string | null>(null);
  const [evaluateError, setEvaluateError] = useState<string | null>(null);

  // Filters
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [minScore, setMinScore] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [fundingFilter, setFundingFilter] = useState<FundingFilter>("all");

  // Company research
  const [researchingCompany, setResearchingCompany] = useState(false);
  const [companyReasoning, setCompanyReasoning] = useState<string | null>(null);
  const [batchResearching, setBatchResearching] = useState(false);
  const [batchResult, setBatchResult] = useState<string | null>(null);
  const [braveEnabled, setBraveEnabled] = useState<boolean | null>(null);

  // Profile edit
  const [editingProfile, setEditingProfile] = useState(false);
  const [editBio, setEditBio] = useState("");
  const [editTweets, setEditTweets] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Outreach
  const [outreachMessages, setOutreachMessages] = useState<OutreachMessage[]>([]);
  const [generatingOutreach, setGeneratingOutreach] = useState(false);
  const [outreachEditText, setOutreachEditText] = useState("");
  const [editingOutreach, setEditingOutreach] = useState<string | null>(null);
  const [savingOutreach, setSavingOutreach] = useState(false);
  const [outreachTab, setOutreachTab] = useState<"generate" | "history">("generate");

  // Auto collection
  const [collectionStatus, setCollectionStatus] = useState<CollectionStatus | null>(null);
  const [showCollection, setShowCollection] = useState(false);
  const [runningCollection, setRunningCollection] = useState(false);

  // Status reason modal
  const [statusReasonModal, setStatusReasonModal] = useState<{
    candidateId: string;
    status: "scheduled" | "passed" | "hold";
  } | null>(null);
  const [statusReason, setStatusReason] = useState("");
  const [submittingStatus, setSubmittingStatus] = useState(false);
  const [statusFeedbackResult, setStatusFeedbackResult] = useState<string | null>(null);

  // Hold alerts
  const [holdAlertCount, setHoldAlertCount] = useState(0);
  const [holdCount, setHoldCount] = useState(0);
  const [checkingHold, setCheckingHold] = useState(false);

  // Template feedback
  const [showTemplateFeedback, setShowTemplateFeedback] = useState(false);
  const [templateFeedback, setTemplateFeedback] = useState("");
  const [submittingTemplateFeedback, setSubmittingTemplateFeedback] = useState(false);
  const [templateFeedbackResult, setTemplateFeedbackResult] = useState<{
    reasoning: string;
    changes: Array<{ type: string; description: string }>;
    newTemplate: { version: string };
  } | null>(null);
  const [templateFeedbackError, setTemplateFeedbackError] = useState<string | null>(null);

  useEffect(() => {
    fetchCandidates();
    fetchCollectionStatus();
    fetchHoldStatus();
    fetch("/api/candidates/batch-company")
      .then((r) => r.json())
      .then((d) => setBraveEnabled(d.braveEnabled ?? false));
  }, []);

  // コレクション実行中はポーリングで状態を更新
  useEffect(() => {
    if (!runningCollection) return;
    const interval = setInterval(async () => {
      const status = await fetchCollectionStatus();
      const latestRun = status?.recentRuns[0];
      if (latestRun && latestRun.status !== "running") {
        setRunningCollection(false);
        fetchCandidates();
        clearInterval(interval);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [runningCollection]);

  useEffect(() => {
    if (selected) fetchOutreachMessages(selected.id);
  }, [selected?.id]);

  async function fetchCandidates() {
    const res = await fetch("/api/candidates");
    if (res.ok) {
      const data: Candidate[] = await res.json();
      setCandidates(data);
    }
  }

  async function fetchCollectionStatus(): Promise<CollectionStatus | null> {
    try {
      const res = await fetch("/api/collection");
      if (res.ok) {
        const data: CollectionStatus = await res.json();
        setCollectionStatus(data);
        return data;
      }
    } catch { /* ignore */ }
    return null;
  }

  async function fetchHoldStatus() {
    try {
      const res = await fetch("/api/hold-check");
      if (res.ok) {
        const data = await res.json() as { alerts: unknown[]; holdCount: number };
        setHoldAlertCount(data.alerts.length);
        setHoldCount(data.holdCount);
      }
    } catch { /* ignore */ }
  }

  async function handleCheckHold() {
    setCheckingHold(true);
    await fetch("/api/hold-check", { method: "POST" });
    await Promise.all([fetchHoldStatus(), fetchCandidates()]);
    setCheckingHold(false);
  }

  async function handleRunCollection() {
    setRunningCollection(true);
    const res = await fetch("/api/collection", { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "収集の開始に失敗しました");
      setRunningCollection(false);
    } else {
      await fetchCollectionStatus();
    }
  }

  async function fetchOutreachMessages(candidateId: string) {
    const res = await fetch(`/api/candidates/${candidateId}/outreach`);
    if (res.ok) setOutreachMessages(await res.json());
  }

  const filtered = useMemo(() => {
    return candidates
      .filter((c) => statusTab === "all" || c.status === statusTab)
      .filter((c) => !minScore || (c.evaluation?.overallScore ?? 0) >= minScore)
      .filter((c) => fundingFilter === "all" || c.fundingRound === fundingFilter)
      .sort((a, b) => {
        if (sortKey === "score") return (b.evaluation?.overallScore ?? 0) - (a.evaluation?.overallScore ?? 0);
        if (sortKey === "followers") return (b.followersCount ?? 0) - (a.followersCount ?? 0);
        return new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime();
      });
  }, [candidates, statusTab, minScore, sortKey, fundingFilter]);

  async function handleAddCandidate() {
    if (!newUsername.trim()) return;
    setAddingLoading(true);
    setAddError(null);
    try {
      const res = await fetch("/api/candidates/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xUsername: newUsername.trim() }),
      });
      if (res.ok) {
        const candidate: Candidate = await res.json();
        setAdding(false);
        setNewUsername("");
        fetchCandidates();
        setSelected(candidate);
      } else {
        const data = await res.json();
        setAddError(data.error ?? "追加に失敗しました");
      }
    } catch {
      setAddError("サーバーへの接続に失敗しました");
    }
    setAddingLoading(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/candidates/${id}`, { method: "DELETE" });
    setSelected(null);
    fetchCandidates();
  }

  async function handleEvaluate(id: string) {
    setEvaluating(id);
    setEvaluateError(null);
    const res = await fetch(`/api/candidates/${id}/evaluate`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setEvaluateError(data.error ?? "AI評価に失敗しました");
    }
    setEvaluating(null);
    fetchCandidates();
  }

  async function handleStatusChange(id: string, status: "pending" | "scheduled" | "contacted" | "passed" | "hold", reason?: string) {
    await fetch(`/api/candidates/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reason }),
    });
    fetchCandidates();
    if (selected?.id === id) setSelected((p) => p ? { ...p, status } : p);
  }

  async function handleStatusWithReason() {
    if (!statusReasonModal || !selected) return;
    setSubmittingStatus(true);
    await handleStatusChange(statusReasonModal.candidateId, statusReasonModal.status, statusReason.trim() || undefined);
    if (statusReason.trim() && statusReasonModal.status !== "hold") {
      setStatusFeedbackResult("フィードバックをもとにアルゴリズムを更新中...");
    }
    if (statusReasonModal.status === "hold") {
      fetchHoldStatus();
    }
    setStatusReasonModal(null);
    setStatusReason("");
    setSubmittingStatus(false);
  }

  function openStatusModal(candidateId: string, status: "scheduled" | "passed" | "hold") {
    setStatusReasonModal({ candidateId, status });
    setStatusReason("");
    setStatusFeedbackResult(null);
  }

  function startEditProfile() {
    if (!selected) return;
    setEditBio(selected.bio ?? "");
    const tweets = selected.sampleTweets ? JSON.parse(selected.sampleTweets) as string[] : [];
    setEditTweets(tweets.join("\n"));
    setEditingProfile(true);
  }

  async function handleSaveProfile() {
    if (!selected) return;
    setSavingProfile(true);
    const tweets = editTweets.split("\n").map((t) => t.trim()).filter(Boolean);
    await fetch(`/api/candidates/${selected.id}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio: editBio, tweets }),
    });
    setSavingProfile(false);
    setEditingProfile(false);
    fetchCandidates();
  }

  async function handleGenerateOutreach() {
    if (!selected) return;
    setGeneratingOutreach(true);
    const res = await fetch(`/api/candidates/${selected.id}/outreach`, { method: "POST" });
    if (res.ok) {
      await fetchOutreachMessages(selected.id);
      setOutreachTab("generate");
    }
    setGeneratingOutreach(false);
  }

  async function handleBatchResearch() {
    setBatchResearching(true);
    setBatchResult(null);
    const res = await fetch("/api/candidates/batch-company", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setBatchResult(`${data.updated}名の調査完了`);
      fetchCandidates();
    }
    setBatchResearching(false);
  }

  async function handleResearchCompany() {
    if (!selected) return;
    setResearchingCompany(true);
    setCompanyReasoning(null);
    const res = await fetch(`/api/candidates/${selected.id}/company`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setCompanyReasoning(data.reasoning ?? null);
      fetchCandidates();
      setSelected((prev) => prev ? {
        ...prev,
        companyName: data.companyName,
        fundingRound: data.fundingRound,
        fundingAmount: data.fundingAmount,
        fundingCheckedAt: data.fundingCheckedAt,
      } : prev);
    }
    setResearchingCompany(false);
  }

  async function handleSubmitTemplateFeedback() {
    if (!templateFeedback.trim()) return;
    setSubmittingTemplateFeedback(true);
    setTemplateFeedbackError(null);
    setTemplateFeedbackResult(null);

    const res = await fetch("/api/message-template", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback: templateFeedback }),
    });

    const data = await res.json();
    if (!res.ok) {
      setTemplateFeedbackError(data.error ?? "エラーが発生しました");
    } else {
      setTemplateFeedbackResult({
        reasoning: data.reasoning,
        changes: data.changes,
        newTemplate: data.newTemplate,
      });
      setTemplateFeedback("");
    }
    setSubmittingTemplateFeedback(false);
  }

  async function handleSaveOutreachEdit(messageId: string) {
    setSavingOutreach(true);
    await fetch(`/api/candidates/${selected!.id}/outreach`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, editedText: outreachEditText }),
    });
    setSavingOutreach(false);
    setEditingOutreach(null);
    fetchOutreachMessages(selected!.id);
  }

  const latestMessage = outreachMessages[0];
  const statusCounts = {
    all: candidates.length,
    scheduled: candidates.filter((c) => c.status === "scheduled").length,
    contacted: candidates.filter((c) => c.status === "contacted").length,
    passed: candidates.filter((c) => c.status === "passed").length,
    hold: candidates.filter((c) => c.status === "hold").length,
  };
  const holdAlertCandidates = candidates.filter((c) => c.status === "hold" && c.holdAlertAt);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Candidates</h1>
          <p className="text-gray-500 text-sm mt-1">発掘された起業家候補</p>
        </div>
        <div className="flex items-center gap-2">
          {batchResult && <span className="text-xs text-green-600">{batchResult}</span>}
          <div className="flex flex-col items-end gap-0.5">
            <button
              onClick={handleBatchResearch}
              disabled={batchResearching}
              className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {batchResearching ? "調査中..." : "全員の会社情報を調査"}
            </button>
            {braveEnabled === false && (
              <span className="text-xs text-amber-600">
                ⚠ Brave API未設定 — DDG使用（大量実行時にブロックされる場合あり）
              </span>
            )}
            {braveEnabled === true && (
              <span className="text-xs text-green-600">Brave Search API 使用中</span>
            )}
          </div>
          <button
            onClick={() => setShowCollection((v) => !v)}
            className="border border-violet-300 text-violet-700 bg-violet-50 px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-100"
          >
            自動収集
          </button>
          <button onClick={() => setAdding(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
            + 手動で追加
          </button>
        </div>
      </div>

      {/* Auto Collection Panel */}
      {showCollection && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-5 mb-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-semibold text-violet-900">自動収集</h2>
              <p className="text-xs text-violet-600 mt-0.5">
                現在のペルソナからX検索クエリを生成し、起業家候補を自動で発掘・評価します
              </p>
            </div>
            <div className="flex items-center gap-3">
              {collectionStatus && (
                <div className="text-right text-xs text-violet-700">
                  <div>今週の新規: <strong>{collectionStatus.weeklyCount}名</strong></div>
                  <div>累計: <strong>{collectionStatus.totalCandidates}名</strong></div>
                </div>
              )}
              <button
                onClick={handleRunCollection}
                disabled={runningCollection}
                className="bg-violet-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
              >
                {runningCollection ? "収集中..." : "今すぐ収集"}
              </button>
            </div>
          </div>

          {runningCollection && (
            <div className="bg-violet-100 rounded-lg px-4 py-3 text-sm text-violet-800 mb-3">
              クエリ生成 → X検索 → 候補者抽出 → プロフィール取得 → 評価中...（数分かかります）
            </div>
          )}

          {/* Recent runs */}
          {collectionStatus && collectionStatus.recentRuns.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-violet-800 mb-1">実行履歴</p>
              {collectionStatus.recentRuns.map((run) => {
                const queries = JSON.parse(run.queriesUsed) as string[];
                const runErrors = run.errors ? JSON.parse(run.errors) as string[] : [];
                return (
                  <div key={run.id} className="bg-white border border-violet-100 rounded-lg px-4 py-3 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-medium ${run.status === "completed" ? "text-green-700" : run.status === "running" ? "text-blue-700" : "text-red-700"}`}>
                        {run.status === "completed" ? "完了" : run.status === "running" ? "実行中" : "失敗"}
                      </span>
                      <span className="text-gray-400">{new Date(run.startedAt).toLocaleString("ja-JP")}</span>
                    </div>
                    <div className="text-gray-600">
                      ツイート取得: {run.tweetsFound}件 / 新規追加: <strong>{run.candidatesAdded}名</strong> / スキップ: {run.candidatesSkipped}名
                    </div>
                    {queries.length > 0 && (
                      <details className="mt-1">
                        <summary className="text-violet-600 cursor-pointer">検索クエリ ({queries.length})</summary>
                        <ul className="mt-1 space-y-0.5 pl-2">
                          {queries.map((q, i) => (
                            <li key={i} className="text-gray-500 font-mono text-xs truncate">{q}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {runErrors.length > 0 && (
                      <details className="mt-1">
                        <summary className="text-red-500 cursor-pointer">エラー ({runErrors.length})</summary>
                        <ul className="mt-1 space-y-0.5 pl-2">
                          {runErrors.map((e, i) => (
                            <li key={i} className="text-red-400 text-xs">{e}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div className="bg-white border border-indigo-200 rounded-xl p-4 mb-5 flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Xのユーザー名</label>
            <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCandidate()}
              placeholder="@username" autoFocus
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <button onClick={handleAddCandidate} disabled={addingLoading}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {addingLoading ? "追加中..." : "追加"}
          </button>
          <button onClick={() => { setAdding(false); setAddError(null); }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">キャンセル</button>
        </div>
      )}
      {addError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-700">{addError}</div>
      )}

      {/* Hold alerts banner */}
      {holdAlertCandidates.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-amber-600 font-bold text-sm">🔔 保留中の候補に変化があります ({holdAlertCandidates.length}名)</span>
            <span className="text-amber-600 text-xs">— 保留タブで確認してください</span>
          </div>
          <button onClick={() => setStatusTab("hold")} className="text-xs text-amber-700 font-medium hover:underline">
            保留タブへ →
          </button>
        </div>
      )}

      {/* Status tabs + filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {(["all", "scheduled", "contacted", "passed", "hold"] as StatusTab[]).map((s) => (
          <button key={s} onClick={() => setStatusTab(s)}
            className={`relative px-3 py-1.5 rounded-lg text-sm transition-all ${
              statusTab === s
                ? s === "scheduled" ? "bg-amber-500 text-white"
                  : s === "contacted" ? "bg-green-600 text-white"
                  : s === "passed" ? "bg-gray-500 text-white"
                  : s === "hold" ? "bg-orange-500 text-white"
                  : "bg-indigo-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}>
            {s === "all" ? "すべて" : s === "scheduled" ? "コンタクト予定" : s === "contacted" ? "コンタクト済" : s === "passed" ? "見送り" : "保留"}
            <span className="ml-1.5 text-xs opacity-70">{statusCounts[s as keyof typeof statusCounts] ?? 0}</span>
            {s === "hold" && holdAlertCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {holdAlertCount}
              </span>
            )}
          </button>
        ))}

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <span className="text-xs text-gray-400">調達:</span>
          <select value={fundingFilter} onChange={(e) => setFundingFilter(e.target.value as FundingFilter)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none">
            <option value="all">すべて</option>
            <option value="未調達">未調達</option>
            <option value="シード">シード</option>
            <option value="プレシリーズA">プレシリーズA</option>
            <option value="シリーズA">シリーズA</option>
            <option value="シリーズB以降">シリーズB以降</option>
            <option value="不明">不明</option>
          </select>
          <span className="text-xs text-gray-400">スコア:</span>
          <select value={minScore} onChange={(e) => setMinScore(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none">
            <option value={0}>制限なし</option>
            <option value={50}>50+</option>
            <option value={60}>60+</option>
            <option value={70}>70+</option>
            <option value={80}>80+</option>
          </select>
          <span className="text-xs text-gray-400">順:</span>
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none">
            <option value="score">スコア</option>
            <option value="discovered">発見日</option>
            <option value="followers">フォロワー</option>
          </select>
          {statusTab === "hold" && (
            <button
              onClick={handleCheckHold}
              disabled={checkingHold}
              className="border border-orange-300 text-orange-700 bg-orange-50 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-orange-100 disabled:opacity-50"
            >
              {checkingHold ? "チェック中..." : "今すぐ保留チェック"}
            </button>
          )}
          <span className="text-xs text-gray-400">{filtered.length}名</span>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-5">
        {/* Candidate list */}
        <div className="col-span-2 space-y-2 max-h-[calc(100vh-240px)] overflow-y-auto pr-1">
          {filtered.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-12">候補がいません</div>
          )}
          {filtered.map((c) => {
            const latestScore = c.humanFeedbacks[0];
            const score = c.evaluation?.overallScore;
            const statusColor = c.status === "scheduled" ? "bg-amber-100 text-amber-700"
              : c.status === "contacted" ? "bg-green-100 text-green-700"
              : c.status === "passed" ? "bg-gray-100 text-gray-400"
              : c.status === "hold" ? (c.holdAlertAt ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700")
              : "";
            const statusLabel = c.status === "scheduled" ? "予定"
              : c.status === "contacted" ? "連絡済"
              : c.status === "passed" ? "見送"
              : c.status === "hold" ? (c.holdAlertAt ? "🔔保留" : "保留")
              : "";
            return (
              <button key={c.id} onClick={() => setSelected(c)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                  selected?.id === c.id ? "border-indigo-500 bg-indigo-50" : "border-gray-200 bg-white hover:border-gray-300"
                } ${c.status === "passed" ? "opacity-50" : ""}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm">@{c.xUsername}</span>
                  <div className="flex items-center gap-1.5">
                    {statusLabel && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusColor}`}>
                        {statusLabel}
                      </span>
                    )}
                    {latestScore && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">★{latestScore.score}</span>
                    )}
                    {score !== undefined && (
                      <span className={`text-xs font-bold ${score >= 70 ? "text-indigo-600" : score >= 50 ? "text-gray-500" : "text-gray-300"}`}>
                        {Math.round(score)}
                      </span>
                    )}
                  </div>
                </div>
                {c.bio && <div className="text-xs text-gray-500 line-clamp-2">{c.bio}</div>}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {c.companyName && (
                    <span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-medium">
                      {c.companyName}
                    </span>
                  )}
                  {c.fundingRound && c.fundingRound !== "不明" && (
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${FUNDING_COLORS[c.fundingRound as FundingRound]}`}>
                      {c.fundingRound}{c.fundingAmount ? ` ${c.fundingAmount}` : ""}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {c.personaPrompt?.version ?? "不明"}で発見
                  {c.followersCount !== null && ` · ${c.followersCount.toLocaleString()}フォロワー`}
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail panel */}
        <div className="col-span-3 max-h-[calc(100vh-240px)] overflow-y-auto">
          {selected ? (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold">@{selected.xUsername}</h2>
                    {selected.displayName && <span className="text-gray-500 text-sm">{selected.displayName}</span>}
                  </div>
                  {selected.bio && <p className="text-gray-600 text-sm">{selected.bio}</p>}
                  <div className="flex gap-3 mt-1 text-xs text-gray-400">
                    {selected.personaPrompt && <span>{selected.personaPrompt.version}で発見</span>}
                    {selected.followersCount !== null && <span>{selected.followersCount.toLocaleString()}フォロワー</span>}
                    {selected.contactedAt && <span>連絡日: {new Date(selected.contactedAt).toLocaleDateString("ja-JP")}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a href={`https://x.com/${selected.xUsername}`} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-indigo-600 hover:underline">Xで見る →</a>
                  <button onClick={() => handleDelete(selected.id)} className="text-xs text-red-400 hover:text-red-600">削除</button>
                </div>
              </div>

              {/* Company & funding info */}
              <div className="flex items-start gap-3 mb-4 flex-wrap">
                {selected.companyName ? (
                  <span className="text-xs bg-violet-100 text-violet-700 px-2.5 py-1 rounded-full font-medium">
                    {selected.companyName}
                  </span>
                ) : null}
                {selected.fundingRound ? (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${FUNDING_COLORS[selected.fundingRound as FundingRound] ?? "bg-gray-100 text-gray-500"}`}>
                    {selected.fundingRound}{selected.fundingAmount ? ` · ${selected.fundingAmount}` : ""}
                  </span>
                ) : null}
                <button
                  onClick={handleResearchCompany}
                  disabled={researchingCompany}
                  className="text-xs text-gray-400 hover:text-indigo-600 border border-dashed border-gray-200 hover:border-indigo-300 px-2.5 py-1 rounded-full transition-colors disabled:opacity-50"
                >
                  {researchingCompany ? "調査中..." : selected.fundingCheckedAt ? "再調査する" : "会社情報を調べる"}
                </button>
                {selected.fundingCheckedAt && (
                  <span className="text-xs text-gray-300">
                    AI推定・要確認 ({new Date(selected.fundingCheckedAt).toLocaleDateString("ja-JP")})
                  </span>
                )}
              </div>
              {companyReasoning && (
                <div className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2 mb-4 text-xs text-violet-700">
                  {companyReasoning}
                </div>
              )}

              {/* Hold alert */}
              {selected.status === "hold" && selected.holdAlertAt && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-red-600 font-bold text-sm">🔔 保留解除の予兆を検出</span>
                    <span className="text-xs text-red-400">{new Date(selected.holdAlertAt).toLocaleDateString("ja-JP")}</span>
                  </div>
                  <p className="text-sm text-red-700">{selected.holdAlertText}</p>
                  <p className="text-xs text-red-400 mt-1">保留理由: {selected.holdReason}</p>
                </div>
              )}

              {/* Status actions */}
              <div className="flex flex-wrap gap-2 mb-2">
                <button
                  onClick={() => openStatusModal(selected.id, "scheduled")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selected.status === "scheduled" ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-amber-50 hover:text-amber-700"
                  }`}>
                  コンタクト予定にする
                </button>
                <button
                  onClick={() => handleStatusChange(selected.id, "contacted")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selected.status === "contacted" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-700"
                  }`}>
                  ✓ コンタクト済みにする
                </button>
                <button
                  onClick={() => openStatusModal(selected.id, "passed")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selected.status === "passed" ? "bg-gray-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}>
                  見送りにする
                </button>
                <button
                  onClick={() => openStatusModal(selected.id, "hold")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selected.status === "hold" ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-orange-50 hover:text-orange-700"
                  }`}>
                  保留にする
                </button>
                {selected.status !== "pending" && (
                  <button
                    onClick={() => handleStatusChange(selected.id, "pending")}
                    className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-600">
                    リセット
                  </button>
                )}
              </div>
              {selected.status === "hold" && selected.holdReason && !selected.holdAlertAt && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mb-3 text-xs text-orange-700">
                  <span className="font-medium">保留理由: </span>{selected.holdReason}
                  {selected.holdCheckedAt && (
                    <span className="text-orange-400 ml-2">最終確認: {new Date(selected.holdCheckedAt).toLocaleDateString("ja-JP")}</span>
                  )}
                </div>
              )}
              {statusFeedbackResult && (
                <p className="text-xs text-violet-600 mb-3">{statusFeedbackResult}</p>
              )}

              {/* Profile edit */}
              {editingProfile ? (
                <div className="mb-5 border border-indigo-200 rounded-lg p-4 bg-indigo-50">
                  <div className="text-sm font-semibold text-indigo-800 mb-3">プロフィールを編集</div>
                  <div className="mb-3">
                    <label className="text-xs text-gray-600 mb-1 block">プロフィール文</label>
                    <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} rows={2}
                      className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  </div>
                  <div className="mb-3">
                    <label className="text-xs text-gray-600 mb-1 block">投稿サンプル（1行1ツイート）</label>
                    <textarea value={editTweets} onChange={(e) => setEditTweets(e.target.value)} rows={5}
                      className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleSaveProfile} disabled={savingProfile}
                      className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm hover:bg-indigo-700 disabled:opacity-50">
                      {savingProfile ? "保存中..." : "保存"}
                    </button>
                    <button onClick={() => setEditingProfile(false)} className="px-3 py-1.5 rounded text-sm text-gray-500 hover:bg-gray-100">キャンセル</button>
                  </div>
                </div>
              ) : (!selected.bio && (!selected.sampleTweets || selected.sampleTweets === "[]")) ? (
                <div className="mb-5 border border-dashed border-amber-300 rounded-lg p-4 bg-amber-50">
                  <div className="text-sm text-amber-800 font-medium mb-1">プロフィールデータがありません</div>
                  <div className="text-xs text-amber-700 mb-2">XのプロフィールとツイートをコピペするとAIが正しく評価・メッセージ生成できます。</div>
                  <button onClick={startEditProfile} className="text-sm px-3 py-1.5 bg-amber-600 text-white rounded hover:bg-amber-700">
                    プロフィールを手動入力する
                  </button>
                </div>
              ) : (
                <button onClick={startEditProfile} className="mb-3 text-xs text-gray-400 hover:text-gray-600 underline block">
                  プロフィール・投稿を編集
                </button>
              )}

              {/* AI Evaluation */}
              {selected.evaluation ? (
                <div className="mb-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">AIスコア</h3>
                  <div className="space-y-2 mb-3">
                    <ScoreBar label="起業確度" score={selected.evaluation.entrepreneurScore} color="bg-indigo-500" />
                    <ScoreBar label="実行力" score={selected.evaluation.executionScore} color="bg-emerald-500" />
                    <ScoreBar label="市場性" score={selected.evaluation.marketScore} color="bg-amber-500" />
                  </div>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{selected.evaluation.reasoning}</p>
                  {selected.evaluation.keySignals && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(JSON.parse(selected.evaluation.keySignals) as string[]).map((s, i) => (
                        <span key={i} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <button onClick={() => handleEvaluate(selected.id)} disabled={evaluating === selected.id}
                    className="mb-2 w-full py-2 border border-dashed border-indigo-300 rounded-lg text-sm text-indigo-600 hover:bg-indigo-50 disabled:opacity-50">
                    {evaluating === selected.id ? "AI評価中..." : "AIで評価する"}
                  </button>
                  {evaluateError && (
                    <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{evaluateError}</div>
                  )}
                </>
              )}

              {/* Outreach message */}
              <div className="border-t border-gray-100 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">面談申込メッセージ</h3>
                  <div className="flex gap-2">
                    <button onClick={() => setOutreachTab("generate")}
                      className={`text-xs px-2 py-1 rounded ${outreachTab === "generate" ? "bg-indigo-100 text-indigo-700" : "text-gray-400 hover:text-gray-600"}`}>
                      生成
                    </button>
                    <button onClick={() => setOutreachTab("history")}
                      className={`text-xs px-2 py-1 rounded ${outreachTab === "history" ? "bg-indigo-100 text-indigo-700" : "text-gray-400 hover:text-gray-600"}`}>
                      履歴 {outreachMessages.length > 0 && `(${outreachMessages.length})`}
                    </button>
                  </div>
                </div>

                {outreachTab === "generate" && (
                  <>
                    {latestMessage ? (
                      <div>
                        {/* Generated message */}
                        <div className="bg-gray-50 rounded-lg p-4 mb-3">
                          <div className="text-xs text-gray-400 mb-2">生成されたメッセージ</div>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                            {latestMessage.generatedText}
                          </p>
                          <div className="text-xs text-gray-400 mt-2">
                            {latestMessage.generatedText.replace(/\n/g, "").length}字
                          </div>
                        </div>

                        {/* Sources */}
                        {(() => {
                          const sources: OutreachSource[] = JSON.parse(latestMessage.sources || "[]");
                          return sources.length > 0 ? (
                            <div className="mb-3">
                              <div className="text-xs text-gray-500 font-medium mb-1.5">参照ソース</div>
                              <div className="space-y-1.5">
                                {sources.map((s, i) => (
                                  <div key={i} className="flex gap-2 text-xs">
                                    <span className={`shrink-0 px-1.5 py-0.5 rounded font-medium ${s.type === "bio" ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"}`}>
                                      {s.type === "bio" ? "Bio" : "投稿"}
                                    </span>
                                    <div>
                                      <span className="text-gray-600">「{s.content.slice(0, 60)}{s.content.length > 60 ? "…" : ""}」</span>
                                      <span className="text-gray-400 ml-1">→ {s.reason}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null;
                        })()}

                        {/* Edit section */}
                        {editingOutreach === latestMessage.id ? (
                          <div>
                            <div className="text-xs text-gray-500 mb-1.5">修正版（この差分が次回の生成に反映されます）</div>
                            <textarea value={outreachEditText} onChange={(e) => setOutreachEditText(e.target.value)}
                              rows={6}
                              className="w-full text-sm border border-indigo-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                            <div className="flex gap-2 mt-2">
                              <button onClick={() => handleSaveOutreachEdit(latestMessage.id)} disabled={savingOutreach}
                                className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm hover:bg-indigo-700 disabled:opacity-50">
                                {savingOutreach ? "保存中..." : "修正版を保存して学習させる"}
                              </button>
                              <button onClick={() => setEditingOutreach(null)}
                                className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded">キャンセル</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            {latestMessage.editedText ? (
                              <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-3">
                                <div className="text-xs text-green-600 font-medium mb-1">修正済み ✓</div>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">{latestMessage.editedText}</p>
                              </div>
                            ) : (
                              <button onClick={() => { setEditingOutreach(latestMessage.id); setOutreachEditText(latestMessage.generatedText); }}
                                className="flex-1 py-2 border border-dashed border-gray-300 rounded-lg text-xs text-gray-400 hover:border-indigo-300 hover:text-indigo-500">
                                修正して学習させる
                              </button>
                            )}
                            <button onClick={handleGenerateOutreach} disabled={generatingOutreach}
                              className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                              {generatingOutreach ? "生成中..." : "再生成"}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <button onClick={handleGenerateOutreach} disabled={generatingOutreach}
                        className="w-full py-3 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                        {generatingOutreach ? "AIが生成中..." : "面談申込メッセージを生成する"}
                      </button>
                    )}
                  </>
                )}

                {outreachTab === "history" && (
                  <div className="space-y-3">
                    {outreachMessages.length === 0 ? (
                      <div className="text-sm text-gray-400 text-center py-4">履歴なし</div>
                    ) : outreachMessages.map((m) => (
                      <div key={m.id} className="border border-gray-100 rounded-lg p-3">
                        <div className="text-xs text-gray-400 mb-1">{new Date(m.createdAt).toLocaleString("ja-JP")}</div>
                        <p className="text-xs text-gray-600 line-clamp-3">{m.editedText ?? m.generatedText}</p>
                        {m.editedText && <span className="text-xs text-green-600">修正済み</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Template feedback */}
              <div className="border-t border-gray-100 pt-4 mt-4">
                <button
                  onClick={() => { setShowTemplateFeedback((v) => !v); setTemplateFeedbackResult(null); setTemplateFeedbackError(null); }}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-600 transition-colors"
                >
                  <span>{showTemplateFeedback ? "▾" : "▸"}</span>
                  メッセージの共通ルールを改善する
                </button>

                {showTemplateFeedback && (
                  <div className="mt-3">
                    {!templateFeedbackResult ? (
                      <>
                        <p className="text-xs text-gray-400 mb-2">
                          個別の修正ではなく、全メッセージに適用したいルールや方向性を指示します。
                        </p>
                        <textarea
                          value={templateFeedback}
                          onChange={(e) => setTemplateFeedback(e.target.value)}
                          rows={3}
                          placeholder={"例: 「相手の具体的な数字（MRR・ユーザー数）に必ず触れる」\n例: 「敬語は使わずフランクなトーンに統一する」\n例: 「最後に面談の目的を一行で書く」"}
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none mb-2"
                        />
                        {templateFeedbackError && (
                          <p className="text-red-500 text-xs mb-2">{templateFeedbackError}</p>
                        )}
                        <div className="flex justify-end">
                          <button
                            onClick={handleSubmitTemplateFeedback}
                            disabled={!templateFeedback.trim() || submittingTemplateFeedback}
                            className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {submittingTemplateFeedback ? "適用中..." : "共通ルールとして反映する →"}
                          </button>
                        </div>
                        {submittingTemplateFeedback && (
                          <p className="text-xs text-gray-400 mt-1 text-right">テンプレートを更新しています（10〜20秒）</p>
                        )}
                      </>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                            {templateFeedbackResult.newTemplate.version} に更新
                          </span>
                          <button onClick={() => setTemplateFeedbackResult(null)}
                            className="text-xs text-gray-400 hover:text-gray-600">もう一度</button>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {templateFeedbackResult.changes.map((c, i) => (
                            <span key={i}
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                c.type === "add" ? "bg-green-100 text-green-700" :
                                c.type === "remove" ? "bg-red-100 text-red-700" :
                                "bg-blue-100 text-blue-700"
                              }`}>
                              {c.type === "add" ? "+" : c.type === "remove" ? "-" : "~"} {c.description}
                            </span>
                          ))}
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{templateFeedbackResult.reasoning}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Human feedback */}
              {selected.humanFeedbacks.length > 0 && (
                <div className="border-t border-gray-100 pt-4 mt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">あなたのスコア</h3>
                  {selected.humanFeedbacks.map((f, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-lg font-bold text-orange-500">★{f.score}</span>
                      {f.comment && <span className="text-sm text-gray-600">"{f.comment}"</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Sample tweets */}
              {selected.sampleTweets && selected.sampleTweets !== "[]" && (
                <div className="border-t border-gray-100 pt-4 mt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">投稿サンプル</h3>
                  <div className="space-y-2">
                    {(JSON.parse(selected.sampleTweets) as string[]).slice(0, 3).map((t, i) => (
                      <div key={i} className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{t}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">候補を選択してください</div>
          )}
        </div>
      </div>

      {/* Status reason modal */}
      {statusReasonModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-base font-bold text-gray-900 mb-1">
              {statusReasonModal.status === "scheduled" ? "コンタクト予定にする"
                : statusReasonModal.status === "hold" ? "保留にする"
                : "見送りにする"}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {statusReasonModal.status === "scheduled"
                ? "この候補者を選んだ理由を入力するとアルゴリズムが改善されます（任意）"
                : statusReasonModal.status === "hold"
                ? "保留の理由と、解除される条件を書いてください。定期的にツイートを確認して条件を満たしたらアラートします。"
                : "見送る理由を入力するとアルゴリズムが改善されます（任意）"}
            </p>
            <textarea
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              rows={statusReasonModal.status === "hold" ? 4 : 3}
              autoFocus
              placeholder={
                statusReasonModal.status === "scheduled"
                  ? "例: 自社プロダクトのMRRを公開していて具体的な数字がある"
                  : statusReasonModal.status === "hold"
                  ? "例: まだ初期段階で売上がないが、プロダクトをリリースしたらコンタクトしたい\n例: シードを調達したらコンタクト予定\n例: 起業しそうな予兆はあるが、まだ会社員の様子"
                  : "例: フリーランスの受託案件が中心でプロダクト開発ではなかった"
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none mb-4"
            />
            {statusReasonModal.status === "hold" && (
              <p className="text-xs text-orange-600 mb-4">
                収集実行のたびに最新ツイートを確認し、条件を満たしたら候補者ページにアラートが表示されます。
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setStatusReasonModal(null); setStatusReason(""); }}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                キャンセル
              </button>
              <button
                onClick={handleStatusWithReason}
                disabled={submittingStatus || (statusReasonModal.status === "hold" && !statusReason.trim())}
                className={`px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 ${
                  statusReasonModal.status === "scheduled" ? "bg-amber-500 hover:bg-amber-600"
                    : statusReasonModal.status === "hold" ? "bg-orange-500 hover:bg-orange-600"
                    : "bg-gray-500 hover:bg-gray-600"
                }`}
              >
                {submittingStatus ? "処理中..." : "決定"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
