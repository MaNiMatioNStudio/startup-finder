"use client";

import { useEffect, useState, useCallback } from "react";

// ── 型定義 ──────────────────────────────────────────────
interface TrainingAccount { id: string; xUsername: string; displayName: string | null; tokenExpiresAt: string | null; isActive: boolean; }
interface ReferenceAccount { id: string; xUsername: string; displayName: string | null; bio: string | null; reason: string | null; addedAt: string; }
interface TrainingAction { id: string; type: string; targetUsername: string | null; tweetId: string | null; executedAt: string; status: string; }
interface TimelinePost { id: string; tweetId: string; authorUsername: string | null; content: string; fetchedAt: string; score: number | null; feedback: string | null; scoredAt: string | null; }
interface TrainingStrategy { id: string; content: string; generation: number; createdAt: string; }
interface AccountSuggestion { username: string; displayName: string | null; bio: string | null; reason: string; xId: string; }
interface DiscoveryCandidate { id: string; sourceUsername: string; xUsername: string; xId: string; displayName: string | null; bio: string | null; followersCount: number | null; followingCount: number | null; tweetCount: number | null; aiScore: number | null; aiReason: string | null; userAction: string | null; }
interface DiscoveryState { sourceUsername: string; paginationToken: string | null; totalFetched: number; }

type Tab = "references" | "discovery" | "session" | "timeline" | "strategy";

// ── メインページ ─────────────────────────────────────────
export default function TrainingAccountPage() {
  const [account, setAccount] = useState<TrainingAccount | null>(null);
  const [tab, setTab] = useState<Tab>("references");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success")) showToast("Xアカウントの連携に成功しました！");
    if (params.get("error")) showToast(`認証エラー: ${params.get("error")}`, false);

    fetch("/api/training-account")
      .then(r => r.json())
      .then(d => { setAccount(d.account ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleConnect = () => { window.location.href = "/api/auth/x"; };
  const handleDisconnect = async () => {
    if (!confirm("連携を解除しますか？")) return;
    await fetch("/api/training-account", { method: "DELETE" });
    setAccount(null);
    showToast("連携を解除しました", false);
  };

  if (loading) return <div className="p-8 text-gray-400">読み込み中...</div>;

  const tabs: { id: Tab; label: string }[] = [
    { id: "references", label: "参考アカウント" },
    { id: "discovery", label: "探索" },
    { id: "session", label: "運用実行" },
    { id: "timeline", label: "タイムライン評価" },
    { id: "strategy", label: "ストラテジー" },
  ];

  return (
    <div className="p-6 max-w-4xl">
      {/* トースト */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg transition-all ${toast.ok ? "bg-green-800 text-green-100" : "bg-red-800 text-red-100"}`}>
          {toast.msg}
        </div>
      )}

      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">教育型アカウント</h1>
          <p className="text-gray-400 text-sm mt-1">Xアルゴリズムを起業家向けに育てる</p>
        </div>
        {account ? (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-semibold text-sm">@{account.xUsername}</div>
              {account.displayName && <div className="text-gray-400 text-xs">{account.displayName}</div>}
            </div>
            <span className="px-2 py-1 bg-green-900/40 text-green-300 text-xs rounded">連携中 ✓</span>
            <button onClick={handleDisconnect} className="text-xs text-gray-500 hover:text-red-400 transition-colors">解除</button>
          </div>
        ) : (
          <button onClick={handleConnect} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium">
            Xアカウントと連携する
          </button>
        )}
      </div>

      {!account ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
          <p className="mb-2">教育型アカウントを連携してください</p>
          <p className="text-xs">連携後、参考アカウント設定から始められます</p>
        </div>
      ) : (
        <>
          {/* タブ */}
          <div className="flex gap-1 mb-6 bg-gray-900 p-1 rounded-lg w-fit">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${tab === t.id ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* タブコンテンツ */}
          {tab === "references" && <ReferencesTab showToast={showToast} />}
          {tab === "discovery" && <DiscoveryTab showToast={showToast} />}
          {tab === "session" && <SessionTab account={account} showToast={showToast} />}
          {tab === "timeline" && <TimelineTab showToast={showToast} />}
          {tab === "strategy" && <StrategyTab showToast={showToast} />}
        </>
      )}
    </div>
  );
}

// ── Tab 1: 参考アカウント ────────────────────────────────
function ReferencesTab({ showToast }: { showToast: (msg: string, ok?: boolean) => void }) {
  const [accounts, setAccounts] = useState<ReferenceAccount[]>([]);
  const [username, setUsername] = useState("");
  const [reason, setReason] = useState("");
  const [adding, setAdding] = useState(false);
  const [suggestions, setSuggestions] = useState<AccountSuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionScores, setSuggestionScores] = useState<Record<string, { score: number; reason: string }>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const d = await fetch("/api/training-account/reference-accounts").then(r => r.json());
    setAccounts(d.accounts ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async (uname = username, rsn = reason) => {
    if (!uname.trim()) return;
    setAdding(true);
    const res = await fetch("/api/training-account/reference-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: uname.trim(), reason: rsn.trim() || undefined }),
    }).then(r => r.json());
    setAdding(false);
    if (res.error) { showToast(res.error, false); return; }
    if (uname === username) { setUsername(""); setReason(""); }
    showToast(`@${res.account.xUsername} を追加しました`);
    setSuggestions(prev => prev.filter(s => s.username !== uname.trim()));
    load();
  };

  const remove = async (id: string, uname: string) => {
    await fetch(`/api/training-account/reference-accounts/${id}`, { method: "DELETE" });
    showToast(`@${uname} を削除しました`, false);
    load();
  };

  const suggest = async () => {
    setSuggesting(true);
    const res = await fetch("/api/training-account/suggest-accounts", { method: "POST" }).then(r => r.json());
    setSuggesting(false);
    if (res.error) { showToast(res.error, false); return; }
    if (!res.suggestions?.length) { showToast("提案できるアカウントが見つかりませんでした", false); return; }
    setSuggestions(res.suggestions);
    const init: Record<string, { score: number; reason: string }> = {};
    res.suggestions.forEach((s: AccountSuggestion) => { init[s.username] = { score: 5, reason: "" }; });
    setSuggestionScores(init);
  };

  const submitFeedback = async () => {
    setSubmitting(true);
    const feedbacks = suggestions.map(s => ({
      xUsername: s.username,
      displayName: s.displayName,
      bio: s.bio,
      xId: s.xId,
      score: suggestionScores[s.username]?.score ?? 5,
      reason: suggestionScores[s.username]?.reason || undefined,
    }));
    const res = await fetch("/api/training-account/account-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedbacks }),
    }).then(r => r.json());
    setSubmitting(false);
    if (res.error) { showToast(res.error, false); return; }
    showToast(`追加 ${res.added}件 / 見送り ${res.rejected}件`);
    setSuggestions([]);
    setSuggestionScores({});
    load();
  };

  return (
    <div className="space-y-6">
      {/* 追加フォーム */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="font-semibold mb-4 text-sm text-gray-300">参考アカウントを追加</h2>
        <div className="flex gap-3 mb-3">
          <input value={username} onChange={e => setUsername(e.target.value)}
            placeholder="@username"
            className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            onKeyDown={e => e.key === "Enter" && !e.nativeEvent.isComposing && add()} />
        </div>
        <div className="flex gap-3">
          <input value={reason} onChange={e => setReason(e.target.value)}
            placeholder="なぜこのアカウントを参考にするか（任意）"
            className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            onKeyDown={e => e.key === "Enter" && !e.nativeEvent.isComposing && add()} />
          <button onClick={() => add()} disabled={adding || !username.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm font-medium">
            {adding ? "追加中..." : "追加"}
          </button>
        </div>
      </div>

      {/* AIによるアカウント提案 */}
      <div className="bg-gray-800 rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-sm text-gray-300">ストラテジーからAI提案</h2>
            <p className="text-xs text-gray-500 mt-0.5">現在のストラテジーに基づき追加すべきアカウントをClaudeが提案します</p>
          </div>
          <button onClick={suggest} disabled={suggesting}
            className="px-3 py-1.5 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 rounded text-xs font-medium shrink-0">
            {suggesting ? "分析中..." : "AIに提案してもらう"}
          </button>
        </div>

        {suggestions.length > 0 && (
          <div className="mt-4 space-y-3">
            {suggestions.map(s => {
              const sc = suggestionScores[s.username] ?? { score: 5, reason: "" };
              const willAdd = sc.score >= 6;
              return (
                <div key={s.username} className={`rounded-lg p-4 border-l-4 ${willAdd ? "bg-gray-700/70 border-green-500" : "bg-gray-700/40 border-red-500/60"}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <a href={`https://x.com/${s.username}`} target="_blank" rel="noopener noreferrer"
                          className="font-medium text-sm text-blue-400 hover:text-blue-300 transition-colors">
                          @{s.username}
                        </a>
                        {s.displayName && <span className="text-gray-400 text-xs">{s.displayName}</span>}
                        <span className={`ml-auto shrink-0 text-xs font-medium px-2 py-0.5 rounded ${willAdd ? "bg-green-900/50 text-green-300" : "bg-red-900/40 text-red-400"}`}>
                          {willAdd ? "追加する" : "見送り"}
                        </span>
                      </div>
                      {s.bio && <div className="text-gray-500 text-xs mt-1 line-clamp-2">{s.bio}</div>}
                      <div className="text-purple-400 text-xs mt-1">{s.reason}</div>
                    </div>
                  </div>

                  {/* スコア */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-400 w-16 shrink-0">スコア: {sc.score}</span>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5,6,7,8,9,10].map(n => (
                        <button key={n} onClick={() => setSuggestionScores(prev => ({ ...prev, [s.username]: { ...sc, score: n } }))}
                          className={`w-6 h-6 rounded text-xs font-medium transition-colors ${n === sc.score ? (n >= 6 ? "bg-green-600 text-white" : "bg-red-600 text-white") : "bg-gray-600 text-gray-300 hover:bg-gray-500"}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 見送り理由（1-5点のとき） */}
                  {!willAdd && (
                    <input
                      value={sc.reason}
                      onChange={e => setSuggestionScores(prev => ({ ...prev, [s.username]: { ...sc, reason: e.target.value } }))}
                      placeholder="見送り理由を入力（ストラテジー改善に使われます）"
                      className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-red-400 text-gray-200 placeholder-gray-500"
                    />
                  )}
                </div>
              );
            })}

            <button onClick={submitFeedback} disabled={submitting}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm font-medium">
              {submitting ? "処理中..." : "評価を確定する"}
            </button>
          </div>
        )}
      </div>

      {/* リスト */}
      <div className="space-y-2">
        {accounts.length === 0 ? (
          <div className="text-gray-500 text-sm text-center py-8">
            まだ参考アカウントがありません。<br />上のフォームから追加してください。
          </div>
        ) : (
          accounts.map(a => (
            <div key={a.id} className="bg-gray-800 rounded-lg p-4 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">@{a.xUsername}</span>
                  {a.displayName && <span className="text-gray-400 text-xs">{a.displayName}</span>}
                </div>
                {a.bio && <div className="text-gray-500 text-xs mt-1 truncate">{a.bio}</div>}
                {a.reason && <div className="text-blue-400 text-xs mt-1">理由: {a.reason}</div>}
              </div>
              <button onClick={() => remove(a.id, a.xUsername)}
                className="text-gray-500 hover:text-red-400 text-xs shrink-0 transition-colors">
                削除
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Tab 2: 運用実行 ──────────────────────────────────────
function SessionTab({ account, showToast }: { account: TrainingAccount; showToast: (msg: string, ok?: boolean) => void }) {
  const [actions, setActions] = useState<TrainingAction[]>([]);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<{ done: number; failed: number; strategyApplied: boolean; strategyGeneration: number | null; weights: Record<string, number> } | null>(null);

  const loadActions = useCallback(async () => {
    const d = await fetch("/api/training-account/actions").then(r => r.json());
    setActions(d.actions ?? []);
  }, []);

  useEffect(() => { loadActions(); }, [loadActions]);

  const run = async () => {
    setRunning(true);
    const res = await fetch("/api/training-account/run-session", { method: "POST" }).then(r => r.json());
    setRunning(false);
    if (res.error) { showToast(res.error, false); return; }
    setLastResult({
      done: res.done,
      failed: res.failed,
      strategyApplied: res.strategyApplied ?? false,
      strategyGeneration: res.strategyGeneration ?? null,
      weights: res.weights ?? {},
    });
    showToast(`セッション完了: ${res.done}件成功 ${res.failed > 0 ? `/ ${res.failed}件失敗` : ""}`);
    loadActions();
  };

  account; // used for token expiry display if needed

  return (
    <div className="space-y-6">
      {/* 実行パネル */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="font-semibold mb-2 text-sm text-gray-300">セッション実行</h2>
        <p className="text-xs text-gray-500 mb-4">
          ストラテジーが存在する場合、Claudeが各アカウントへのいいね数を自動調整します。
          トークンが期限切れの場合は自動更新します。
        </p>

        {lastResult && (
          <div className="mb-4 p-3 bg-gray-700/80 rounded-lg text-xs space-y-2">
            <div className="flex items-center gap-2 text-gray-300">
              <span>成功 {lastResult.done}件</span>
              {lastResult.failed > 0 && <span className="text-red-400">/ 失敗 {lastResult.failed}件</span>}
            </div>
            {lastResult.strategyApplied && (
              <div className="flex items-center gap-1.5 text-purple-400">
                <span>✦</span>
                <span>第{lastResult.strategyGeneration}世代ストラテジーを適用</span>
              </div>
            )}
            {lastResult.strategyApplied && Object.keys(lastResult.weights).length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {Object.entries(lastResult.weights).map(([username, likes]) => (
                  <span key={username} className={`px-2 py-0.5 rounded text-xs ${likes >= 4 ? "bg-green-900/50 text-green-300" : likes <= 1 ? "bg-red-900/30 text-red-400" : "bg-gray-600 text-gray-300"}`}>
                    @{username} {likes}いいね
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <button onClick={run} disabled={running}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded font-medium text-sm">
          {running ? "ストラテジー分析→実行中..." : "セッション実行"}
        </button>
      </div>

      {/* アクションログ */}
      <div>
        <h2 className="font-semibold mb-3 text-sm text-gray-300">アクションログ</h2>
        {actions.length === 0 ? (
          <div className="text-gray-500 text-sm text-center py-6">まだアクションはありません</div>
        ) : (
          <div className="space-y-1.5">
            {actions.map(a => (
              <div key={a.id} className="flex items-center gap-3 bg-gray-800 rounded px-4 py-2.5 text-sm">
                <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${a.type === "follow" ? "bg-purple-900/50 text-purple-300" : "bg-pink-900/50 text-pink-300"}`}>
                  {a.type === "follow" ? "フォロー" : "いいね"}
                </span>
                <span className="text-gray-300">@{a.targetUsername}</span>
                {a.tweetId && <span className="text-gray-600 text-xs truncate">tweet:{a.tweetId}</span>}
                <span className={`ml-auto shrink-0 text-xs ${a.status === "done" ? "text-green-400" : "text-red-400"}`}>
                  {a.status === "done" ? "✓" : "✗"}
                </span>
                <span className="text-gray-600 text-xs shrink-0">
                  {new Date(a.executedAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab 3: タイムライン評価 ──────────────────────────────
function TimelineTab({ showToast }: { showToast: (msg: string, ok?: boolean) => void }) {
  const [posts, setPosts] = useState<TimelinePost[]>([]);
  const [scores, setScores] = useState<Record<string, { score: number; feedback: string }>>({});
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadPosts = useCallback(async () => {
    const d = await fetch("/api/training-account/timeline-posts").then(r => r.json());
    const ps: TimelinePost[] = d.posts ?? [];
    setPosts(ps);
    const init: Record<string, { score: number; feedback: string }> = {};
    ps.forEach(p => { init[p.id] = { score: p.score ?? 5, feedback: p.feedback ?? "" }; });
    setScores(init);
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const fetchTimeline = async () => {
    setFetching(true);
    const res = await fetch("/api/training-account/fetch-timeline", { method: "POST" }).then(r => r.json());
    setFetching(false);
    if (res.error) { showToast(res.error, false); return; }
    showToast(`${res.added}件の新しい投稿を取得しました`);
    loadPosts();
  };

  const save = async () => {
    setSaving(true);
    const payload = Object.entries(scores).map(([id, s]) => ({ id, score: s.score, feedback: s.feedback || undefined }));
    await fetch("/api/training-account/timeline-posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scores: payload }),
    });
    setSaving(false);
    showToast("採点を保存しました");
    loadPosts();
  };

  const unscoredCount = posts.filter(p => p.score === null).length;

  return (
    <div className="space-y-5">
      {/* 操作バー */}
      <div className="flex items-center gap-3">
        <button onClick={fetchTimeline} disabled={fetching}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-sm font-medium">
          {fetching ? "取得中..." : "参考アカウントの投稿を取得"}
        </button>
        {posts.length > 0 && (
          <>
            <span className="text-gray-500 text-xs">{posts.length}件 / 未採点 {unscoredCount}件</span>
            <button onClick={save} disabled={saving}
              className="ml-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm font-medium">
              {saving ? "保存中..." : "採点を保存"}
            </button>
          </>
        )}
      </div>

      {/* 投稿リスト */}
      {posts.length === 0 ? (
        <div className="text-gray-500 text-sm text-center py-8">
          タイムラインを取得してください
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(p => {
            const s = scores[p.id] ?? { score: p.score ?? 5, feedback: p.feedback ?? "" };
            return (
              <div key={p.id} className={`bg-gray-800 rounded-lg p-4 border-l-4 ${s.score >= 7 ? "border-green-500" : s.score <= 3 ? "border-red-500" : "border-gray-600"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {p.authorUsername ? (
                    <a href={`https://x.com/${p.authorUsername}`} target="_blank" rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors">
                      @{p.authorUsername}
                    </a>
                  ) : (
                    <span className="text-gray-500 text-xs">不明</span>
                  )}
                  <span className="text-gray-600 text-xs">
                    {new Date(p.fetchedAt).toLocaleDateString("ja-JP")}
                  </span>
                  {p.authorUsername && (
                    <a href={`https://x.com/${p.authorUsername}/status/${p.tweetId}`} target="_blank" rel="noopener noreferrer"
                      className="text-gray-500 hover:text-gray-300 text-xs transition-colors">
                      投稿を開く →
                    </a>
                  )}
                  {p.scoredAt && <span className="ml-auto text-green-400 text-xs">採点済み</span>}
                </div>
                <p className="text-sm text-gray-200 mb-3 leading-relaxed">{p.content}</p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs text-gray-400 w-6 text-right">{s.score}</span>
                    <input type="range" min={0} max={10} value={s.score}
                      onChange={e => setScores(prev => ({ ...prev, [p.id]: { ...s, score: Number(e.target.value) } }))}
                      className="flex-1 accent-blue-500" />
                    <div className="flex gap-0.5">
                      {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                        <button key={n} onClick={() => setScores(prev => ({ ...prev, [p.id]: { ...s, score: n } }))}
                          className={`w-5 h-5 rounded text-xs transition-colors ${n === s.score ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400 hover:bg-gray-600"}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <input value={s.feedback}
                  onChange={e => setScores(prev => ({ ...prev, [p.id]: { ...s, feedback: e.target.value } }))}
                  placeholder="フィードバック（任意）：なぜこの点数か、何が良い/悪いか"
                  className="mt-2 w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 text-gray-300 placeholder-gray-500" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Tab 2: 探索 ─────────────────────────────────────────
function DiscoveryTab({ showToast }: { showToast: (msg: string, ok?: boolean) => void }) {
  const [references, setReferences] = useState<ReferenceAccount[]>([]);
  const [states, setStates] = useState<DiscoveryState[]>([]);
  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([]);
  const [stats, setStats] = useState({ followedCount: 0, skippedCount: 0, executedCount: 0, pendingFollowCount: 0 });
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [fetching, setFetching] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  // Track local evaluations before sending to API
  const [localActions, setLocalActions] = useState<Record<string, "follow" | "skip">>({});

  const load = useCallback(async () => {
    const [refData, discData] = await Promise.all([
      fetch("/api/training-account/reference-accounts").then(r => r.json()),
      fetch("/api/training-account/discovery").then(r => r.json()),
    ]);
    setReferences(refData.accounts ?? []);
    setStates(discData.states ?? []);
    setCandidates(discData.pendingCandidates ?? []);
    setStats(discData.stats ?? { followedCount: 0, skippedCount: 0, executedCount: 0, pendingFollowCount: 0 });
    setCurrentIndex(0);
    setLocalActions({});
  }, []);

  useEffect(() => { load(); }, [load]);

  // キーボードショートカット
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight" || e.key === "f" || e.key === "l") evaluate("follow");
      if (e.key === "ArrowLeft" || e.key === "s" || e.key === "h") evaluate("skip");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const evaluate = async (action: "follow" | "skip") => {
    const candidate = candidates[currentIndex];
    if (!candidate) return;

    // ローカル状態を即座に更新
    setLocalActions(prev => ({ ...prev, [candidate.id]: action }));

    // APIに非同期送信
    fetch("/api/training-account/discovery/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evaluations: [{ id: candidate.id, action }] }),
    }).catch(() => {});

    // 次のカードへ
    if (currentIndex < candidates.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // 全件評価完了
      showToast("全ての候補を評価しました");
      setTimeout(() => load(), 500);
    }
  };

  const fetchFollowers = async () => {
    if (!selectedSource) { showToast("探索元アカウントを選択してください", false); return; }
    setFetching(true);
    const res = await fetch("/api/training-account/discovery/fetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceUsername: selectedSource }),
    }).then(r => r.json());
    setFetching(false);
    if (res.error) { showToast(res.error, false); return; }
    showToast(`${res.fetched}人取得 → AI選別: ${res.filtered}人が候補に追加${res.hasMore ? "（次ページあり）" : "（完了）"}`);
    load();
  };

  const executeFollows = async () => {
    setExecuting(true);
    const res = await fetch("/api/training-account/discovery/execute-follows", { method: "POST" }).then(r => r.json());
    setExecuting(false);
    if (res.error) { showToast(res.error, false); return; }
    showToast(`フォロー完了: ${res.done}件成功${res.failed > 0 ? ` / ${res.failed}件失敗` : ""}`);
    load();
  };

  const currentCandidate = candidates[currentIndex];
  const progress = candidates.length > 0 ? `${currentIndex + 1} / ${candidates.length}` : null;
  const sourceState = states.find(s => s.sourceUsername === selectedSource);

  return (
    <div className="space-y-5">
      {/* 探索設定パネル */}
      <div className="bg-gray-800 rounded-lg p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="font-semibold text-sm text-gray-300 mb-1">グラフ探索</h2>
            <p className="text-xs text-gray-500">参考アカウントのフォロワーを取得し、Claudeが起業家候補を選別します</p>
            <p className="text-xs text-amber-500/80 mt-1">⚠ 1回の探索で100人取得（コスト管理のため上限設定）。繰り返し実行で続きを取得できます</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={selectedSource}
              onChange={e => setSelectedSource(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 min-w-40"
            >
              <option value="">参考アカウントを選択</option>
              {references.map(r => (
                <option key={r.id} value={r.xUsername}>@{r.xUsername}</option>
              ))}
            </select>
            <button
              onClick={fetchFollowers}
              disabled={fetching || !selectedSource}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm font-medium whitespace-nowrap"
            >
              {fetching ? "取得中..." : "探索開始"}
            </button>
          </div>
        </div>

        {/* 探索状態 */}
        {selectedSource && sourceState && (
          <div className="mt-3 text-xs text-gray-500 flex items-center gap-3">
            <span>累計取得: {sourceState.totalFetched.toLocaleString()}人</span>
            {sourceState.paginationToken && <span className="text-blue-400">次ページあり → 再度「探索開始」で続きを取得</span>}
            {!sourceState.paginationToken && <span className="text-green-400">✓ このアカウントのフォロワーは全て探索済み</span>}
          </div>
        )}
      </div>

      {/* 統計 */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "評価待ち", value: candidates.length, color: "text-yellow-300" },
          { label: "フォロー予定", value: stats.pendingFollowCount, color: "text-green-300" },
          { label: "フォロー済", value: stats.executedCount, color: "text-blue-300" },
          { label: "スキップ", value: stats.skippedCount, color: "text-gray-400" },
        ].map(s => (
          <div key={s.label} className="bg-gray-800 rounded-lg p-3 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* フォロー実行 */}
      {stats.pendingFollowCount > 0 && (
        <div className="bg-green-900/20 border border-green-700/40 rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-green-300">{stats.pendingFollowCount}人へのフォロー準備完了</div>
            <div className="text-xs text-gray-400 mt-0.5">評価済みの「フォロー」候補をまとめてフォローします</div>
          </div>
          <button
            onClick={executeFollows}
            disabled={executing}
            className="px-5 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 rounded text-sm font-medium shrink-0"
          >
            {executing ? "実行中..." : "フォロー実行"}
          </button>
        </div>
      )}

      {/* カード評価UI */}
      {candidates.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm bg-gray-800 rounded-lg">
          <p className="mb-1">評価待ちの候補がいません</p>
          <p className="text-xs">上の「探索開始」でフォロワーを取得してください</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* プログレスバー */}
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-700 rounded-full h-1.5">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all"
                style={{ width: `${(currentIndex / candidates.length) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-400 shrink-0">{progress}</span>
          </div>

          {/* メインカード */}
          {currentCandidate && (
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              {/* ヘッダー */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://x.com/${currentCandidate.xUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-lg font-bold text-blue-400 hover:text-blue-300"
                    >
                      @{currentCandidate.xUsername}
                    </a>
                    {currentCandidate.displayName && (
                      <span className="text-gray-300 text-sm">{currentCandidate.displayName}</span>
                    )}
                  </div>
                  {/* フォロワー数など */}
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    {currentCandidate.followersCount != null && (
                      <span>フォロワー {currentCandidate.followersCount.toLocaleString()}</span>
                    )}
                    {currentCandidate.followingCount != null && (
                      <span>フォロー中 {currentCandidate.followingCount.toLocaleString()}</span>
                    )}
                    {currentCandidate.tweetCount != null && (
                      <span>ツイート {currentCandidate.tweetCount.toLocaleString()}</span>
                    )}
                  </div>
                </div>
                {currentCandidate.aiScore != null && (
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${currentCandidate.aiScore >= 8 ? "text-green-400" : currentCandidate.aiScore >= 6 ? "text-yellow-400" : "text-gray-400"}`}>
                      {currentCandidate.aiScore}
                    </div>
                    <div className="text-xs text-gray-500">AIスコア</div>
                  </div>
                )}
              </div>

              {/* bio */}
              {currentCandidate.bio && (
                <p className="text-sm text-gray-200 mb-3 leading-relaxed">{currentCandidate.bio}</p>
              )}

              {/* AI選別理由 */}
              {currentCandidate.aiReason && (
                <div className="text-xs text-purple-400 bg-purple-900/20 rounded px-3 py-1.5 mb-4">
                  ✦ {currentCandidate.aiReason}
                </div>
              )}

              {/* 探索元 */}
              <div className="text-xs text-gray-600 mb-5">
                探索元: @{currentCandidate.sourceUsername}
              </div>

              {/* アクションボタン */}
              <div className="flex gap-3">
                <button
                  onClick={() => evaluate("skip")}
                  className="flex-1 py-3 bg-gray-700 hover:bg-red-900/40 border border-gray-600 hover:border-red-500/50 rounded-lg text-sm font-medium text-gray-300 hover:text-red-300 transition-all"
                >
                  ← スキップ (S)
                </button>
                <button
                  onClick={() => evaluate("follow")}
                  className="flex-1 py-3 bg-gray-700 hover:bg-green-900/40 border border-gray-600 hover:border-green-500/50 rounded-lg text-sm font-medium text-gray-300 hover:text-green-300 transition-all"
                >
                  フォロー (F) →
                </button>
              </div>
            </div>
          )}

          {/* キューのプレビュー（次の数件） */}
          {candidates.slice(currentIndex + 1, currentIndex + 4).length > 0 && (
            <div className="space-y-2">
              {candidates.slice(currentIndex + 1, currentIndex + 4).map((c, i) => (
                <div key={c.id} className={`bg-gray-800/60 rounded-lg px-4 py-2.5 flex items-center gap-3 opacity-${i === 0 ? "60" : i === 1 ? "40" : "20"}`}>
                  <span className="text-sm text-gray-400">@{c.xUsername}</span>
                  {c.displayName && <span className="text-xs text-gray-600">{c.displayName}</span>}
                  {c.aiScore && <span className="ml-auto text-xs text-gray-500">AI:{c.aiScore}</span>}
                </div>
              ))}
            </div>
          )}

          {/* キーボードショートカット説明 */}
          <div className="text-center text-xs text-gray-600">
            キーボード: ← または S でスキップ / → または F でフォロー
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab 4: ストラテジー ──────────────────────────────────
function StrategyTab({ showToast }: { showToast: (msg: string, ok?: boolean) => void }) {
  const [strategies, setStrategies] = useState<TrainingStrategy[]>([]);
  const [evolving, setEvolving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadStrategies = useCallback(async () => {
    const r = await fetch("/api/training-account/strategies").then(r => r.json()).catch(() => ({ strategies: [] }));
    setStrategies(r.strategies ?? []);
  }, []);

  useEffect(() => { loadStrategies(); }, [loadStrategies]);

  const evolve = async () => {
    setEvolving(true);
    const res = await fetch("/api/training-account/evolve-strategy", { method: "POST" }).then(r => r.json());
    setEvolving(false);
    if (res.error) { showToast(res.error, false); return; }
    showToast(`第${res.strategy.generation}世代のストラテジーを生成しました`);
    loadStrategies();
    setExpanded(res.strategy.id);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-sm text-gray-300">運用ストラテジー</h2>
          <p className="text-xs text-gray-500 mt-1">採点済みフィードバックからClaudeが最適な運用方針を生成します</p>
        </div>
        <button onClick={evolve} disabled={evolving}
          className="px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 rounded text-sm font-medium">
          {evolving ? "生成中..." : "ストラテジーを進化させる"}
        </button>
      </div>

      {strategies.length === 0 ? (
        <div className="text-gray-500 text-sm text-center py-8 bg-gray-800 rounded-lg">
          <p>まだストラテジーがありません</p>
          <p className="text-xs mt-1">タイムライン評価タブで採点後、「ストラテジーを進化させる」を押してください</p>
        </div>
      ) : (
        <div className="space-y-3">
          {strategies.map((s, i) => (
            <div key={s.id} className={`bg-gray-800 rounded-lg overflow-hidden ${i === 0 ? "ring-1 ring-purple-500/50" : ""}`}>
              <button onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${i === 0 ? "bg-purple-900/60 text-purple-300" : "bg-gray-700 text-gray-400"}`}>
                    第{s.generation}世代
                  </span>
                  {i === 0 && <span className="text-xs text-purple-400">最新</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-xs">
                    {new Date(s.createdAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="text-gray-400 text-xs">{expanded === s.id ? "▲" : "▼"}</span>
                </div>
              </button>
              {expanded === s.id && (
                <div className="px-4 pb-4 pt-1 border-t border-gray-700">
                  <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{s.content}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
