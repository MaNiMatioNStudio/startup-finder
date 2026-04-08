"use client";

interface ScoreBarProps {
  label: string;
  score: number;
  color?: string;
}

export function ScoreBar({ label, score, color = "bg-blue-500" }: ScoreBarProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-16 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-sm font-semibold w-8 text-right">{score}</span>
    </div>
  );
}
