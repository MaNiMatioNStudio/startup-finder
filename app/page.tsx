"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface PersonaPrompt {
  id: string;
  version: string;
  isActive: boolean;
  actualScore: number | null;
  candidateCount: number;
  createdAt: string;
}

interface Evolution {
  id: string;
  systemReasoning: string;
  changes: string;
  predictedImprovement: number | null;
  createdAt: string;
  fromVersion: { version: string; actualScore: number | null };
  toVersion: { version: string; actualScore: number | null };
}

export default function Dashboard() {
  const [activePersona, setActivePersona] = useState<PersonaPrompt | null>(null);
  const [evolutions, setEvolutions] = useState<Evolution[]>([]);
  const [unscoredCount, setUnscoredCount] = useState(0);
  const [seeding, setSeeding] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [personasRes, evolutionsRes, scoringRes] = await Promise.all([
      fetch("/api/personas"),
      fetch("/api/evolution"),
      fetch("/api/scoring"),
    ]);

    if (personasRes.ok) {
      const personas: PersonaPrompt[] = await personasRes.json();
      setActivePersona(personas.find((p) => p.isActive) ?? null);
      if (personas.length > 0) setSeeded(true);
    }

    if (evolutionsRes.ok) {
      setEvolutions(await evolutionsRes.json());
    }

    if (scoringRes.ok) {
      const candidates = await scoringRes.json();
      setUnscoredCount(Array.isArray(candidates) ? candidates.length : 0);
    }
  }

  async function handleSeed() {
    setSeeding(true);
    await fetch("/api/seed", { method: "POST" });
    setSeeding(false);
    setSeeded(true);
    fetchData();
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">プロンプト駆動型 起業家発掘システム</p>
      </div>

      {!seeded && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8">
          <h2 className="font-semibold text-amber-900 mb-2">初期設定が必要です</h2>
          <p className="text-amber-700 text-sm mb-4">
            初回利用時はシードデータを作成してください。Persona / Extraction / Evaluation の初期プロンプトが作成されます。
          </p>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
          >
            {seeding ? "作成中..." : "初期データを作成する"}
          </button>
        </div>
      )}

      {activePersona && (
        <div className="bg-indigo-950 text-white rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-indigo-300 text-xs font-medium uppercase tracking-wide mb-1">Active Persona</div>
              <div className="text-xl font-bold">{activePersona.version}</div>
            </div>
            <div className="text-right">
              <div className="text-indigo-300 text-xs mb-1">候補数</div>
              <div className="text-2xl font-bold">{activePersona.candidateCount}</div>
            </div>
            {activePersona.actualScore !== null && (
              <div className="text-right">
                <div className="text-indigo-300 text-xs mb-1">平均スコア</div>
                <div className="text-2xl font-bold">
                  {activePersona.actualScore.toFixed(1)}
                  <span className="text-sm text-indigo-300">/5</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-8">
        <Link
          href="/scoring"
          className={`rounded-xl p-5 border transition-all ${
            unscoredCount > 0
              ? "bg-orange-50 border-orange-200 hover:bg-orange-100"
              : "bg-white border-gray-200 hover:bg-gray-50"
          }`}
        >
          <div className={`text-2xl font-bold mb-1 ${unscoredCount > 0 ? "text-orange-600" : "text-gray-400"}`}>
            {unscoredCount}
          </div>
          <div className="text-sm font-medium text-gray-700">スコア待ち候補</div>
          <div className="text-xs text-gray-400 mt-1">今すぐ評価する →</div>
        </Link>

        <Link href="/evolution" className="bg-white border border-gray-200 rounded-xl p-5 hover:bg-gray-50 transition-all">
          <div className="text-2xl font-bold text-gray-700 mb-1">{evolutions.length}</div>
          <div className="text-sm font-medium text-gray-700">プロンプト進化回数</div>
          <div className="text-xs text-gray-400 mt-1">進化ログを見る →</div>
        </Link>

        <Link href="/candidates" className="bg-white border border-gray-200 rounded-xl p-5 hover:bg-gray-50 transition-all">
          <div className="text-2xl font-bold text-gray-700 mb-1">{activePersona?.candidateCount ?? 0}</div>
          <div className="text-sm font-medium text-gray-700">候補一覧</div>
          <div className="text-xs text-gray-400 mt-1">全候補を見る →</div>
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="font-semibold text-gray-900 mb-4">最近の進化ログ</h2>
        {evolutions.length === 0 ? (
          <div className="text-gray-400 text-sm py-4 text-center">
            まだ進化履歴はありません。候補を評価してフィードバックを送るとプロンプトが自動改善されます。
          </div>
        ) : (
          <div className="space-y-3">
            {evolutions.slice(0, 5).map((evo) => {
              const changes = JSON.parse(evo.changes) as Array<{ type: string; description: string }>;
              return (
                <div key={evo.id} className="flex items-start gap-4 py-3 border-b border-gray-100 last:border-0">
                  <div className="text-xs text-gray-400 w-24 shrink-0 mt-0.5">
                    {evo.fromVersion.version} → {evo.toVersion.version}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-1.5 mb-1">
                      {changes.map((c, i) => (
                        <span
                          key={i}
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            c.type === "add"
                              ? "bg-green-100 text-green-700"
                              : c.type === "remove"
                              ? "bg-red-100 text-red-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {c.type === "add" ? "+" : c.type === "remove" ? "-" : "~"} {c.description}
                        </span>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500 line-clamp-1">
                      {evo.systemReasoning.slice(0, 120)}...
                    </div>
                  </div>
                  {evo.predictedImprovement !== null && (
                    <div
                      className={`text-xs font-semibold shrink-0 ${
                        evo.predictedImprovement > 0 ? "text-green-600" : "text-red-500"
                      }`}
                    >
                      {evo.predictedImprovement > 0 ? "+" : ""}
                      {evo.predictedImprovement}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
