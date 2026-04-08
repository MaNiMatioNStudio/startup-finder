"use client";

import { useEffect, useState } from "react";

interface Persona {
  id: string;
  version: string;
  versionNumber: number;
  isActive: boolean;
  reasoning: string | null;
  predictedScore: number | null;
  actualScore: number | null;
  candidateCount: number;
  createdAt: string;
}

export default function HistoryPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [compareA, setCompareA] = useState<string>("");
  const [compareB, setCompareB] = useState<string>("");

  useEffect(() => {
    fetch("/api/personas")
      .then((r) => r.json())
      .then((data: Persona[]) => {
        setPersonas(data);
        if (data.length >= 2) {
          setCompareA(data[0].id);
          setCompareB(data[1].id);
        } else if (data.length === 1) {
          setCompareA(data[0].id);
        }
      });
  }, []);

  const personaA = personas.find((p) => p.id === compareA);
  const personaB = personas.find((p) => p.id === compareB);

  const maxScore = Math.max(...personas.map((p) => p.actualScore ?? 0), 5);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">History & Analysis</h1>
        <p className="text-gray-500 text-sm mt-1">バージョン比較とパフォーマンス分析</p>
      </div>

      {/* Score timeline chart */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">スコア推移</h2>
        {personas.length === 0 ? (
          <div className="text-gray-400 text-sm text-center py-8">データがありません</div>
        ) : (
          <div className="relative">
            <div className="flex items-end gap-3 h-40">
              {[...personas].reverse().map((p) => {
                const height = p.actualScore !== null
                  ? Math.max(8, (p.actualScore / maxScore) * 100)
                  : 8;
                return (
                  <div key={p.id} className="flex flex-col items-center gap-1 flex-1">
                    <div className="text-xs text-gray-500 font-medium">
                      {p.actualScore !== null ? p.actualScore.toFixed(1) : "—"}
                    </div>
                    <div
                      className={`w-full rounded-t-md transition-all ${
                        p.isActive ? "bg-indigo-500" : "bg-gray-200"
                      }`}
                      style={{ height: `${height}%` }}
                    />
                    <div className="text-xs text-gray-400 text-center">{p.version}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Version comparison */}
      {personas.length >= 2 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">バージョン比較</h2>
          <div className="flex gap-4 mb-5">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">バージョンA</label>
              <select
                value={compareA}
                onChange={(e) => setCompareA(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>{p.version}{p.isActive ? " (active)" : ""}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end pb-2 text-gray-400">vs</div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">バージョンB</label>
              <select
                value={compareB}
                onChange={(e) => setCompareB(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>{p.version}{p.isActive ? " (active)" : ""}</option>
                ))}
              </select>
            </div>
          </div>

          {personaA && personaB && (
            <div className="grid grid-cols-3 gap-4">
              <div className="border border-gray-100 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-3 font-medium">{personaA.version}</div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">候補数: </span>
                    <span className="font-medium">{personaA.candidateCount}名</span>
                  </div>
                  <div>
                    <span className="text-gray-500">平均スコア: </span>
                    <span className="font-medium">
                      {personaA.actualScore !== null ? `${personaA.actualScore.toFixed(2)}/5` : "未評価"}
                    </span>
                  </div>
                  {personaA.reasoning && (
                    <div className="text-xs text-gray-400 mt-2">{personaA.reasoning}</div>
                  )}
                </div>
              </div>

              <div className="border border-indigo-100 bg-indigo-50 rounded-lg p-4 flex flex-col items-center justify-center">
                {personaA.actualScore !== null && personaB.actualScore !== null ? (
                  <>
                    <div className={`text-2xl font-bold ${
                      personaA.actualScore > personaB.actualScore ? "text-green-600" :
                      personaA.actualScore < personaB.actualScore ? "text-red-500" : "text-gray-500"
                    }`}>
                      {personaA.actualScore > personaB.actualScore ? "↑" :
                       personaA.actualScore < personaB.actualScore ? "↓" : "="}
                      {Math.abs(personaA.actualScore - personaB.actualScore).toFixed(2)}
                    </div>
                    <div className="text-xs text-indigo-600 mt-1">スコア差</div>
                  </>
                ) : (
                  <div className="text-xs text-gray-400 text-center">
                    両バージョンにスコアデータが必要です
                  </div>
                )}
              </div>

              <div className="border border-gray-100 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-3 font-medium">{personaB.version}</div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">候補数: </span>
                    <span className="font-medium">{personaB.candidateCount}名</span>
                  </div>
                  <div>
                    <span className="text-gray-500">平均スコア: </span>
                    <span className="font-medium">
                      {personaB.actualScore !== null ? `${personaB.actualScore.toFixed(2)}/5` : "未評価"}
                    </span>
                  </div>
                  {personaB.reasoning && (
                    <div className="text-xs text-gray-400 mt-2">{personaB.reasoning}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* All versions table */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="font-semibold text-gray-900 mb-4">全バージョン一覧</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-xs text-gray-500 pb-2 font-medium">バージョン</th>
              <th className="text-right text-xs text-gray-500 pb-2 font-medium">候補数</th>
              <th className="text-right text-xs text-gray-500 pb-2 font-medium">平均スコア</th>
              <th className="text-right text-xs text-gray-500 pb-2 font-medium">作成日</th>
              <th className="text-right text-xs text-gray-500 pb-2 font-medium">状態</th>
            </tr>
          </thead>
          <tbody>
            {personas.map((p) => (
              <tr key={p.id} className="border-b border-gray-50 last:border-0">
                <td className="py-2.5 font-medium">{p.version}</td>
                <td className="py-2.5 text-right text-gray-600">{p.candidateCount}名</td>
                <td className="py-2.5 text-right font-semibold">
                  {p.actualScore !== null ? (
                    <span className={p.actualScore >= 3.5 ? "text-green-600" : "text-gray-500"}>
                      {p.actualScore.toFixed(2)}/5
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="py-2.5 text-right text-gray-400">
                  {new Date(p.createdAt).toLocaleDateString("ja-JP")}
                </td>
                <td className="py-2.5 text-right">
                  {p.isActive ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">active</span>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
