"use client";

interface ScoreStarsProps {
  value: number;
  onChange: (v: number) => void;
}

export function ScoreStars({ value, onChange }: ScoreStarsProps) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={`w-9 h-9 rounded-lg text-sm font-semibold transition-all border ${
            value === n
              ? "bg-indigo-600 text-white border-indigo-600 scale-110"
              : "bg-white text-gray-400 border-gray-200 hover:border-indigo-400 hover:text-indigo-500"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
