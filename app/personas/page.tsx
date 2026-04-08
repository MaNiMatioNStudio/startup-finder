"use client";

import { useEffect, useState } from "react";

interface Persona {
  id: string;
  version: string;
  versionNumber: number;
  content: string;
  isActive: boolean;
  reasoning: string | null;
  predictedScore: number | null;
  actualScore: number | null;
  candidateCount: number;
  createdAt: string;
}

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selected, setSelected] = useState<Persona | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editReasoning, setEditReasoning] = useState("");
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);

  useEffect(() => {
    fetchPersonas();
  }, []);

  async function fetchPersonas() {
    const res = await fetch("/api/personas");
    if (res.ok) {
      const data: Persona[] = await res.json();
      setPersonas(data);
      if (!selected && data.length > 0) {
        setSelected(data.find((p) => p.isActive) ?? data[0]);
      }
    }
  }

  async function handleActivate(id: string) {
    setActivating(id);
    await fetch(`/api/personas/${id}/activate`, { method: "POST" });
    setActivating(null);
    fetchPersonas();
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/personas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editContent, reasoning: editReasoning }),
    });
    if (res.ok) {
      setEditing(false);
      fetchPersonas();
    }
    setSaving(false);
  }

  function startEdit() {
    setEditContent(selected?.content ?? "");
    setEditReasoning("");
    setEditing(true);
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Persona Prompts</h1>
          <p className="text-gray-500 text-sm mt-1">起業家ペルソナの定義とバージョン管理</p>
        </div>
        <button
          onClick={startEdit}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          + 新バージョンを作成
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Version list */}
        <div className="col-span-1 space-y-2">
          {personas.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                selected?.id === p.id
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm">{p.version}</span>
                {p.isActive && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">active</span>
                )}
              </div>
              <div className="text-xs text-gray-400">
                候補 {p.candidateCount}名
                {p.actualScore !== null && ` · 平均 ${p.actualScore.toFixed(1)}/5`}
              </div>
              {p.reasoning && (
                <div className="text-xs text-gray-500 mt-1 line-clamp-1">{p.reasoning}</div>
              )}
            </button>
          ))}
        </div>

        {/* Content editor / viewer */}
        <div className="col-span-2">
          {editing ? (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="font-semibold text-gray-900 mb-4">新バージョンを作成</h2>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  変更理由 (任意)
                </label>
                <input
                  type="text"
                  value={editReasoning}
                  onChange={(e) => setEditReasoning(e.target.value)}
                  placeholder="例: フィードバックを受けて受託除外を強化"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  プロンプト内容
                </label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={20}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? "保存中..." : "保存して有効化"}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : selected ? (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-gray-900">{selected.version}</h2>
                  {selected.reasoning && (
                    <p className="text-gray-500 text-sm mt-0.5">{selected.reasoning}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {!selected.isActive && (
                    <button
                      onClick={() => handleActivate(selected.id)}
                      disabled={activating === selected.id}
                      className="text-sm px-3 py-1.5 border border-indigo-500 text-indigo-600 rounded-lg hover:bg-indigo-50 disabled:opacity-50"
                    >
                      {activating === selected.id ? "..." : "有効化"}
                    </button>
                  )}
                  <button
                    onClick={startEdit}
                    className="text-sm px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
                  >
                    このバージョンを元に編集
                  </button>
                </div>
              </div>

              {(selected.actualScore !== null || selected.predictedScore !== null) && (
                <div className="flex gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
                  {selected.actualScore !== null && (
                    <div className="text-sm">
                      <span className="text-gray-500">実際のスコア: </span>
                      <span className="font-semibold">{selected.actualScore.toFixed(2)}/5</span>
                    </div>
                  )}
                  {selected.predictedScore !== null && (
                    <div className="text-sm">
                      <span className="text-gray-500">予測改善率: </span>
                      <span className={`font-semibold ${selected.predictedScore > 0 ? "text-green-600" : "text-red-500"}`}>
                        {selected.predictedScore > 0 ? "+" : ""}{selected.predictedScore}%
                      </span>
                    </div>
                  )}
                </div>
              )}

              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono bg-gray-50 rounded-lg p-4 leading-relaxed">
                {selected.content}
              </pre>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
