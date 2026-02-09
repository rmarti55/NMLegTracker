"use client";

interface VoteChartProps {
  yea: number;
  nay: number;
  nv: number;
  absent: number;
  total: number;
  passed: boolean;
  showLabels?: boolean;
  size?: "sm" | "md" | "lg";
}

export default function VoteChart({
  yea,
  nay,
  nv,
  absent,
  total,
  passed,
  showLabels = true,
  size = "md",
}: VoteChartProps) {
  const yeaPercent = total > 0 ? (yea / total) * 100 : 0;
  const nayPercent = total > 0 ? (nay / total) * 100 : 0;
  const nvPercent = total > 0 ? (nv / total) * 100 : 0;
  const absentPercent = total > 0 ? (absent / total) * 100 : 0;

  const heights = {
    sm: "h-4",
    md: "h-6",
    lg: "h-8",
  };

  return (
    <div className="w-full">
      {/* Bar chart */}
      <div className={`flex ${heights[size]} rounded-full overflow-hidden bg-gray-100`}>
        {yeaPercent > 0 && (
          <div
            className="bg-green-500 transition-all"
            style={{ width: `${yeaPercent}%` }}
            title={`Yea: ${yea}`}
          />
        )}
        {nayPercent > 0 && (
          <div
            className="bg-red-500 transition-all"
            style={{ width: `${nayPercent}%` }}
            title={`Nay: ${nay}`}
          />
        )}
        {nvPercent > 0 && (
          <div
            className="bg-yellow-400 transition-all"
            style={{ width: `${nvPercent}%` }}
            title={`NV: ${nv}`}
          />
        )}
        {absentPercent > 0 && (
          <div
            className="bg-gray-300 transition-all"
            style={{ width: `${absentPercent}%` }}
            title={`Absent: ${absent}`}
          />
        )}
      </div>

      {/* Labels */}
      {showLabels && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span className="text-gray-600">Yea: <span className="font-medium">{yea}</span></span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            <span className="text-gray-600">Nay: <span className="font-medium">{nay}</span></span>
          </span>
          {nv > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
              <span className="text-gray-600">NV: <span className="font-medium">{nv}</span></span>
            </span>
          )}
          {absent > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-gray-300"></span>
              <span className="text-gray-600">Absent: <span className="font-medium">{absent}</span></span>
            </span>
          )}
          <span className={`ml-auto font-medium ${passed ? "text-green-600" : "text-red-600"}`}>
            {passed ? "Passed" : "Failed"}
          </span>
        </div>
      )}
    </div>
  );
}

// Compact inline version for tables/lists
export function VoteChartInline({
  yea,
  nay,
  passed,
}: {
  yea: number;
  nay: number;
  passed: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className="text-green-600 font-medium">{yea}</span>
      <span className="text-gray-400">-</span>
      <span className="text-red-600 font-medium">{nay}</span>
      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
        passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
      }`}>
        {passed ? "P" : "F"}
      </span>
    </span>
  );
}
